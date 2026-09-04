import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'Student' | 'TA' | 'Teacher';
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  uniqueId: string;
  teacherId?: mongoose.Types.ObjectId; // Only for TA: the Teacher they are assigned to
  createdAt: Date;
  updatedAt: Date;
}

const getNextUniqueId = async (role: string): Promise<string> => {
  if (role === 'Student') {
    const count = await mongoose.model('User').countDocuments({ role: 'Student' });
    return `STU${String(count + 1).padStart(3, '0')}`;
  }
  if (role === 'Teacher') {
    const count = await mongoose.model('User').countDocuments({ role: 'Teacher' });
    return `T${String(count + 1).padStart(4, '0')}`;
  }
  if (role === 'TA') {
    const count = await mongoose.model('User').countDocuments({ role: 'TA' });
    return `TECH${String(count + 1).padStart(4, '0')}`;
  }
  return `STU${String(await mongoose.model('User').countDocuments({ role: 'Student' }) + 1).padStart(3, '0')}`;
};

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['Student', 'TA', 'Teacher'], default: 'Student' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    uniqueId: { type: String, unique: true, required: true },
    // For TAs — references the Teacher they operate under
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

UserSchema.pre('validate', async function (next) {
  const user = this as any;
  if (!user.uniqueId) {
    user.uniqueId = await getNextUniqueId(user.role || 'Student');
  }
  next();
});

export default mongoose.model<IUser>('User', UserSchema);
