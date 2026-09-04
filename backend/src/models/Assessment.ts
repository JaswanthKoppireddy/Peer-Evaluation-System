import mongoose, { Document, Schema } from 'mongoose';

export interface IAssessment extends Document {
  title: string;
  description: string;
  teacherId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  deadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    deadline: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAssessment>('Assessment', AssessmentSchema);
