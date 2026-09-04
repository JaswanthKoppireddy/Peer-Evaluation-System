import { Request, Response } from 'express';
import Group from '../models/Group';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { name, studentIds } = req.body;

    // Resolve the teacherId: if caller is TA, use their assigned teacher; if Teacher, use themselves
    let teacherId: any;
    if (req.user.role === 'TA') {
      const ta = await User.findById(req.user._id).select('teacherId');
      if (!ta || !(ta as any).teacherId) {
        return res.status(400).json({ message: 'TA is not linked to a teacher. Please re-register with a valid Teacher ID.' });
      }
      teacherId = (ta as any).teacherId;
    } else if (req.user.role === 'Teacher') {
      teacherId = req.user._id;
    } else {
      return res.status(403).json({ message: 'Not authorized to create groups' });
    }

    const group = await Group.create({
      name,
      taId: req.user._id,
      teacherId,
      studentIds: studentIds || [],
    });
    
    const populated = await group.populate('studentIds', 'name email uniqueId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Error creating group' });
  }
};

export const getGroups = async (req: AuthRequest, res: Response) => {
  try {
    let query: any = {};

    if (req.user.role === 'TA') {
      // TA sees only groups for their linked teacher
      const ta = await User.findById(req.user._id).select('teacherId');
      if (ta && (ta as any).teacherId) {
        query.teacherId = (ta as any).teacherId;
      }
    } else if (req.user.role === 'Teacher') {
      // Teacher sees their own groups
      query.teacherId = req.user._id;
    }
    // Students see all groups (no filter) — to check if they're in one

    const groups = await Group.find(query)
      .populate('studentIds', 'name email uniqueId')
      .populate('taId', 'name uniqueId')
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching groups' });
  }
};

export const getAllStudents = async (req: AuthRequest, res: Response) => {
  try {
    // Use case-insensitive role match so legacy records like "student" are also returned.
    const students = await User.find({ role: { $regex: '^student$', $options: 'i' } })
      .select('-passwordHash -verificationToken -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching students' });
  }
};
