import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { PlusCircle, Trash2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState<'assessments' | 'quizzes' | 'notes' | 'submissions' | 'marks'>('assessments');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const location = useLocation();
  const [groups, setGroups] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<any[]>([]);
  const { user } = useAuth();
  const socketRef = useRef<any>(null);

  // Assessment State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  // Note State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLargeFile, setIsLargeFile] = useState(false);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState([{ text: '', options: ['', '', '', ''], correctIndex: 0 }]);
  const [timeLimit, setTimeLimit] = useState(30);

  const totalStudents = groups.reduce((count, group) => count + (group.studentIds?.length || 0), 0);
  const totalCourses = groups.length;
  const totalBatches = groups.length;
  const activeExams = quizzes.length;
  const section = new URLSearchParams(location.search).get('section') || 'home';

  useEffect(() => {
    fetchData();
    setupSocket();
  }, []);

  useEffect(() => {
    if (section === 'quizzes' || section === 'notes' || section === 'submissions' || section === 'marks') {
      setActiveTab(section as any);
    } else if (section === 'assessments') {
      setActiveTab('assessments');
    } else {
      setActiveTab('assessments');
    }
  }, [section]);

  const setupSocket = () => {
    try {
      const io = require('socket.io-client').io || (window as any).io;
      if (io) {
        socketRef.current = io('http://localhost:5000', {
          withCredentials: true,
        });
        
        socketRef.current.on('connect', () => {
          console.log('Connected to socket server');
          socketRef.current.emit('join_teacher_room');
        });

        socketRef.current.on('quizSubmitted', (data: any) => {
          setQuizSubmissions(prev => [data, ...prev]);
          toast.success(`${data.studentName} submitted quiz: ${data.score}/${data.totalQuestions}`);
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

        socketRef.current.on('submissionCreated', (newSubmission: any) => {
          setSubmissions((prev) => {
            const exists = prev.some((submission) => submission._id === newSubmission._id);
            return exists ? prev : [newSubmission, ...prev];
          });
        });

        socketRef.current.on('submissionStatusUpdated', (updatedSubmission: any) => {
          setSubmissions((prev) =>
            prev.map((submission) =>
              submission._id === updatedSubmission._id ? updatedSubmission : submission
            )
          );
        });

        socketRef.current.on('disconnect', () => {
          console.log('Disconnected from socket server');
        });
      }
    } catch (err) {
      console.log('Socket.io not available');
    }
  };

  const fetchData = async () => {
    try {
      const [gRes, aRes, qRes, nRes, subRes, quizSubRes] = await Promise.all([
        api.get('/groups'),
        api.get('/assessments'),
        api.get('/quizzes'),
        api.get('/notes'),
        api.get('/submissions'),
        api.get('/quizzes/submissions')
      ]);
      setGroups(gRes.data);
      setAssessments(aRes.data);
      setQuizzes(qRes.data);
      setNotes(nRes.data);
      setSubmissions(subRes.data);
      setQuizSubmissions(quizSubRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data');
    }
  };

  const createAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/assessments', { title, description, deadline, groupId: selectedGroup || undefined });
      toast.success('Assessment created!');
      setTitle(''); setDescription(''); setDeadline(''); setSelectedGroup('');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error creating assessment');
    }
  };

  const createNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return toast.warning('Please select a file');

    try {
      const formData = new FormData();
      formData.append('document', uploadFile);
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const fileUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${uploadRes.data}`;
      await api.post('/notes', { title, description, fileUrl, isLargeFile, groupId: selectedGroup || undefined });
      
      toast.success('Material published!');
      setTitle(''); setDescription(''); setUploadFile(null); setIsLargeFile(false); setSelectedGroup('');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error creating note or uploading file');
    }
  };

  const addQuestion = () => {
    setQuizQuestions([...quizQuestions, { text: '', options: ['', '', '', ''], correctIndex: 0 }]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...quizQuestions];
    (updated[index] as any)[field] = value;
    setQuizQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...quizQuestions];
    updated[qIndex].options[optIndex] = value;
    setQuizQuestions(updated);
  };

  const createDynamicQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/quizzes', { title, description, timeLimit, questions: quizQuestions, groupId: selectedGroup || undefined });
      toast.success('Quiz created!');
      setTitle(''); setDescription(''); setSelectedGroup('');
      setQuizQuestions([{ text: '', options: ['', '', '', ''], correctIndex: 0 }]);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error creating quiz');
    }
  };

  const verifySubmission = async (submissionId: string, status: 'approved' | 'rejected') => {
    try {
      await api.patch(`/submissions/${submissionId}`, { status });
      toast.success(`Submission ${status === 'approved' ? 'Approved ✓' : 'Rejected ✗'}`);
    } catch (error: any) {
      toast.error('Error updating submission status');
    }
  };

  // Determine which tabs show the create form
  const showCreateForm = activeTab === 'assessments' || activeTab === 'quizzes' || activeTab === 'notes';
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
                <span className="profile-info-label">Teacher ID</span>
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
              <h1 className="mt-2 text-5xl font-bold">Welcome to the Teacher Dashboard</h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #6a86f0 0%, #7d42ad 100%)' }}>
                <p className="text-2xl font-semibold">Total Courses</p>
                <p className="mt-2 text-5xl font-bold">{totalCourses}</p>
              </div>
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #df70f4 0%, #f57595 100%)' }}>
                <p className="text-2xl font-semibold">Total Batches</p>
                <p className="mt-2 text-5xl font-bold">{totalBatches}</p>
              </div>
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #37cf38 0%, #158f11 100%)' }}>
                <p className="text-2xl font-semibold">Enrolled Students</p>
                <p className="mt-2 text-5xl font-bold">{totalStudents}</p>
              </div>
              <div className="rounded-2xl p-5 text-white min-h-[112px]" style={{ background: 'linear-gradient(140deg, #54cfa7 0%, #3478c6 100%)' }}>
                <p className="text-2xl font-semibold">Active Exams</p>
                <p className="mt-2 text-5xl font-bold">{activeExams}</p>
              </div>
            </div>
          </div>
      </div>

      <div className="shell-surface px-8 py-8">
        <h2 className="text-4xl font-bold text-center">
          {activeTab === 'assessments'
            ? 'Assessments'
            : activeTab === 'quizzes'
            ? 'Exams & Quizzes'
            : activeTab === 'notes'
            ? 'Course Materials'
            : activeTab === 'submissions'
            ? 'Approvals'
            : 'Exam History'}
        </h2>
        <p className="text-center mt-3 text-sm" style={{ color: 'var(--muted-text)' }}>
          {activeTab === 'assessments'
            ? 'Create and manage assessment tasks for your students.'
            : activeTab === 'quizzes'
            ? 'Create and manage exams and quizzes for your groups.'
            : activeTab === 'notes'
            ? 'Upload and manage course materials and study resources.'
            : activeTab === 'submissions'
            ? 'Review and approve or reject student assignment submissions.'
            : 'Manage your dashboard data below.'}
        </p>
      </div>

      {/* Layout: 2-col when creating content, full-width for submissions/marks */}
      {showCreateForm ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — Create Form */}
          <div className="lg:col-span-1">
            <Card className="rounded-[12px]">
              <CardHeader title={`Create New ${activeTab === 'assessments' ? 'Assessment' : activeTab === 'quizzes' ? 'Exam / Quiz' : 'Material'}`} />
              <CardBody>
                <form onSubmit={activeTab === 'assessments' ? createAssessment : activeTab === 'quizzes' ? createDynamicQuiz : createNote} className="space-y-4">
                  <Input label="Title" required value={title} onChange={e => setTitle(e.target.value)} />
                  <div className="flex flex-col gap-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea 
                      rows={2} value={description} onChange={e => setDescription(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-700 rounded-md focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Group (Optional)</label>
                    <select 
                      value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-700 rounded-md focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    >
                      <option value="">All Students</option>
                      {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                    </select>
                  </div>

                  {activeTab === 'assessments' && (
                    <Input label="Deadline" type="date" required value={deadline} onChange={e => setDeadline(e.target.value)} />
                  )}

                  {activeTab === 'notes' && (
                    <>
                      <div className="flex flex-col gap-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload PDF</label>
                        <input 
                          type="file" accept="application/pdf" required 
                          onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                          className="dark:text-white"
                        />
                      </div>
                      <label className="flex items-center gap-2 mt-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={isLargeFile} onChange={e => setIsLargeFile(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500" />
                        Mark as Large File (Generates QR Code for students)
                      </label>
                    </>
                  )}

                  {activeTab === 'quizzes' && (
                    <div className="space-y-6 mt-4">
                      <Input label="Time Limit (minutes)" type="number" required value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} />
                      
                      <div className="space-y-4">
                        {quizQuestions.map((q, qIndex) => (
                          <div key={qIndex} className="p-4 border dark:border-gray-700 rounded-lg space-y-3 relative">
                            <h4 className="font-bold dark:text-white">Question {qIndex + 1}</h4>
                            <Input label="" placeholder="Question text..." required value={q.text} onChange={e => updateQuestion(qIndex, 'text', e.target.value)} />
                            
                            <div className="grid grid-cols-2 gap-2">
                              {q.options.map((opt, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2">
                                  <input 
                                    type="radio" name={`correct-${qIndex}`} 
                                    checked={q.correctIndex === optIndex} 
                                    onChange={() => updateQuestion(qIndex, 'correctIndex', optIndex)} 
                                  />
                                  <Input 
                                    label=""
                                    placeholder={`Option ${optIndex + 1}`} required 
                                    value={opt} onChange={e => updateOption(qIndex, optIndex, e.target.value)} 
                                  />
                                </div>
                              ))}
                            </div>
                            {quizQuestions.length > 1 && (
                              <button type="button" onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== qIndex))} className="absolute top-4 right-4 text-red-500">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button type="button" variant="secondary" onClick={addQuestion} className="w-full flex justify-center items-center gap-2">
                        <PlusCircle size={16} /> Add Question
                      </Button>
                    </div>
                  )}

                  <Button type="submit" className="w-full mt-6">Publish</Button>
                </form>
              </CardBody>
            </Card>
          </div>

          {/* RIGHT — Active Content List */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Content</h2>
              {activeTab === 'assessments' && assessments.map(item => (
                <Card key={item._id}>
                  <CardBody>
                    <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-primary-600">{item.groupId ? `Group: ${item.groupId.name}` : 'All Students'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Due: {new Date(item.deadline).toLocaleDateString()}</p>
                  </CardBody>
                </Card>
              ))}
              {activeTab === 'quizzes' && quizzes.map(item => (
                <Card key={item._id}>
                  <CardBody>
                    <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-primary-600">{item.groupId ? `Group: ${item.groupId.name}` : 'All Students'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.questions?.length} Questions | {item.timeLimit} mins</p>
                  </CardBody>
                </Card>
              ))}
              {activeTab === 'notes' && notes.map(item => (
                <Card key={item._id}>
                  <CardBody>
                    <h3 className="font-bold text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-primary-600">{item.groupId ? `Group: ${item.groupId.name}` : 'All Students'}</p>
                    {item.isLargeFile && <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-bold">QR Gen</span>}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Full-width layout for Submissions and Quiz Marks */
        <div className="space-y-4">
          {activeTab === 'submissions' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Assignment Submissions</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">{submissions.length} total</span>
              </div>
              {submissions.length === 0 ? (
                <Card>
                  <CardBody>
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No submissions yet</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submissions.map(sub => {
                    const status = sub.status?.toLowerCase() || 'pending';
                    const isPending = status === 'pending';
                    return (
                      <Card key={sub._id} className={`border-l-4 ${
                        status === 'approved' ? 'border-l-green-500' :
                        status === 'rejected' ? 'border-l-red-500' :
                        'border-l-yellow-500'
                      }`}>
                        <CardBody>
                          <div className="space-y-3">
                            {/* Student Info */}
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-base">{sub.studentId?.name}</p>
                                <p className="text-xs text-primary-600 dark:text-primary-400 font-mono mt-0.5">ID: {sub.studentId?.uniqueId}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Assessment: {sub.assessmentId?.title || 'N/A'}
                                </p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                                status === 'approved'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                  : status === 'rejected'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                              }`}>
                                {status === 'approved' && <CheckCircle2 size={12} />}
                                {status === 'rejected' && <XCircle size={12} />}
                                {status}
                              </span>
                            </div>

                            {/* Submitted Content */}
                            {sub.contentUrl && (
                              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">Submitted Content</p>
                                <a 
                                  href={sub.contentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium break-all"
                                >
                                  <ExternalLink size={14} className="shrink-0" />
                                  {sub.contentUrl}
                                </a>
                              </div>
                            )}

                            {/* Action Buttons — only when pending */}
                            {isPending && (
                              <div className="flex gap-2 pt-1">
                                <Button 
                                  onClick={() => verifySubmission(sub._id, 'approved')} 
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 size={15} /> Approve
                                </Button>
                                <Button 
                                  onClick={() => verifySubmission(sub._id, 'rejected')} 
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 flex items-center justify-center gap-1"
                                >
                                  <XCircle size={15} /> Reject
                                </Button>
                              </div>
                            )}
                            {!isPending && (
                              <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1 italic">
                                Decision recorded — no further action needed
                              </p>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'marks' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quiz Submissions & Marks</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">{quizSubmissions.length} submissions</span>
              </div>
              {quizSubmissions.length === 0 ? (
                <Card>
                  <CardBody>
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No quiz submissions yet</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {quizSubmissions.map(qSub => {
                    const pct = Math.round((qSub.score / qSub.totalQuestions) * 100);
                    const color = pct >= 75 ? 'text-green-600 dark:text-green-400' : pct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
                    // Only show "Escalated" if an actual escalation was triggered
                    const isEscalated = qSub.resultStatus === 'escalated' && qSub.anomalyStatus === 'escalated';
                    const displayStatus = isEscalated ? 'escalated' : (pct >= 50 ? 'passed' : 'failed');
                    return (
                      <Card key={qSub._id} className="border-l-4 border-l-primary-500">
                        <CardBody>
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate">{qSub.studentId?.name}</p>
                              <p className="text-xs text-primary-600 dark:text-primary-400 font-mono mt-0.5">ID: {qSub.studentId?.uniqueId}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">Quiz: {qSub.quizId?.title}</p>
                              <div className="mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  isEscalated
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                    : displayStatus === 'passed'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                }`}>
                                  {isEscalated ? 'Escalated · Failed' : displayStatus}
                                </span>
                              </div>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              {isEscalated ? (
                                <>
                                  <p className="text-lg font-bold text-red-600 dark:text-red-400">Escalated</p>
                                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">Score Hidden</p>
                                </>
                              ) : (
                                <>
                                  <p className={`text-2xl font-bold ${color}`}>{qSub.score}/{qSub.totalQuestions}</p>
                                  <p className={`text-xs font-semibold ${color}`}>{pct}%</p>
                                </>
                              )}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
