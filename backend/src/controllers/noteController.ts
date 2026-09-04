import { Response } from 'express';
import Note from '../models/Note';
import Group from '../models/Group';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';
import QRCode from 'qrcode';

export const createNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, groupId, fileUrl, isLargeFile } = req.body;
    
    let qrCodeData = '';
    if (isLargeFile) {
      qrCodeData = await QRCode.toDataURL(fileUrl);
    }

    const note = await Note.create({
      title, description,
      groupId: groupId || undefined,
      fileUrl, isLargeFile, qrCodeData,
      teacherId: req.user._id
    });
    
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Error creating note' });
  }
};

export const getNotes = async (req: AuthRequest, res: Response) => {
  try {
    let query: any = {};

    if (req.user.role === 'Teacher') {
      query.teacherId = req.user._id;
    } else if (req.user.role === 'Student') {
      const studentGroups = await Group.find({ studentIds: req.user._id }).select('_id');
      const groupIds = studentGroups.map(g => g._id);
      query = {
        $or: [
          { groupId: { $exists: false } },
          { groupId: null },
          { groupId: { $in: groupIds } },
        ],
      };
    } else if (req.user.role === 'TA') {
      const ta = await User.findById(req.user._id).select('teacherId');
      if (ta && (ta as any).teacherId) {
        query.teacherId = (ta as any).teacherId;
      }
    }

    const notes = await Note.find(query)
      .populate('groupId', 'name')
      .sort({ createdAt: -1 });

    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notes' });
  }
};
