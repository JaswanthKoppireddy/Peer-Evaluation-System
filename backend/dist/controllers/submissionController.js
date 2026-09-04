"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSubmissionStatus = exports.getSubmissions = exports.createSubmission = void 0;
const Submission_1 = __importDefault(require("../models/Submission"));
const qrService_1 = require("../services/qrService");
const createSubmission = async (req, res) => {
    try {
        const { assessmentId, submissionType, contentUrl } = req.body;
        const studentId = req.user._id;
        // Check if submission already exists for this student and assessment
        const existingSubmission = await Submission_1.default.findOne({ assessmentId, studentId });
        if (existingSubmission) {
            return res.status(400).json({
                message: 'Assignment Successfully Submitted',
                submitted: true,
                submission: existingSubmission
            });
        }
        // Utilize QR Logic service for generating specific references if needed
        const specificId = (0, qrService_1.generateSubmissionId)(submissionType);
        const submission = await Submission_1.default.create({
            assessmentId,
            studentId,
            submissionType,
            contentUrl,
            status: 'Pending'
        });
        const populatedSubmission = await Submission_1.default.findById(submission._id)
            .populate('assessmentId', 'title')
            .populate('studentId', 'name email uniqueId');
        const io = req.app.get('io');
        io.to('teacher_room').emit('submissionCreated', populatedSubmission);
        io.to(`student_${studentId.toString()}`).emit('submissionCreated', populatedSubmission);
        res.status(201).json({ submission: populatedSubmission, internalRef: specificId });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error creating submission' });
    }
};
exports.createSubmission = createSubmission;
const getSubmissions = async (req, res) => {
    try {
        // If student, only see their own. If Teacher, see all for their assessments. If TA, see all.
        let query = {};
        if (req.user.role === 'Student') {
            query = { studentId: req.user._id };
        }
        else if (req.user.role === 'Teacher') {
            // Get all submissions for assessments created by this teacher
            const Assessment = require('../models/Assessment').default;
            const teacherAssessments = await Assessment.find({ teacherId: req.user._id }).select('_id');
            query = { assessmentId: { $in: teacherAssessments.map((a) => a._id) } };
        }
        const submissions = await Submission_1.default.find(query)
            .populate('assessmentId', 'title')
            .populate('studentId', 'name email uniqueId');
        res.json(submissions);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error fetching submissions' });
    }
};
exports.getSubmissions = getSubmissions;
const updateSubmissionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : '';
        if (!['approved', 'rejected'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Invalid status. Use approved or rejected.' });
        }
        const finalStatus = normalizedStatus === 'approved' ? 'Approved' : 'Rejected';
        const submission = await Submission_1.default.findByIdAndUpdate(id, { status: finalStatus }, { new: true }).populate('assessmentId', 'title').populate('studentId', 'name email uniqueId');
        if (!submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }
        const io = req.app.get('io');
        io.to('teacher_room').emit('submissionStatusUpdated', submission);
        if (submission.studentId?._id) {
            io.to(`student_${submission.studentId._id.toString()}`).emit('submissionStatusUpdated', submission);
        }
        res.json(submission);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error updating submission' });
    }
};
exports.updateSubmissionStatus = updateSubmissionStatus;
