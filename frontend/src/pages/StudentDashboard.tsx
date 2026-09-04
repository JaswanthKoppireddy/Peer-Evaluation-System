import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { CheckCircle, XCircle, Award } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState<'assessments' | 'quizzes' | 'notes' | 'submissions'>('assessments');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const location = useLocation();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submissionUrls, setSubmissionUrls] = useState<{ [key: string]: string }>({});
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<any>(null);
  const section = new URLSearchParams(location.search).get('section') || 'home';

  useEffect(() => {
    fetchData();
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (section === 'quizzes') {
      setActiveTab('quizzes');
    } else if (section === 'notes') {
      setActiveTab('notes');
    } else if (section === 'submissions') {
      setActiveTab('submissions');
    } else {
      setActiveTab('assessments');
    }
  }, [section]);

  const setupSocket = () => {
    try {
      const io = require('socket.io-client').io || (window as any).io;
      if (io && user?._id) {
        socketRef.current = io('http://localhost:5000', {
          withCredentials: true,
        });

        socketRef.current.on('connect', () => {
          socketRef.current.emit('join_student', { userId: user._id });
        });

        socketRef.current.on('submissionStatusUpdated', (updatedSubmission: any) => {
          setSubmissions((prev) =>
            prev.map((submission) =>
              submission._id === updatedSubmission._id ? updatedSubmission : submission
            )
          );
        });

        socketRef.current.on('submissionCreated', (newSubmission: any) => {
          setSubmissions((prev) => {
            const exists = prev.some((submission) => submission._id === newSubmission._id);
            return exists ? prev : [newSubmission, ...prev];
          });
        });

        socketRef.current.on('quizSubmissionUpdated', (updatedSubmission: any) => {
          setQuizSubmissions((prev) => {
            const idx = prev.findIndex((submission) => submission._id === updatedSubmission._id);
            if (idx === -1) return [updatedSubmission, ...prev];
            const next = [...prev];
            next[idx] = updatedSubmission;
            return next;
          });
        });
      }
    } catch (err) {
      console.log('Socket.io not available');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [aRes, qRes, nRes, subRes, qSubRes] = await Promise.all([
        api.get('/assessments'),
        api.get('/quizzes'),
        api.get('/notes'),
        api.get('/submissions'),
        api.get('/quizzes/submissions').catch(() => ({ data: [] }))
      ]);
      setAssessments(aRes.data);
      setQuizzes(qRes.data);
      setNotes(nRes.data);
      setSubmissions(subRes.data);
      setQuizSubmissions(qSubRes.data);
    } catch (error) {
      toast.error('Error fetching dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Returns the submission object for an assessment if submitted
  const getAssessmentSubmission = (assessmentId: string) => {
    return submissions.find(sub => sub.assessmentId?._id === assessmentId || sub.assessmentId === assessmentId);
  };

  // Returns the quiz submission if submitted
  const getQuizSubmission = (quizId: string) => {
    return quizSubmissions.find(sub => sub.quizId?._id === quizId || sub.quizId === quizId);
  };

  const enrolledCourses = assessments.length;
  const pendingEvaluations = submissions.filter(s => s.status?.toLowerCase() === 'pending').length;
  const activeExamsCount = quizzes.filter(q => !q.isClosed).length || quizzes.length;

  const handleUrlChange = (id: string, value: string) => {
    setSubmissionUrls(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmitWork = async (assessmentId: string) => {
    const url = submissionUrls[assessmentId];
    if (!url?.trim()) return toast.error('Please enter a submission URL or link');
    try {
      await api.post('/submissions', {
        assessmentId,
        submissionType: 'Portal',
        contentUrl: url.trim()
      });
      toast.success('Submitted successfully! Awaiting teacher review.');
      handleUrlChange(assessmentId, '');
      fetchData();
    } catch (error: any) {
      const msg = error.response?.data?.message;
      if (msg === 'Assignment Successfully Submitted') {
        toast.info('You have already submitted this assignment.');
      } else {
        toast.error(msg || 'Error submitting work');
      }
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded"></div>
      </div>
    );
  }

  // Status badge helper for assessments
  const AssessmentStatusBadge = ({ status }: { status?: string }) => {
    const s = status?.toLowerCase() || 'pending';
    if (s === 'pending') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-bold rounded-full">
        Pending
      </span>
    );
    if (s === 'rejected') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs font-bold rounded-full">
        <XCircle size={11} /> Rejected
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs font-bold rounded-full">
        <CheckCircle size={11} /> Approved
      </span>
    );
  };
  if (section === 'profile') {
    return (
      <>
        <ChangePasswordModal isOpen={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
        <div className="shell-surface p-8 md:p-10 min-h-[75vh]">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">My Profile</h2>
          <div className="space-y-5">
            <div className="profile-info-row">
              <span className="profile-info-label">Full Name</span>
              <span className="profile-info-value">{user?.name}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">Email Address</span>
              <span className="profile-info-value">{user?.email}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">Role</span>
              <span className="profile-info-value">{user?.role}</span>
            </div>
            {user?.uniqueId && (
              <div className="profile-info-row">
                <span className="profile-info-label">Student ID</span>
                <span className="profile-info-value font-mono">{user.uniqueId}</span>
              </div>
            )}
          </div>
          <button
            id="open-change-password-btn"
            onClick={() => setChangePasswordOpen(true)}
            className="gradient-btn mt-10 px-7"
          >
            Change Password
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="shell-surface px-8 py-8 min-h-[210px]">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
            <div>
              <h1 className="mt-2 text-5xl font-bold">Welcome to the Student Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #6a86f0 0%, #7d42ad 100%)' }}>
                <p className="text-2xl font-semibold">Courses Enrolled</p>
                <p className="mt-2 text-5xl font-bold">{enrolledCourses}</p>
              </div>
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #37cf38 0%, #158f11 100%)' }}>
                <p className="text-2xl font-semibold">Pending Evaluations</p>
                <p className="mt-2 text-5xl font-bold">{pendingEvaluations}</p>
              </div>
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #54cfa7 0%, #3478c6 100%)' }}>
                <p className="text-2xl font-semibold">Active Exams</p>
                <p className="mt-2 text-5xl font-bold">{activeExamsCount}</p>
              </div>
            </div>
          </div>
      </div>

      <div className="shell-surface px-8 py-8">
        <h2 className="text-4xl font-bold text-center">
          {activeTab === 'submissions'
            ? 'Results'
            : activeTab === 'assessments'
            ? 'Assessments'
            : activeTab === 'quizzes'
            ? 'Exams & Quizzes'
            : 'Course Materials'}
        </h2>
        <p className="text-center mt-3 text-sm" style={{ color: 'var(--muted-text)' }}>
          {activeTab === 'submissions'
            ? 'Your assignment approvals and quiz scores are shown below.'
            : activeTab === 'assessments'
            ? 'Submit your assignments and track teacher approvals.'
            : activeTab === 'quizzes'
            ? 'Take available exams and view your quiz results.'
            : 'Access study materials and course resources.'}
        </p>
      </div>

      {/* ── RESULTS (submissions) ── */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          {/* Assignment Results */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold" style={{ color: 'var(--primary-text)' }}>
              Assignment Submissions
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--muted-text)' }}>({submissions.length} total)</span>
            </h3>
            {submissions.length === 0 ? (
              <div className="shell-surface p-8 text-center" style={{ color: 'var(--muted-text)' }}>
                <p className="text-sm italic">No assignment submissions yet. Submit work from the Assessments tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {submissions.map(sub => {
                  const status = sub.status?.toLowerCase() || 'pending';
                  return (
                    <Card key={sub._id} className={`border-l-4 ${
                      status === 'approved' ? 'border-l-green-500' :
                      status === 'rejected' ? 'border-l-red-500' :
                      'border-l-yellow-500'
                    }`}>
                      <CardBody>
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--primary-text)' }}>
                              {sub.assessmentId?.title || 'Assignment'}
                            </p>
                            {sub.contentUrl && (
                              <p className="text-xs mt-1 truncate" style={{ color: 'var(--muted-text)' }}>
                                Submitted: {sub.contentUrl}
                              </p>
                            )}
                          </div>
                          <AssessmentStatusBadge status={status} />
                        </div>
                        {status !== 'pending' && (
                          <p className="text-xs mt-2 italic" style={{ color: 'var(--muted-text)' }}>
                            {status === 'approved' ? '✓ Teacher approved your submission.' : '✗ Teacher rejected — contact your instructor.'}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quiz Results */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold" style={{ color: 'var(--primary-text)' }}>
              Quiz Results
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--muted-text)' }}>({quizSubmissions.length} attempted)</span>
            </h3>
            {quizSubmissions.length === 0 ? (
              <div className="shell-surface p-8 text-center" style={{ color: 'var(--muted-text)' }}>
                <p className="text-sm italic">No quiz results yet. Take an exam from the Exams & Quizzes tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizSubmissions.map(qSub => {
                  const isEscalated = qSub.resultStatus === 'escalated' && qSub.anomalyStatus === 'escalated';
                  const hasScore = !isEscalated && typeof qSub.score === 'number' && typeof qSub.totalQuestions === 'number' && qSub.totalQuestions > 0;
                  const pct = hasScore ? Math.round((qSub.score / qSub.totalQuestions) * 100) : 0;
                  const scoreColor = pct >= 75 ? 'text-green-600 dark:text-green-400' : pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
                  const displayStatus = isEscalated ? 'Escalated' : (hasScore ? (pct >= 50 ? 'Passed' : 'Failed') : 'Under Review');
                  return (
                    <Card key={qSub._id} className={`border-l-4 ${
                      isEscalated ? 'border-l-red-500' :
                      hasScore && pct >= 50 ? 'border-l-green-500' :
                      hasScore ? 'border-l-yellow-500' :
                      'border-l-primary-500'
                    }`}>
                      <CardBody>
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--primary-text)' }}>
                              {qSub.quizId?.title || 'Quiz'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-text)' }}>
                              {qSub.timestamp ? new Date(qSub.timestamp).toLocaleDateString() : (qSub.createdAt ? new Date(qSub.createdAt).toLocaleDateString() : '')}
                            </p>
                            <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                              isEscalated
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : displayStatus === 'Passed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : displayStatus === 'Failed'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {displayStatus}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            {isEscalated ? (
                              <>
                                <XCircle className="w-6 h-6 text-red-500 mx-auto" />
                                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">Score Hidden</p>
                              </>
                            ) : hasScore ? (
                              <>
                                <p className={`text-2xl font-bold ${scoreColor}`}>{qSub.score}/{qSub.totalQuestions}</p>
                                <p className={`text-xs font-semibold ${scoreColor}`}>{pct}%</p>
                              </>
                            ) : (
                              <Award className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-auto" />
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab !== 'submissions' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── ASSESSMENTS ── */}
        {activeTab === 'assessments' && assessments.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No assessments available.</div>
        )}
        {activeTab === 'assessments' && assessments.map(item => {
          const submission = getAssessmentSubmission(item._id);
          const isSubmitted = !!submission;
          const status = submission?.status?.toLowerCase() || 'pending';

          return (
            <Card key={item._id} className={isSubmitted ? 'border-l-4 border-l-green-500' : ''}>
              <CardHeader title={item.title} subtitle={`Due: ${new Date(item.deadline).toLocaleDateString()}`} />
              <CardBody>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">{item.description}</p>
                {isSubmitted ? (
                  <div className="space-y-3">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-800 dark:text-green-300">Assignment Submitted</p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">You can only submit once</p>
                        {submission.contentUrl && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                            Submitted: <span className="text-primary-600 dark:text-primary-400">{submission.contentUrl}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Teacher Review Status */}
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Teacher Review:</span>
                      <AssessmentStatusBadge status={status} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Submit your work</h4>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Input 
                          label=""
                          placeholder="Paste PDF link or Github URL" 
                          value={submissionUrls[item._id] || ''}
                          onChange={e => handleUrlChange(item._id, e.target.value)}
                        />
                      </div>
                      <Button onClick={() => handleSubmitWork(item._id)}>Submit</Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}

        {/* ── QUIZZES ── */}
        {activeTab === 'quizzes' && quizzes.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No quizzes available.</div>
        )}
        {activeTab === 'quizzes' && quizzes.map(item => {
          const submission = getQuizSubmission(item._id);
          const isSubmitted = !!submission;
          const isClosed = item.isClosed === true; // quiz closed by teacher/system
          const resultStatus = submission?.resultStatus || 'pending';
          // Only show "Escalated" if an escalation was actually triggered
          const isEscalated = resultStatus === 'escalated' && submission?.anomalyStatus === 'escalated';
          const hasVisibleScore = !isEscalated && typeof submission?.score === 'number' && typeof submission?.totalQuestions === 'number' && submission.totalQuestions > 0;
          const pct = hasVisibleScore ? Math.round((submission.score / submission.totalQuestions) * 100) : 0;
          const scoreColor = pct >= 75 ? 'text-green-600 dark:text-green-400' : pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
          // Determine display status — never show "pending", show "Approved" for non-escalated
          const displayStatus = isEscalated ? 'Escalated' : (hasVisibleScore ? (pct >= 50 ? 'Passed' : 'Failed') : 'Under Review');

          return (
            <Card key={item._id} className={`border-l-4 ${isSubmitted ? (isEscalated ? 'border-l-red-500' : 'border-l-green-500') : (isClosed ? 'border-l-gray-400' : 'border-l-primary-500')}`}>
              <CardHeader title={item.title} subtitle={`${item.questions?.length} Questions | ${item.timeLimit} mins`} />
              <CardBody>
                {isSubmitted ? (
                  <div className="space-y-3">
                    <div className={`${isEscalated ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} p-4 rounded-lg border`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Award className={`w-5 h-5 ${isEscalated ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                        <p className={`font-semibold ${isEscalated ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>
                          {isEscalated ? 'Quiz Escalated by TA' : 'Quiz Successfully Submitted'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${isEscalated ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                          {isEscalated ? 'Status:' : 'Your Score:'}
                        </p>
                        <div className="text-right">
                          {isEscalated ? (
                            <span className="text-lg font-bold text-red-600 dark:text-red-400">Under Review</span>
                          ) : hasVisibleScore ? (
                            <>
                              <span className={`text-2xl font-bold ${scoreColor}`}>{submission.score}/{submission.totalQuestions}</span>
                              <span className={`ml-2 text-sm font-semibold ${scoreColor}`}>({pct}%)</span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Under Review</span>
                          )}
                        </div>
                      </div>
                      {/* Only show Escalated badge when escalation was actually triggered */}
                      {isEscalated && (
                        <p className="text-xs mt-2 font-semibold text-red-700 dark:text-red-400">
                          Status: Escalated
                        </p>
                      )}
                      {!isEscalated && (
                        <p className="text-xs mt-2 font-semibold text-gray-500 dark:text-gray-400">
                          Result: {displayStatus}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">Quiz submitted — results are final. No re-attempt allowed.</p>
                  </div>
                ) : isClosed ? (
                  // Quiz was closed (e.g. time expired system-wide) — no attempt allowed
                  <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-gray-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-700 dark:text-gray-300">Quiz Closed</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This quiz is no longer available for attempts.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Shuffled questions &amp; anomaly detection active.</p>
                    <Button onClick={() => navigate(`/quiz/${item._id}`)}>Take Exam</Button>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}

        {/* ── NOTES ── */}
        {activeTab === 'notes' && notes.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">No course materials available.</div>
        )}
        {activeTab === 'notes' && notes.map(item => (
          <Card key={item._id}>
            <CardHeader title={item.title} subtitle={item.isLargeFile ? 'High Size PDF' : 'Standard Material'} />
            <CardBody className="flex flex-col items-center justify-center text-center">
              {item.isLargeFile && item.fileUrl ? (
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Scan to download the large PDF securely.</p>
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <QRCodeSVG value={item.fileUrl} size={150} />
                  </div>
                </div>
              ) : (
                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">
                  Open Document Link
                </a>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
};

export default StudentDashboard;
