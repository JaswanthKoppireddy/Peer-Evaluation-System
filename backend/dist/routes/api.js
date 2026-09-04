"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authController_1 = require("../controllers/authController");
const submissionController_1 = require("../controllers/submissionController");
const evaluationController_1 = require("../controllers/evaluationController");
const assessmentController_1 = require("../controllers/assessmentController");
const groupController_1 = require("../controllers/groupController");
const quizController_1 = require("../controllers/quizController");
const noteController_1 = require("../controllers/noteController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Limit each IP to 50 auth requests per windowMs
    message: { message: 'Too many requests from this IP, please try again after 1 minute' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Auth Routes
router.post('/auth/register', authLimiter, authController_1.registerUser);
router.post('/auth/login', authLimiter, authController_1.loginUser);
router.post('/auth/refresh', authController_1.refresh);
router.post('/auth/logout', authController_1.logout);
router.get('/auth/me', authMiddleware_1.protect, authController_1.getMe);
// Submission Routes
router.route('/submissions')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Student'), submissionController_1.createSubmission)
    .get(authMiddleware_1.protect, submissionController_1.getSubmissions);
router.route('/submissions/:id')
    .patch(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Teacher'), submissionController_1.updateSubmissionStatus);
// Assessment Routes
router.route('/assessments')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Teacher'), assessmentController_1.createAssessment)
    .get(authMiddleware_1.protect, assessmentController_1.getAssessments);
// Evaluation Routes
router.route('/evaluations')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Student'), evaluationController_1.createEvaluation);
router.route('/evaluations/escalations')
    .get(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('TA', 'Teacher'), evaluationController_1.getEscalations);
// Group Routes
router.route('/groups')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('TA', 'Teacher'), groupController_1.createGroup)
    .get(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('TA', 'Teacher', 'Student'), groupController_1.getGroups);
router.route('/students')
    .get(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('TA', 'Teacher'), groupController_1.getAllStudents);
// Quiz Routes (specific routes before generic ones)
router.route('/quizzes/submit')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Student'), quizController_1.submitQuiz);
router.route('/quizzes/submissions')
    .get(authMiddleware_1.protect, quizController_1.getQuizSubmissions);
router.route('/quizzes/submissions/:id/anomaly-status')
    .patch(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('TA', 'Teacher'), quizController_1.updateQuizAnomalyStatus);
router.route('/quizzes')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Teacher'), quizController_1.createQuiz)
    .get(authMiddleware_1.protect, quizController_1.getQuizzes);
// Note Routes
router.route('/notes')
    .post(authMiddleware_1.protect, (0, authMiddleware_1.authorizeRoles)('Teacher'), noteController_1.createNote)
    .get(authMiddleware_1.protect, noteController_1.getNotes);
exports.default = router;
