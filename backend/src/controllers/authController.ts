import { Request, Response } from 'express';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';
import { AuthRequest } from '../middleware/authMiddleware';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const generateUniqueId = async (role: string): Promise<string> => {
  if (role === 'Student') {
    const count = await User.countDocuments({ role: 'Student' });
    return `STU${String(count + 1).padStart(3, '0')}`;
  } else if (role === 'Teacher') {
    const count = await User.countDocuments({ role: 'Teacher' });
    return `T${String(count + 1).padStart(4, '0')}`;
  } else if (role === 'TA') {
    const count = await User.countDocuments({ role: 'TA' });
    return `TECH${String(count + 1).padStart(4, '0')}`;
  }
  return '';
};

const generateTokens = (id: string) => {
  const accessToken = jwt.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'refresh_secret', { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

const setCookies = (res: Response, accessToken: string, refreshToken: string) => {
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

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, teacherUniqueId } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists or invalid credentials' });
    }

    // If registering as TA, validate the Teacher's unique ID
    let resolvedTeacherId: any = null;
    if (role === 'TA') {
      if (!teacherUniqueId) {
        return res.status(400).json({ message: 'A valid Teacher ID is required to register as a Teaching Assistant.' });
      }
      const teacher = await User.findOne({ uniqueId: teacherUniqueId, role: 'Teacher' });
      if (!teacher) {
        return res.status(400).json({ message: `No teacher found with ID "${teacherUniqueId}". Please enter a valid Teacher ID.` });
      }
      resolvedTeacherId = teacher._id;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const uniqueId = await generateUniqueId(role || 'Student');

    const user = await User.create({
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
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(403).json({ message: 'Account is temporarily locked. Try again later.' });
    }

    if (await bcrypt.compare(password, user.passwordHash)) {
      // Reset login attempts
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user.id);

      await RefreshToken.create({
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
        teacherId: (user as any).teacherId || null,
      });
    } else {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }
      await user.save();
      
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as any;
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.id);

      // Rotate token
      existingToken.token = newRefreshToken;
      existingToken.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await existingToken.save();

      setCookies(res, accessToken, newRefreshToken);
      res.json({ message: 'Token refreshed' });
    } catch (err) {
      await existingToken.deleteOne();
      return res.status(401).json({ message: 'Refresh token expired' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    await RefreshToken.deleteOne({ token: refreshToken });
  }
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id)
      .select('-passwordHash -verificationToken -resetPasswordToken -resetPasswordExpires')
      .populate('teacherId', 'name uniqueId');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user?.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
