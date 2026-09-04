"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.refresh = exports.loginUser = exports.registerUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const RefreshToken_1 = __importDefault(require("../models/RefreshToken"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const generateUniqueId = async (role) => {
    if (role === 'Student') {
        const count = await User_1.default.countDocuments({ role: 'Student' });
        return `STU${String(count + 1).padStart(3, '0')}`;
    }
    else if (role === 'Teacher') {
        const count = await User_1.default.countDocuments({ role: 'Teacher' });
        return `T${String(count + 1).padStart(4, '0')}`;
    }
    else if (role === 'TA') {
        const count = await User_1.default.countDocuments({ role: 'TA' });
        return `TECH${String(count + 1).padStart(4, '0')}`;
    }
    return '';
};
const generateTokens = (id) => {
    const accessToken = jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ id }, process.env.JWT_REFRESH_SECRET || 'refresh_secret', { expiresIn: '30d' });
    return { accessToken, refreshToken };
};
const setCookies = (res, accessToken, refreshToken) => {
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
};
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role, teacherUniqueId } = req.body;
        const userExists = await User_1.default.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists or invalid credentials' });
        }
        // If registering as TA, validate the Teacher's unique ID
        let resolvedTeacherId = null;
        if (role === 'TA') {
            if (!teacherUniqueId) {
                return res.status(400).json({ message: 'A valid Teacher ID is required to register as a Teaching Assistant.' });
            }
            const teacher = await User_1.default.findOne({ uniqueId: teacherUniqueId, role: 'Teacher' });
            if (!teacher) {
                return res.status(400).json({ message: `No teacher found with ID "${teacherUniqueId}". Please enter a valid Teacher ID.` });
            }
            resolvedTeacherId = teacher._id;
        }
        const salt = await bcrypt_1.default.genSalt(10);
        const passwordHash = await bcrypt_1.default.hash(password, salt);
        const verificationToken = crypto_1.default.randomBytes(32).toString('hex');
        const uniqueId = await generateUniqueId(role || 'Student');
        const user = await User_1.default.create({
            name,
            email,
            passwordHash,
            role: role || 'Student',
            verificationToken,
            uniqueId,
            teacherId: resolvedTeacherId,
        });
        console.log(`[Mock Email] Verify your email using token: ${verificationToken}`);
        res.status(201).json({ message: 'Account created successfully!' });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.registerUser = registerUser;
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Check account lockout
        if (user.lockUntil && user.lockUntil > new Date()) {
            return res.status(403).json({ message: 'Account is temporarily locked. Try again later.' });
        }
        if (await bcrypt_1.default.compare(password, user.passwordHash)) {
            // Reset login attempts
            user.failedLoginAttempts = 0;
            user.lockUntil = undefined;
            await user.save();
            const { accessToken, refreshToken } = generateTokens(user.id);
            await RefreshToken_1.default.create({
                token: refreshToken,
                user: user._id,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            });
            setCookies(res, accessToken, refreshToken);
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                uniqueId: user.uniqueId,
                teacherId: user.teacherId || null,
            });
        }
        else {
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
            }
            await user.save();
            res.status(401).json({ message: 'Invalid credentials' });
        }
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.loginUser = loginUser;
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        const existingToken = await RefreshToken_1.default.findOne({ token: refreshToken });
        if (!existingToken) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret');
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.id);
            // Rotate token
            existingToken.token = newRefreshToken;
            existingToken.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await existingToken.save();
            setCookies(res, accessToken, newRefreshToken);
            res.json({ message: 'Token refreshed' });
        }
        catch (err) {
            await existingToken.deleteOne();
            return res.status(401).json({ message: 'Refresh token expired' });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
        await RefreshToken_1.default.deleteOne({ token: refreshToken });
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user?.id)
            .select('-passwordHash -verificationToken -resetPasswordToken -resetPasswordExpires')
            .populate('teacherId', 'name uniqueId');
        if (user) {
            res.json(user);
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMe = getMe;
