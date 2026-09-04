import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestion {
  text: string;
  options: string[];
  correctIndex: number;
}

export interface IQuiz extends Document {
  title: string;
  description: string;
  teacherId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  questions: IQuestion[];
  timeLimit: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema({
  text: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctIndex: { type: Number, required: true },
});

const QuizSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    questions: [QuestionSchema],
    timeLimit: { type: Number, required: true, default: 30 },
  },
  { timestamps: true }
);

export default mongoose.model<IQuiz>('Quiz', QuizSchema);
