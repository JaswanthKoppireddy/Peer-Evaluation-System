import mongoose, { Document, Schema } from 'mongoose';

export interface ISubmission extends Document {
  assessmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  submissionType: 'Portal' | 'PDF';
  contentUrl: string; // URL for PDF or text content for Portal
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema(
  {
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionType: { type: String, enum: ['Portal', 'PDF'], required: true },
    contentUrl: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  },
  { timestamps: true }
);

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
