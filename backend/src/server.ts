import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { connectDB } from './config/db';
import apiRoutes from './routes/api';
import uploadRoutes from './routes/uploadRoutes';
import { errorHandler } from './middleware/errorMiddleware';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();

// Database connection
connectDB();

// Middleware
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(mongoSanitize());

// Routes
app.use('/api', apiRoutes);
app.use('/api/upload', uploadRoutes);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  }
});

// Attach io to app for use in controllers
app.set('io', io);

// Track connected sockets with their metadata
const socketMeta: Record<string, { userId?: string; teacherId?: string; role?: string }> = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Student joins — sends their userId so TA can target them
  socket.on('join_student', (data: { userId: string }) => {
    socket.join(`student_${data.userId}`);
    socketMeta[socket.id] = { ...socketMeta[socket.id], userId: data.userId };
    console.log(`Student ${data.userId} joined their room`);
  });

  // Teacher joins their room
  socket.on('join_teacher_room', (data?: { teacherId?: string }) => {
    const tId = data?.teacherId || '';
    socket.join('teacher_room');
    if (tId) socket.join(`teacher_${tId}`);
    socketMeta[socket.id] = { ...socketMeta[socket.id], teacherId: tId, role: 'Teacher' };
    console.log(`Teacher ${socket.id} joined teacher_room`);
  });

  // TA joins — scoped to their teacher
  socket.on('join_ta_room', (data?: { teacherId?: string }) => {
    const tId = data?.teacherId || '';
    socket.join('ta_room');           // global TA room (fallback)
    if (tId) socket.join(`ta_${tId}`); // teacher-scoped TA room
    socketMeta[socket.id] = { ...socketMeta[socket.id], teacherId: tId, role: 'TA' };
    console.log(`TA ${socket.id} joined ta_room (teacher: ${tId})`);
  });

  // Student emits anomaly — forward to scoped TA room AND global TA room
  socket.on('anomalyDetected', (data: any) => {
    const teacherId = data.teacherId;
    if (teacherId) {
      // Emit to teacher-scoped TA room
      io.to(`ta_${teacherId}`).emit('liveAnomaly', data);
    }
    // Also emit to global TA room so non-scoped TAs catch it
    io.to('ta_room').emit('liveAnomaly', data);
  });

  // TA force-closes quiz — emit directly to student's room
  socket.on('forceCloseQuiz', (data: any) => {
    const { studentId, quizId, reason } = data;
    if (studentId) {
      // Direct to student's personal room
      io.to(`student_${studentId}`).emit('closeQuiz', { studentId, quizId, reason });
    }
    // Broadcast fallback so all clients can check
    io.emit('closeQuiz', { studentId, quizId, reason });
  });

  // TA gives another chance — allow student to retake
  socket.on('giveAnotherChance', (data: any) => {
    const { studentId, quizId } = data;
    if (studentId) {
      io.to(`student_${studentId}`).emit('anotherChanceGranted', { studentId, quizId });
    }
  });

  socket.on('disconnect', () => {
    delete socketMeta[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
