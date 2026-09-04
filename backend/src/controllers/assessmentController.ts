import { Response } from 'express';
import Assessment from '../models/Assessment';
import Group from '../models/Group';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Create a new assessment
// @route   POST /api/assessments
// @access  Private/Teacher
export const createAssessment = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, deadline, groupId } = req.body;

    if (req.user?.role !== 'Teacher') {
      return res.status(403).json({ message: 'Not authorized as teacher' });
    }

    const assessment = await Assessment.create({
      title,
      description,
      deadline,
      teacherId: req.user._id,
      // Only persist groupId when a specific group was selected
      groupId: groupId || undefined,
    });

    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating assessment' });
  }
};

// @desc    Get assessments (group-filtered for students)
// @route   GET /api/assessments
// @access  Private
export const getAssessments = async (req: AuthRequest, res: Response) => {
  try {
    let query: any = {};

    if (req.user.role === 'Teacher') {
      // Teacher sees only their own assessments
      query.teacherId = req.user._id;
    } else if (req.user.role === 'Student') {
      // Find every group this student belongs to
      const studentGroups = await Group.find({ studentIds: req.user._id }).select('_id');
      const groupIds = studentGroups.map(g => g._id);

      // Return assessments that are either:
      //  (a) Open to all (no groupId set), OR
      //  (b) Targeted at a group the student is in
      query = {
        $or: [
          { groupId: { $exists: false } },
          { groupId: null },
          { groupId: { $in: groupIds } },
        ],
      };
    } else if (req.user.role === 'TA') {
      // TA sees assessments for their linked teacher
      const User = require('../models/User').default;
      const ta = await User.findById(req.user._id).select('teacherId');
      if (ta && (ta as any).teacherId) {
        query.teacherId = (ta as any).teacherId;
      }
    }

    const assessments = await Assessment.find(query)
      .populate('teacherId', 'name email')
      .populate('groupId', 'name')
      .sort({ createdAt: -1 });

    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching assessments' });
  }
};
