import mongoose, { Document, Schema } from 'mongoose';

export interface IEvaluation extends Document {
  submissionId: mongoose.Types.ObjectId;
  evaluatorId: mongoose.Types.ObjectId;
  score: number;
  comments: string;
  isAnomaly: boolean;
  escalationStatus: 'Pending' | 'Flagged' | 'TA_Review' | 'Teacher_Escalation' | 'Resolved';
  createdAt: Date;
  updatedAt: Date;
}

const EvaluationSchema: Schema = new Schema(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true },
    evaluatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    comments: { type: String },
    isAnomaly: { type: Boolean, default: false },
    escalationStatus: { 
      type: String, 
      enum: ['Pending', 'Flagged', 'TA_Review', 'Teacher_Escalation', 'Resolved'], 
      default: 'Pending' 
    },
  },
  { timestamps: true }
);

export default mongoose.model<IEvaluation>('Evaluation', EvaluationSchema);
