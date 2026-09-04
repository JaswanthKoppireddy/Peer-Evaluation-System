"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuizAnomalyStatus = exports.getQuizSubmissions = exports.submitQuiz = exports.getQuizzes = exports.createQuiz = void 0;
const Quiz_1 = __importDefault(require("../models/Quiz"));
const QuizSubmission_1 = __importDefault(require("../models/QuizSubmission"));
const User_1 = __importDefault(require("../models/User"));
const Group_1 = __importDefault(require("../models/Group"));
const ANOMALY_CLOSE_THRESHOLD = 3;
const sanitizeQuizSubmissionForStudent = (submission) => {
    const raw = typeof submission?.toObject === 'function' ? submission.toObject() : submission;
    if (!raw)
        return raw;
    if (raw.resultStatus === 'escalated' || raw.anomalyStatus === 'escalated') {
        return {
            ...raw,
            score: null,
            totalQuestions: null,
        };
    }
    return raw;
};
const createQuiz = async (req, res) => {
    try {
        const { title, description, groupId, questions, timeLimit } = req.body;
        const quiz = await Quiz_1.default.create({
            title, description, groupId, questions, timeLimit, teacherId: req.user._id
        });
        res.status(201).json(quiz);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating quiz' });
    }
};
exports.createQuiz = createQuiz;
const getQuizzes = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'Teacher') {
            // Teacher sees only their own quizzes
            query.teacherId = req.user._id;
        }
        else if (req.user.role === 'Student') {
            // Find every group this student belongs to
            const studentGroups = await Group_1.default.find({ studentIds: req.user._id }).select('_id');
            const groupIds = studentGroups.map(g => g._id);
            // Return quizzes that are either:
            //  (a) Open to all (no groupId set), OR
            //  (b) Targeted at a group the student is in
            query = {
                $or: [
                    { groupId: { $exists: false } },
                    { groupId: null },
                    { groupId: { $in: groupIds } },
                ],
            };
        }
        else if (req.user.role === 'TA') {
            // TA sees quizzes for their linked teacher
            const ta = await User_1.default.findById(req.user._id).select('teacherId');
            if (ta && ta.teacherId) {
                query.teacherId = ta.teacherId;
            }
        }
        const quizzes = await Quiz_1.default.find(query)
            .populate('groupId', 'name')
            .populate('teacherId', '_id name uniqueId')
            .sort({ createdAt: -1 });
        res.json(quizzes);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching quizzes' });
    }
};
exports.getQuizzes = getQuizzes;
const submitQuiz = async (req, res) => {
    try {
        const { quizId, answers, timeTaken, tabSwitches } = req.body;
        const quiz = await Quiz_1.default.findById(quizId).populate('teacherId', 'name uniqueId');
        if (!quiz)
            return res.status(404).json({ message: 'Quiz not found' });
        // ── Group Access Guard ──────────────────────────────────────────────────
        // If this quiz targets a specific group, the submitting student must be in it
        if (quiz.groupId) {
            const group = await Group_1.default.findById(quiz.groupId).select('studentIds');
            const isMember = group?.studentIds?.some((sId) => sId.toString() === req.user._id.toString());
            if (!isMember) {
                return res.status(403).json({ message: 'Access denied: you are not in the designated group for this quiz.' });
            }
        }
        // Check if submission already exists for this student and quiz
        const existingSubmission = await QuizSubmission_1.default.findOne({ quizId, studentId: req.user._id });
        if (existingSubmission) {
            return res.status(400).json({
                message: 'Quiz Successfully Submitted',
                submitted: true,
                submission: existingSubmission
            });
        }
        let score = 0;
        quiz.questions.forEach((q, index) => {
            if (answers[index] === q.correctIndex)
                score++;
        });
        const anomalyFlags = [];
        if (tabSwitches > 0)
            anomalyFlags.push(`Tab switched ${tabSwitches} time(s)`);
        if (timeTaken > 0 && timeTaken < (quiz.questions.length * 2)) {
            anomalyFlags.push('Completed suspiciously fast');
        }
        if (tabSwitches >= ANOMALY_CLOSE_THRESHOLD) {
            anomalyFlags.push(`Escalated: exceeded max tab switches (${ANOMALY_CLOSE_THRESHOLD})`);
        }
        const percentage = Math.round((score / quiz.questions.length) * 100);
        const isEscalated = tabSwitches >= ANOMALY_CLOSE_THRESHOLD;
        const resultStatus = isEscalated ? 'escalated' : percentage >= 50 ? 'passed' : 'failed';
        const anomalyStatus = anomalyFlags.length > 0 ? (isEscalated ? 'escalated' : 'open') : 'none';
        const submission = await QuizSubmission_1.default.create({
            quizId,
            studentId: req.user._id,
            score,
            totalQuestions: quiz.questions.length,
            timeTaken,
            tabSwitches: tabSwitches || 0,
            anomalyFlags,
            anomalyStatus,
            resultStatus,
            escalatedAt: isEscalated ? new Date() : null,
            escalatedReason: isEscalated ? 'Auto escalated due to repeated tab switches.' : '',
        });
        // Populate the submission with student and quiz details for socket.io
        await submission.populate(['studentId', 'quizId']);
        // Emit socket event to teacher dashboard
        const io = req.app.get('io');
        if (io) {
            io.to('teacher_room').emit('quizSubmitted', {
                quizId: quiz._id,
                quizTitle: quiz.title,
                studentId: req.user._id,
                studentName: req.user.name,
                studentUniqueId: req.user.uniqueId,
                score,
                totalQuestions: quiz.questions.length,
                percentage: Math.round((score / quiz.questions.length) * 100),
                timestamp: new Date()
            });
            // If this submission has anomaly flags (i.e., tab switches detected),
            // push it to the TA room immediately so the TA dashboard shows it live
            // without requiring a manual refresh.
            if (anomalyFlags.length > 0 && anomalyStatus !== 'none') {
                io.to('ta_room').emit('persistedAnomaly', {
                    submissionId: submission._id,
                    studentId: req.user._id,
                    studentName: req.user.name,
                    studentUniqueId: req.user.uniqueId,
                    quizId: quiz._id,
                    quizTitle: quiz.title,
                    anomalyFlags,
                    anomalyStatus,
                    resultStatus,
                    score,
                    totalQuestions: quiz.questions.length,
                    tabSwitches: tabSwitches || 0,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        if (req.user.role === 'Student') {
            return res.status(201).json(sanitizeQuizSubmissionForStudent(submission));
        }
        res.status(201).json(submission);
    }
    catch (error) {
        res.status(500).json({ message: 'Error submitting quiz' });
    }
};
exports.submitQuiz = submitQuiz;
const getQuizSubmissions = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'Student') {
            query = { studentId: req.user._id };
        }
        else if (req.user.role === 'Teacher') {
            // Only submissions for quizzes created by this teacher
            const teacherQuizzes = await Quiz_1.default.find({ teacherId: req.user._id }).select('_id');
            query = { quizId: { $in: teacherQuizzes.map(q => q._id) } };
        }
        else if (req.user.role === 'TA') {
            // TA sees submissions for their linked teacher's quizzes
            const ta = await User_1.default.findById(req.user._id).select('teacherId');
            if (ta && ta.teacherId) {
                const teacherQuizzes = await Quiz_1.default.find({ teacherId: ta.teacherId }).select('_id');
                query = { quizId: { $in: teacherQuizzes.map(q => q._id) } };
            }
        }
        const submissions = await QuizSubmission_1.default.find(query)
            .populate('quizId', 'title teacherId')
            .populate('studentId', 'name email uniqueId')
            .sort({ createdAt: -1 });
        if (req.user.role === 'Student') {
            return res.json(submissions.map((submission) => sanitizeQuizSubmissionForStudent(submission)));
        }
        res.json(submissions);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching quiz submissions' });
    }
};
exports.getQuizSubmissions = getQuizSubmissions;
const updateQuizAnomalyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, studentId, quizId } = req.body;
        if (!['dismiss', 'escalate', 'chance'].includes(action)) {
            return res.status(400).json({ message: 'Invalid anomaly action' });
        }
        if (action === 'dismiss') {
            const submission = await QuizSubmission_1.default.findById(id)
                .populate('quizId', 'title teacherId')
                .populate('studentId', 'name email uniqueId');
            if (!submission)
                return res.status(404).json({ message: 'Submission not found' });
            if (submission.anomalyStatus === 'dismissed' || submission.anomalyStatus === 'escalated') {
                return res.status(400).json({ message: 'Anomaly status is already finalized for this submission.' });
            }
            submission.anomalyStatus = 'dismissed';
            await submission.save();
            const io = req.app.get('io');
            io?.to('teacher_room').emit('quizSubmissionUpdated', submission);
            io?.to('ta_room').emit('quizSubmissionUpdated', submission);
            if (submission.studentId?._id) {
                io?.to(`student_${submission.studentId._id.toString()}`).emit('quizSubmissionUpdated', sanitizeQuizSubmissionForStudent(submission));
            }
            return res.json({ message: 'Anomaly dismissed successfully', submission });
        }
        if (!studentId || !quizId) {
            return res.status(400).json({ message: 'studentId and quizId are required for this action' });
        }
        const io = req.app.get('io');
        if (action === 'chance') {
            const existingSubmission = await QuizSubmission_1.default.findOne({ studentId, quizId });
            if (existingSubmission) {
                return res.status(400).json({ message: 'Another chance is only allowed before quiz submission.' });
            }
            io?.to(`student_${studentId}`).emit('anotherChanceGranted', { studentId, quizId });
            return res.json({ message: 'Another chance granted to student.' });
        }
        const quiz = await Quiz_1.default.findById(quizId);
        if (!quiz)
            return res.status(404).json({ message: 'Quiz not found' });
        let submission = await QuizSubmission_1.default.findOne({ studentId, quizId })
            .populate('quizId', 'title teacherId')
            .populate('studentId', 'name email uniqueId');
        if (!submission) {
            submission = await QuizSubmission_1.default.create({
                quizId,
                studentId,
                score: 0,
                totalQuestions: quiz.questions.length,
                timeTaken: 0,
                tabSwitches: ANOMALY_CLOSE_THRESHOLD,
                anomalyFlags: ['Escalated by TA before submission'],
                anomalyStatus: 'escalated',
                resultStatus: 'escalated',
                escalatedBy: req.user._id,
                escalatedAt: new Date(),
                escalatedReason: 'Escalated by TA due to anomaly detection.',
            });
            submission = await QuizSubmission_1.default.findById(submission._id)
                .populate('quizId', 'title teacherId')
                .populate('studentId', 'name email uniqueId');
        }
        else {
            if (submission.anomalyStatus === 'escalated') {
                return res.status(400).json({ message: 'Student is already escalated for this quiz.' });
            }
            submission.anomalyStatus = 'escalated';
            submission.resultStatus = 'escalated';
            submission.escalatedBy = req.user._id;
            submission.escalatedAt = new Date();
            submission.escalatedReason = 'Escalated by TA due to anomaly detection.';
            if (!submission.anomalyFlags.includes('Escalated by TA')) {
                submission.anomalyFlags.push('Escalated by TA');
            }
            await submission.save();
        }
        io?.to(`student_${studentId}`).emit('closeQuiz', {
            studentId,
            quizId,
            reason: 'Quiz escalated by TA due to repeated anomaly detections.',
        });
        io?.emit('closeQuiz', {
            studentId,
            quizId,
            reason: 'Quiz escalated by TA due to repeated anomaly detections.',
        });
        io?.to('teacher_room').emit('quizSubmissionUpdated', submission);
        io?.to('ta_room').emit('quizSubmissionUpdated', submission);
        io?.to(`student_${studentId}`).emit('quizSubmissionUpdated', sanitizeQuizSubmissionForStudent(submission));
        return res.json({ message: 'Student escalated successfully', submission });
    }
    catch (error) {
        return res.status(500).json({ message: 'Error updating anomaly status' });
    }
};
exports.updateQuizAnomalyStatus = updateQuizAnomalyStatus;
