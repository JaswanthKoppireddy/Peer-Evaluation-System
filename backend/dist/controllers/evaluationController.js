"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEscalations = exports.createEvaluation = void 0;
const Evaluation_1 = __importDefault(require("../models/Evaluation"));
const Submission_1 = __importDefault(require("../models/Submission"));
const anomalyEngine_1 = require("../services/anomalyEngine");
const createEvaluation = async (req, res) => {
    try {
        const { submissionId, score, comments } = req.body;
        const evaluatorId = req.user._id;
        const evaluation = await Evaluation_1.default.create({
            submissionId,
            evaluatorId,
            score,
            comments,
            escalationStatus: 'Pending',
        });
        const anomalyFound = await (0, anomalyEngine_1.checkAnomaly)(submissionId);
        if (anomalyFound) {
            const submission = await Submission_1.default.findById(submissionId).populate('studentId', 'name uniqueId');
            const populatedStudent = submission?.studentId;
            const io = req.app.get('io');
            if (io && submission) {
                io.to('ta_room').emit('liveAnomaly', {
                    submissionId,
                    studentId: populatedStudent?._id,
                    studentName: populatedStudent?.name,
                    studentUniqueId: populatedStudent?.uniqueId,
                    message: 'Anomaly detected in peer evaluation submission',
                    timestamp: new Date(),
                    escalation: true,
                });
            }
        }
        res.status(201).json({ evaluation, anomalyFound });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error creating evaluation' });
    }
};
exports.createEvaluation = createEvaluation;
const getEscalations = async (req, res) => {
    try {
        const escalations = await Evaluation_1.default.find({
            escalationStatus: { $in: ['Flagged', 'TA_Review', 'Teacher_Escalation'] },
        })
            .populate('submissionId')
            .populate('evaluatorId', 'name');
        res.json(escalations);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error fetching escalations' });
    }
};
exports.getEscalations = getEscalations;
