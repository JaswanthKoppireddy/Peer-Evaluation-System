import { Request, Response } from 'express';
import Submission from '../models/Submission';
import { generateSubmissionId } from '../services/qrService';
import { AuthRequest } from '../middleware/authMiddleware';

export const createSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { assessmentId, submissionType, contentUrl } = req.body;
    const studentId = req.user._id;

    // Check if submission already exists for this student and assessment
    const existingSubmission = await Submission.findOne({ assessmentId, studentId });
    if (existingSubmission) {
      return res.status(400).json({ 
        message: 'Assignment Successfully Submitted',
        submitted: true,
        submission: existingSubmission 
      });
    }

    // Utilize QR Logic service for generating specific references if needed
    const specificId = generateSubmissionId(submissionType);

    const submission = await Submission.create({
      assessmentId,
      studentId,
      submissionType,
      contentUrl,
      status: 'Pending'
    });

    const populatedSubmission = await Submission.findById(submission._id)
      .populate('assessmentId', 'title')
      .populate('studentId', 'name email uniqueId');

    const io = req.app.get('io');
    io.to('teacher_room').emit('submissionCreated', populatedSubmission);
    io.to(`student_${studentId.toString()}`).emit('submissionCreated', populatedSubmission);

    res.status(201).json({ submission: populatedSubmission, internalRef: specificId });
  } catch (error) {
    res.status(500).json({ message: 'Server error creating submission' });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    // If student, only see their own. If Teacher, see all for their assessments. If TA, see all.
    let query: any = {};
    if (req.user.role === 'Student') {
      query = { studentId: req.user._id };
    } else if (req.user.role === 'Teacher') {
      // Get all submissions for assessments created by this teacher
      const Assessment = require('../models/Assessment').default;
      const teacherAssessments = await Assessment.find({ teacherId: req.user._id }).select('_id');
      query = { assessmentId: { $in: teacherAssessments.map((a: any) => a._id) } };
    }
    const submissions = await Submission.find(query)
      .populate('assessmentId', 'title')
      .populate('studentId', 'name email uniqueId');
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching submissions' });
  }
};

export const updateSubmissionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : '';

    if (!['approved', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid status. Use approved or rejected.' });
    }

    const finalStatus = normalizedStatus === 'approved' ? 'Approved' : 'Rejected';
    const submission = await Submission.findByIdAndUpdate(
      id,
      { status: finalStatus },
      { new: true }
    ).populate('assessmentId', 'title').populate('studentId', 'name email uniqueId');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const io = req.app.get('io');
    io.to('teacher_room').emit('submissionStatusUpdated', submission);
    if ((submission as any).studentId?._id) {
      io.to(`student_${(submission as any).studentId._id.toString()}`).emit('submissionStatusUpdated', submission);
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating submission' });
  }
};
