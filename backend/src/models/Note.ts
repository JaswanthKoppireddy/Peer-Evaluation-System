import mongoose, { Document, Schema } from 'mongoose';

export interface INote extends Document {
  title: string;
  description: string;
  teacherId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  fileUrl: string;
  isLargeFile: boolean;
  qrCodeData?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    fileUrl: { type: String, required: true },
    isLargeFile: { type: Boolean, default: false },
    qrCodeData: { type: String }, // Pre-generated QR string if large file
  },
  { timestamps: true }
);

export default mongoose.model<INote>('Note', NoteSchema);
