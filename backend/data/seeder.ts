import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../src/models/User';
import Assessment from '../src/models/Assessment';
import Submission from '../src/models/Submission';
import Evaluation from '../src/models/Evaluation';
import Group from '../src/models/Group';
import Quiz from '../src/models/Quiz';
import QuizSubmission from '../src/models/QuizSubmission';
import Note from '../src/models/Note';
import RefreshToken from '../src/models/RefreshToken';
import { connectDB } from '../src/config/db';

dotenv.config();

const importData = async () => {
  try {
    await connectDB();

    await User.deleteMany();
    await Assessment.deleteMany();
    await Submission.deleteMany();
    await Evaluation.deleteMany();
    await Group.deleteMany();
    await Quiz.deleteMany();
    await QuizSubmission.deleteMany();
    await Note.deleteMany();
    await RefreshToken.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const users = await User.insertMany([
      { name: 'Teacher John', email: 'teacher@test.com', passwordHash, role: 'Teacher', isVerified: true },
      { name: 'TA Alice', email: 'ta@test.com', passwordHash, role: 'TA', isVerified: true },
      { name: 'Student Bob', email: 'bob@test.com', passwordHash, role: 'Student', isVerified: true },
      { name: 'Student Charlie', email: 'charlie@test.com', passwordHash, role: 'Student', isVerified: true },
    ]);

    const teacher = users[0];

    const assessment = await Assessment.create({
      title: 'React Fundamentals',
      description: 'Build a simple React app with state.',
      teacherId: teacher._id,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // + 1 week
    });

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  // destroy data logic could go here
} else {
  importData();
}
