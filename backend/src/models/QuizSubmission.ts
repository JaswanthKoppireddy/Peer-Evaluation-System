import mongoose, { Document, Schema } from 'mongoose';

export interface IQuizSubmission extends Document {
  quizId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  score: number;
  totalQuestions: number;
  timeTaken: number; // seconds
  tabSwitches: number;
  anomalyFlags: string[]; // e.g. "Tab Switched", "Finished suspiciously fast"
  anomalyStatus: 'open' | 'dismissed' | 'escalated' | 'chance_granted' | 'none';
  resultStatus: 'passed' | 'failed' | 'escalated' | 'pending';
  escalatedBy?: mongoose.Types.ObjectId;
  escalatedAt?: Date;
  escalatedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSubmissionSchema: Schema = new Schema(
  {
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    timeTaken: { type: Number, required: true },
    tabSwitches: { type: Number, default: 0 },
    anomalyFlags: [{ type: String }],
    anomalyStatus: {
      type: String,
      enum: ['open', 'dismissed', 'escalated', 'chance_granted', 'none'],
      default: 'none',
    },
    resultStatus: {
      type: String,
      enum: ['passed', 'failed', 'escalated', 'pending'],
      default: 'pending',
    },
    escalatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    escalatedAt: { type: Date, default: null },
    escalatedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IQuizSubmission>('QuizSubmission', QuizSubmissionSchema);
