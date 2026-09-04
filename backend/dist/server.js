"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const db_1 = require("./config/db");
const api_1 = __importDefault(require("./routes/api"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Database connection
(0, db_1.connectDB)();
// Middleware
app.use((0, helmet_1.default)());
app.use(helmet_1.default.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use((0, cors_1.default)({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, express_mongo_sanitize_1.default)());
// Routes
app.use('/api', api_1.default);
app.use('/api/upload', uploadRoutes_1.default);
// Static uploads
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Error Handling Middleware
app.use(errorMiddleware_1.errorHandler);
const PORT = process.env.PORT || 5000;
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true,
    }
});
// Attach io to app for use in controllers
app.set('io', io);
// Track connected sockets with their metadata
const socketMeta = {};
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // Student joins — sends their userId so TA can target them
    socket.on('join_student', (data) => {
        socket.join(`student_${data.userId}`);
        socketMeta[socket.id] = { ...socketMeta[socket.id], userId: data.userId };
        console.log(`Student ${data.userId} joined their room`);
    });
    // Teacher joins their room
    socket.on('join_teacher_room', (data) => {
        const tId = data?.teacherId || '';
        socket.join('teacher_room');
        if (tId)
            socket.join(`teacher_${tId}`);
        socketMeta[socket.id] = { ...socketMeta[socket.id], teacherId: tId, role: 'Teacher' };
        console.log(`Teacher ${socket.id} joined teacher_room`);
    });
    // TA joins — scoped to their teacher
    socket.on('join_ta_room', (data) => {
        const tId = data?.teacherId || '';
        socket.join('ta_room'); // global TA room (fallback)
        if (tId)
            socket.join(`ta_${tId}`); // teacher-scoped TA room
        socketMeta[socket.id] = { ...socketMeta[socket.id], teacherId: tId, role: 'TA' };
        console.log(`TA ${socket.id} joined ta_room (teacher: ${tId})`);
    });
    // Student emits anomaly — forward to scoped TA room AND global TA room
    socket.on('anomalyDetected', (data) => {
        const teacherId = data.teacherId;
        if (teacherId) {
            // Emit to teacher-scoped TA room
            io.to(`ta_${teacherId}`).emit('liveAnomaly', data);
        }
        // Also emit to global TA room so non-scoped TAs catch it
        io.to('ta_room').emit('liveAnomaly', data);
    });
    // TA force-closes quiz — emit directly to student's room
    socket.on('forceCloseQuiz', (data) => {
        const { studentId, quizId, reason } = data;
        if (studentId) {
            // Direct to student's personal room
            io.to(`student_${studentId}`).emit('closeQuiz', { studentId, quizId, reason });
        }
        // Broadcast fallback so all clients can check
        io.emit('closeQuiz', { studentId, quizId, reason });
    });
    // TA gives another chance — allow student to retake
    socket.on('giveAnotherChance', (data) => {
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
