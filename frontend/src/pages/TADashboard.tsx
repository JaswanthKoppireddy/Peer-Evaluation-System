import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardBody } from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { Users, PlusCircle, AlertTriangle, CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface AnomalyEntry {
  _id: string;
  studentId: { _id: string; name: string; uniqueId: string; email: string };
  quizId: { _id: string; title: string };
  anomalyFlags: string[];
  score: number;
  totalQuestions: number;
  timestamp: string;
  anomalyCount?: number;
  anomalyStatus?: 'open' | 'dismissed' | 'escalated' | 'chance_granted' | 'none';
  resultStatus?: 'passed' | 'failed' | 'escalated' | 'pending';
}

const CLOSE_THRESHOLD = 3;

const TADashboard = () => {
  const [activeTab, setActiveTab] = useState<'anomalies' | 'escalations' | 'groups'>('anomalies');
  const location = useLocation();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyEntry[]>([]);
  // Live anomaly events keyed by `studentId-quizId`
  const [liveAnomalyMap, setLiveAnomalyMap] = useState<Record<string, { count: number; latest: any }>>({});
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMap, setActionMap] = useState<Record<string, 'chance' | 'escalated'>>({});
  const { user } = useAuth();
  const socketRef = useRef<any>(null);

  const myTeacherId = typeof (user as any)?.teacherId === 'string'
    ? (user as any).teacherId
    : (user as any)?.teacherId?._id || null;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setupSocket();
    return () => { socketRef.current?.disconnect(); };
  }, [myTeacherId, user?._id]);

  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section');
    if (section === 'groups') {
      setActiveTab('groups');
    } else if (section === 'escalations') {
      setActiveTab('escalations');
    } else {
      setActiveTab('anomalies');
    }
  }, [location.search]);

  const setupSocket = () => {
    try {
      socketRef.current?.disconnect();
      socketRef.current = io('http://localhost:5000', { withCredentials: true });

      socketRef.current.on('connect', () => {
        // Join teacher-scoped TA room so we only get anomalies for our teacher
        socketRef.current.emit('join_ta_room', { teacherId: myTeacherId || undefined });
      });

      // Real-time tab-switch events WHILE student is still in quiz
      socketRef.current.on('liveAnomaly', (data: any) => {
        const key = `${data.studentId}-${data.quizId}`;
        setLiveAnomalyMap(prev => {
          const existing = prev[key];
          const newCount = (existing?.count || 0) + 1;
          return { ...prev, [key]: { count: newCount, latest: data } };
        });
        toast.error(`🚨 Anomaly: ${data.studentName || 'Student'} — tab switch #${data.anomalyCount}`);
      });

      // Persisted anomaly: quiz was auto-submitted after tab-switch threshold
      // Adds the new DB record directly to the Recorded Anomalies list in real-time
      socketRef.current.on('persistedAnomaly', (data: any) => {
        const newEntry: AnomalyEntry = {
          _id: data.submissionId,
          studentId: {
            _id: data.studentId,
            name: data.studentName,
            uniqueId: data.studentUniqueId,
            email: '',
          },
          quizId: { _id: data.quizId, title: data.quizTitle },
          anomalyFlags: data.anomalyFlags || [],
          score: data.score,
          totalQuestions: data.totalQuestions,
          timestamp: data.timestamp,
          anomalyStatus: data.anomalyStatus,
          resultStatus: data.resultStatus,
        };
        // Avoid duplicates: only add if not already tracked
        setAnomalies(prev => {
          const alreadyExists = prev.some(a => a._id === newEntry._id);
          if (alreadyExists) return prev;
          return [newEntry, ...prev];
        });
        toast.warning(`📋 Quiz closed — anomaly recorded for ${data.studentName}`);
      });

      socketRef.current.on('quizSubmissionUpdated', (updatedSubmission: any) => {
        setAnomalies((prev) => {
          const hasAnomaly = (updatedSubmission?.anomalyFlags || []).length > 0;
          const index = prev.findIndex((entry) => entry._id === updatedSubmission._id);

          // Remove only if no anomaly exists anymore.
          if (!hasAnomaly) {
            if (index === -1) return prev;
            return prev.filter((entry) => entry._id !== updatedSubmission._id);
          }

          const mapped: AnomalyEntry = {
            _id: updatedSubmission._id,
            studentId: updatedSubmission.studentId,
            quizId: updatedSubmission.quizId,
            anomalyFlags: updatedSubmission.anomalyFlags || [],
            score: updatedSubmission.score,
            totalQuestions: updatedSubmission.totalQuestions,
            timestamp: updatedSubmission.createdAt,
            anomalyStatus: updatedSubmission.anomalyStatus,
            resultStatus: updatedSubmission.resultStatus,
          };

          if (index === -1) return [mapped, ...prev];
          const next = [...prev];
          next[index] = mapped;
          return next;
        });
      });

      socketRef.current.on('disconnect', () => console.log('TA socket disconnected'));
    } catch (err) {
      console.log('Socket not available');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupRes, studRes, qSubRes] = await Promise.all([
        api.get('/groups'),
        api.get('/students'),
        api.get('/quizzes/submissions').catch(() => ({ data: [] })),
      ]);

      setGroups(groupRes.data || []);
      setStudents(studRes.data || []);

      // Build anomaly list from persisted quiz submissions with anomalyFlags
      const list: AnomalyEntry[] = [];
      (qSubRes.data || []).forEach((sub: any) => {
        if (sub.anomalyFlags && sub.anomalyFlags.length > 0) {
          list.push({
            _id: sub._id,
            studentId: sub.studentId,
            quizId: sub.quizId,
            anomalyFlags: sub.anomalyFlags,
            score: sub.score,
            totalQuestions: sub.totalQuestions,
            timestamp: sub.createdAt,
            anomalyStatus: sub.anomalyStatus,
            resultStatus: sub.resultStatus,
          });
        }
      });
      setAnomalies(list);
    } catch (err) {
      console.error('TA fetch error', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  /* ── Actions ─────────────────────────────────────────────────────── */
  const giveAnotherChance = async (key: string, studentId: string, quizId: string) => {
    try {
      await api.patch('/quizzes/submissions/live/anomaly-status', {
        action: 'chance',
        studentId,
        quizId,
      });
      setActionMap(prev => ({ ...prev, [key]: 'chance' }));
      toast.success('Another chance granted and anomaly dismissed.');
      // Remove from live map after brief delay
      setTimeout(() => setLiveAnomalyMap(prev => { const n = { ...prev }; delete n[key]; return n; }), 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to grant another chance');
    }
  };

  const escalateStudent = async (key: string, studentId: string, quizId: string, name: string) => {
    try {
      await api.patch('/quizzes/submissions/live/anomaly-status', {
        action: 'escalate',
        studentId,
        quizId,
      });
      setActionMap(prev => ({ ...prev, [key]: 'escalated' }));
      toast.error(`${name} escalated — marked failed across dashboards.`);
      fetchData();
      setTimeout(() => setLiveAnomalyMap(prev => { const n = { ...prev }; delete n[key]; return n; }), 1800);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to escalate student');
    }
  };

  const dismissAnomaly = async (id: string) => {
    try {
      await api.patch(`/quizzes/submissions/${id}/anomaly-status`, { action: 'dismiss' });
      setAnomalies(prev => prev.filter(a => a._id !== id));
      toast.success('Anomaly dismissed permanently');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dismiss anomaly');
    }
  };

  const escalatePersistedAnomaly = async (anom: AnomalyEntry) => {
    try {
      await api.patch('/quizzes/submissions/live/anomaly-status', {
        action: 'escalate',
        studentId: anom.studentId?._id,
        quizId: anom.quizId?._id,
      });
      toast.error(`${anom.studentId?.name} escalated — marked failed.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to escalate anomaly');
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedStudents.length === 0) {
      toast.warning('Enter a group name and select at least one student');
      return;
    }
    try {
      await api.post('/groups', { name: groupName.trim(), studentIds: selectedStudents });
      setGroupName('');
      setSelectedStudents([]);
      fetchData();
      toast.success('Group created!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error creating group');
    }
  };

  const toggleStudent = (id: string) =>
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  /* ── Live anomaly entries (from socket) ──────────────────────────── */
  const liveEntries = Object.entries(liveAnomalyMap).map(([key, val]) => ({ key, ...val }));

  /* ── Pending-only badge count ────────────────────────────────────── */
  const pendingPersisted = anomalies.filter(a => a.anomalyStatus === 'open').length;
  const pendingLive = liveEntries.filter(({ key }) => !actionMap[key]).length;
  const pendingAnomalyCount = pendingPersisted + pendingLive;

  if (loading) return (
    <div className="p-8 text-center flex flex-col items-center gap-3 dark:text-white">
      <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      <p>Loading TA dashboard...</p>
    </div>
  );

  const section = new URLSearchParams(location.search).get('section') || 'home';

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
                <span className="profile-info-label">TA ID</span>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b dark:border-gray-800 pb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            TA Operations
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 font-mono">({user?.uniqueId})</span>
          </h1>
          {myTeacherId && (
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 font-mono">
              Linked Teacher ID: {myTeacherId}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={activeTab === 'anomalies' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('anomalies')} className="relative flex items-center gap-2">
            <AlertTriangle size={18} /> Anomalies
            {pendingAnomalyCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {pendingAnomalyCount}
              </span>
            )}
          </Button>
          <Button variant={activeTab === 'escalations' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('escalations')} className="flex items-center gap-2">
            <XCircle size={18} /> Escalations
            {anomalies.filter(a => a.anomalyStatus === 'escalated').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">
                {anomalies.filter(a => a.anomalyStatus === 'escalated').length}
              </span>
            )}
          </Button>
          <Button variant={activeTab === 'groups' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('groups')} className="flex items-center gap-2">
            <Users size={18} /> Groups
          </Button>
        </div>
      </div>

      {/* ── ANOMALIES TAB ─────────────────────────────────────────────── */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
            Quiz auto-closes at <strong>{CLOSE_THRESHOLD} tab switches</strong>. Use <strong>Give Another Chance</strong> to notify the student, or <strong>Escalate</strong> to force-close the quiz.
          </div>

          {/* LIVE Anomalies (from socket) */}
          {liveEntries.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Live Detections ({liveEntries.length})
              </h3>
              {liveEntries.map(({ key, count, latest }) => {
                const taken = actionMap[key];
                const isCritical = count >= CLOSE_THRESHOLD;
                return (
                  <Card key={key} className={`border-l-4 ${isCritical ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10' : 'border-l-orange-400 bg-orange-50 dark:bg-orange-900/10'}`}>
                    <CardBody>
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {isCritical ? <XCircle className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-orange-500" />}
                            <span className="font-bold text-gray-900 dark:text-white">{latest.studentName}</span>
                            <span className="font-mono text-xs text-primary-600 dark:text-primary-400">({latest.studentUniqueId})</span>
                            {isCritical && <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">CRITICAL</span>}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Quiz: <span className="font-medium">{latest.quizTitle}</span></p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="px-2 py-1 bg-orange-200 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 text-xs rounded font-medium">
                              Tab Switches: {count}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Clock size={11} /> {new Date(latest.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          {!taken ? (
                            <>
                              <Button onClick={() => giveAnotherChance(key, latest.studentId, latest.quizId)}
                                className="bg-green-600 hover:bg-green-700 text-white text-sm border-0">
                                ✓ Dismiss & Give Chance
                              </Button>
                              <Button onClick={() => escalateStudent(key, latest.studentId, latest.quizId, latest.studentName)}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm">
                                ⚠ Escalate
                              </Button>
                            </>
                          ) : (
                            <div className={`px-3 py-2 rounded-lg text-center text-sm font-semibold ${taken === 'chance' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                              {taken === 'chance' ? '✓ Chance Granted' : '⚠ Escalated'}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Persisted Anomalies (from DB) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              Recorded Anomalies
              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full font-bold">{anomalies.length}</span>
              <span className="text-xs font-normal text-gray-400 normal-case">— quiz closed by tab switch or time limit</span>
            </h3>
            {anomalies.length === 0 ? (
              <div className="p-8 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 dark:text-green-300">All Clear!</h3>
                <p className="text-green-600 dark:text-green-400 text-sm mt-1">No recorded anomalies in submissions.</p>
              </div>
            ) : (
              anomalies.map(anom => {
                const flagCount = anom.anomalyFlags?.length || 0;
                const isCritical = flagCount >= CLOSE_THRESHOLD || anom.resultStatus === 'escalated';
                const isFinalized = anom.anomalyStatus === 'dismissed' || anom.anomalyStatus === 'escalated';
                // Determine termination reason from flags
                const wasTabSwitchClosure = anom.anomalyFlags?.some(f =>
                  f.toLowerCase().includes('tab switch') || f.toLowerCase().includes('escalated')
                );
                return (
                  <Card key={anom._id} className={`border-l-4 ${isCritical ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
                    <CardBody>
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {isCritical ? <XCircle className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                            <span className="font-bold text-gray-900 dark:text-white">{anom.studentId?.name}</span>
                            <span className="font-mono text-xs text-primary-600 dark:text-primary-400">({anom.studentId?.uniqueId})</span>
                            {isCritical && <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">CRITICAL</span>}
                            {/* Termination reason badge */}
                            {wasTabSwitchClosure ? (
                              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full font-semibold">
                                🔄 Tab Switch Closure
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-semibold">
                                ⏱ Time Limit
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Quiz: <span className="font-medium">{anom.quizId?.title}</span></p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {anom.anomalyFlags.map((f, i) => (
                              <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded">{f}</span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Score: <span className="font-semibold">{anom.score}/{anom.totalQuestions}</span>
                            {anom.timestamp && <span className="ml-3">· {new Date(anom.timestamp).toLocaleString()}</span>}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 self-start min-w-[140px]">
                          {!isFinalized ? (
                            <>
                              <Button variant="outline" onClick={() => dismissAnomaly(anom._id)} className="text-sm">
                                Dismiss
                              </Button>
                              <Button onClick={() => escalatePersistedAnomaly(anom)} className="bg-red-600 hover:bg-red-700 text-white text-sm">
                                Escalate
                              </Button>
                            </>
                          ) : (
                            <div className={`px-3 py-2 rounded-lg text-center text-sm font-semibold ${anom.anomalyStatus === 'escalated' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                              {anom.anomalyStatus === 'escalated' ? 'Final: Escalated' : 'Final: Dismissed'}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── ESCALATIONS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'escalations' && (() => {
        const escalated = anomalies.filter(a => a.anomalyStatus === 'escalated');
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle size={20} /> Escalated Students
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{escalated.length} record{escalated.length !== 1 ? 's' : ''}</span>
            </div>

            {escalated.length === 0 ? (
              <div className="p-8 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 dark:text-green-300">No Escalations</h3>
                <p className="text-green-600 dark:text-green-400 text-sm mt-1">No students have been escalated yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {escalated.map(anom => (
                  <Card key={anom._id} className="border-l-4 border-l-red-500">
                    <CardBody>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                          <span className="font-bold text-gray-900 dark:text-white">{anom.studentId?.name}</span>
                          <span className="font-mono text-xs text-primary-600 dark:text-primary-400">({anom.studentId?.uniqueId})</span>
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">ESCALATED</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Quiz: <span className="font-medium">{anom.quizId?.title}</span></p>
                        <div className="flex flex-wrap gap-1.5">
                          {anom.anomalyFlags.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded">{f}</span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Score hidden (escalated) &middot; {anom.timestamp ? new Date(anom.timestamp).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── GROUPS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Group */}
          <Card>
            <CardHeader title="Create New Group" action={<PlusCircle size={20} className="text-primary-600" />} />
            <CardBody>
              <form onSubmit={createGroup} className="space-y-4">
                <Input label="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g., Group A" required />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Students
                    {selectedStudents.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full font-bold">
                        {selectedStudents.length} selected
                      </span>
                    )}
                  </label>

                  {students.length === 0 ? (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        No students registered yet. Students must sign up first.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-72 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {students.map(s => (
                          <label key={s._id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              selectedStudents.includes(s._id)
                                ? 'bg-primary-50 dark:bg-primary-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                          >
                            <input type="checkbox" checked={selectedStudents.includes(s._id)}
                              onChange={() => toggleStudent(s._id)}
                              className="rounded text-primary-600 focus:ring-primary-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{s.name}</p>
                              <p className="text-xs text-primary-600 dark:text-primary-400 font-mono">{s.uniqueId}</p>
                            </div>
                            <span className="text-xs text-gray-400 truncate max-w-[120px] hidden sm:block">{s.email}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{students.length} student(s) available</p>
                    </>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={students.length === 0 || !groupName.trim() || selectedStudents.length === 0}>
                  Create Group
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Existing Groups */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Existing Groups <span className="text-sm font-normal text-gray-500">({groups.length})</span>
            </h2>
            {groups.length === 0 ? (
              <Card><CardBody><p className="text-gray-500 dark:text-gray-400 text-center py-4">No groups created yet</p></CardBody></Card>
            ) : groups.map(g => (
              <Card key={g._id}>
                <CardBody>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">{g.name}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {g.studentIds?.length || 0} students
                    </span>
                  </div>
                  {g.taId && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Created by: {g.taId.name || g.taId.uniqueId}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {g.studentIds?.length > 0
                      ? g.studentIds.map((s: any) => (
                          <span key={s._id} className="px-2 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs rounded-full border border-primary-200 dark:border-primary-700">
                            {s.name}
                          </span>
                        ))
                      : <span className="text-xs text-gray-400">No students assigned</span>
                    }
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TADashboard;
