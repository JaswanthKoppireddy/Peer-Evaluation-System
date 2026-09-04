import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardBody } from '../components/Card';
import Button from '../components/Button';
import { Clock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

const ANOMALY_CLOSE_THRESHOLD = 3; // Auto-close quiz after this many tab switches

const QuizInterface = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ score: number | null; total: number | null; status?: string } | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [closeMessage, setCloseMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer state — in seconds
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  // Tracks when quiz is force-closed by tab switch threshold so we can auto-submit
  const [tabSwitchTriggeredClose, setTabSwitchTriggeredClose] = useState(false);

  const socketRef = useRef<any>(null);
  const tabSwitchesRef = useRef(0); // ref for use inside event handlers without stale closure
  const isClosedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const hasAutoSubmittedRef = useRef(false);

  // ── Socket Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    socketRef.current = io('http://localhost:5000', { withCredentials: true });

    socketRef.current.on('connect', () => {
      console.log('Quiz socket connected');
      // Join student personal room so TA can target force-close to this student
      if (user?._id) {
        socketRef.current.emit('join_student', { userId: user._id });
      }
    });

    // TA or teacher force-closed this quiz
    socketRef.current.on('closeQuiz', (data: any) => {
      if (data.studentId === user?._id || data.studentId === String(user?._id)) {
        isClosedRef.current = true;
        setIsClosed(true);
        setCloseMessage(data.reason || 'Your quiz was closed by the Teaching Assistant.');
        toast.error('Quiz closed by instructor.');
      }
    });

    // TA granted another chance for this specific quiz
    socketRef.current.on('anotherChanceGranted', (data: any) => {
      if (
        (data.studentId === user?._id || data.studentId === String(user?._id)) &&
        (data.quizId === id || data.quizId === String(id))
      ) {
        isClosedRef.current = false;
        setIsClosed(false);
        setCloseMessage('');
        tabSwitchesRef.current = 0;
        setTabSwitches(0);
        toast.success('TA approved another chance. You may continue the quiz.');
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, id]);

  // ── Fetch Quiz ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        // First: check if student already submitted this quiz — no re-attempts allowed
        const subCheck = await api.get('/quizzes/submissions').catch(() => ({ data: [] }));
        const existingSub = (subCheck.data || []).find(
          (s: any) => s.quizId?._id === id || s.quizId === id
        );
        if (existingSub) {
          // Already submitted — block access immediately
          setAlreadySubmitted(true);
          setLoading(false);
          toast.error('You have already submitted this quiz. No re-attempts allowed.');
          return;
        }

        const { data } = await api.get('/quizzes');
        const q = data.find((x: any) => x._id === id);
        if (!q) {
          setLoading(false);
          toast.error('Quiz not found');
          return;
        }

        // Shuffle options for each question (keeps track of original correct index)
        const randomizedQuestions = q.questions.map((question: any) => {
          const originalCorrect = question.options[question.correctIndex];
          const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
          const newCorrectIndex = shuffledOptions.indexOf(originalCorrect);
          return {
            ...question,
            originalOptions: question.options,
            options: shuffledOptions,
            correctIndex: newCorrectIndex,
          };
        });

        setQuiz({ ...q, questions: randomizedQuestions });
        setAnswers(new Array(q.questions.length).fill(-1));

        // Start timer — timeLimit is in minutes
        const totalSeconds = (q.timeLimit || 30) * 60;
        setTimeLeft(totalSeconds);
        startTimeRef.current = Date.now();
      } catch {
        toast.error('Failed to fetch quiz');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  // ── Countdown Timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === null || isClosed || result) return;

    if (timeLeft <= 0) {
      setTimerExpired(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, isClosed, result]);

  // ── Auto-submit when timer expires ───────────────────────────────────────
  const doSubmit = useCallback(async (isAutoSubmit = false) => {
    if (hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;
    setIsSubmitting(true);

    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

    const mappedAnswers = answers.map((ans, i) => {
      if (!quiz || ans === -1) return -1;
      const selectedOptionText = quiz.questions[i].options[ans];
      return quiz.questions[i].originalOptions.indexOf(selectedOptionText);
    });

    try {
      const { data } = await api.post('/quizzes/submit', {
        quizId: id,
        answers: mappedAnswers,
        timeTaken,
        tabSwitches: tabSwitchesRef.current,
      });
      const isEscalated = data?.resultStatus === 'escalated' || data?.anomalyStatus === 'escalated';
      setResult({ score: data?.score ?? null, total: data?.totalQuestions ?? null, status: data?.resultStatus });
      if (isEscalated) {
        toast.warning('Quiz submitted and escalated for TA review.');
      } else if (isAutoSubmit) {
        toast.info('Time\'s up! Your quiz has been submitted automatically.');
      } else {
        toast.success('Quiz submitted successfully!');
      }
    } catch (error: any) {
      if (error.response?.data?.message === 'Quiz Successfully Submitted') {
        toast.success('Quiz already submitted.');
        navigate('/');
      } else {
        toast.error('Error submitting quiz');
        hasAutoSubmittedRef.current = false;
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, quiz, id, navigate]);

  // Auto-submit when timer expires (time-limit termination)
  useEffect(() => {
    if (timerExpired && !result && !isClosed) {
      doSubmit(true);
    }
  }, [timerExpired, result, isClosed, doSubmit]);

  // ── Auto-submit when quiz is force-closed by tab switch ───────────────────
  // CRITICAL: This creates the QuizSubmission record in the DB which:
  //   1. Prevents re-attempts (load check finds the existing submission)
  //   2. Populates the anomaly record the TA dashboard reads from
  useEffect(() => {
    if (tabSwitchTriggeredClose && !result) {
      doSubmit(true);
    }
  }, [tabSwitchTriggeredClose, result, doSubmit]);

  // ── Anomaly Detection (Tab Switching) ────────────────────────────────────
  useEffect(() => {
    if (!quiz) return;

    const recordAnomaly = () => {
      if (!isClosedRef.current) {
        tabSwitchesRef.current += 1;
        const count = tabSwitchesRef.current;
        setTabSwitches(count);

        // Emit anomaly to TA (with teacher context so scoped TA gets it)
        if (socketRef.current) {
          // quiz.teacherId may be a populated object or a plain ObjectId string
          const teacherIdValue =
            quiz.teacherId?._id || quiz.teacherId || null;

          socketRef.current.emit('anomalyDetected', {
            quizId: id,
            studentId: user?._id,
            studentName: user?.name,
            studentUniqueId: user?.uniqueId,
            teacherId: teacherIdValue,
            quizTitle: quiz.title,
            anomalyType: 'Tab Switch',
            anomalyCount: count,
            timestamp: new Date().toISOString(),
          });
        }

        if (count >= ANOMALY_CLOSE_THRESHOLD) {
          // Auto-close quiz on the student side
          isClosedRef.current = true;
          setIsClosed(true);
          setCloseMessage(
            `Quiz auto-closed: You switched tabs ${count} time(s). Maximum allowed is ${ANOMALY_CLOSE_THRESHOLD - 1}.`
          );
          toast.error(`Quiz closed! Too many tab switches (${count}/${ANOMALY_CLOSE_THRESHOLD}).`);
          // Trigger auto-submit: creates DB record → blocks re-attempt + flags anomaly for TA
          setTabSwitchTriggeredClose(true);
        } else {
          const remaining = ANOMALY_CLOSE_THRESHOLD - count;
          toast.warning(
            `⚠ Tab switch detected (${count}/${ANOMALY_CLOSE_THRESHOLD}). ${remaining} more will close your quiz!`
          );
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordAnomaly();
      }
    };

    const handleWindowBlur = () => {
      recordAnomaly();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [id, user, quiz]);

  // ── Timer display helpers ─────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const timerColor = () => {
    if (timeLeft === null) return 'text-white';
    if (timeLeft <= 60) return 'text-red-300 animate-pulse font-extrabold';
    if (timeLeft <= 300) return 'text-yellow-300 font-bold';
    return 'text-white';
  };

  // ── Render states ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading Quiz...</p>
        </div>
      </div>
    );
  }

  // Block re-attempt: quiz already submitted
  if (alreadySubmitted) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <Card>
          <CardBody className="text-center p-10">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Already Submitted</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have already submitted this quiz. Once a quiz is closed, no re-attempts are allowed.
            </p>
            <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <p className="text-xl font-bold text-red-500">Quiz not found!</p>
        <Button onClick={() => navigate('/')} className="mt-4">Return to Dashboard</Button>
      </div>
    );
  }

  if (result) {
    const isEscalated = result.status === 'escalated' || result.score === null || result.total === null;
    const pct = !isEscalated && result.total ? Math.round((result.score! / result.total) * 100) : 0;
    const passed = pct >= 50;
    return (
      <div className="max-w-xl mx-auto mt-12">
        <Card>
          <CardBody className="text-center p-10">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isEscalated ? 'bg-yellow-100 dark:bg-yellow-900/30' : passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {isEscalated
                ? <AlertTriangle className="w-10 h-10 text-yellow-700 dark:text-yellow-400" />
                : passed
                  ? <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                  : <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              }
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quiz Completed!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Your answers have been recorded.</p>
            {isEscalated ? (
              <div className="inline-flex flex-col items-center justify-center w-44 h-36 rounded-2xl border-4 mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                <span className="text-xl font-extrabold text-yellow-700 dark:text-yellow-300">Under Review</span>
                <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mt-1">Escalated by TA policy</span>
              </div>
            ) : (
              <>
                <div className={`inline-flex flex-col items-center justify-center w-36 h-36 rounded-full border-4 mb-6 ${passed ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                  <span className={`text-4xl font-extrabold ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result.score}/{result.total}
                  </span>
                  <span className={`text-sm font-semibold ${passed ? 'text-green-500' : 'text-red-500'}`}>{pct}%</span>
                </div>
                <p className={`text-lg font-semibold mb-6 ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {passed ? '🎉 Great job!' : '📚 Keep studying!'}
                </p>
              </>
            )}
            {tabSwitches > 0 && (
              <p className="text-xs text-orange-500 dark:text-orange-400 mb-4">
                ⚠ {tabSwitches} tab switch(es) were recorded and flagged.
              </p>
            )}
            <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <Card>
          <CardBody className="text-center p-10">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Quiz Closed</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">{closeMessage || 'Your quiz has been closed.'}</p>
            {/* Show submitting indicator while the auto-submit is running in background */}
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Recording your attempt...
              </div>
            ) : (
              <p className="text-xs text-orange-500 dark:text-orange-400 mb-4">
                ⚠ This attempt has been recorded and flagged for TA review.
              </p>
            )}
            <Button onClick={() => navigate('/')} disabled={isSubmitting}>Return to Dashboard</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const answeredCount = answers.filter(a => a !== -1).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Quiz Header with Timer */}
      <div className="sticky top-0 z-20">
        <Card>
          <CardBody className="bg-gradient-to-r from-primary-600 to-violet-600 text-white rounded-xl p-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5">
              <div>
                <h1 className="text-2xl font-bold">{quiz.title}</h1>
                <p className="text-primary-100 text-sm mt-0.5">
                  {answeredCount}/{quiz.questions.length} answered
                </p>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-3 bg-black/20 backdrop-blur-sm px-5 py-3 rounded-xl border border-white/20">
                <Clock className="w-5 h-5 text-white shrink-0" />
                <div className="text-center">
                  <div className={`text-3xl font-mono tracking-widest ${timerColor()}`}>
                    {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                  </div>
                  <p className="text-xs text-primary-200">remaining</p>
                </div>
              </div>
            </div>

            {/* Anomaly warning bar */}
            {tabSwitches > 0 && (
              <div className="bg-orange-500/90 px-5 py-2 flex items-center gap-2 rounded-b-xl">
                <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                <p className="text-sm text-white font-medium">
                  {tabSwitches} tab switch(es) detected — {ANOMALY_CLOSE_THRESHOLD - tabSwitches} more will auto-close this quiz
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Questions */}
      {quiz.questions.map((q: any, i: number) => (
        <Card key={i}>
          <CardBody>
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-base">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-sm font-bold mr-2">{i + 1}</span>
              {q.text}
            </h3>
            <div className="space-y-2">
              {q.options.map((opt: string, optIdx: number) => (
                <label
                  key={optIdx}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                    answers[i] === optIdx
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${i}`}
                    checked={answers[i] === optIdx}
                    onChange={() => {
                      const newAnswers = [...answers];
                      newAnswers[i] = optIdx;
                      setAnswers(newAnswers);
                    }}
                    className="text-primary-600 focus:ring-primary-500 shrink-0"
                  />
                  <span className="text-gray-900 dark:text-gray-200">{opt}</span>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* Submit Bar */}
      <div className="sticky bottom-4">
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-lg p-4 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {answeredCount < quiz.questions.length ? (
              <span className="text-orange-500 font-medium">
                ⚠ {quiz.questions.length - answeredCount} question(s) unanswered
              </span>
            ) : (
              <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> All questions answered
              </span>
            )}
          </div>
          <Button
            onClick={() => doSubmit(false)}
            disabled={isSubmitting}
            className="min-w-[140px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Exam'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuizInterface;
