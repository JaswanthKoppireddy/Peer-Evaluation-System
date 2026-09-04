import express from 'express';
import rateLimit from 'express-rate-limit';
import { registerUser, loginUser, refresh, logout, getMe, changePassword } from '../controllers/authController';
import { createSubmission, getSubmissions, updateSubmissionStatus } from '../controllers/submissionController';
import { createEvaluation, getEscalations } from '../controllers/evaluationController';
import { createAssessment, getAssessments } from '../controllers/assessmentController';
import { createGroup, getGroups, getAllStudents } from '../controllers/groupController';
import { createQuiz, getQuizzes, submitQuiz, getQuizSubmissions, updateQuizAnomalyStatus } from '../controllers/quizController';
import { createNote, getNotes } from '../controllers/noteController';
import { protect, authorizeRoles } from '../middleware/authMiddleware';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 1 minute' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth Routes
router.post('/auth/register', authLimiter, registerUser);
router.post('/auth/login', authLimiter, loginUser);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', protect, getMe);
router.post('/auth/change-password', protect, changePassword);

// Submission Routes
router.route('/submissions')
  .post(protect, authorizeRoles('Student'), createSubmission)
  .get(protect, getSubmissions);

router.route('/submissions/:id')
  .patch(protect, authorizeRoles('Teacher'), updateSubmissionStatus);

// Assessment Routes
router.route('/assessments')
  .post(protect, authorizeRoles('Teacher'), createAssessment)
  .get(protect, getAssessments);

// Evaluation Routes
router.route('/evaluations')
  .post(protect, authorizeRoles('Student'), createEvaluation);

router.route('/evaluations/escalations')
  .get(protect, authorizeRoles('TA', 'Teacher'), getEscalations);

// Group Routes
router.route('/groups')
  .post(protect, authorizeRoles('TA', 'Teacher'), createGroup)
  .get(protect, authorizeRoles('TA', 'Teacher', 'Student'), getGroups);

router.route('/students')
  .get(protect, authorizeRoles('TA', 'Teacher'), getAllStudents);

// Quiz Routes (specific routes before generic ones)
router.route('/quizzes/submit')
  .post(protect, authorizeRoles('Student'), submitQuiz);

router.route('/quizzes/submissions')
  .get(protect, getQuizSubmissions);

router.route('/quizzes/submissions/:id/anomaly-status')
  .patch(protect, authorizeRoles('TA', 'Teacher'), updateQuizAnomalyStatus);

router.route('/quizzes')
  .post(protect, authorizeRoles('Teacher'), createQuiz)
  .get(protect, getQuizzes);

// Note Routes
router.route('/notes')
  .post(protect, authorizeRoles('Teacher'), createNote)
  .get(protect, getNotes);

export default router;
