import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  taId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId; // Teacher who owns this group
  studentIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    taId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model<IGroup>('Group', GroupSchema);
