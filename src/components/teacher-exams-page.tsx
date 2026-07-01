'use client';

/**
 * ============================================================
 *  واجهة المعلم للامتحانات الإلكترونية
 *  TeacherExamsPage
 * ============================================================
 *  تدفّق الشاشات:
 *    login → dashboard (exam list)
 *              └── exam-detail (tabs: questions | submissions | appeals | settings)
 *                    ├── create-exam (dialog)
 *                    ├── question-editor (dialog)
 *                    └── submission-grading (detail view)
 *
 *  التكامل:
 *    • GET    /api/exams/teacher
 *    • POST   /api/exams/teacher
 *    • GET    /api/exams/teacher/[id]
 *    • PUT    /api/exams/teacher/[id]
 *    • DELETE /api/exams/teacher/[id]
 *    • POST   /api/exams/teacher/[id]/publish
 *    • POST   /api/exams/teacher/[id]/close
 *    • POST   /api/exams/teacher/[id]/archive
 *    • GET    /api/exams/teacher/[id]/questions
 *    • POST   /api/exams/teacher/[id]/questions
 *    • PUT    /api/exams/teacher/[id]/questions/[qid]
 *    • DELETE /api/exams/teacher/[id]/questions/[qid]
 *    • GET    /api/exams/teacher/[id]/submissions
 *    • GET    /api/exams/teacher/submissions/[subId]
 *    • POST   /api/exams/teacher/answers/[ansId]
 *    • POST   /api/exams/teacher/submissions/[subId]/finalize
 *    • GET    /api/exams/teacher/[id]/appeals
 *    • POST   /api/exams/teacher/appeals/[appealId]
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, ArrowLeft, Plus, Search, RefreshCw, Loader2, AlertCircle,
  FileText, Clock, Calendar, Users, BookOpen, Settings, ListChecks,
  Edit3, Trash2, Eye, Send, CheckCircle2, XCircle, AlertTriangle,
  Shield, Lock, EyeOff, Eye as EyeIcon, Save, X, ChevronLeft,
  GraduationCap, LogOut, ClipboardList, Gavel, MessageSquareWarning,
  Hash, Award, TrendingUp, Filter, FileImage, FileType, HelpCircle,
  Check, Ban, Info, Sparkles, ShieldAlert, Hash as HashIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

// ===== Types =====

interface TeacherExamsPageProps {
  onBack: () => void;
  schoolId?: string;
}

interface TeacherInfo {
  teacherId: string;
  teacherName: string;
  schoolId: string;
}

type Screen = 'login' | 'dashboard' | 'exam-detail' | 'submission-grading';

type QuestionType =
  | 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF';

interface ExamListItem {
  id: string;
  title: string;
  subject: string;
  classroomName: string | null;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  totalPoints: number;
  passingScore: number | null;
  maxAttempts: number;
  hasPassword: boolean;
  timeStatus: 'UPCOMING' | 'OPEN' | 'ENDED';
  submissionsCount: number;
  questionsCount: number;
}

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[] | null;
  correctAnswer: string | null;
  correctText: string | null;
  rubric: Record<string, unknown> | string | null;
  points: number;
  order: number;
  explanation: string | null;
  textModeration?: string | null;
}

interface ExamDetail {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  teacherName: string | null;
  classroomName: string | null;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  hasPassword: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReview: boolean;
  showResultImmediately: boolean;
  parentVisible: boolean;
  maxAttempts: number;
  maxFileSizeMb: number;
  allowTextAnswers: boolean;
  allowImageAnswers: boolean;
  allowPdfAnswers: boolean;
  antiCheatEnabled: boolean;
  ipRestriction: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  totalPoints: number;
  passingScore: number | null;
  questionsCount: number;
  submissionsCount: number;
  questions: Question[];
}

interface SubmissionListItem {
  id: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  autoClosedAt: string | null;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'FLAGGED' | 'AUTO_CLOSED';
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  focusEvents: number;
  tabSwitches: number;
  copyAttempts: number;
  gradedAt: string | null;
  gradedByName: string | null;
  answersCount: number;
  violationsCount: number;
  appealsCount: number;
  suspicious: boolean;
  needsGrading: boolean;
}

interface SubmissionStats {
  total: number;
  inProgress: number;
  submitted: number;
  graded: number;
  autoClosed: number;
  needsGrading: number;
  suspiciousCount: number;
  avgScore: number;
}

interface AnswerDetail {
  id: string;
  questionId: string;
  textAnswer: string | null;
  imageAnswerUrl: string | null;
  fileAnswerUrl: string | null;
  textModeration: string | null;
  imageModeration: string | null;
  fileModeration: string | null;
  moderationNotes: string | null;
  score: number | null;
  maxScore: number | null;
  isCorrect: boolean | null;
  teacherNote: string | null;
  aiSuggestedScore: number | null;
  aiConfidence: number | null;
  gradedAt: string | null;
  gradedById: string | null;
  question: Question;
}

interface SubmissionDetail {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  autoClosedAt: string | null;
  status: SubmissionListItem['status'];
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  focusEvents: number;
  tabSwitches: number;
  copyAttempts: number;
  lastActivityAt: string | null;
  gradedAt: string | null;
  gradedByName: string | null;
  exam: {
    id: string;
    title: string;
    subject: string;
    totalPoints: number;
    passingScore: number | null;
  };
  answers: AnswerDetail[];
  violations: Array<{
    id: string;
    type: string;
    severity: string;
    details: string | null;
    createdAt: string;
  }>;
  appeals: Array<{
    id: string;
    reason: string;
    requestedScore: number | null;
    status: string;
    teacherReply: string | null;
    reviewedAt: string | null;
    createdAt: string;
  }>;
  violationsCount: number;
  appealsCount: number;
}

interface AppealListItem {
  id: string;
  answerId: string;
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  currentScore: number | null;
  maxScore: number | null;
  requestedScore: number | null;
  studentName: string;
  attemptNumber: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  teacherReply: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

// ===== Constants =====

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'اختيار من متعدد',
  TRUE_FALSE: 'صح / خطأ',
  SHORT: 'إجابة قصيرة',
  ESSAY: 'سؤال مقالي',
  IMAGE_ANSWER: 'إجابة بصورة',
  FILE_PDF: 'إجابة بملف PDF',
};

const EXAM_STATUS_LABELS: Record<ExamListItem['status'], string> = {
  DRAFT: 'مسودة',
  PUBLISHED: 'منشور',
  CLOSED: 'مغلق',
  ARCHIVED: 'مؤرشف',
};

const SUBMISSION_STATUS_LABELS: Record<SubmissionListItem['status'], string> = {
  IN_PROGRESS: 'قيد الحل',
  SUBMITTED: 'تم التسليم',
  GRADED: 'تم التصحيح',
  FLAGGED: 'مُعلَّق',
  AUTO_CLOSED: 'أُغلق تلقائياً',
};

const APPEAL_STATUS_LABELS: Record<AppealListItem['status'], string> = {
  PENDING: 'بانتظار المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

const TIME_STATUS_LABELS: Record<ExamListItem['timeStatus'], string> = {
  UPCOMING: 'لم يبدأ بعد',
  OPEN: 'مفتوح الآن',
  ENDED: 'انتهى',
};

// ===== Helpers =====

async function teacherFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as Record<string, unknown>).error as string || `HTTP ${res.status}`);
    return data as T;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('انتهت مهلة الطلب');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(base: string, teacher: TeacherInfo, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set('schoolId', teacher.schoolId);
  params.set('teacherId', teacher.teacherId);
  params.set('teacherName', teacher.teacherName);
  if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return `${base}?${params.toString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function toDateTimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function defaultDateTimeLocal(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function statusBadgeClass(status: ExamListItem['status']): string {
  switch (status) {
    case 'DRAFT': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'PUBLISHED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CLOSED': return 'bg-gray-200 text-gray-700 border-gray-300';
    case 'ARCHIVED': return 'bg-slate-200 text-slate-700 border-slate-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function submissionStatusBadgeClass(status: SubmissionListItem['status']): string {
  switch (status) {
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'SUBMITTED': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'GRADED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'FLAGGED': return 'bg-red-100 text-red-800 border-red-200';
    case 'AUTO_CLOSED': return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function appealStatusBadgeClass(status: AppealListItem['status']): string {
  switch (status) {
    case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'APPROVED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

// ===== Main Component =====

export default function TeacherExamsPage({ onBack, schoolId }: TeacherExamsPageProps) {
  const [screen, setScreen] = useState<Screen>('login');
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: ToastMessage['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const handleLogin = (info: TeacherInfo) => {
    setTeacher(info);
    setScreen('dashboard');
  };

  const handleSwitchTeacher = () => {
    setTeacher(null);
    setSelectedExamId(null);
    setSelectedSubmissionId(null);
    setScreen('login');
  };

  const handleOpenExam = (examId: string) => {
    setSelectedExamId(examId);
    setScreen('exam-detail');
  };

  const handleBackToDashboard = () => {
    setSelectedExamId(null);
    setScreen('dashboard');
  };

  const handleOpenSubmission = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setScreen('submission-grading');
  };

  const handleBackToExamDetail = () => {
    setSelectedSubmissionId(null);
    setScreen('exam-detail');
  };

  return (
    <div className="min-h-screen flex flex-col" dir="rtl" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (screen === 'login') onBack();
                else if (screen === 'dashboard') onBack();
                else if (screen === 'exam-detail') handleBackToDashboard();
                else if (screen === 'submission-grading') handleBackToExamDetail();
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              {screen === 'login' || screen === 'dashboard' ? 'الموقع' : screen === 'exam-detail' ? 'القائمة' : 'الامتحان'}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#610000] flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-900 truncate">امتحانات المعلم</h1>
                {teacher && screen !== 'login' && (
                  <p className="text-xs text-gray-500 truncate">
                    {teacher.teacherName} • {teacher.teacherId}
                  </p>
                )}
              </div>
            </div>
          </div>
          {teacher && screen !== 'login' && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 hidden sm:flex">
                <LogOut className="w-4 h-4 ml-1" />
                الرئيسية
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSwitchTeacher} className="text-gray-500">
                <Users className="w-4 h-4 ml-1" />
                تبديل المعلم
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4">
          <Alert
            variant={toast.type === 'error' ? 'destructive' : 'default'}
            className={`shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200' : toast.type === 'info' ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
            <AlertDescription className="font-medium">{toast.text}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {screen === 'login' && (
          <TeacherLogin onLogin={handleLogin} schoolId={schoolId} onBack={onBack} />
        )}
        {screen === 'dashboard' && teacher && (
          <TeacherDashboard teacher={teacher} onOpenExam={handleOpenExam} showToast={showToast} />
        )}
        {screen === 'exam-detail' && teacher && selectedExamId && (
          <ExamDetail
            teacher={teacher}
            examId={selectedExamId}
            onBack={handleBackToDashboard}
            onOpenSubmission={handleOpenSubmission}
            showToast={showToast}
          />
        )}
        {screen === 'submission-grading' && teacher && selectedExamId && selectedSubmissionId && (
          <SubmissionGrading
            teacher={teacher}
            submissionId={selectedSubmissionId}
            onBack={handleBackToExamDetail}
            showToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t py-3 px-4 text-center">
        <p className="text-xs text-gray-500">
          لوحة تحكّم المعلم • إنشاء وإدارة الامتحانات الإلكترونية وتصحيح التسليمات
        </p>
      </footer>
    </div>
  );
}

// ============================================================
//  ① TeacherLogin — شاشة الدخول
// ============================================================

function TeacherLogin({
  onLogin, schoolId, onBack,
}: {
  onLogin: (info: TeacherInfo) => void;
  schoolId?: string;
  onBack: () => void;
}) {
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [schoolIdInput, setSchoolIdInput] = useState(schoolId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!teacherId.trim()) { setError('معرّف المعلم مطلوب'); return; }
    if (!teacherName.trim()) { setError('اسم المعلم مطلوب'); return; }
    if (!schoolIdInput.trim()) { setError('معرّف المدرسة مطلوب'); return; }
    setLoading(true);
    try {
      // تحقق سريع من قائمة الامتحانات (لا يلزم — فقط للتأكد من المعلم)
      const url = `/api/exams/teacher?schoolId=${encodeURIComponent(schoolIdInput)}&teacherId=${encodeURIComponent(teacherId)}&teacherName=${encodeURIComponent(teacherName)}`;
      const data = await teacherFetch<{ success?: boolean; error?: string }>(url);
      if (data && data.success) {
        onLogin({
          teacherId: teacherId.trim(),
          teacherName: teacherName.trim(),
          schoolId: schoolIdInput.trim(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل التحقق';
      // نسمح بالدخول حتى لو فشل الفحص في وضع الاختبار (قد لا توجد امتحانات بعد)
      if (teacherId.trim().startsWith('test-')) {
        onLogin({
          teacherId: teacherId.trim(),
          teacherName: teacherName.trim(),
          schoolId: schoolIdInput.trim(),
        });
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-6">
      <Card className="shadow-lg border-0">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#610000]/10 flex items-center justify-center mb-3">
            <GraduationCap className="w-8 h-8 text-[#610000]" />
          </div>
          <CardTitle className="text-xl text-gray-900">دخول المعلم</CardTitle>
          <CardDescription className="text-gray-500">
            أدخل بياناتك للوصول إلى لوحة تحكّم الامتحانات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacherId" className="text-sm font-medium text-gray-700">
                معرّف المعلم <span className="text-red-500">*</span>
              </Label>
              <Input
                id="teacherId"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                placeholder="مثال: test-teacher-001"
                className="text-right font-mono text-sm"
                autoComplete="off"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherName" className="text-sm font-medium text-gray-700">
                الاسم الكامل <span className="text-red-500">*</span>
              </Label>
              <Input
                id="teacherName"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="الاسم كما هو مسجّل في المدرسة"
                className="text-right"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolIdLogin" className="text-sm font-medium text-gray-700">
                معرّف المدرسة <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolIdLogin"
                value={schoolIdInput}
                onChange={(e) => setSchoolIdInput(e.target.value)}
                placeholder="معرّف المدرسة"
                className="text-right font-mono text-sm"
                autoComplete="off"
                disabled={!!schoolId}
              />
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                للتجربة استخدم: <span className="font-mono font-bold">test-teacher-001</span>
              </AlertDescription>
            </Alert>

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
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جارٍ التحقق...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 ml-2 rotate-180" />
                  دخول
                </>
              )}
            </Button>

            <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة للصفحة الرئيسية
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  ② TeacherDashboard — قائمة الامتحانات
// ============================================================

function TeacherDashboard({
  teacher, onOpenExam, showToast,
}: {
  teacher: TeacherInfo;
  onOpenExam: (examId: string) => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ExamListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const extra: Record<string, string> = {};
      if (statusFilter !== 'all') extra.status = statusFilter;
      if (search.trim()) extra.search = search.trim();
      const url = buildUrl('/api/exams/teacher', teacher, extra);
      const data = await teacherFetch<{ success: boolean; exams: ExamListItem[] }>(url);
      setExams(data.exams || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب الامتحانات');
    } finally {
      setLoading(false);
    }
  }, [teacher, statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchExams, 350);
    return () => clearTimeout(t);
  }, [fetchExams]);

  const handlePublish = async (exam: ExamListItem) => {
    setActionLoading(exam.id);
    try {
      const url = buildUrl(`/api/exams/teacher/${exam.id}/publish`, teacher);
      await teacherFetch<{ success: boolean }>(url, { method: 'POST' });
      showToast('success', 'تم نشر الامتحان بنجاح');
      fetchExams();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل النشر');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (exam: ExamListItem) => {
    if (!confirm(`هل تريد إغلاق الامتحان "${exam.title}"؟ سيتم إغلاق جميع المحاولات الجارية.`)) {
      return;
    }
    setActionLoading(exam.id);
    try {
      const url = buildUrl(`/api/exams/teacher/${exam.id}/close`, teacher);
      const data = await teacherFetch<{ success: boolean; closedSubmissions: number }>(url, { method: 'POST' });
      showToast('success', `تم الإغلاق. أُغلق ${data.closedSubmissions || 0} محاولة جارية.`);
      fetchExams();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل الإغلاق');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (exam: ExamListItem) => {
    if (!confirm(`هل تريد أرشفة الامتحان "${exam.title}"؟`)) return;
    setActionLoading(exam.id);
    try {
      const url = buildUrl(`/api/exams/teacher/${exam.id}/archive`, teacher);
      await teacherFetch<{ success: boolean }>(url, { method: 'POST' });
      showToast('success', 'تمت الأرشفة بنجاح');
      fetchExams();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل الأرشفة');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(confirmDelete.id);
    try {
      const url = buildUrl(`/api/exams/teacher/${confirmDelete.id}`, teacher);
      await teacherFetch<{ success: boolean }>(url, { method: 'DELETE' });
      showToast('success', 'تم حذف الامتحان');
      setConfirmDelete(null);
      fetchExams();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل الحذف (قد يكون منشوراً وله تسليمات)');
    } finally {
      setActionLoading(null);
    }
  };

  // KPI stats
  const kpis = {
    total: exams.length,
    published: exams.filter(e => e.status === 'PUBLISHED').length,
    draft: exams.filter(e => e.status === 'DRAFT').length,
    needsGrading: 0, // requires submissions fetch per exam — show submissionsCount summary instead
    submissionsTotal: exams.reduce((s, e) => s + e.submissionsCount, 0),
  };

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<FileText className="w-5 h-5" />}
          label="إجمالي الامتحانات"
          value={kpis.total}
          color="bg-gray-100 text-gray-700"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="منشور"
          value={kpis.published}
          color="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          icon={<Edit3 className="w-5 h-5" />}
          label="مسودة"
          value={kpis.draft}
          color="bg-amber-100 text-amber-700"
        />
        <KpiCard
          icon={<ClipboardList className="w-5 h-5" />}
          label="إجمالي التسليمات"
          value={kpis.submissionsTotal}
          color="bg-purple-100 text-purple-700"
        />
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالعنوان أو الوصف..."
                className="pr-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="DRAFT">مسودة</SelectItem>
                  <SelectItem value="PUBLISHED">منشور</SelectItem>
                  <SelectItem value="CLOSED">مغلق</SelectItem>
                  <SelectItem value="ARCHIVED">مؤرشف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={fetchExams}
              disabled={loading}
              className="sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4 ml-1" />
              إنشاء امتحان جديد
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchExams}>إعادة المحاولة</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && exams.length === 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">لا توجد امتحانات بعد</h3>
            <p className="text-sm text-gray-500 mb-4">
              ابدأ بإنشاء أول امتحان إلكتروني لطلابك
            </p>
            <Button onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 ml-1" />
              إنشاء امتحان جديد
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Exam List */}
      {!loading && !error && exams.length > 0 && (
        <div className="grid gap-3">
          {exams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              onOpen={() => onOpenExam(exam.id)}
              onPublish={() => handlePublish(exam)}
              onClose={() => handleClose(exam)}
              onArchive={() => handleArchive(exam)}
              onDelete={() => setConfirmDelete(exam)}
              actionLoading={actionLoading === exam.id}
            />
          ))}
        </div>
      )}

      {/* Create Exam Dialog */}
      {showCreate && (
        <CreateExamDialog
          teacher={teacher}
          onClose={() => setShowCreate(false)}
          onCreated={(examId) => {
            setShowCreate(false);
            showToast('success', 'تم إنشاء الامتحان كمسودة. أضف الأسئلة ثم انشره.');
            fetchExams();
            onOpenExam(examId);
          }}
          showToast={showToast}
        />
      )}

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد الحذف</DialogTitle>
            <DialogDescription className="text-right">
              هل أنت متأكد من حذف الامتحان &quot;{confirmDelete?.title}&quot;؟ لا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              لا يمكن حذف امتحان منشور له تسليمات. في تلك الحالة استخدم &quot;أرشفة&quot; بدلاً من ذلك.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={!!actionLoading}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!!actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Trash2 className="w-4 h-4 ml-1" />}
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string; }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ExamCard({
  exam, onOpen, onPublish, onClose, onArchive, onDelete, actionLoading,
}: {
  exam: ExamListItem;
  onOpen: () => void;
  onPublish: () => void;
  onClose: () => void;
  onArchive: () => void;
  onDelete: () => void;
  actionLoading: boolean;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Main info */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-gray-900 truncate">{exam.title}</h3>
              <Badge className={statusBadgeClass(exam.status)} variant="outline">
                {EXAM_STATUS_LABELS[exam.status]}
              </Badge>
              <Badge className="bg-gray-100 text-gray-600 border-gray-200" variant="outline">
                {TIME_STATUS_LABELS[exam.timeStatus]}
              </Badge>
              {exam.hasPassword && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-200" variant="outline">
                  <Lock className="w-3 h-3 ml-1" />
                  محمي
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {exam.subject}
              </span>
              {exam.classroomName && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {exam.classroomName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {exam.durationMinutes} دقيقة
              </span>
              <span className="flex items-center gap-1">
                <ListChecks className="w-3 h-3" />
                {exam.questionsCount} سؤال
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                {exam.submissionsCount} تسليم
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3" />
                {exam.totalPoints} نقطة
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                يبدأ: {formatDate(exam.startDate)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                ينتهي: {formatDate(exam.endDate)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 md:flex-col md:w-44">
            <Button variant="outline" size="sm" onClick={onOpen} className="flex-1 md:flex-none">
              <Eye className="w-4 h-4 ml-1" />
              فتح
            </Button>
            {exam.status === 'DRAFT' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPublish}
                  disabled={actionLoading || exam.questionsCount === 0}
                  className="flex-1 md:flex-none text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  title={exam.questionsCount === 0 ? 'أضف أسئلة أولاً' : ''}
                >
                  <Send className="w-4 h-4 ml-1" />
                  نشر
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  disabled={actionLoading}
                  className="flex-1 md:flex-none text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 ml-1" />
                  حذف
                </Button>
              </>
            )}
            {exam.status === 'PUBLISHED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={actionLoading}
                className="flex-1 md:flex-none text-orange-700 border-orange-200 hover:bg-orange-50"
              >
                <Ban className="w-4 h-4 ml-1" />
                إغلاق
              </Button>
            )}
            {exam.status === 'CLOSED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onArchive}
                disabled={actionLoading}
                className="flex-1 md:flex-none text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <ArchiveIcon />
                أرشفة
              </Button>
            )}
            {exam.status === 'ARCHIVED' && (
              <Badge className="bg-slate-100 text-slate-500 border-slate-200" variant="outline">
                مؤرشف — افتح للعرض
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArchiveIcon() {
  return (
    <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

// ============================================================
//  ③ CreateExamDialog — إنشاء امتحان جديد
// ============================================================

interface ExamFormState {
  title: string;
  description: string;
  subject: string;
  classroomName: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  maxAttempts: number;
  passingScore: string;
  password: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReview: boolean;
  showResultImmediately: boolean;
  parentVisible: boolean;
  antiCheatEnabled: boolean;
  allowTextAnswers: boolean;
  allowImageAnswers: boolean;
  allowPdfAnswers: boolean;
}

function defaultExamForm(): ExamFormState {
  return {
    title: '',
    description: '',
    subject: '',
    classroomName: '',
    startDate: defaultDateTimeLocal(10),
    endDate: defaultDateTimeLocal(70),
    durationMinutes: 30,
    maxAttempts: 1,
    passingScore: '',
    password: '',
    shuffleQuestions: false,
    shuffleOptions: false,
    allowReview: true,
    showResultImmediately: false,
    parentVisible: false,
    antiCheatEnabled: true,
    allowTextAnswers: true,
    allowImageAnswers: true,
    allowPdfAnswers: false,
  };
}

function CreateExamDialog({
  teacher, onClose, onCreated, showToast,
}: {
  teacher: TeacherInfo;
  onClose: () => void;
  onCreated: (examId: string) => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [form, setForm] = useState<ExamFormState>(defaultExamForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ExamFormState>(key: K, value: ExamFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError('عنوان الامتحان مطلوب'); return; }
    if (!form.subject.trim()) { setError('المادة مطلوبة'); return; }
    if (!form.startDate || !form.endDate) { setError('وقت البدء والانتهاء مطلوبان'); return; }
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      setError('وقت البدء يجب أن يكون قبل وقت الانتهاء');
      return;
    }
    if (!form.durationMinutes || form.durationMinutes < 1) {
      setError('مدة الامتحان يجب أن تكون دقيقة على الأقل');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject.trim(),
        classroomName: form.classroomName.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        maxAttempts: Number(form.maxAttempts),
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        allowReview: form.allowReview,
        showResultImmediately: form.showResultImmediately,
        parentVisible: form.parentVisible,
        antiCheatEnabled: form.antiCheatEnabled,
        allowTextAnswers: form.allowTextAnswers,
        allowImageAnswers: form.allowImageAnswers,
        allowPdfAnswers: form.allowPdfAnswers,
      };
      if (form.passingScore.trim()) body.passingScore = Number(form.passingScore);
      if (form.password.trim()) body.password = form.password.trim();

      const url = buildUrl('/api/exams/teacher', teacher);
      const data = await teacherFetch<{ success: boolean; examId: string }>(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(data.examId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إنشاء الامتحان';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">إنشاء امتحان جديد</DialogTitle>
          <DialogDescription className="text-right">
            سيُنشأ كمسودة. أضف الأسئلة ثم انشره ليصبح متاحاً للطلاب.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium">عنوان الامتحان <span className="text-red-500">*</span></Label>
              <Input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="مثال: اختبار الفصل الأول - الرياضيات"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">المادة <span className="text-red-500">*</span></Label>
              <Input
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder="مثال: الرياضيات"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">الفصل / الصف</Label>
              <Input
                value={form.classroomName}
                onChange={(e) => set('classroomName', e.target.value)}
                placeholder="مثال: الصف العاشر - أ"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium">الوصف (اختياري)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="تعليمات إضافية للطلاب..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">وقت بدء الامتحان <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">وقت انتهاء الامتحان <span className="text-red-500">*</span></Label>
              <Input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">المدة بالدقائق <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={form.durationMinutes}
                onChange={(e) => set('durationMinutes', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">الحد الأقصى للمحاولات</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.maxAttempts}
                onChange={(e) => set('maxAttempts', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">درجة النجاح (اختياري)</Label>
              <Input
                type="number"
                min={0}
                value={form.passingScore}
                onChange={(e) => set('passingScore', e.target.value)}
                placeholder="مثال: 50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">كلمة سر الامتحان (اختياري)</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="اتركها فارغة لعدم الحماية"
                minLength={4}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              الإعدادات
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleRow label="خلط ترتيب الأسئلة" checked={form.shuffleQuestions} onChange={(v) => set('shuffleQuestions', v)} />
              <ToggleRow label="خلط ترتيب الخيارات" checked={form.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
              <ToggleRow label="السماح بمراجعة الإجابات" checked={form.allowReview} onChange={(v) => set('allowReview', v)} />
              <ToggleRow label="إظهار النتيجة فور التسليم" checked={form.showResultImmediately} onChange={(v) => set('showResultImmediately', v)} />
              <ToggleRow label="مرئي لأولياء الأمور" checked={form.parentVisible} onChange={(v) => set('parentVisible', v)} />
              <ToggleRow label="تفعيل مكافحة الغش" checked={form.antiCheatEnabled} onChange={(v) => set('antiCheatEnabled', v)} />
              <ToggleRow label="السماح بإجابات نصية" checked={form.allowTextAnswers} onChange={(v) => set('allowTextAnswers', v)} />
              <ToggleRow label="السماح بإجابات بالصور" checked={form.allowImageAnswers} onChange={(v) => set('allowImageAnswers', v)} />
              <ToggleRow label="السماح بإجابات بملفات PDF" checked={form.allowPdfAnswers} onChange={(v) => set('allowPdfAnswers', v)} />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
              إنشاء كمسودة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <label className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// ============================================================
//  ④ ExamDetail — تفاصيل الامتحان بتبويبات
// ============================================================

function ExamDetail({
  teacher, examId, onBack, onOpenSubmission, showToast,
}: {
  teacher: TeacherInfo;
  examId: string;
  onBack: () => void;
  onOpenSubmission: (submissionId: string) => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('questions');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);

  const fetchExam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(`/api/exams/teacher/${examId}`, teacher);
      const data = await teacherFetch<{ success: boolean; exam: ExamDetail }>(url);
      setExam(data.exam);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب الامتحان');
    } finally {
      setLoading(false);
    }
  }, [teacher, examId]);

  useEffect(() => {
    const t = setTimeout(fetchExam, 0);
    return () => clearTimeout(t);
  }, [fetchExam]);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">جارٍ تحميل الامتحان...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchExam}>إعادة المحاولة</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!exam) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 -mr-2">
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-bold text-gray-900 truncate">{exam.title}</h2>
                <Badge className={statusBadgeClass(exam.status)} variant="outline">
                  {EXAM_STATUS_LABELS[exam.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{exam.subject}</span>
                {exam.classroomName && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{exam.classroomName}</span>}
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{exam.durationMinutes} دقيقة</span>
                <span className="flex items-center gap-1"><ListChecks className="w-3 h-3" />{exam.questionsCount} سؤال</span>
                <span className="flex items-center gap-1"><Award className="w-3 h-3" />{exam.totalPoints} نقطة</span>
                {exam.passingScore !== null && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />نجاح: {exam.passingScore}</span>}
                {exam.hasPassword && <span className="flex items-center gap-1"><Lock className="w-3 h-3" />محمي</span>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                <span>يبدأ: {formatDate(exam.startDate)}</span>
                <span>ينتهي: {formatDate(exam.endDate)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="questions" className="gap-1">
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">الأسئلة</span>
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-1">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">التسليمات</span>
          </TabsTrigger>
          <TabsTrigger value="appeals" className="gap-1">
            <Gavel className="w-4 h-4" />
            <span className="hidden sm:inline">التظلّمات</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">الإعدادات</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <QuestionsTab
            teacher={teacher}
            exam={exam}
            onRefresh={fetchExam}
            showToast={showToast}
            onAddQuestion={() => { setEditingQuestion(null); setShowQuestionEditor(true); }}
            onEditQuestion={(q) => { setEditingQuestion(q); setShowQuestionEditor(true); }}
          />
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <SubmissionsTab
            teacher={teacher}
            exam={exam}
            onOpenSubmission={onOpenSubmission}
            showToast={showToast}
          />
        </TabsContent>

        <TabsContent value="appeals" className="mt-4">
          <AppealsTab
            teacher={teacher}
            exam={exam}
            onRefresh={fetchExam}
            showToast={showToast}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsTab
            teacher={teacher}
            exam={exam}
            onRefresh={fetchExam}
            onBack={onBack}
            showToast={showToast}
          />
        </TabsContent>
      </Tabs>

      {/* Question Editor Dialog */}
      {showQuestionEditor && (
        <QuestionEditor
          teacher={teacher}
          examId={examId}
          question={editingQuestion}
          onClose={() => { setShowQuestionEditor(false); setEditingQuestion(null); }}
          onSaved={() => {
            setShowQuestionEditor(false);
            setEditingQuestion(null);
            fetchExam();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ============================================================
//  QuestionsTab — قائمة الأسئلة
// ============================================================

function QuestionsTab({
  teacher, exam, onRefresh, showToast, onAddQuestion, onEditQuestion,
}: {
  teacher: TeacherInfo;
  exam: ExamDetail;
  onRefresh: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
  onAddQuestion: () => void;
  onEditQuestion: (q: Question) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async (qid: string) => {
    if (!confirm('هل تريد حذف هذا السؤال؟')) return;
    setDeletingId(qid);
    setDeleteLoading(true);
    try {
      const url = buildUrl(`/api/exams/teacher/${exam.id}/questions/${qid}`, teacher);
      await teacherFetch<{ success: boolean }>(url, { method: 'DELETE' });
      showToast('success', 'تم حذف السؤال');
      onRefresh();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل الحذف');
    } finally {
      setDeleteLoading(false);
      setDeletingId(null);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              أسئلة الامتحان
            </CardTitle>
            <CardDescription className="text-xs">
              {exam.questions.length} سؤال • {exam.totalPoints} نقطة إجمالية
            </CardDescription>
          </div>
          <Button onClick={onAddQuestion} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 ml-1" />
            إضافة سؤال
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exam.questions.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto rounded-xl bg-gray-100 flex items-center justify-center mb-2">
              <HelpCircle className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900">لا توجد أسئلة بعد</p>
            <p className="text-xs text-gray-500 mb-3">أضف سؤالك الأول لينشر الامتحان</p>
            <Button onClick={onAddQuestion} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 ml-1" />
              إضافة سؤال
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pl-1">
            {exam.questions.map((q, i) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#610000]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#610000]">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline">
                        {QUESTION_TYPE_LABELS[q.type]}
                      </Badge>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200" variant="outline">
                        <Award className="w-3 h-3 ml-1" />
                        {q.points} نقطة
                      </Badge>
                      {q.textModeration === 'FLAGGED' && (
                        <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
                          <ShieldAlert className="w-3 h-3 ml-1" />
                          مُعلَّم للمراجعة
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{q.text}</p>

                    {/* Type-specific preview */}
                    {q.type === 'MCQ' && q.options && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, idx) => (
                          <div key={idx} className={`text-xs px-2 py-1 rounded border ${String(q.correctAnswer) === String(idx) ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                            {String.fromCharCode(1571 + (idx === 0 ? 0 : idx === 1 ? 1 : idx))}) {opt}
                            {String(q.correctAnswer) === String(idx) && <CheckCircle2 className="w-3 h-3 inline ml-1" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'TRUE_FALSE' && q.correctAnswer && (
                      <div className="mt-2 text-xs text-gray-600">
                        الإجابة الصحيحة:{' '}
                        <span className="font-medium text-emerald-700">
                          {q.correctAnswer === 'true' ? 'صح' : 'خطأ'}
                        </span>
                      </div>
                    )}
                    {q.type === 'SHORT' && q.correctText && (
                      <div className="mt-2 text-xs text-gray-600">
                        الإجابة النموذجية: <span className="font-medium">{q.correctText}</span>
                      </div>
                    )}
                    {q.explanation && (
                      <div className="mt-2 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded p-2">
                        <Info className="w-3 h-3 inline ml-1" />
                        {q.explanation}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEditQuestion(q)} className="h-8 w-8 p-0">
                      <Edit3 className="w-4 h-4 text-gray-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)} disabled={deleteLoading && deletingId === q.id} className="h-8 w-8 p-0">
                      {deleteLoading && deletingId === q.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {exam.status === 'DRAFT' && exam.questions.length === 0 && (
          <Alert className="mt-4 bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              يجب إضافة سؤال واحد على الأقل قبل نشر الامتحان.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
//  ⑤ QuestionEditor — محرر الأسئلة (dialog)
// ============================================================

function QuestionEditor({
  teacher, examId, question, onClose, onSaved, showToast,
}: {
  teacher: TeacherInfo;
  examId: string;
  question: Question | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [type, setType] = useState<QuestionType>(question?.type || 'MCQ');
  const [text, setText] = useState(question?.text || '');
  const [points, setPoints] = useState(question?.points || 1);
  const [options, setOptions] = useState<string[]>(question?.options?.length ? question.options : ['', '']);
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || '');
  const [correctText, setCorrectText] = useState(question?.correctText || '');
  const [rubric, setRubric] = useState<string>(
    typeof question?.rubric === 'string' ? question.rubric : (question?.rubric ? JSON.stringify(question.rubric) : '')
  );
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moderation, setModeration] = useState<{ decision: string; reasons: string[] } | null>(null);

  const isEdit = !!question;

  const handleAddOption = () => {
    if (options.length >= 8) return;
    setOptions([...options, '']);
  };
  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== idx);
    setOptions(next);
    if (String(correctAnswer) === String(idx)) setCorrectAnswer('');
    else if (Number(correctAnswer) > idx) setCorrectAnswer(String(Number(correctAnswer) - 1));
  };
  const handleOptionChange = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setModeration(null);
    if (!text.trim()) { setError('نص السؤال مطلوب'); return; }
    if (type === 'MCQ') {
      const filled = options.filter(o => o.trim());
      if (filled.length < 2) { setError('خياران على الأقل مطلوبان للاختيار من متعدد'); return; }
      if (correctAnswer === '' || Number(correctAnswer) < 0 || Number(correctAnswer) >= filled.length) {
        setError('حدّد الإجابة الصحيحة'); return;
      }
    }
    if (type === 'TRUE_FALSE' && !correctAnswer) {
      setError('حدّد الإجابة الصحيحة (صح أو خطأ)'); return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type,
        text: text.trim(),
        points: Number(points),
        explanation: explanation.trim() || undefined,
      };
      if (type === 'MCQ') {
        body.options = options.filter(o => o.trim());
        body.correctAnswer = String(correctAnswer);
      } else if (type === 'TRUE_FALSE') {
        body.correctAnswer = correctAnswer;
      } else if (type === 'SHORT') {
        if (correctText.trim()) body.correctText = correctText.trim();
      } else if (type === 'ESSAY') {
        if (rubric.trim()) body.rubric = rubric.trim();
      }

      if (isEdit && question) {
        const url = buildUrl(`/api/exams/teacher/${examId}/questions/${question.id}`, teacher);
        await teacherFetch<{ success: boolean }>(url, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        showToast('success', 'تم تحديث السؤال');
      } else {
        const url = buildUrl(`/api/exams/teacher/${examId}/questions`, teacher);
        const data = await teacherFetch<{ success: boolean; moderation?: { decision: string; reasons: string[] } }>(url, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        showToast('success', 'تمت إضافة السؤال');
        if (data.moderation && data.moderation.decision !== 'SAFE') {
          setModeration(data.moderation);
          setSaving(false);
          return; // keep dialog open to show moderation warning
        }
      }
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ السؤال';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">
            {isEdit ? 'تحرير السؤال' : 'إضافة سؤال جديد'}
          </DialogTitle>
          <DialogDescription className="text-right">
            {isEdit ? 'عدّل بيانات السؤال ثم احفظ' : 'اختر نوع السؤال وأدخل بياناته'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">نوع السؤال</Label>
            <Select value={type} onValueChange={(v) => { setType(v as QuestionType); setCorrectAnswer(''); }} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
                  <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">نص السؤال <span className="text-red-500">*</span></Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب نص السؤال هنا..."
              rows={3}
            />
          </div>

          {/* Points */}
          <div className="space-y-2 w-32">
            <Label className="text-sm font-medium">الدرجة</Label>
            <Input
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>

          {/* Conditional fields */}
          {type === 'MCQ' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">الخيارات (2 إلى 8) — حدّد الإجابة الصحيحة</Label>
              <RadioGroup value={correctAnswer} onValueChange={setCorrectAnswer}>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <RadioGroupItem value={String(idx)} id={`opt-${idx}`} />
                      <Input
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`الخيار ${idx + 1}`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 2}
                        className="h-9 w-9 p-0"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              {options.length < 8 && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة خيار
                </Button>
              )}
            </div>
          )}

          {type === 'TRUE_FALSE' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">الإجابة الصحيحة</Label>
              <RadioGroup value={correctAnswer} onValueChange={setCorrectAnswer} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="true" id="tf-true" />
                  <span className="text-sm">صح</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="false" id="tf-false" />
                  <span className="text-sm">خطأ</span>
                </label>
              </RadioGroup>
            </div>
          )}

          {type === 'SHORT' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">الإجابة النموذجية (اختياري)</Label>
              <Input
                value={correctText}
                onChange={(e) => setCorrectText(e.target.value)}
                placeholder="الإجابة المرجعية للتصحيح"
              />
            </div>
          )}

          {type === 'ESSAY' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">معايير التصحيح (اختياري)</Label>
              <Textarea
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="معايير تقييم الإجابة المقالية..."
                rows={3}
              />
            </div>
          )}

          {(type === 'IMAGE_ANSWER' || type === 'FILE_PDF') && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                {type === 'IMAGE_ANSWER'
                  ? 'سيُطلب من الطالب رفع صورة كإجابة. يتم التصحيح يدوياً.'
                  : 'سيُطلب من الطالب رفع ملف PDF كإجابة. يتم التصحيح يدوياً.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Explanation */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">شرح الإجابة (اختياري — يظهر للطالب بعد التصحيح)</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="شرح مختصر للإجابة الصحيحة..."
              rows={2}
            />
          </div>

          {/* Moderation warning */}
          {moderation && (
            <Alert variant="destructive">
              <ShieldAlert className="w-4 h-4" />
              <AlertTitle>تمت إضافة السؤال لكنه أُعلِّم للمراجعة</AlertTitle>
              <AlertDescription>
                الأسباب: {moderation.reasons?.join('، ') || 'محتوى قد يحتاج مراجعة'}
                <br />
                يمكنك تعديل النص أو حذف السؤال.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              {moderation ? 'إغلاق' : 'إلغاء'}
            </Button>
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
              {isEdit ? 'حفظ التعديلات' : 'إضافة السؤال'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
//  SubmissionsTab — قائمة التسليمات
// ============================================================

function SubmissionsTab({
  teacher, exam, onOpenSubmission, showToast,
}: {
  teacher: TeacherInfo;
  exam: ExamDetail;
  onOpenSubmission: (submissionId: string) => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [stats, setStats] = useState<SubmissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const extra: Record<string, string> = {};
      if (statusFilter !== 'all') extra.status = statusFilter;
      if (search.trim()) extra.search = search.trim();
      const url = buildUrl(`/api/exams/teacher/${exam.id}/submissions`, teacher, extra);
      const data = await teacherFetch<{ success: boolean; submissions: SubmissionListItem[]; stats: SubmissionStats }>(url);
      setSubmissions(data.submissions || []);
      setStats(data.stats || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب التسليمات');
    } finally {
      setLoading(false);
    }
  }, [teacher, exam.id, statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchSubmissions, 300);
    return () => clearTimeout(t);
  }, [fetchSubmissions]);

  return (
    <div className="space-y-3">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<ClipboardList className="w-5 h-5" />} label="إجمالي التسليمات" value={stats.total} color="bg-gray-100 text-gray-700" />
          <KpiCard icon={<AlertCircle className="w-5 h-5" />} label="بانتظار التصحيح" value={stats.needsGrading} color="bg-amber-100 text-amber-700" />
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="متوسط النسبة" value={Math.round(stats.avgScore || 0)} color="bg-emerald-100 text-emerald-700" suffix="%" />
          <KpiCard icon={<ShieldAlert className="w-5 h-5" />} label="حالات مشبوهة" value={stats.suspiciousCount} color="bg-red-100 text-red-700" />
        </div>
      )}

      {/* Filter Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم الطالب..."
                className="pr-9"
              />
            </div>
            <div className="w-full sm:w-44">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="IN_PROGRESS">قيد الحل</SelectItem>
                  <SelectItem value="SUBMITTED">تم التسليم</SelectItem>
                  <SelectItem value="GRADED">تم التصحيح</SelectItem>
                  <SelectItem value="FLAGGED">مُعلَّق</SelectItem>
                  <SelectItem value="AUTO_CLOSED">أُغلق تلقائياً</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchSubmissions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={fetchSubmissions}>إعادة المحاولة</Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="shadow-sm"><CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">جارٍ التحميل...</p>
        </CardContent></Card>
      ) : submissions.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="p-8 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-gray-900">لا توجد تسليمات</p>
          <p className="text-xs text-gray-500">ستظهر تسليمات الطلاب هنا بعد بدء الامتحان</p>
        </CardContent></Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-right text-xs text-gray-500">
                    <th className="p-3 font-medium">الطالب</th>
                    <th className="p-3 font-medium hidden sm:table-cell">المحاولة</th>
                    <th className="p-3 font-medium">الحالة</th>
                    <th className="p-3 font-medium">الدرجة</th>
                    <th className="p-3 font-medium hidden md:table-cell">المخالفات</th>
                    <th className="p-3 font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{s.studentName}</div>
                        <div className="text-xs text-gray-400">{s.studentId}</div>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-gray-600">#{s.attemptNumber}</td>
                      <td className="p-3">
                        <Badge className={submissionStatusBadgeClass(s.status)} variant="outline">
                          {SUBMISSION_STATUS_LABELS[s.status]}
                        </Badge>
                        {s.needsGrading && (
                          <Badge className="mr-1 bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                            بانتظار التصحيح
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {s.percentage !== null ? (
                          <div>
                            <div className={`font-bold ${s.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                              {s.percentage.toFixed(0)}%
                            </div>
                            <div className="text-xs text-gray-400">
                              {s.totalScore ?? 0} / {s.maxScore ?? 0}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {s.suspicious ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
                            <ShieldAlert className="w-3 h-3 ml-1" />
                            {s.violationsCount}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-xs">{s.violationsCount}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" onClick={() => onOpenSubmission(s.id)}>
                          <Gavel className="w-4 h-4 ml-1" />
                          تصحيح
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
//  AppealsTab — قائمة التظلّمات
// ============================================================

function AppealsTab({
  teacher, exam, onRefresh, showToast,
}: {
  teacher: TeacherInfo;
  exam: ExamDetail;
  onRefresh: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [appeals, setAppeals] = useState<AppealListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const extra: Record<string, string> = {};
      if (statusFilter !== 'all') extra.status = statusFilter;
      const url = buildUrl(`/api/exams/teacher/${exam.id}/appeals`, teacher, extra);
      const data = await teacherFetch<{ success: boolean; appeals: AppealListItem[] }>(url);
      setAppeals(data.appeals || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب التظلّمات');
    } finally {
      setLoading(false);
    }
  }, [teacher, exam.id, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchAppeals, 0);
    return () => clearTimeout(t);
  }, [fetchAppeals]);

  const handleAction = async (appeal: AppealListItem, action: 'APPROVED' | 'REJECTED') => {
    setActionLoading(appeal.id);
    try {
      const url = buildUrl(`/api/exams/teacher/appeals/${appeal.id}`, teacher);
      const body: Record<string, unknown> = { action };
      const reply = replies[appeal.id]?.trim();
      if (reply) body.teacherReply = reply;
      if (action === 'APPROVED' && appeal.requestedScore !== null) {
        body.newScore = appeal.requestedScore;
      }
      await teacherFetch<{ success: boolean }>(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('success', action === 'APPROVED' ? 'تم قبول التظلّم وتحديث الدرجة' : 'تم رفض التظلّم');
      setReplies(prev => { const n = { ...prev }; delete n[appeal.id]; return n; });
      fetchAppeals();
      onRefresh();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشلت المراجعة');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="PENDING">بانتظار المراجعة</SelectItem>
                  <SelectItem value="APPROVED">مقبول</SelectItem>
                  <SelectItem value="REJECTED">مرفوض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={fetchAppeals} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="shadow-sm"><CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
        </CardContent></Card>
      ) : appeals.length === 0 ? (
        <Card className="shadow-sm"><CardContent className="p-8 text-center">
          <Gavel className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-semibold text-gray-900">لا توجد تظلّمات</p>
          <p className="text-xs text-gray-500">ستظهر تظلّمات الطلاب على التصحيح هنا</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {appeals.map((a) => (
            <Card key={a.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={appealStatusBadgeClass(a.status)} variant="outline">
                      {APPEAL_STATUS_LABELS[a.status]}
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline">
                      {QUESTION_TYPE_LABELS[a.questionType]}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {a.studentName} • المحاولة #{a.attemptNumber}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(a.createdAt)}</span>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded p-2 mb-2">
                  <p className="text-xs text-gray-500 mb-1">السؤال:</p>
                  <p className="text-sm text-gray-900">{a.questionText}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">الدرجة الحالية</p>
                    <p className="font-bold text-gray-900">{a.currentScore ?? '—'} / {a.maxScore ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">الدرجة المطلوبة</p>
                    <p className="font-bold text-emerald-700">{a.requestedScore ?? '—'}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded p-2 mb-2">
                  <p className="text-xs text-amber-700 mb-1">سبب التظلّم:</p>
                  <p className="text-sm text-gray-800">{a.reason}</p>
                </div>

                {a.status !== 'PENDING' && a.teacherReply && (
                  <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-2">
                    <p className="text-xs text-blue-700 mb-1">رد المعلم:</p>
                    <p className="text-sm text-gray-800">{a.teacherReply}</p>
                  </div>
                )}

                {a.status === 'PENDING' && (
                  <div className="space-y-2">
                    <Textarea
                      value={replies[a.id] || ''}
                      onChange={(e) => setReplies(prev => ({ ...prev, [a.id]: e.target.value }))}
                      placeholder="رد المعلم (اختياري)..."
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(a, 'APPROVED')}
                        disabled={actionLoading === a.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {actionLoading === a.id ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Check className="w-4 h-4 ml-1" />}
                        قبول ({a.requestedScore ?? a.currentScore ?? '—'})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(a, 'REJECTED')}
                        disabled={actionLoading === a.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {actionLoading === a.id ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <X className="w-4 h-4 ml-1" />}
                        رفض
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  SettingsTab — تعديل إعدادات الامتحان
// ============================================================

function SettingsTab({
  teacher, exam, onRefresh, onBack, showToast,
}: {
  teacher: TeacherInfo;
  exam: ExamDetail;
  onRefresh: () => void;
  onBack: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [form, setForm] = useState<ExamFormState>({
    title: exam.title,
    description: exam.description || '',
    subject: exam.subject,
    classroomName: exam.classroomName || '',
    startDate: toDateTimeLocal(exam.startDate),
    endDate: toDateTimeLocal(exam.endDate),
    durationMinutes: exam.durationMinutes,
    maxAttempts: exam.maxAttempts,
    passingScore: exam.passingScore !== null ? String(exam.passingScore) : '',
    password: '',
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    allowReview: exam.allowReview,
    showResultImmediately: exam.showResultImmediately,
    parentVisible: exam.parentVisible,
    antiCheatEnabled: exam.antiCheatEnabled,
    allowTextAnswers: exam.allowTextAnswers,
    allowImageAnswers: exam.allowImageAnswers,
    allowPdfAnswers: exam.allowPdfAnswers,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const set = <K extends keyof ExamFormState>(key: K, value: ExamFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { setError('العنوان مطلوب'); return; }
    if (!form.subject.trim()) { setError('المادة مطلوبة'); return; }
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      setError('وقت البدء يجب أن يكون قبل وقت الانتهاء'); return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject.trim(),
        classroomName: form.classroomName.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        maxAttempts: Number(form.maxAttempts),
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        allowReview: form.allowReview,
        showResultImmediately: form.showResultImmediately,
        parentVisible: form.parentVisible,
        antiCheatEnabled: form.antiCheatEnabled,
        allowTextAnswers: form.allowTextAnswers,
        allowImageAnswers: form.allowImageAnswers,
        allowPdfAnswers: form.allowPdfAnswers,
      };
      if (form.passingScore.trim()) body.passingScore = Number(form.passingScore);
      else body.passingScore = null;
      if (form.password.trim()) body.password = form.password.trim();

      const url = buildUrl(`/api/exams/teacher/${exam.id}`, teacher);
      await teacherFetch<{ success: boolean }>(url, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showToast('success', 'تم حفظ الإعدادات');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الحفظ';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const url = buildUrl(`/api/exams/teacher/${exam.id}`, teacher);
      await teacherFetch<{ success: boolean }>(url, { method: 'DELETE' });
      showToast('success', 'تم حذف الامتحان');
      onBack();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل الحذف — جرّب الأرشفة');
      setConfirmDelete(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const isPublished = exam.status === 'PUBLISHED';

  return (
    <div className="space-y-3">
      {isPublished && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            الامتحان منشور. بعض التعديلات قد لا تنعكس على المحاولات الجارية. أغلق الامتحان أولاً لتعديل الحقول الحرجة.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            تعديل بيانات الامتحان
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">العنوان <span className="text-red-500">*</span></Label>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">المادة <span className="text-red-500">*</span></Label>
                <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">الفصل / الصف</Label>
                <Input value={form.classroomName} onChange={(e) => set('classroomName', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">الوصف</Label>
                <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">وقت البدء</Label>
                <Input type="datetime-local" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">وقت الانتهاء</Label>
                <Input type="datetime-local" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">المدة (دقيقة)</Label>
                <Input type="number" min={1} max={600} value={form.durationMinutes} onChange={(e) => set('durationMinutes', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">الحد الأقصى للمحاولات</Label>
                <Input type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => set('maxAttempts', Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">درجة النجاح</Label>
                <Input type="number" min={0} value={form.passingScore} onChange={(e) => set('passingScore', e.target.value)} placeholder="اتركها فارغة للإلغاء" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">كلمة سر جديدة (اتركها فارغة للإبقاء)</Label>
                <Input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} minLength={4} placeholder="••••" />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">الإعدادات</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow label="خلط ترتيب الأسئلة" checked={form.shuffleQuestions} onChange={(v) => set('shuffleQuestions', v)} />
                <ToggleRow label="خلط ترتيب الخيارات" checked={form.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
                <ToggleRow label="السماح بمراجعة الإجابات" checked={form.allowReview} onChange={(v) => set('allowReview', v)} />
                <ToggleRow label="إظهار النتيجة فور التسليم" checked={form.showResultImmediately} onChange={(v) => set('showResultImmediately', v)} />
                <ToggleRow label="مرئي لأولياء الأمور" checked={form.parentVisible} onChange={(v) => set('parentVisible', v)} />
                <ToggleRow label="تفعيل مكافحة الغش" checked={form.antiCheatEnabled} onChange={(v) => set('antiCheatEnabled', v)} />
                <ToggleRow label="السماح بإجابات نصية" checked={form.allowTextAnswers} onChange={(v) => set('allowTextAnswers', v)} />
                <ToggleRow label="السماح بإجابات بالصور" checked={form.allowImageAnswers} onChange={(v) => set('allowImageAnswers', v)} />
                <ToggleRow label="السماح بإجابات بملفات PDF" checked={form.allowPdfAnswers} onChange={(v) => set('allowPdfAnswers', v)} />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onBack}>إلغاء</Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                حفظ التعديلات
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="shadow-sm border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            منطقة الخطر
          </CardTitle>
          <CardDescription className="text-xs">
            حذف الامتحان نهائياً. لا يمكن التراجع. للامتحانات المنشورة ذات التسليمات، استخدم الأرشفة بدلاً من الحذف.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!confirmDelete ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4 ml-1" />
              حذف الامتحان نهائياً
            </Button>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
                <span>هل أنت متأكد؟ سيُحذف الامتحان وكل أسئلته وتسليماته بشكل دائم.</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleteLoading}>
                    إلغاء
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                    {deleteLoading ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Trash2 className="w-4 h-4 ml-1" />}
                    نعم، احذف
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  ⑥ SubmissionGrading — تصحيح تسليم
// ============================================================

function SubmissionGrading({
  teacher, submissionId, onBack, showToast,
}: {
  teacher: TeacherInfo;
  submissionId: string;
  onBack: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradingAnswerId, setGradingAnswerId] = useState<string | null>(null);
  const [gradeInputs, setGradeInputs] = useState<Record<string, { score: string; note: string }>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  const fetchSubmission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(`/api/exams/teacher/submissions/${submissionId}`, teacher);
      const data = await teacherFetch<{ success: boolean; submission: SubmissionDetail }>(url);
      setSubmission(data.submission);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب التسليم');
    } finally {
      setLoading(false);
    }
  }, [teacher, submissionId]);

  useEffect(() => {
    const t = setTimeout(fetchSubmission, 0);
    return () => clearTimeout(t);
  }, [fetchSubmission]);

  const handleGradeAnswer = async (answer: AnswerDetail) => {
    const input = gradeInputs[answer.id];
    if (!input) {
      showToast('error', 'أدخل الدرجة أولاً');
      return;
    }
    const score = Number(input.score);
    const maxScore = answer.maxScore ?? answer.question.points;
    if (isNaN(score) || score < 0 || score > maxScore) {
      showToast('error', `الدرجة يجب أن تكون بين 0 و ${maxScore}`);
      return;
    }
    setGradingAnswerId(answer.id);
    try {
      const url = buildUrl(`/api/exams/teacher/answers/${answer.id}`, teacher);
      await teacherFetch<{ success: boolean }>(url, {
        method: 'POST',
        body: JSON.stringify({
          score,
          teacherNote: input.note?.trim() || undefined,
          aiAssisted: false,
        }),
      });
      showToast('success', 'تم حفظ تصحيح الإجابة');
      setGradeInputs(prev => { const n = { ...prev }; delete n[answer.id]; return n; });
      fetchSubmission();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل حفظ التصحيح');
    } finally {
      setGradingAnswerId(null);
    }
  };

  const handleFinalize = async (force: boolean) => {
    setFinalizing(true);
    try {
      const url = buildUrl(`/api/exams/teacher/submissions/${submissionId}/finalize`, teacher);
      await teacherFetch<{ success: boolean }>(url, {
        method: 'POST',
        body: JSON.stringify({ force }),
      });
      showToast('success', 'تم إنهاء التصحيح وحساب النتيجة النهائية');
      setShowFinalizeConfirm(false);
      fetchSubmission();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'فشل الإنهاء');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">جارٍ تحميل التسليم...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchSubmission}>إعادة المحاولة</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!submission) return null;

  const ungradedAnswers = submission.answers.filter(
    a => a.score === null && (a.question.type === 'SHORT' || a.question.type === 'ESSAY' || a.question.type === 'IMAGE_ANSWER' || a.question.type === 'FILE_PDF')
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 -mr-2">
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-bold text-gray-900">{submission.studentName}</h2>
                <Badge className={submissionStatusBadgeClass(submission.status)} variant="outline">
                  {SUBMISSION_STATUS_LABELS[submission.status]}
                </Badge>
                {submission.passed !== null && (
                  <Badge className={submission.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} variant="outline">
                    {submission.passed ? 'ناجح' : 'راسب'}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" />المحاولة #{submission.attemptNumber}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />بدأ: {formatDate(submission.startedAt)}</span>
                {submission.submittedAt && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />سلّم: {formatDate(submission.submittedAt)}</span>}
                {submission.gradedByName && <span className="flex items-center gap-1"><Gavel className="w-3 h-3" />صحّح بواسطة: {submission.gradedByName}</span>}
              </div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg p-3 min-w-[120px]">
              <p className="text-xs text-gray-500">النتيجة</p>
              <p className={`text-2xl font-bold ${submission.passed === false ? 'text-red-600' : 'text-emerald-600'}`}>
                {submission.percentage !== null ? `${submission.percentage.toFixed(0)}%` : '—'}
              </p>
              <p className="text-xs text-gray-400">
                {submission.totalScore ?? 0} / {submission.maxScore ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suspicious activity alert */}
      {submission.suspicious && (
        <Alert variant="destructive">
          <ShieldAlert className="w-4 h-4" />
          <AlertTitle>نشاط مشبوه</AlertTitle>
          <AlertDescription>
            تبديل تبويب: {submission.tabSwitches} • محاولات نسخ: {submission.copyAttempts} • فقد التركيز: {submission.focusEvents}
            {submission.violationsCount > 0 && ` • عدد المخالفات: ${submission.violationsCount}`}
          </AlertDescription>
        </Alert>
      )}

      {/* Violations list */}
      {submission.violations.length > 0 && (
        <Card className="shadow-sm border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-4 h-4" />
              سجل المخالفات ({submission.violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {submission.violations.map(v => (
                <div key={v.id} className="text-xs flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded">
                  <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">{v.type}</Badge>
                  <span className="text-gray-700 flex-1">{v.details || '—'}</span>
                  <span className="text-gray-400">{formatDate(v.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Answers */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              إجابات الطالب ({submission.answers.length})
            </CardTitle>
            <Button
              onClick={() => setShowFinalizeConfirm(true)}
              disabled={finalizing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {finalizing ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
              إنهاء التصحيح
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pl-1">
            {submission.answers.map((a, idx) => {
              const isAutoGraded = a.question.type === 'MCQ' || a.question.type === 'TRUE_FALSE';
              const needsManualGrade = !isAutoGraded && (a.score === null || gradeInputs[a.id]);
              const input = gradeInputs[a.id] || { score: a.score !== null ? String(a.score) : '', note: a.teacherNote || '' };
              return (
                <div key={a.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#610000]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#610000]">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline">
                          {QUESTION_TYPE_LABELS[a.question.type]}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200" variant="outline">
                          <Award className="w-3 h-3 ml-1" />
                          {a.maxScore ?? a.question.points} نقطة
                        </Badge>
                        {a.score !== null && (
                          <Badge className={a.isCorrect ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} variant="outline">
                            الدرجة: {a.score} / {a.maxScore ?? a.question.points}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words mb-2">{a.question.text}</p>

                      {/* Student answer */}
                      <div className="bg-gray-50 border border-gray-100 rounded p-2 mb-2">
                        <p className="text-xs text-gray-500 mb-1">إجابة الطالب:</p>
                        {a.textAnswer && <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{a.textAnswer}</p>}
                        {a.imageAnswerUrl && (
                          <a href={a.imageAnswerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <FileImage className="w-4 h-4" />
                            عرض الصورة المرفقة
                          </a>
                        )}
                        {a.fileAnswerUrl && (
                          <a href={a.fileAnswerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <FileType className="w-4 h-4" />
                            عرض ملف PDF المرفق
                          </a>
                        )}
                        {!a.textAnswer && !a.imageAnswerUrl && !a.fileAnswerUrl && (
                          <p className="text-sm text-gray-400 italic">لم يجب الطالب</p>
                        )}
                      </div>

                      {/* AI suggestion */}
                      {a.aiSuggestedScore !== null && (
                        <div className="bg-violet-50 border border-violet-100 rounded p-2 mb-2 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-violet-600 mt-0.5" />
                          <div className="text-xs">
                            <p className="text-violet-700 font-medium">
                              اقتراح الذكاء الاصطناعي: {a.aiSuggestedScore} / {a.maxScore ?? a.question.points}
                              {a.aiConfidence !== null && ` (ثقة: ${(a.aiConfidence * 100).toFixed(0)}%)`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Auto-graded feedback */}
                      {isAutoGraded && a.question.options && a.question.type === 'MCQ' && (
                        <div className="text-xs text-gray-600 mb-1">
                          الإجابة الصحيحة:{' '}
                          <span className="font-medium text-emerald-700">
                            {a.question.options[Number(a.question.correctAnswer)] || '—'}
                          </span>
                        </div>
                      )}
                      {isAutoGraded && a.question.type === 'TRUE_FALSE' && (
                        <div className="text-xs text-gray-600 mb-1">
                          الإجابة الصحيحة:{' '}
                          <span className="font-medium text-emerald-700">
                            {a.question.correctAnswer === 'true' ? 'صح' : 'خطأ'}
                          </span>
                        </div>
                      )}
                      {a.question.correctText && (
                        <div className="text-xs text-gray-600 mb-2">
                          الإجابة النموذجية: <span className="font-medium">{a.question.correctText}</span>
                        </div>
                      )}
                      {a.teacherNote && (
                        <div className="bg-blue-50 border border-blue-100 rounded p-2 mb-2 text-xs">
                          <p className="text-blue-700 font-medium mb-1">ملاحظة المعلم:</p>
                          <p className="text-gray-800">{a.teacherNote}</p>
                        </div>
                      )}

                      {/* Manual grading form */}
                      {!isAutoGraded && (
                        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-2 items-start mt-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">الدرجة (من {a.maxScore ?? a.question.points})</Label>
                            <Input
                              type="number"
                              min={0}
                              max={a.maxScore ?? a.question.points}
                              step="0.5"
                              value={input.score}
                              onChange={(e) => setGradeInputs(prev => ({ ...prev, [a.id]: { ...input, score: e.target.value } }))}
                              className="text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">ملاحظة للطالب (اختياري)</Label>
                            <Textarea
                              value={input.note}
                              onChange={(e) => setGradeInputs(prev => ({ ...prev, [a.id]: { ...input, note: e.target.value } }))}
                              rows={2}
                              className="text-sm"
                              placeholder="توضيح للدرجة..."
                            />
                          </div>
                          <div className="sm:pt-5">
                            <Button
                              size="sm"
                              onClick={() => handleGradeAnswer(a)}
                              disabled={gradingAnswerId === a.id || !input.score}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {gradingAnswerId === a.id ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                              حفظ
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Moderation flag on answer */}
                      {a.textModeration === 'FLAGGED' && (
                        <div className="text-xs text-red-600 flex items-center gap-1 mt-2">
                          <ShieldAlert className="w-3 h-3" />
                          إجابة الطالب أُعلِّمت للمراجعة
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Finalize confirm */}
      <Dialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد إنهاء التصحيح</DialogTitle>
            <DialogDescription className="text-right">
              سيتم حساب النتيجة النهائية وحفظها بشكل دائم.
            </DialogDescription>
          </DialogHeader>
          {ungradedAnswers.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                يوجد {ungradedAnswers.length} إجابة لم تُصحَّح بعد. سيتم احتسابها كصفر إن أجبرت الإنهاء.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeConfirm(false)} disabled={finalizing}>
              إلغاء
            </Button>
            <Button
              onClick={() => handleFinalize(ungradedAnswers.length > 0)}
              disabled={finalizing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {finalizing ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
              {ungradedAnswers.length > 0 ? 'إنهاء مع إجبار' : 'تأكيد الإنهاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
