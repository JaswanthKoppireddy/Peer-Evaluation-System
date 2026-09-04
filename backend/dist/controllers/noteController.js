"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotes = exports.createNote = void 0;
const Note_1 = __importDefault(require("../models/Note"));
const Group_1 = __importDefault(require("../models/Group"));
const User_1 = __importDefault(require("../models/User"));
const qrcode_1 = __importDefault(require("qrcode"));
const createNote = async (req, res) => {
    try {
        const { title, description, groupId, fileUrl, isLargeFile } = req.body;
        let qrCodeData = '';
        if (isLargeFile) {
            qrCodeData = await qrcode_1.default.toDataURL(fileUrl);
        }
        const note = await Note_1.default.create({
            title, description,
            groupId: groupId || undefined,
            fileUrl, isLargeFile, qrCodeData,
            teacherId: req.user._id
        });
        res.status(201).json(note);
    }
    catch (error) {
        res.status(500).json({ message: 'Error creating note' });
    }
};
exports.createNote = createNote;
const getNotes = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'Teacher') {
            query.teacherId = req.user._id;
        }
        else if (req.user.role === 'Student') {
            const studentGroups = await Group_1.default.find({ studentIds: req.user._id }).select('_id');
            const groupIds = studentGroups.map(g => g._id);
            query = {
                $or: [
                    { groupId: { $exists: false } },
                    { groupId: null },
                    { groupId: { $in: groupIds } },
                ],
            };
        }
        else if (req.user.role === 'TA') {
            const ta = await User_1.default.findById(req.user._id).select('teacherId');
            if (ta && ta.teacherId) {
                query.teacherId = ta.teacherId;
            }
        }
        const notes = await Note_1.default.find(query)
            .populate('groupId', 'name')
            .sort({ createdAt: -1 });
        res.json(notes);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching notes' });
    }
};
exports.getNotes = getNotes;
