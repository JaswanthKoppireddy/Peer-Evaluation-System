"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllStudents = exports.getGroups = exports.createGroup = void 0;
const Group_1 = __importDefault(require("../models/Group"));
const User_1 = __importDefault(require("../models/User"));
const createGroup = async (req, res) => {
    try {
        const { name, studentIds } = req.body;
        // Resolve the teacherId: if caller is TA, use their assigned teacher; if Teacher, use themselves
        let teacherId;
        if (req.user.role === 'TA') {
            const ta = await User_1.default.findById(req.user._id).select('teacherId');
            if (!ta || !ta.teacherId) {
                return res.status(400).json({ message: 'TA is not linked to a teacher. Please re-register with a valid Teacher ID.' });
            }
            teacherId = ta.teacherId;
        }
        else if (req.user.role === 'Teacher') {
            teacherId = req.user._id;
        }
        else {
            return res.status(403).json({ message: 'Not authorized to create groups' });
        }
        const group = await Group_1.default.create({
            name,
            taId: req.user._id,
            teacherId,
            studentIds: studentIds || [],
        });
        const populated = await group.populate('studentIds', 'name email uniqueId');
        res.status(201).json(populated);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating group' });
    }
};
exports.createGroup = createGroup;
const getGroups = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'TA') {
            // TA sees only groups for their linked teacher
            const ta = await User_1.default.findById(req.user._id).select('teacherId');
            if (ta && ta.teacherId) {
                query.teacherId = ta.teacherId;
            }
        }
        else if (req.user.role === 'Teacher') {
            // Teacher sees their own groups
            query.teacherId = req.user._id;
        }
        // Students see all groups (no filter) — to check if they're in one
        const groups = await Group_1.default.find(query)
            .populate('studentIds', 'name email uniqueId')
            .populate('taId', 'name uniqueId')
            .sort({ createdAt: -1 });
        res.json(groups);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching groups' });
    }
};
exports.getGroups = getGroups;
const getAllStudents = async (req, res) => {
    try {
        // Use case-insensitive role match so legacy records like "student" are also returned.
        const students = await User_1.default.find({ role: { $regex: '^student$', $options: 'i' } })
            .select('-passwordHash -verificationToken -resetPasswordToken -resetPasswordExpires')
            .sort({ createdAt: -1 });
        res.json(students);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching students' });
    }
};
exports.getAllStudents = getAllStudents;
