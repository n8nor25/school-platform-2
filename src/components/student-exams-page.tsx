'use client';

/**
 * ============================================================
 *  واجهة الطالب للامتحانات الإلكترونية
 *  Student Exams Page
 * ============================================================
 *  تدفّق الشاشات:
 *    login → list → intro → runner → result → appeals
 *
 *  المكوّنات:
 *    ① StudentLogin      — إدخال معرّف الطالب + اسمه
 *    ② ExamsList          — قائمة الامتحانات المتاحة
 *    ③ ExamIntro          — تعليمات + كلمة سر + بدء
 *    ④ ExamRunner         — المؤقّت + الأسئلة + الحفظ + الرفع + المراقبة
 *    ⑤ ExamResult         — النتيجة + مراجعة الإجابات + التظلّم
 *
 *  التكامل:
 *    • GET  /api/exams/available
 *    • GET  /api/exams/[id]
 *    • POST /api/exams/[id]/start
 *    • GET  /api/exams/[id]/answers
 *    • POST /api/exams/[id]/answers
 *    • POST /api/exams/[id]/answers/[qid]/upload
 *    • POST /api/exams/[id]/submit
 *    • POST /api/exams/[id]/proctor
 *    • GET  /api/exams/[id]/result
 *    • POST /api/exams/[id]/appeals
 *    • GET  /api/exams/[id]/appeals
 *    • useExamProctor (WebSocket للمراقبة الحيّة)
 * ============================================================
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowRight, ArrowLeft, Clock, FileText, AlertTriangle, CheckCircle2,
  XCircle, Eye, EyeOff, Upload, Send, Loader2, RefreshCw, ChevronRight,
  Award, Shield, Lock, LogOut, Info, Camera, FileCheck, AlertCircle,
  ListChecks, RotateCcw, MessageSquareWarning, Timer, Hash, User,
  BookOpen, Calendar, GraduationCap, Bookmark, BookmarkCheck,
  Wifi, WifiOff, Search, Filter, History, TrendingUp, Trophy,
  Target, Percent, Printer, ChevronLeft, Keyboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useExamProctor } from '@/hooks/use-exam-proctor';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend as RLegend,
} from 'recharts';

// ===== Types =====

interface StudentExamsPageProps {
  onBack: () => void;
  schoolId?: string;
}

type Screen = 'login' | 'list' | 'intro' | 'runner' | 'result';

interface StudentInfo {
  studentId: string;
  studentName: string;
  schoolId: string;
}

interface AvailableExam {
  id: string;
  title: string;
  description: string;
  subject: string;
  teacherName: string;
  classroomName: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsLeft: number;
  hasActiveSubmission: boolean;
  activeSubmissionId: string | null;
  antiCheatEnabled: boolean;
  hasPassword: boolean;
  questionsCount: number;
  timeStatus: string;
  allowTextAnswers: boolean;
  allowImageAnswers: boolean;
  allowPdfAnswers: boolean;
}

interface Question {
  id: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF';
  text: string;
  options: string[] | null;
  points: number;
  order: number;
  hasAttachment?: boolean;
  attachmentUrl?: string | null;
}

interface SubmissionInfo {
  id: string;
  attemptNumber: number;
  startedAt: string;
  status: string;
  remainingSeconds: number;
}

interface ExamStartResponse {
  submission: SubmissionInfo;
  exam: {
    id: string;
    title: string;
    durationMinutes: number;
    totalPoints: number;
    allowTextAnswers: boolean;
    allowImageAnswers: boolean;
    allowPdfAnswers: boolean;
    antiCheatEnabled: boolean;
    showResultImmediately: boolean;
  };
  questions: Question[];
  resumed?: boolean;
}

interface SavedAnswer {
  id: string;
  questionId: string;
  textAnswer: string | null;
  imageAnswerUrl: string | null;
  fileAnswerUrl: string | null;
  textModeration: string | null;
  imageModeration: string | null;
  score: number | null;
  isCorrect: boolean | null;
  teacherNote: string | null;
}

interface ModerationInfo {
  decision: string;
  reasons: string[];
  categories: string[];
  confidence: number;
}

// ===== إحصائيات الطالب =====
interface StudentStats {
  isEmpty: boolean;
  kpis: {
    totalExams: number;
    avgScore: number;
    passRate: number;
    bestScore: number;
    totalAppeals: number;
  };
  timeline: Array<{
    examTitle: string;
    subject: string;
    score: number;
    passed: boolean | null;
    date: string;
  }>;
  subjectBreakdown: Array<{
    subject: string;
    avgScore: number;
    examCount: number;
    passRate: number;
  }>;
  recentResults: Array<{
    submissionId: string;
    examId: string;
    examTitle: string;
    subject: string;
    percentage: number;
    totalScore: number | null;
    maxScore: number | null;
    passed: boolean | null;
    status: string;
    submittedAt: string;
  }>;
  isTestMode?: boolean;
}

// ===== Helpers =====

function buildUrl(base: string, student: StudentInfo | null, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (student) {
    params.set('schoolId', student.schoolId);
    params.set('studentId', student.studentId);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: 'اختيار من متعدد',
  TRUE_FALSE: 'صح / خطأ',
  SHORT: 'إجابة قصيرة',
  ESSAY: 'سؤال مقالي',
  IMAGE_ANSWER: 'إجابة بصورة',
  FILE_PDF: 'إجابة بملف PDF',
};

// ===== Main Component =====

export default function StudentExamsPage({ onBack, schoolId }: StudentExamsPageProps) {
  const [screen, setScreen] = useState<Screen>('login');
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [selectedExam, setSelectedExam] = useState<AvailableExam | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [startData, setStartData] = useState<ExamStartResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // عند تسجيل الدخول
  const handleLogin = (info: StudentInfo) => {
    setStudent(info);
    setScreen('list');
    setRefreshKey(k => k + 1);
  };

  // اختيار امتحان من القائمة
  const handleSelectExam = (exam: AvailableExam) => {
    setSelectedExam(exam);
    setScreen('intro');
  };

  // بدء الامتحان بنجاح
  const handleStartSuccess = (data: ExamStartResponse) => {
    setStartData(data);
    setSubmissionId(data.submission.id);
    setScreen('runner');
  };

  // تسليم الامتحان
  const handleSubmit = () => {
    setScreen('result');
  };

  // العودة للقائمة
  const handleBackToList = () => {
    setSelectedExam(null);
    setStartData(null);
    setSubmissionId(null);
    setScreen('list');
    setRefreshKey(k => k + 1);
  };

  // العودة للقائمة من شاشة النتيجة (لرؤية محاولات أخرى)
  const handleBackFromResult = () => {
    setSelectedExam(null);
    setStartData(null);
    setSubmissionId(null);
    setScreen('list');
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (screen === 'runner') return; // لا يمكن الخروج أثناء الامتحان
                if (screen === 'login') onBack();
                else if (screen === 'list') onBack();
                else handleBackToList();
              }}
              disabled={screen === 'runner'}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              {screen === 'login' || screen === 'list' ? 'الموقع' : 'القائمة'}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#610000] flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-900 truncate">الامتحانات الإلكترونية</h1>
                {student && screen !== 'login' && (
                  <p className="text-xs text-gray-500 truncate">
                    {student.studentName} • {student.studentId}
                  </p>
                )}
              </div>
            </div>
          </div>
          {student && screen !== 'login' && screen !== 'runner' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStudent(null);
                setScreen('login');
              }}
              className="text-gray-500"
            >
              <LogOut className="w-4 h-4 ml-1" />
              تبديل الطالب
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {screen === 'login' && (
          <StudentLogin onLogin={handleLogin} schoolId={schoolId} />
        )}
        {screen === 'list' && student && (
          <ExamsList
            key={refreshKey}
            student={student}
            onSelectExam={handleSelectExam}
          />
        )}
        {screen === 'intro' && student && selectedExam && (
          <ExamIntro
            student={student}
            exam={selectedExam}
            onBack={handleBackToList}
            onStartSuccess={handleStartSuccess}
          />
        )}
        {screen === 'runner' && student && selectedExam && startData && submissionId && (
          <ExamRunner
            student={student}
            exam={selectedExam}
            startData={startData}
            submissionId={submissionId}
            onSubmit={handleSubmit}
          />
        )}
        {screen === 'result' && student && selectedExam && submissionId && (
          <ExamResult
            student={student}
            exam={selectedExam}
            submissionId={submissionId}
            onBack={handleBackFromResult}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t py-3 px-4 text-center">
        <p className="text-xs text-gray-500">
          نظام الامتحانات الإلكترونية الآمن • جميع الإجابات تُراقب وتُراجع آلياً
        </p>
      </footer>
    </div>
  );
}

// ============================================================
//  ① StudentLogin — شاشة الدخول
// ============================================================

function StudentLogin({
  onLogin,
  schoolId,
}: {
  onLogin: (info: StudentInfo) => void;
  schoolId?: string;
}) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [schoolIdInput, setSchoolIdInput] = useState(schoolId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // مزامنة schoolIdInput مع الـ prop عندما يتوفر (selectedSchoolId يُحمّل من store
  // بعد أول render). نُلّف setState بـ setTimeout لتجنّب تحذير set-state-in-effect.
  useEffect(() => {
    if (schoolId && schoolId !== schoolIdInput) {
      const id = schoolId;
      const t = setTimeout(() => setSchoolIdInput(id), 0);
      return () => clearTimeout(t);
    }
  }, [schoolId, schoolIdInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!studentId.trim()) {
      setError('معرّف الطالب مطلوب');
      return;
    }
    if (!studentName.trim()) {
      setError('اسم الطالب مطلوب');
      return;
    }
    if (!schoolIdInput.trim()) {
      setError('معرّف المدرسة مطلوب');
      return;
    }
    setLoading(true);
    // تحقق سريع من توفر امتحانات (لا يلزم — فقط للتأكد من المدرسة)
    try {
      const res = await fetch(
        `/api/exams/available?schoolId=${encodeURIComponent(schoolIdInput)}&studentId=${encodeURIComponent(studentId)}`,
        { headers: { 'x-student-id': studentId } }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل التحقق من البيانات');
        setLoading(false);
        return;
      }
      onLogin({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        schoolId: schoolIdInput.trim(),
      });
    } catch (e) {
      // نسمح بالدخول حتى لو فشل الفحص (قد لا توجد امتحانات متاحة)
      onLogin({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        schoolId: schoolIdInput.trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card className="shadow-lg border-0">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#610000]/10 flex items-center justify-center mb-3">
            <User className="w-8 h-8 text-[#610000]" />
          </div>
          <CardTitle className="text-xl text-gray-900">دخول الطالب</CardTitle>
          <CardDescription className="text-gray-500">
            أدخل بياناتك للوصول إلى الامتحانات المتاحة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-sm font-medium text-gray-700">
                معرّف الطالب <span className="text-red-500">*</span>
              </Label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="مثال: stu-2024-001"
                className="text-right"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentName" className="text-sm font-medium text-gray-700">
                الاسم الكامل <span className="text-red-500">*</span>
              </Label>
              <Input
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="الاسم كما هو مسجّل في المدرسة"
                className="text-right"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolId" className="text-sm font-medium text-gray-700">
                معرّف المدرسة <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolId"
                value={schoolIdInput}
                onChange={(e) => setSchoolIdInput(e.target.value)}
                placeholder="معرّف المدرسة"
                className="text-right font-mono text-sm"
                autoComplete="off"
                disabled={!!schoolId}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-[#610000] hover:bg-[#4a0000] text-white"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحقق...</>
              ) : (
                <>دخول <ArrowLeft className="w-4 h-4 mr-1" /></>
              )}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 space-y-1">
                <p className="font-medium">ملاحظات مهمة:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                  <li>ستُراقب إجاباتك أثناء الامتحان لضمان النزاهة.</li>
                  <li>لا تُغلق نافذة الامتحان أو تنتقل لتبويب آخر.</li>
                  <li>يُحفظ تقدّمك تلقائياً كل بضع ثوانٍ.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  ② ExamsList — قائمة الامتحانات المتاحة
// ============================================================

function ExamsList({
  student,
  onSelectExam,
}: {
  student: StudentInfo;
  onSelectExam: (exam: AvailableExam) => void;
}) {
  const [exams, setExams] = useState<AvailableExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== إحصائيات الطالب =====
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ===== الفلترة والتبويب =====
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildUrl('/api/exams/available', student), {
        headers: { 'x-student-id': student.studentId },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل جلب الامتحانات');
        setExams([]);
      } else {
        setExams(data.exams || []);
      }
    } catch (e) {
      setError('تعذّر الاتصال بالخادم');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [student]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(buildUrl('/api/exams/student-stats', student), {
        headers: { 'x-student-id': student.studentId },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data as StudentStats);
      } else {
        setStats(null);
      }
    } catch (e) {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [student]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadExams(), loadStats()]);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, []);

  // قائمة المواد المتاحة للفلترة
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    exams.forEach((e) => { if (e.subject) set.add(e.subject); });
    stats?.subjectBreakdown.forEach((s) => set.add(s.subject));
    return Array.from(set).sort();
  }, [exams, stats]);

  // تطبيق الفلترة على الامتحانات المتاحة
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matches =
          exam.title.toLowerCase().includes(q) ||
          exam.subject.toLowerCase().includes(q) ||
          (exam.teacherName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (subjectFilter !== 'all' && exam.subject !== subjectFilter) return false;
      if (statusFilter !== 'all' && exam.timeStatus !== statusFilter) return false;
      return true;
    });
  }, [exams, searchTerm, subjectFilter, statusFilter]);

  // ===== شاشة التحميل =====
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#610000] animate-spin mb-3" />
        <p className="text-gray-500 text-sm">جاري تحميل الامتحانات...</p>
      </div>
    );
  }

  // ===== شاشة الخطأ =====
  if (error) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>خطأ</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={loadExams} variant="outline" className="w-full mt-4">
          <RefreshCw className="w-4 h-4 ml-2" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ====== رأس إحصائيات الطالب ====== */}
      <StudentStatsHeader stats={stats} loading={statsLoading} studentName={student.studentName} />

      {/* ====== تبويب: متاحة / منجزة ====== */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'available'
              ? 'bg-white text-[#610000] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          المتاحة
          {exams.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{exams.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-white text-[#610000] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <History className="w-4 h-4" />
          النتائج السابقة
          {stats && !stats.isEmpty && stats.kpis.totalExams > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{stats.kpis.totalExams}</Badge>
          )}
        </button>
      </div>

      {activeTab === 'available' ? (
        <>
          {/* ====== شريط الفلترة ====== */}
          {exams.length > 0 && (
            <div className="bg-white rounded-xl border p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="ابحث بالعنوان أو المادة أو المعلم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-9 h-9"
                />
              </div>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#610000]/30"
              >
                <option value="all">كل المواد</option>
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#610000]/30"
              >
                <option value="all">كل الحالات</option>
                <option value="OPEN">مفتوح الآن</option>
                <option value="UPCOMING">قادم</option>
                <option value="ENDED">منتهي</option>
              </select>
              {(searchTerm || subjectFilter !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchTerm(''); setSubjectFilter('all'); setStatusFilter('all'); }}
                  className="h-9 text-gray-500"
                >
                  <XCircle className="w-4 h-4 ml-1" /> مسح
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={loadExams} className="h-9 mr-auto">
                <RefreshCw className="w-4 h-4 ml-1" /> تحديث
              </Button>
            </div>
          )}

          {/* ====== قائمة الامتحانات ====== */}
          {filteredExams.length === 0 ? (
            <div className="max-w-md mx-auto py-12 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {exams.length === 0 ? 'لا توجد امتحانات متاحة' : 'لا نتائج مطابقة'}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {exams.length === 0
                  ? 'لا توجد امتحانات مفتوحة حالياً. تابع صفحتك للاطلاع على الامتحانات الجديدة.'
                  : 'جرّب تعديل معايير البحث أو الفلترة.'}
              </p>
              {exams.length === 0 ? (
                <Button onClick={loadExams} variant="outline">
                  <RefreshCw className="w-4 h-4 ml-2" /> تحديث
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => { setSearchTerm(''); setSubjectFilter('all'); setStatusFilter('all'); }}
                >
                  <Filter className="w-4 h-4 ml-2" /> إعادة ضبط الفلترة
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredExams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} onSelect={onSelectExam} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ====== تبويب النتائج السابقة ====== */
        <HistoryTab stats={stats} loading={statsLoading} onRetry={loadStats} />
      )}
    </div>
  );
}

// ============================================================
//  StudentStatsHeader — رأس إحصائيات الطالب (KPIs + مخطط)
// ============================================================
function StudentStatsHeader({
  stats,
  loading,
  studentName,
}: {
  stats: StudentStats | null;
  loading: boolean;
  studentName: string;
}) {
  if (loading) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-l from-[#610000] to-[#7a1a1a] text-white overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="h-4 w-32 bg-white/20 rounded mb-1 animate-pulse" />
              <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white/10 rounded-lg p-3">
                <div className="h-8 w-12 bg-white/20 rounded animate-pulse mb-2" />
                <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.isEmpty) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-l from-[#610000] to-[#7a1a1a] text-white overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">أهلاً، {studentName}</h3>
              <p className="text-white/80 text-sm">لم تخض أي امتحان بعد — ابدأ أول امتحان متاح!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { kpis, timeline } = stats;
  const chartData = timeline.map((t, i) => ({
    name: `#${i + 1}`,
    score: t.score,
    title: t.examTitle,
  }));

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-l from-[#610000] to-[#7a1a1a] text-white overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">أهلاً، {studentName}</h3>
              <p className="text-white/80 text-sm">ملخّص أدائك في الامتحانات الإلكترونية</p>
            </div>
          </div>
          {stats.isTestMode && (
            <Badge className="bg-white/20 text-white border-0 hover:bg-white/20">
              وضع تجريبي
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatPill icon={<FileCheck className="w-4 h-4" />} label="امتحانات منجزة" value={String(kpis.totalExams)} />
          <StatPill icon={<TrendingUp className="w-4 h-4" />} label="متوسط الدرجات" value={`${kpis.avgScore}%`} />
          <StatPill icon={<Percent className="w-4 h-4" />} label="نسبة النجاح" value={`${kpis.passRate}%`} />
          <StatPill icon={<Trophy className="w-4 h-4" />} label="أعلى نتيجة" value={`${kpis.bestScore}%`} />
        </div>

        {/* مخطط الأداء الزمني */}
        {chartData.length > 1 && (
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/80 font-medium">اتجاه الأداء (آخر {chartData.length} امتحانات)</span>
              <span className="text-xs text-white/60">الدرجة %</span>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.6)" fontSize={10} tickLine={false} axisLine={false} />
                  <RTooltip
                    contentStyle={{ background: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(v: number) => [`${v}%`, 'الدرجة']}
                    labelFormatter={(_l: number, payload) => {
                      const p = payload?.[0]?.payload;
                      return p?.title || '';
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#fff"
                    strokeWidth={2.5}
                    dot={{ fill: '#fff', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-white/70 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ============================================================
//  ExamCard — بطاقة امتحان (مستخرجة لإعادة الاستخدام)
// ============================================================
function ExamCard({ exam, onSelect }: { exam: AvailableExam; onSelect: (e: AvailableExam) => void }) {
  const status = exam.timeStatus;
  const statusInfo =
    status === 'UPCOMING'
      ? { label: 'قادم', color: 'bg-amber-100 text-amber-800 border-amber-200' }
      : status === 'OPEN'
      ? { label: 'مفتوح', color: 'bg-green-100 text-green-800 border-green-200' }
      : { label: 'منتهي', color: 'bg-gray-100 text-gray-600 border-gray-200' };

  return (
    <Card
      className={`shadow-sm hover:shadow-md transition-shadow cursor-pointer border ${
        exam.hasActiveSubmission ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
      }`}
      onClick={() => onSelect(exam)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base text-gray-900 leading-snug">
              {exam.title}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {exam.subject}
              {exam.classroomName ? ` • ${exam.classroomName}` : ''}
              {exam.teacherName ? ` • أ/ ${exam.teacherName}` : ''}
            </CardDescription>
          </div>
          <Badge variant="outline" className={`flex-shrink-0 ${statusInfo.color}`}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {exam.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{exam.description}</p>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            {exam.durationMinutes} دقيقة
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <ListChecks className="w-3.5 h-3.5 text-gray-400" />
            {exam.questionsCount} سؤال
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Hash className="w-3.5 h-3.5 text-gray-400" />
            {exam.attemptsLeft} محاولة متبقية
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            {exam.hasPassword ? (
              <><Lock className="w-3.5 h-3.5 text-gray-400" /> بكلمة سر</>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> بدون سر</>
            )}
          </div>
        </div>
        {exam.antiCheatEnabled && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
            <Shield className="w-3.5 h-3.5" />
            مراقبة ذكية مفعّلة
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 pb-3">
        <Button
          className="w-full bg-[#610000] hover:bg-[#4a0000] text-white"
          size="sm"
          variant="default"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(exam);
          }}
        >
          {exam.hasActiveSubmission ? (
            <><RotateCcw className="w-4 h-4 ml-1" /> استئناف المحاولة</>
          ) : (
            <>ابدأ الامتحان <ArrowLeft className="w-4 h-4 mr-1" /></>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================
//  HistoryTab — تبويب النتائج السابقة
// ============================================================
function HistoryTab({
  stats,
  loading,
  onRetry,
}: {
  stats: StudentStats | null;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#610000] animate-spin mb-3" />
        <p className="text-gray-500 text-sm">جاري تحميل النتائج السابقة...</p>
      </div>
    );
  }

  if (!stats || stats.isEmpty) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <History className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">لا توجد نتائج سابقة</h3>
        <p className="text-gray-500 text-sm mb-4">لم تُكمل أي امتحان بعد.</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 ml-2" /> تحديث
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* تفصيل حسب المادة */}
      {stats.subjectBreakdown.length > 0 && (
        <Card className="shadow-sm border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#610000]" />
              الأداء حسب المادة
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {stats.subjectBreakdown.map((s) => (
                <div key={s.subject} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900 truncate">{s.subject}</span>
                      <Badge variant="outline" className="text-xs">{s.examCount} امتحان</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={s.avgScore} className="h-1.5 flex-1" />
                      <span className="text-xs text-gray-500 w-12 text-left">{s.avgScore}%</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">نجاح</div>
                    <div className={`text-sm font-bold ${s.passRate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                      {s.passRate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* آخر النتائج */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-[#610000]" />
            آخر النتائج
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {stats.recentResults.map((r) => {
              const passed = r.passed === true;
              const failed = r.passed === false;
              return (
                <div key={r.submissionId} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    passed ? 'bg-green-100 text-green-700' :
                    failed ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {passed ? <CheckCircle2 className="w-5 h-5" /> : failed ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{r.examTitle}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                      <span>{r.subject}</span>
                      <span>•</span>
                      <span>{formatDate(r.submittedAt)}</span>
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className={`text-lg font-bold ${
                      passed ? 'text-green-600' : failed ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {r.percentage}%
                    </div>
                    {r.totalScore !== null && r.maxScore !== null && (
                      <div className="text-xs text-gray-400">{r.totalScore}/{r.maxScore}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  ③ ExamIntro — تعليمات + كلمة سر + بدء
// ============================================================

function ExamIntro({
  student,
  exam,
  onBack,
  onStartSuccess,
}: {
  student: StudentInfo;
  exam: AvailableExam;
  onBack: () => void;
  onStartSuccess: (data: ExamStartResponse) => void;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const handleStart = async () => {
    setError(null);
    if (exam.hasPassword && !password.trim()) {
      setError('كلمة السر مطلوبة لهذا الامتحان');
      return;
    }
    if (!agreed) {
      setError('يجب الموافقة على التعليمات قبل البدء');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        buildUrl(`/api/exams/${exam.id}/start`, student),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-student-id': student.studentId },
          body: JSON.stringify({ password: exam.hasPassword ? password : undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'فشل بدء الامتحان');
        setLoading(false);
        return;
      }
      onStartSuccess(data as ExamStartResponse);
    } catch (e) {
      setError('تعذّر الاتصال بالخادم');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-0">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-gray-900">{exam.title}</CardTitle>
              <CardDescription className="mt-1">
                {exam.subject} • أ/ {exam.teacherName || '—'}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-[#610000]/5 text-[#610000] border-[#610000]/20">
              محاولة {exam.attemptsUsed + 1} من {exam.maxAttempts}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {exam.description && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              {exam.description}
            </div>
          )}

          {/* معلومات الامتحان */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoCard icon={<Clock className="w-4 h-4" />} label="المدة" value={`${exam.durationMinutes} دقيقة`} />
            <InfoCard icon={<ListChecks className="w-4 h-4" />} label="عدد الأسئلة" value={`${exam.questionsCount}`} />
            <InfoCard icon={<Calendar className="w-4 h-4" />} label="ينتهي في" value={formatDate(exam.endDate).split(' ')[0]} />
            <InfoCard icon={<Hash className="w-4 h-4" />} label="المحاولات المتبقية" value={`${exam.attemptsLeft}`} />
          </div>

          {/* التعليمات */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-4 py-2 border-b flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-bold text-amber-900">تعليمات هامة قبل البدء</h4>
            </div>
            <ul className="px-4 py-3 space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-[#610000] font-bold">•</span>
                بمجرد بدء الامتحان، يبدأ المؤقّت ولا يمكن إيقافه.
              </li>
              <li className="flex gap-2">
                <span className="text-[#610000] font-bold">•</span>
                يُحفظ تقدّمك تلقائياً، لكن تأكّد من الضغط على «تسليم» قبل انتهاء الوقت.
              </li>
              {exam.antiCheatEnabled && (
                <>
                  <li className="flex gap-2">
                    <span className="text-[#610000] font-bold">•</span>
                    <span>
                      <strong>المراقبة مفعّلة:</strong> لا تنتقل لتبويب آخر أو تُغلق النافذة — سيُسجَّل كانتهاك.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#610000] font-bold">•</span>
                    يُمنع النسخ واللصق واستخدام اختصارات لوحة المفاتيح.
                  </li>
                </>
              )}
              <li className="flex gap-2">
                <span className="text-[#610000] font-bold">•</span>
                تُراجع إجاباتك المقالية بالذكاء الاصطناعي للتأكد من خلوها من محتوى مخالف.
              </li>
              {exam.hasActiveSubmission && (
                <li className="flex gap-2 text-blue-700">
                  <span className="font-bold">•</span>
                  لديك محاولة جارية — سيتم استئنافها بدلاً من بدء محاولة جديدة.
                </li>
              )}
            </ul>
          </div>

          {/* الموافقة */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#610000]"
            />
            <span className="text-sm text-gray-700">
              قرأت التعليمات وأوافق عليها. أتحمّل مسؤولية التزامهنّ.
            </span>
          </label>

          {/* كلمة السر */}
          {exam.hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                كلمة سر الامتحان
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة السر التي أعطاك إياها المعلم"
                className="text-right"
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowRight className="w-4 h-4 ml-1" /> رجوع
            </Button>
            <Button
              onClick={handleStart}
              disabled={loading || !agreed}
              className="flex-1 bg-[#610000] hover:bg-[#4a0000] text-white"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري البدء...</>
              ) : exam.hasActiveSubmission ? (
                <><RotateCcw className="w-4 h-4 ml-1" /> استئناف المحاولة</>
              ) : (
                <><Timer className="w-4 h-4 ml-1" /> ابدأ الآن</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="w-8 h-8 mx-auto rounded-full bg-white flex items-center justify-center text-gray-500 mb-1.5">
        {icon}
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ============================================================
//  ④ ExamRunner — المؤقّت + الأسئلة + الحفظ + المراقبة
// ============================================================

interface ExamRunnerProps {
  student: StudentInfo;
  exam: AvailableExam;
  startData: ExamStartResponse;
  submissionId: string;
  onSubmit: () => void;
}

function ExamRunner({ student, exam, startData, submissionId, onSubmit }: ExamRunnerProps) {
  const questions = startData.questions;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { text?: string; imageUrl?: string; fileUrl?: string }>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(startData.submission.remainingSeconds);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [moderationWarnings, setModerationWarnings] = useState<Record<string, ModerationInfo | null>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'uploading' | 'done' | 'error'>>({});
  const [violationCount, setViolationCount] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autoCloseWarning, setAutoCloseWarning] = useState(false);

  // ===== تحسينات جديدة =====
  // تعليم الأسئلة للمراجعة لاحقاً
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  // فلترة المستكشف (الكل / للمراجعة / غير مُجاب)
  const [navFilter, setNavFilter] = useState<'all' | 'flagged' | 'unanswered'>('all');
  // حالة الاتصال بالخادم
  const [isOnline, setIsOnline] = useState(true);
  // إظهار تلميح اختصارات لوحة المفاتيح
  const [showShortcutsHint, setShowShortcutsHint] = useState(false);
  // عرض/إخفاء لوحة اختصارات لوحة المفاتيح
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);

  const currentQuestion = questions[currentIdx];
  const totalAnswered = Object.values(answers).filter(a => a.text?.trim() || a.imageUrl || a.fileUrl).length;
  const progress = questions.length > 0 ? (totalAnswered / questions.length) * 100 : 0;
  const flaggedCount = flaggedQuestions.size;

  // ===== المراقبة (WebSocket) =====
  const proctor = useExamProctor({ role: 'student' });

  useEffect(() => {
    if (exam.antiCheatEnabled) {
      proctor.connect();
      proctor.joinExam({
        examId: exam.id,
        submissionId,
        studentId: student.studentId,
        studentName: student.studentName,
      });
    }
    return () => {
      proctor.disconnect();
    };
  }, []);

  // ===== اعتراض الأحداث المشبوهة =====
  useEffect(() => {
    if (!exam.antiCheatEnabled) return;

    const sendProctorEvent = (type: string, severity: number, details: string) => {
      // إرسال للـ WebSocket
      proctor.sendViolation({ type, severity, details });
      // إرسال للسيرفر للتسجيل الدائم
      fetch(buildUrl(`/api/exams/${exam.id}/proctor`, student), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-id': student.studentId },
        body: JSON.stringify({
          submissionId,
          events: [{ type, severity, details, timestamp: new Date().toISOString() }],
        }),
      }).catch(() => {});
      setViolationCount(c => c + 1);
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      sendProctorEvent('COPY_ATTEMPT', 2, 'محاولة نسخ');
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      sendProctorEvent('PASTE_ATTEMPT', 2, 'محاولة لصق');
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      sendProctorEvent('RIGHT_CLICK', 1, 'زر الفأرة الأيمن');
    };
    const onShortcut = (e: KeyboardEvent) => {
      // منع Ctrl+C/V/X/U/S/P/A و F12 و dev tools shortcuts
      const blocked =
        (e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'u', 's', 'p', 'a'].includes(e.key.toLowerCase()) ||
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()));
      if (blocked) {
        e.preventDefault();
        sendProctorEvent('SHORTCUT_KEY', 2, `اختصار: ${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`);
      }
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onShortcut);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onShortcut);
    };
  }, [exam.antiCheatEnabled, exam.id, submissionId]);

  // ===== التسليم التلقائي عند انتهاء الوقت =====
  const handleAutoSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await fetch(buildUrl(`/api/exams/${exam.id}/submit`, student, { submissionId }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-id': student.studentId },
        body: JSON.stringify({ force: true }),
      });
    } catch {}
    setSubmitting(false);
    onSubmit();
  }, [exam.id, student, submissionId, onSubmit]);

  // ===== المؤقّت =====
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingSeconds(s => {
        const next = s - 1;
        if (next <= 0) {
          // انتهى الوقت — تسليم تلقائي
          clearInterval(interval);
          setAutoCloseWarning(true);
          handleAutoSubmit();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [handleAutoSubmit]);

  // ===== جلب الإجابات المحفوظة سابقاً (للاستئناف) =====
  useEffect(() => {
    if (!startData.resumed) return;
    (async () => {
      try {
        const res = await fetch(
          buildUrl(`/api/exams/${exam.id}/answers`, student, { submissionId }),
          { headers: { 'x-student-id': student.studentId } }
        );
        const data = await res.json();
        if (res.ok && data.answers) {
          const restored: Record<string, { text?: string; imageUrl?: string; fileUrl?: string }> = {};
          for (const a of data.answers) {
            restored[a.questionId] = {
              text: a.textAnswer || undefined,
              imageUrl: a.imageAnswerUrl || undefined,
              fileUrl: a.fileAnswerUrl || undefined,
            };
          }
          setAnswers(restored);
        }
      } catch {}
    })();
  }, [startData.resumed]);

  // ===== حفظ إجابة نصية =====
  const saveAnswer = useCallback(async (questionId: string, text: string, immediate = false) => {
    // للأهداف الموضوعية نُرسل فوراً، وللمقالية نُأخّر قليلاً (debounce)
    setSaveStatus(s => ({ ...s, [questionId]: 'saving' }));
    try {
      const res = await fetch(
        buildUrl(`/api/exams/${exam.id}/answers`, student, { submissionId }),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-student-id': student.studentId },
          body: JSON.stringify({ questionId, text }),
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus(s => ({ ...s, [questionId]: 'saved' }));
        if (data.moderation) {
          setModerationWarnings(w => ({
            ...w,
            [questionId]: data.moderation as ModerationInfo,
          }));
        }
        if (data.warning) {
          // تحذير مراجعة المحتوى
        }
      } else {
        setSaveStatus(s => ({ ...s, [questionId]: 'error' }));
      }
    } catch {
      setSaveStatus(s => ({ ...s, [questionId]: 'error' }));
    }
  }, [exam.id, student, submissionId]);

  // debounce للحفظ التلقائي
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedSave = useCallback((questionId: string, text: string) => {
    if (saveTimers.current[questionId]) clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      saveAnswer(questionId, text);
    }, 1200);
  }, [saveAnswer]);

  // ===== رفع صورة/PDF =====
  const handleUpload = useCallback(async (questionId: string, file: File) => {
    setUploadStatus(s => ({ ...s, [questionId]: 'uploading' }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        buildUrl(`/api/exams/${exam.id}/answers/${questionId}/upload`, student, { submissionId }),
        {
          method: 'POST',
          headers: { 'x-student-id': student.studentId },
          body: formData,
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setAnswers(a => ({
          ...a,
          [questionId]: {
            ...a[questionId],
            imageUrl: data.url || data.publicUrl,
            fileUrl: data.url || data.publicUrl,
          },
        }));
        setUploadStatus(s => ({ ...s, [questionId]: 'done' }));
        if (data.moderation && data.moderation.decision !== 'SAFE') {
          setModerationWarnings(w => ({
            ...w,
            [questionId]: {
              decision: data.moderation.decision,
              reasons: data.moderation.reasons || [],
              categories: data.moderation.categories || [],
              confidence: data.moderation.confidence || 0,
            },
          }));
        }
      } else {
        setUploadStatus(s => ({ ...s, [questionId]: 'error' }));
      }
    } catch {
      setUploadStatus(s => ({ ...s, [questionId]: 'error' }));
    }
  }, [exam.id, student, submissionId]);

  // ===== التسليم النهائي =====
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(
        buildUrl(`/api/exams/${exam.id}/submit`, student, { submissionId }),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-student-id': student.studentId },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'فشل التسليم');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setShowSubmitDialog(false);
      onSubmit();
    } catch (e) {
      setSubmitError('تعذّر الاتصال بالخادم');
      setSubmitting(false);
    }
  };

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(a => ({ ...a, [questionId]: { ...a[questionId], text: value } }));
    // للحظي (MCQ/TRUE_FALSE) نحفظ فوراً، ولغيره debounced
    const q = questions.find(qq => qq.id === questionId);
    if (q && (q.type === 'MCQ' || q.type === 'TRUE_FALSE')) {
      saveAnswer(questionId, value, true);
    } else {
      debouncedSave(questionId, value);
    }
  };

  const goToQuestion = (idx: number) => {
    if (idx >= 0 && idx < questions.length) setCurrentIdx(idx);
  };

  // ===== تعليم سؤال للمراجعة =====
  const toggleFlag = useCallback((questionId: string) => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  const isFlagged = (questionId: string) => flaggedQuestions.has(questionId);

  // ===== الانتقال للسؤال التالي غير المُجاب =====
  const goToNextUnanswered = useCallback(() => {
    for (let i = currentIdx + 1; i < questions.length; i++) {
      const q = questions[i];
      const a = answers[q.id];
      if (!a?.text?.trim() && !a?.imageUrl && !a?.fileUrl) {
        setCurrentIdx(i);
        return;
      }
    }
    // لو لم نجد بعد الحالي، نبحث قبله
    for (let i = 0; i < currentIdx; i++) {
      const q = questions[i];
      const a = answers[q.id];
      if (!a?.text?.trim() && !a?.imageUrl && !a?.fileUrl) {
        setCurrentIdx(i);
        return;
      }
    }
  }, [currentIdx, questions, answers]);

  // ===== beforeunload: تحذير قبل مغادرة الصفحة أثناء الامتحان =====
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'سيتم فقدان تقدّمك في الامتحان إذا غادرت الصفحة.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ===== مؤشر حالة الاتصال (online/offline) =====
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    // نُلّف setState بـ setTimeout لتجنّب تحذير set-state-in-effect
    const t = setTimeout(() => setIsOnline(navigator.onLine), 0);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearTimeout(t);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ===== اختصارات لوحة المفاتيح أثناء الامتحان =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // تجاهل إذا كان المستخدم يكتب في حقل نصي (إلا لمفاتيح التنقل الخاصة)
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // ArrowLeft / ArrowRight للتنقل بين الأسئلة (حتى أثناء الكتابة في textareas)
      // في RTL: السهم الأيسر = التالي، السهم الأيمن = السابق
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        goToQuestion(currentIdx + 1 < questions.length ? currentIdx + 1 : currentIdx);
        return;
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        goToQuestion(currentIdx > 0 ? currentIdx - 1 : currentIdx);
        return;
      }

      // اختصارات أخرى فقط إن لم يكن يكتب
      if (isTyping) return;

      // F: تعليم السؤال للمراجعة
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleFlag(currentQuestion.id);
        return;
      }
      // N: السؤال التالي غير المُجاب
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        goToNextUnanswered();
        return;
      }
      // ? : إظهار لوحة الاختصارات
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsPanel(s => !s);
        return;
      }
      // Esc: إغلاق لوحة الاختصارات
      if (e.key === 'Escape') {
        setShowShortcutsPanel(false);
        return;
      }
      // أرقام 1-9 للقفز للأسئلة
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9 && !e.ctrlKey && !e.metaKey) {
        const idx = num - 1;
        if (idx < questions.length) {
          e.preventDefault();
          setCurrentIdx(idx);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIdx, questions.length, currentQuestion.id, toggleFlag, goToNextUnanswered]);

  // تلميح الاختصارات عند أول دخول (يظهر مرة واحدة)
  useEffect(() => {
    const seen = sessionStorage.getItem('exam-shortcuts-hint-seen');
    if (!seen) {
      const t = setTimeout(() => setShowShortcutsHint(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);
  const dismissShortcutsHint = useCallback(() => {
    setShowShortcutsHint(false);
    sessionStorage.setItem('exam-shortcuts-hint-seen', '1');
  }, []);

  const timeWarning = remainingSeconds <= 60;
  const timeCritical = remainingSeconds <= 30;

  return (
    <div className="space-y-4">
      {/* ====== تنبيه عدم الاتصال ====== */}
      {!isOnline && (
        <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900">
          <WifiOff className="w-4 h-4" />
          <AlertTitle>لا يوجد اتصال بالإنترنت</AlertTitle>
          <AlertDescription>
            تقدّمك يُحفظ محلياً وسيُزامَن تلقائياً عند عودة الاتصال. لا تغلق الصفحة.
          </AlertDescription>
        </Alert>
      )}

      {/* شريط المعلومات العلوي */}
      <div className="sticky top-[57px] z-30 bg-white rounded-xl shadow-sm border p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-lg ${
              timeCritical ? 'bg-red-100 text-red-700 animate-pulse' :
              timeWarning ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(remainingSeconds)}
            </div>
            <div className="text-xs text-gray-500 hidden sm:block">
              <span className="font-medium text-gray-700">{totalAnswered}</span> / {questions.length} سؤال
              {flaggedCount > 0 && (
                <span className="mr-2 text-amber-600 flex items-center gap-0.5">
                  <Bookmark className="w-3 h-3 inline" /> {flaggedCount} للمراجعة
                </span>
              )}
            </div>
            {/* مؤشر الاتصال */}
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
              isOnline ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
            }`} title={isOnline ? 'متصل' : 'غير متصل'}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isOnline ? 'متصل' : 'غير متصل'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowShortcutsPanel(s => !s)}
              title="اختصارات لوحة المفاتيح (?)"
              className="text-gray-500 hover:text-gray-700"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
            {violationCount > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <AlertTriangle className="w-3 h-3 ml-1" /> {violationCount} انتهاك
              </Badge>
            )}
            <Button
              size="sm"
              onClick={() => setShowSubmitDialog(true)}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              <Send className="w-4 h-4 ml-1" /> تسليم
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-1.5 mt-2" />
      </div>

      {/* ====== تلميح اختصارات لوحة المفاتيح ====== */}
      {showShortcutsHint && !showShortcutsPanel && (
        <div className="bg-[#610000] text-white rounded-xl p-3 flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm">
            <Keyboard className="w-4 h-4 flex-shrink-0" />
            <span>تعلّم اختصارات لوحة المفاتيح لتسريع الامتحان! اضغط <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-xs">؟</kbd></span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 h-7" onClick={() => { setShowShortcutsPanel(true); dismissShortcutsHint(); }}>
              عرض
            </Button>
            <Button size="sm" variant="ghost" className="text-white/70 hover:bg-white/20 hover:text-white h-7 px-2" onClick={dismissShortcutsHint}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ====== لوحة اختصارات لوحة المفاتيح ====== */}
      {showShortcutsPanel && (
        <Card className="border-[#610000]/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#610000]" />
                اختصارات لوحة المفاتيح
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowShortcutsPanel(false)}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <ShortcutRow keys={['→']} label="السؤال التالي" />
              <ShortcutRow keys={['←']} label="السؤال السابق" />
              <ShortcutRow keys={['F']} label="تعليم للمراجعة" />
              <ShortcutRow keys={['N']} label="التالي غير المُجاب" />
              <ShortcutRow keys={['1-9']} label="قفز لسؤال" />
              <ShortcutRow keys={['؟']} label="إظهار/إخفاء اللوحة" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* تنبيه الإغلاق التلقائي */}
      {autoCloseWarning && (
        <Alert variant="destructive">
          <Timer className="w-4 h-4" />
          <AlertTitle>انتهى الوقت!</AlertTitle>
          <AlertDescription>يتم تسليم محاولتك تلقائياً...</AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-[1fr_240px] gap-4">
        {/* منطقة السؤال */}
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-[#610000]/5 text-[#610000]">
                  سؤال {currentIdx + 1} / {questions.length}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {QUESTION_TYPE_LABELS[currentQuestion.type] || currentQuestion.type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {currentQuestion.points} درجة
                </Badge>
                {isFlagged(currentQuestion.id) && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                    <BookmarkCheck className="w-3 h-3 ml-1" /> للمراجعة
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {saveStatus[currentQuestion.id] === 'saving' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> يحفظ...
                  </span>
                )}
                {saveStatus[currentQuestion.id] === 'saved' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> حُفظ
                  </span>
                )}
                {saveStatus[currentQuestion.id] === 'error' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> فشل الحفظ
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleFlag(currentQuestion.id)}
                  title="تعليم للمراجعة (F)"
                  className={`h-7 px-2 ${isFlagged(currentQuestion.id) ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}
                >
                  {isFlagged(currentQuestion.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="prose prose-sm max-w-none mb-5">
              <p className="text-gray-900 text-base leading-relaxed whitespace-pre-wrap">
                {currentQuestion.text}
              </p>
            </div>

            {/* عرض المرفق إن وُجد */}
            {currentQuestion.hasAttachment && currentQuestion.attachmentUrl && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <a
                  href={currentQuestion.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-700 hover:underline"
                >
                  <FileText className="w-4 h-4" />
                  عرض مرفق السؤال
                </a>
              </div>
            )}

            <QuestionInput
              key={currentQuestion.id}
              question={currentQuestion}
              answer={answers[currentQuestion.id]}
              uploadStatus={uploadStatus[currentQuestion.id]}
              moderation={moderationWarnings[currentQuestion.id]}
              allowText={startData.exam.allowTextAnswers}
              allowImage={startData.exam.allowImageAnswers}
              allowPdf={startData.exam.allowPdfAnswers}
              onTextChange={(v) => handleTextChange(currentQuestion.id, v)}
              onUpload={(file) => handleUpload(currentQuestion.id, file)}
            />
          </CardContent>
          <CardFooter className="border-t pt-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => goToQuestion(currentIdx - 1)}
              disabled={currentIdx === 0}
            >
              <ArrowRight className="w-4 h-4 ml-1" /> السابق
            </Button>
            <span className="text-xs text-gray-400">
              السؤال {currentIdx + 1} من {questions.length}
            </span>
            {currentIdx === questions.length - 1 ? (
              <Button
                onClick={() => setShowSubmitDialog(true)}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                <Send className="w-4 h-4 ml-1" /> تسليم
              </Button>
            ) : (
              <Button
                onClick={() => goToQuestion(currentIdx + 1)}
                className="bg-[#610000] hover:bg-[#4a0000] text-white"
              >
                التالي <ArrowLeft className="w-4 h-4 mr-1" />
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* مستكشف الأسئلة */}
        <Card className="shadow-sm border-0 h-fit sticky top-[140px]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">الأسئلة</CardTitle>
              {flaggedCount > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  <Bookmark className="w-3 h-3 ml-1" /> {flaggedCount}
                </Badge>
              )}
            </div>
            {/* فلترة المستكشف */}
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => setNavFilter('all')}
                className={`flex-1 text-xs py-1 px-2 rounded-md transition-colors ${
                  navFilter === 'all' ? 'bg-[#610000]/10 text-[#610000] font-medium' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setNavFilter('flagged')}
                className={`flex-1 text-xs py-1 px-2 rounded-md transition-colors flex items-center justify-center gap-1 ${
                  navFilter === 'flagged' ? 'bg-amber-100 text-amber-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Bookmark className="w-3 h-3" /> للمراجعة
              </button>
              <button
                onClick={() => setNavFilter('unanswered')}
                className={`flex-1 text-xs py-1 px-2 rounded-md transition-colors ${
                  navFilter === 'unanswered' ? 'bg-gray-200 text-gray-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                غير مُجاب
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-5 lg:grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto">
              {questions.map((q, idx) => {
                const isAnswered = !!(answers[q.id]?.text?.trim() || answers[q.id]?.imageUrl || answers[q.id]?.fileUrl);
                const isCurrent = idx === currentIdx;
                const flagged = isFlagged(q.id);

                // تطبيق فلترة المستكشف
                if (navFilter === 'flagged' && !flagged) return null;
                if (navFilter === 'unanswered' && isAnswered) return null;

                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(idx)}
                    className={`aspect-square rounded-lg text-sm font-medium border-2 transition-all relative ${
                      isCurrent
                        ? 'border-[#610000] bg-[#610000] text-white'
                        : isAnswered
                        ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                    title={`سؤال ${idx + 1}${flagged ? ' • للمراجعة' : ''}${isAnswered ? ' • مُجاب' : ' • غير مُجاب'}`}
                  >
                    {idx + 1}
                    {flagged && (
                      <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center ${
                        isCurrent ? 'bg-white' : 'bg-amber-400'
                      }`}>
                        <Bookmark className={`w-2 h-2 ${isCurrent ? 'text-[#610000]' : 'text-white'}`} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Separator className="my-3" />
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 border-green-300 bg-green-50" />
                <span>مُجاب ({totalAnswered})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 border-gray-200 bg-white" />
                <span>غير مُجاب ({questions.length - totalAnswered})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border-2 border-amber-400 bg-amber-50" />
                <span>للمراجعة ({flaggedCount})</span>
              </div>
              {flaggedCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 mt-2 text-xs text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    // القفز لأول سؤال معلّم
                    const firstFlaggedIdx = questions.findIndex(q => isFlagged(q.id));
                    if (firstFlaggedIdx >= 0) goToQuestion(firstFlaggedIdx);
                  }}
                >
                  <BookmarkCheck className="w-3 h-3 ml-1" /> اذهب لأول سؤال معلّم
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* نافذة تأكيد التسليم */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#610000]" />
              تأكيد تسليم الامتحان
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من تسليم الامتحان؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">أجبت عن</p>
                <p className="text-lg font-bold text-gray-900">{totalAnswered} / {questions.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">الوقت المتبقي</p>
                <p className="text-lg font-bold text-gray-900">{formatTime(remainingSeconds)}</p>
              </div>
            </div>
            {totalAnswered < questions.length && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  لديك {questions.length - totalAnswered} سؤال بدون إجابة. سيتم تسليمها فارغة.
                </AlertDescription>
              </Alert>
            )}
            {violationCount > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  تم تسجيل {violationCount} انتهاك أثناء الامتحان — سيتم مراجعتها من قبل المعلم.
                </AlertDescription>
              </Alert>
            )}
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التسليم...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 ml-1" /> نعم، سلّم</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== مدخل السؤال حسب نوعه =====

function QuestionInput({
  question,
  answer,
  uploadStatus,
  moderation,
  allowText,
  allowImage,
  allowPdf,
  onTextChange,
  onUpload,
}: {
  question: Question;
  answer?: { text?: string; imageUrl?: string; fileUrl?: string };
  uploadStatus?: 'idle' | 'uploading' | 'done' | 'error';
  moderation?: ModerationInfo | null;
  allowText: boolean;
  allowImage: boolean;
  allowPdf: boolean;
  onTextChange: (v: string) => void;
  onUpload: (file: File) => void;
}) {
  const currentValue = answer?.text || '';

  // MCQ
  if (question.type === 'MCQ' && question.options) {
    return (
      <div className="space-y-3">
        <RadioGroup
          value={currentValue}
          onValueChange={onTextChange}
          className="space-y-2"
        >
          {question.options.map((opt, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                currentValue === opt || currentValue === String(idx)
                  ? 'border-[#610000] bg-[#610000]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RadioGroupItem value={opt} id={`opt-${idx}`} className="data-[state=checked]:border-[#610000] data-[state=checked]:text-[#610000]" />
              <span className="text-sm text-gray-800 flex-1">{opt}</span>
            </label>
          ))}
        </RadioGroup>
        <ModerationBanner moderation={moderation} />
      </div>
    );
  }

  // TRUE_FALSE
  if (question.type === 'TRUE_FALSE') {
    return (
      <div className="space-y-3">
        <RadioGroup
          value={currentValue}
          onValueChange={onTextChange}
          className="grid grid-cols-2 gap-3"
        >
          <label className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            currentValue === 'true' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <RadioGroupItem value="true" id="tf-true" className="data-[state=checked]:border-green-600 data-[state=checked]:text-green-600" />
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">صح</span>
          </label>
          <label className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            currentValue === 'false' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <RadioGroupItem value="false" id="tf-false" className="data-[state=checked]:border-red-600 data-[state=checked]:text-red-600" />
            <XCircle className="w-5 h-5" />
            <span className="font-medium">خطأ</span>
          </label>
        </RadioGroup>
        <ModerationBanner moderation={moderation} />
      </div>
    );
  }

  // IMAGE_ANSWER
  if (question.type === 'IMAGE_ANSWER') {
    return (
      <div className="space-y-3">
        <ImageUploader
          questionId={question.id}
          existingUrl={answer?.imageUrl}
          status={uploadStatus || 'idle'}
          onUpload={onUpload}
        />
        <ModerationBanner moderation={moderation} />
      </div>
    );
  }

  // FILE_PDF
  if (question.type === 'FILE_PDF') {
    return (
      <div className="space-y-3">
        <PdfUploader
          questionId={question.id}
          existingUrl={answer?.fileUrl}
          status={uploadStatus || 'idle'}
          onUpload={onUpload}
        />
        <ModerationBanner moderation={moderation} />
      </div>
    );
  }

  // SHORT / ESSAY
  return (
    <div className="space-y-3">
      <Textarea
        value={currentValue}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={
          question.type === 'SHORT'
            ? 'اكتب إجابتك القصيرة هنا...'
            : 'اكتب إجابتك التفصيلية هنا... (تُراجع إجابتك بالذكاء الاصطناعي لضمان النزاهة)'
        }
        className="min-h-[120px] text-right text-sm leading-relaxed resize-y"
        dir="rtl"
      />
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{currentValue.length} حرف</span>
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          الحفظ تلقائي
        </span>
      </div>
      <ModerationBanner moderation={moderation} />
    </div>
  );
}

function ModerationBanner({ moderation }: { moderation?: ModerationInfo | null }) {
  if (!moderation) return null;
  if (moderation.decision === 'SAFE') return null;
  const isBlocked = moderation.decision === 'BLOCKED';
  return (
    <Alert variant={isBlocked ? 'destructive' : 'default'} className={isBlocked ? '' : 'border-amber-200 bg-amber-50 text-amber-800'}>
      {isBlocked ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <AlertDescription className="text-xs">
        {isBlocked
          ? `تم رفض إجابتك: ${moderation.reasons.join('، ')}. يرجى إعادة كتابتها.`
          : `تم حفظ الإجابة لكنها ستخضع لمراجعة المعلم: ${moderation.reasons.join('، ')}`}
      </AlertDescription>
    </Alert>
  );
}

function ImageUploader({
  questionId,
  existingUrl,
  status,
  onUpload,
}: {
  questionId: string;
  existingUrl?: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // preview يُستخدم فقط لمعاينة الملف المرفوع محلياً (data URL).
  // عند تغيّر السؤال، المكوّن يُعاد تركيبه عبر key={questionId} من الأب.
  const [preview, setPreview] = useState<string | null>(null);
  const displayUrl = preview || existingUrl;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    onUpload(file);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {displayUrl ? (
        <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
          <img src={displayUrl} alt="إجابتك" className="w-full max-h-80 object-contain bg-gray-50" />
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 left-2"
            onClick={() => {
              setPreview(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            <Upload className="w-3.5 h-3.5 ml-1" /> استبدال
          </Button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-[#610000] hover:bg-[#610000]/5 transition-colors"
        >
          <div className="flex flex-col items-center gap-2 text-gray-500">
            {status === 'uploading' ? (
              <><Loader2 className="w-8 h-8 animate-spin" /> <span className="text-sm">جاري الرفع والمراجعة...</span></>
            ) : status === 'error' ? (
              <><XCircle className="w-8 h-8 text-red-500" /> <span className="text-sm text-red-600">فشل الرفع — حاول مجدداً</span></>
            ) : (
              <>
                <Camera className="w-8 h-8" />
                <span className="text-sm font-medium">اضغط لرفع صورة الإجابة</span>
                <span className="text-xs text-gray-400">PNG / JPG / WEBP — حتى 5MB</span>
              </>
            )}
          </div>
        </button>
      )}
      {status === 'done' && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> تم رفع الصورة ومراجعتها بنجاح
        </p>
      )}
    </div>
  );
}

function PdfUploader({
  questionId,
  existingUrl,
  status,
  onUpload,
}: {
  questionId: string;
  existingUrl?: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    onUpload(file);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {fileName || existingUrl ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
          <FileCheck className="w-8 h-8 text-red-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{fileName || 'ملف PDF'}</p>
            <p className="text-xs text-gray-500">
              {status === 'uploading' ? 'جاري الرفع والمراجعة...' : status === 'done' ? 'تم الرفع' : ''}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            استبدال
          </Button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-[#610000] hover:bg-[#610000]/5 transition-colors"
        >
          <div className="flex flex-col items-center gap-2 text-gray-500">
            {status === 'uploading' ? (
              <><Loader2 className="w-8 h-8 animate-spin" /> <span className="text-sm">جاري الرفع...</span></>
            ) : (
              <>
                <FileText className="w-8 h-8" />
                <span className="text-sm font-medium">اضغط لرفع ملف PDF</span>
                <span className="text-xs text-gray-400">PDF فقط — حتى 10MB</span>
              </>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

// ============================================================
//  ShortcutRow — صف اختصار في لوحة الاختصارات
// ============================================================
function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono text-gray-700 min-w-[24px] text-center">
            {k}
          </kbd>
        ))}
      </div>
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

// ============================================================
//  ⑤ ExamResult — النتيجة + مراجعة + التظلّم
// ============================================================

function ExamResult({
  student,
  exam,
  submissionId,
  onBack,
}: {
  student: StudentInfo;
  exam: AvailableExam;
  submissionId: string;
  onBack: () => void;
}) {
  const [result, setResult] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appealDialogFor, setAppealDialogFor] = useState<{ answerId: string; questionId: string; currentScore: number; maxScore: number } | null>(null);
  const [appeals, setAppeals] = useState<any[]>([]);

  const loadResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resResult, resQuestions, resAppeals] = await Promise.all([
        fetch(buildUrl(`/api/exams/${exam.id}/result`, student, { submissionId }), {
          headers: { 'x-student-id': student.studentId },
        }),
        fetch(buildUrl(`/api/exams/${exam.id}`, student), {
          headers: { 'x-student-id': student.studentId },
        }),
        fetch(buildUrl(`/api/exams/${exam.id}/appeals`, student), {
          headers: { 'x-student-id': student.studentId },
        }),
      ]);
      const dataResult = await resResult.json();
      const dataQuestions = await resQuestions.json();
      const dataAppeals = await resAppeals.json();
      if (resResult.ok) setResult(dataResult.result || dataResult);
      else setError(dataResult.error || dataResult.message || 'فشل جلب النتيجة');
      if (resQuestions.ok) setQuestions(dataQuestions.questions || []);
      if (resAppeals.ok) setAppeals(dataAppeals.appeals || []);
    } catch (e) {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [exam.id, student, submissionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadResult();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, []);

  const submitAppeal = async (answerId: string, reason: string, requestedScore?: number) => {
    const res = await fetch(buildUrl(`/api/exams/${exam.id}/appeals`, student), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-student-id': student.studentId },
      body: JSON.stringify({ answerId, reason, requestedScore }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تقديم التظلّم');
    // إعادة تحميل التظلّمات
    loadResult();
    return data;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#610000] animate-spin mb-3" />
        <p className="text-gray-500 text-sm">جاري حساب النتيجة...</p>
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>تعذّر عرض النتيجة</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={loadResult} variant="outline" className="w-full mt-4">
          <RefreshCw className="w-4 h-4 ml-2" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  // الحالات الخاصة
  if (result?.status === 'IN_PROGRESS') {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <Clock className="w-16 h-16 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">المحاولة جارية</h3>
        <p className="text-gray-500 text-sm mb-4">لم يتم تسليم هذه المحاولة بعد.</p>
        <Button onClick={onBack}>العودة للقائمة</Button>
      </div>
    );
  }

  if (result?.status === 'SUBMITTED' && !result?.totalScore) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <FileCheck className="w-10 h-10 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">تم التسليم بنجاح</h3>
        <p className="text-gray-500 text-sm mb-4">
          تم تسليم محاولتك. النتيجة الكاملة ستظهر بعد تصحيح المعلم للأسئلة المقالية.
        </p>
        <div className="text-xs text-gray-400 mb-4">
          {result.submittedAt && `سُلِّمت في: ${formatDate(result.submittedAt)}`}
        </div>
        <Button onClick={onBack}>العودة للقائمة</Button>
      </div>
    );
  }

  const totalScore = result?.totalScore ?? 0;
  const maxScore = result?.maxScore ?? 0;
  const percentage = result?.percentage ?? (maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0);
  const passed = result?.passed ?? percentage >= 50;
  const violationsCount = result?.violationsCount || 0;
  const answers = result?.answers || [];

  // ===== إحصائيات الأسئلة للرسم البياني =====
  const correctCount = answers.filter((a: any) => a.isCorrect === true).length;
  const incorrectCount = answers.filter((a: any) => a.isCorrect === false).length;
  const pendingCount = answers.filter((a: any) => a.isCorrect === null || a.isCorrect === undefined).length;
  const hasChartData = correctCount + incorrectCount + pendingCount > 0;
  const chartData = [
    { name: 'صحيحة', value: correctCount, color: '#16a34a' },
    { name: 'خاطئة', value: incorrectCount, color: '#dc2626' },
    { name: 'قيد المراجعة', value: pendingCount, color: '#d97706' },
  ].filter(d => d.value > 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 print:space-y-3">
      {/* بطاقة النتيجة الرئيسية */}
      <Card className={`shadow-lg border-0 overflow-hidden ${passed ? 'ring-2 ring-green-500/20' : 'ring-2 ring-red-500/20'} print:shadow-none print:ring-1`}>
        <div className={`p-6 text-center ${passed ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-red-600 to-red-700'} text-white print:bg-green-700`}>
          <div className="flex items-center justify-between mb-3 print:hidden">
            <span className="text-xs text-white/70">{result?.submittedAt && formatDate(result.submittedAt)}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrint}
              className="text-white hover:bg-white/20 h-8"
              title="طباعة / حفظ PDF"
            >
              <Printer className="w-4 h-4 ml-1" /> طباعة
            </Button>
          </div>
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-3">
            {passed ? <Award className="w-12 h-12" /> : <AlertCircle className="w-12 h-12" />}
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {passed ? 'نجحت!' : 'لم تنجح هذه المرة'}
          </h2>
          <p className="text-white/80 text-sm mb-4">{exam.title}</p>
          <div className="inline-flex items-center gap-4 bg-white/15 backdrop-blur rounded-2xl px-6 py-3">
            <div className="text-center">
              <p className="text-3xl font-bold">{totalScore}</p>
              <p className="text-xs text-white/70">من {maxScore}</p>
            </div>
            <div className="w-px h-10 bg-white/30" />
            <div className="text-center">
              <p className="text-3xl font-bold">{percentage}%</p>
              <p className="text-xs text-white/70">النسبة</p>
            </div>
          </div>
        </div>
        <CardContent className="pt-5">
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-gray-500">عدد الأسئلة</p>
              <p className="font-bold text-gray-900">{questions.length || answers.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">الانتهاكات</p>
              <p className={`font-bold ${violationsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {violationsCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">درجة النجاح</p>
              <p className="font-bold text-gray-900">{result?.passingScore ?? 50}%</p>
            </div>
          </div>
          {result?.autoClosed && (
            <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-800">
              <Timer className="w-4 h-4" />
              <AlertDescription className="text-xs">
                انتهى وقت الامتحان وتم تسليم محاولتك تلقائياً.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ====== رسم بياني لأداء الأسئلة ====== */}
      {hasChartData && (
        <Card className="shadow-sm border-0 print:shadow-none print:border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-[#610000]" />
              توزيع نتائج الأسئلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="h-32 w-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis type="number" stroke="#666" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} width={70} />
                    <RTooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v} سؤال`, '']}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-[160px] space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-green-50">
                  <span className="flex items-center gap-2 text-sm text-green-800">
                    <span className="w-3 h-3 rounded bg-green-600" /> إجابات صحيحة
                  </span>
                  <span className="font-bold text-green-700">{correctCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-50">
                  <span className="flex items-center gap-2 text-sm text-red-800">
                    <span className="w-3 h-3 rounded bg-red-600" /> إجابات خاطئة
                  </span>
                  <span className="font-bold text-red-700">{incorrectCount}</span>
                </div>
                {pendingCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50">
                    <span className="flex items-center gap-2 text-sm text-amber-800">
                      <span className="w-3 h-3 rounded bg-amber-600" /> قيد المراجعة
                    </span>
                    <span className="font-bold text-amber-700">{pendingCount}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* مراجعة الإجابات — تُظهر الدرجات حتى قبل التصحيح الكامل */}
      {answers.length > 0 && (
        <Card className="shadow-sm border-0 print:shadow-none print:border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-[#610000]" />
              مراجعة الإجابات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.map((q, idx) => {
              const ans = answers.find((a: any) => a.questionId === q.id);
              if (!ans) return null;
              const score = ans.score ?? 0;
              const maxS = ans.maxScore ?? q.points;
              const isCorrect = ans.isCorrect;
              const hasAppeal = appeals.some(ap => ap.answerId === ans.id && ap.status === 'PENDING');
              return (
                <div key={q.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">سؤال {idx + 1}</Badge>
                      <Badge variant="secondary" className="text-xs">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      {hasAppeal && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          <MessageSquareWarning className="w-3 h-3 ml-1" /> تظلّم قيد المراجعة
                        </Badge>
                      )}
                    </div>
                    <div className={`text-sm font-bold flex-shrink-0 ${
                      isCorrect === true ? 'text-green-600' :
                      isCorrect === false ? 'text-red-600' :
                      'text-gray-500'
                    }`}>
                      {score} / {maxS}
                      {isCorrect === true && <CheckCircle2 className="w-4 h-4 inline mr-1" />}
                      {isCorrect === false && <XCircle className="w-4 h-4 inline mr-1" />}
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 mb-2 line-clamp-2">{q.text}</p>
                  {ans.teacherNote && (
                    <div className="text-xs bg-blue-50 rounded p-2 text-blue-800 mt-2">
                      <strong>ملاحظة المعلم:</strong> {ans.teacherNote}
                    </div>
                  )}
                  {(q.type === 'SHORT' || q.type === 'ESSAY') && !hasAppeal && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-amber-700 hover:text-amber-800 mt-2"
                      onClick={() => setAppealDialogFor({
                        answerId: ans.id,
                        questionId: q.id,
                        currentScore: score,
                        maxScore: maxS,
                      })}
                    >
                      <MessageSquareWarning className="w-3.5 h-3.5 ml-1" /> تظلّم على هذه الدرجة
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* التظلّمات السابقة */}
      {appeals.length > 0 && (
        <Card className="shadow-sm border-0">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareWarning className="w-4 h-4 text-amber-600" />
              تظلّماتي ({appeals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appeals.map((ap: any) => (
              <div key={ap.id} className="border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className={
                    ap.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                    ap.status === 'APPROVED' ? 'bg-green-50 text-green-700' :
                    'bg-gray-50 text-gray-700'
                  }>
                    {ap.status === 'PENDING' ? 'قيد المراجعة' : ap.status === 'APPROVED' ? 'مقبول' : 'مرفوض'}
                  </Badge>
                  <span className="text-xs text-gray-400">{formatDate(ap.createdAt)}</span>
                </div>
                <p className="text-gray-700 text-xs mb-1">{ap.reason}</p>
                {ap.requestedScore != null && (
                  <p className="text-xs text-gray-500">الدرجة المطلوبة: {ap.requestedScore} / {ap.maxScore}</p>
                )}
                {ap.teacherReply && (
                  <p className="text-xs bg-blue-50 rounded p-2 mt-1 text-blue-800">
                    <strong>رد المعلم:</strong> {ap.teacherReply}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={onBack} className="flex-1 bg-[#610000] hover:bg-[#4a0000] text-white">
          <ArrowRight className="w-4 h-4 ml-1" /> العودة للقائمة
        </Button>
        <Button onClick={loadResult} variant="outline" className="flex-1">
          <RefreshCw className="w-4 h-4 ml-2" /> تحديث النتيجة
        </Button>
      </div>

      {/* نافذة التظلّم — key يُعيد التركيب عند تغيّر الإجابة لإعادة ضبط النموذج */}
      <AppealDialog
        key={appealDialogFor?.answerId || 'closed'}
        info={appealDialogFor}
        onClose={() => setAppealDialogFor(null)}
        onSubmit={async (reason, requestedScore) => {
          if (!appealDialogFor) return;
          await submitAppeal(appealDialogFor.answerId, reason, requestedScore);
          setAppealDialogFor(null);
        }}
      />
    </div>
  );
}

function AppealDialog({
  info,
  onClose,
  onSubmit,
}: {
  info: { answerId: string; questionId: string; currentScore: number; maxScore: number } | null;
  onClose: () => void;
  onSubmit: (reason: string, requestedScore?: number) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [requestedScore, setRequestedScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!info) return;
    setError(null);
    if (reason.trim().length < 10) {
      setError('سبب التظلّم يجب أن يكون 10 أحرف على الأقل');
      return;
    }
    setLoading(true);
    try {
      const reqScore = requestedScore ? parseFloat(requestedScore) : undefined;
      if (reqScore !== undefined && (isNaN(reqScore) || reqScore < 0 || reqScore > info.maxScore)) {
        setError(`الدرجة المطلوبة يجب أن تكون بين 0 و ${info.maxScore}`);
        setLoading(false);
        return;
      }
      await onSubmit(reason.trim(), reqScore);
    } catch (e) {
      setError((e as Error).message || 'فشل تقديم التظلّم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-amber-600" />
            تقديم تظلّم
          </DialogTitle>
          <DialogDescription>
            الدرجة الحالية: {info?.currentScore} / {info?.maxScore}. اشرح سبب تظلّمك بوضوح.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label className="text-sm">سبب التظلّم</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اشرح لماذا تعتقد أن الدرجة تستحق المراجعة..."
              className="min-h-[100px] text-sm"
              dir="rtl"
            />
            <p className="text-xs text-gray-400">{reason.length} / 1000 حرف</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">الدرجة التي تطلبها (اختياري)</Label>
            <Input
              type="number"
              value={requestedScore}
              onChange={(e) => setRequestedScore(e.target.value)}
              placeholder={`من 0 إلى ${info?.maxScore}`}
              className="text-right"
              min={0}
              max={info?.maxScore}
              step={0.5}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>إلغاء</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-1" />}
            تقديم التظلّم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
