import { Response } from 'express';
import Evaluation from '../models/Evaluation';
import Submission from '../models/Submission';
import { AuthRequest } from '../middleware/authMiddleware';
import { checkAnomaly } from '../services/anomalyEngine';
import { Server } from 'socket.io';

export const createEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId, score, comments } = req.body;
    const evaluatorId = req.user._id;

    const evaluation = await Evaluation.create({
      submissionId,
      evaluatorId,
      score,
      comments,
      escalationStatus: 'Pending',
    });

    const anomalyFound = await checkAnomaly(submissionId);

    if (anomalyFound) {
      const submission = await Submission.findById(submissionId).populate('studentId', 'name uniqueId');
      const populatedStudent = submission?.studentId as any;
      const io = req.app.get('io') as Server;
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
  } catch (error) {
    res.status(500).json({ message: 'Server error creating evaluation' });
  }
};

export const getEscalations = async (req: AuthRequest, res: Response) => {
  try {
    const escalations = await Evaluation.find({
      escalationStatus: { $in: ['Flagged', 'TA_Review', 'Teacher_Escalation'] },
    })
      .populate('submissionId')
      .populate('evaluatorId', 'name');

    res.json(escalations);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching escalations' });
  }
};
