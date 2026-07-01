'use client';

/**
 * ============================================================
 *  لوحة المنسّق / إدارة الامتحانات على مستوى المدرسة
 *  CoordinatorDashboardPage
 * ============================================================
 *  تدفّق الشاشات:
 *    login → dashboard (4 tabs: overview | exams | violations | appeals)
 *                └── exam-detail-panel (dialog) — stats + admin actions
 *                      ├── reassign dialog
 *                      ├── force-close confirmation
 *                      └── delete confirmation (type-to-confirm)
 *
 *  التكامل:
 *    • GET   /api/exams/coordinator/overview
 *    • GET   /api/exams/coordinator/exams
 *    • GET   /api/exams/coordinator/exams/[id]
 *    • PATCH /api/exams/coordinator/exams/[id]   { action, ... }
 *    • GET   /api/exams/coordinator/violations
 *    • GET   /api/exams/coordinator/appeals
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, LogOut, RefreshCw, Loader2, AlertCircle, Search,
  Filter, ChevronRight, ChevronLeft, ShieldAlert, FileText,
  Clock, Calendar, Users, BookOpen, ListChecks, GraduationCap,
  CheckCircle2, XCircle, AlertTriangle, Info, Trash2, Send,
  Archive, ArchiveRestore, Ban, UserCog, Eye, Gavel, Activity,
  TrendingUp, Award, BarChart3, Hash, ClipboardList, Inbox,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend as RLegend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card';
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

// ============================================================
//  Types
// ============================================================

interface CoordinatorDashboardPageProps {
  onBack: () => void;
  schoolId?: string;
}

interface CoordinatorInfo {
  coordinatorId: string;
  coordinatorName: string;
  schoolId: string;
}

type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type SubmissionStatus =
  | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'FLAGGED' | 'AUTO_CLOSED';

type ViolationType =
  | 'FOCUS_LOSS' | 'TAB_SWITCH' | 'COPY_ATTEMPT' | 'SHORTCUT_KEY'
  | 'SUSPICIOUS_FILE' | 'RIGHT_CLICK' | 'PRINT_SCREEN';

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface OverviewKpis {
  exams: { total: number; draft: number; published: number; closed: number; archived: number };
  submissions: { total: number; graded: number; inProgress: number; passRate: number };
  appeals: { total: number; pending: number; approved: number; rejected: number };
  violations: { total: number; byType: Record<string, number> };
}

interface SubjectStat {
  subject: string;
  examCount: number;
  avgScore: number;
  passRate: number;
  gradedCount: number;
}

interface TopTeacher {
  teacherId: string;
  teacherName: string;
  examsCount: number;
}

interface RecentExam {
  id: string;
  title: string;
  subject: string;
  teacherName: string | null;
  classroomName: string | null;
  status: ExamStatus;
  startDate: string;
  endDate: string;
  submissionsCount: number;
  questionsCount: number;
}

interface UpcomingExam {
  id: string;
  title: string;
  teacherName: string | null;
  endDate: string;
  submissionsCount: number;
}

interface PendingAppealExam {
  examId: string;
  examTitle: string;
  teacherName: string | null;
  subject: string;
}

interface OverviewResponse {
  success: boolean;
  kpis: OverviewKpis;
  subjectStats: SubjectStat[];
  topTeachers: TopTeacher[];
  recentExams: RecentExam[];
  upcomingExams: UpcomingExam[];
  pendingAppealsExams: PendingAppealExam[];
}

interface ExamListItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  teacherId: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  status: ExamStatus;
  totalPoints: number;
  passingScore: number | null;
  antiCheatEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  questionsCount: number;
  submissionsCount: number;
  gradedCount: number;
  avgScore: number;
  passRate: number;
  pendingAppealsCount: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ExamsListResponse {
  success: boolean;
  exams: ExamListItem[];
  pagination: Pagination;
  filters: Record<string, string | null>;
}

interface ExamDetailFull {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  teacherId: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  academicYearId: string | null;
  startDate: string;
  endDate: string;
  durationMinutes: number;
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
  ipRestriction: string | null;
  antiCheatEnabled: boolean;
  status: ExamStatus;
  totalPoints: number;
  passingScore: number | null;
  createdAt: string;
  updatedAt: string;
  questionsCount: number;
  submissionsCount: number;
}

interface ExamStats {
  submissionsByStatus: Record<string, number>;
  gradedCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  passCount: number;
  passRate: number;
  violationsCount: number;
  appealsCount: number;
}

interface RecentSubmission {
  id: string;
  studentName: string;
  status: string;
  percentage: number | null;
  totalScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  tabSwitches: number;
  copyAttempts: number;
  focusEvents: number;
  _count: { appeals: number };
}

interface ExamDetailResponse {
  success: boolean;
  exam: ExamDetailFull;
  stats: ExamStats;
  recentSubmissions: RecentSubmission[];
}

interface AdminActionResponse {
  success: boolean;
  message: string;
  action: string;
  previousStatus?: string;
  newStatus?: string | null;
  coordinator?: { id: string; name: string };
}

interface ViolationItem {
  id: string;
  type: string;
  details: string | null;
  createdAt: string;
  submissionId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  subject: string;
  teacherName: string | null;
}

interface ViolationsResponse {
  success: boolean;
  violations: ViolationItem[];
  pagination: Pagination;
}

interface AppealItem {
  id: string;
  reason: string;
  requestedScore: number | null;
  status: AppealStatus;
  teacherReply: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  studentId: string;
  studentName: string;
  answerId: string;
  currentScore: number | null;
  maxScore: number | null;
  isCorrect: boolean | null;
  questionText: string;
  questionType: string;
  questionPoints: number;
  submissionId: string;
  examId: string;
  examTitle: string;
  subject: string;
  teacherName: string | null;
  submissionPercentage: number | null;
}

interface AppealsResponse {
  success: boolean;
  appeals: AppealItem[];
  pagination: Pagination;
}

// ============================================================
//  Constants
// ============================================================

const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: 'مسودة',
  PUBLISHED: 'منشور',
  CLOSED: 'مغلق',
  ARCHIVED: 'مؤرشف',
};

const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  PENDING: 'معلّق',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  FOCUS_LOSS: 'فقدان التركيز',
  TAB_SWITCH: 'تبديل التبويب',
  COPY_ATTEMPT: 'محاولة نسخ',
  SHORTCUT_KEY: 'اختصار لوحة المفاتيح',
  SUSPICIOUS_FILE: 'ملف مشبوه',
  RIGHT_CLICK: 'زر الفأرة الأيمن',
  PRINT_SCREEN: 'لقطة شاشة',
};

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'قيد الحل',
  SUBMITTED: 'تم التسليم',
  GRADED: 'تم التصحيح',
  FLAGGED: 'مُعلَّق',
  AUTO_CLOSED: 'أُغلق تلقائياً',
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ: 'اختيار من متعدد',
  TRUE_FALSE: 'صح / خطأ',
  SHORT: 'إجابة قصيرة',
  ESSAY: 'سؤال مقالي',
  IMAGE_ANSWER: 'إجابة بصورة',
  FILE_PDF: 'إجابة بملف PDF',
};

const STATUS_COLORS: Record<ExamStatus, string> = {
  DRAFT: '#64748b',
  PUBLISHED: '#10b981',
  CLOSED: '#f59e0b',
  ARCHIVED: '#9ca3af',
};

const VIOLATION_COLORS: Record<string, string> = {
  FOCUS_LOSS: '#f59e0b',
  TAB_SWITCH: '#3b82f6',
  COPY_ATTEMPT: '#ef4444',
  SHORTCUT_KEY: '#8b5cf6',
  SUSPICIOUS_FILE: '#ec4899',
  RIGHT_CLICK: '#06b6d4',
  PRINT_SCREEN: '#84cc16',
};

const SUBMISSION_COLORS: Record<string, string> = {
  GRADED: '#10b981',
  IN_PROGRESS: '#3b82f6',
  SUBMITTED: '#f59e0b',
  FLAGGED: '#ef4444',
  AUTO_CLOSED: '#8b5cf6',
  OTHER: '#94a3b8',
};

const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'الأحدث إنشاءً' },
  { value: 'startDate-asc', label: 'الأقرب موعداً' },
  { value: 'startDate-desc', label: 'الأبعد موعداً' },
  { value: 'title-asc', label: 'العنوان (أبجدياً)' },
  { value: 'submissions-desc', label: 'الأكثر تسليماً' },
];

// ============================================================
//  Helpers
// ============================================================

/**
 * fetch مع timeout 25s + إعادة محاولة واحدة عند فشل الشبكة.
 * لا يضيف headers مخصصة لطلبات GET (تفادياً لـ CORS preflight).
 */
async function coordinatorFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const method = options?.method || 'GET';
  const isGet = method === 'GET';

  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const headers: Record<string, string> = {
        ...((options?.headers as Record<string, string>) || {}),
      };
      if (!isGet && options?.body) headers['Content-Type'] = 'application/json';
      return await fetch(url, {
        ...options,
        method,
        signal: controller.signal,
        headers: isGet ? undefined : headers,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const parseAndCheck = async (res: Response): Promise<T> => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data as Record<string, unknown>).error as string ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  };

  try {
    const res = await doFetch();
    return await parseAndCheck(res);
  } catch (err: unknown) {
    // إعادة محاولة واحدة فقط لأخطاء الشبكة/المهلة
    const isNetwork =
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TypeError');
    if (isNetwork) {
      try {
        const res2 = await doFetch();
        return await parseAndCheck(res2);
      } catch (retryErr) {
        if (
          retryErr instanceof Error &&
          retryErr.name === 'AbortError'
        ) {
          throw new Error('انتهت مهلة الطلب');
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

function buildUrl(
  base: string,
  coordinator: CoordinatorInfo,
  extra?: Record<string, string | null | undefined>
): string {
  const params = new URLSearchParams();
  params.set('schoolId', coordinator.schoolId);
  params.set('coordinatorId', coordinator.coordinatorId);
  if (coordinator.coordinatorName) {
    params.set('coordinatorName', coordinator.coordinatorName);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== null && v !== undefined && v !== '') params.set(k, v);
    }
  }
  return `${base}?${params.toString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatCountdown(iso: string): string {
  try {
    const now = Date.now();
    const target = new Date(iso).getTime();
    const diff = target - now;
    if (diff <= 0) return 'انتهى';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days} يوم و ${remHours} ساعة`;
    if (hours > 0) return `${hours} ساعة و ${mins} دقيقة`;
    return `${mins} دقيقة`;
  } catch {
    return '—';
  }
}

function examStatusBadgeClass(status: ExamStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CLOSED':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'ARCHIVED':
      return 'bg-gray-200 text-gray-700 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function appealStatusBadgeClass(status: AppealStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function violationBadgeClass(type: string): string {
  switch (type) {
    case 'COPY_ATTEMPT':
    case 'PRINT_SCREEN':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'SUSPICIOUS_FILE':
      return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'FOCUS_LOSS':
    case 'TAB_SWITCH':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'SHORTCUT_KEY':
    case 'RIGHT_CLICK':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

// ============================================================
//  Main Component
// ============================================================

export default function CoordinatorDashboardPage({
  onBack,
  schoolId,
}: CoordinatorDashboardPageProps) {
  const [screen, setScreen] = useState<'login' | 'dashboard'>('login');
  const [coordinator, setCoordinator] = useState<CoordinatorInfo | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: ToastMessage['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const handleLogin = (info: CoordinatorInfo) => {
    setCoordinator(info);
    setScreen('dashboard');
  };

  const handleSwitchCoordinator = () => {
    setCoordinator(null);
    setScreen('login');
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50"
      dir="rtl"
      style={{ fontFamily: "'Segoe UI', 'Tahoma', 'Arial', sans-serif" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (screen === 'login') onBack();
                else handleSwitchCoordinator();
              }}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              {screen === 'login' ? 'الموقع' : 'تبديل المنسّق'}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#610000] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-900 truncate">
                  لوحة المنسّق — إدارة الامتحانات
                </h1>
                {coordinator && screen !== 'login' && (
                  <p className="text-xs text-gray-500 truncate">
                    {coordinator.coordinatorName} • {coordinator.coordinatorId}
                  </p>
                )}
              </div>
            </div>
          </div>
          {coordinator && screen !== 'login' && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-gray-500 hidden sm:flex"
              >
                <LogOut className="w-4 h-4 ml-1" />
                الرئيسية
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
            className={`shadow-lg border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200'
                : toast.type === 'info'
                ? 'bg-blue-50 border-blue-200'
                : ''
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
            <AlertDescription className="font-medium">
              {toast.text}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {screen === 'login' && (
          <CoordinatorLogin
            onLogin={handleLogin}
            schoolId={schoolId}
            onBack={onBack}
          />
        )}
        {screen === 'dashboard' && coordinator && (
          <CoordinatorDashboard
            coordinator={coordinator}
            showToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t py-3 px-4 text-center">
        <p className="text-xs text-gray-500">
          لوحة المنسّق • إدارة جميع امتحانات المدرسة + المخالفات + التظلّمات
        </p>
      </footer>
    </div>
  );
}

// ============================================================
//  CoordinatorLogin — شاشة الدخول
// ============================================================

function CoordinatorLogin({
  onLogin,
  schoolId,
  onBack,
}: {
  onLogin: (info: CoordinatorInfo) => void;
  schoolId?: string;
  onBack: () => void;
}) {
  const [coordinatorId, setCoordinatorId] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [schoolIdInput, setSchoolIdInput] = useState(schoolId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // مزامنة schoolIdInput مع الـ prop عندما يتوفر (الحالة التي يُحمّل فيها
  // selectedSchoolId من store بعد أول render). نُلّف setState بـ setTimeout(0)
  // لتجنّب تحذير set-state-in-effect.
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
    if (!coordinatorId.trim()) {
      setError('معرّف المنسّق مطلوب');
      return;
    }
    if (!coordinatorName.trim()) {
      setError('اسم المنسّق مطلوب');
      return;
    }
    if (!schoolIdInput.trim()) {
      setError('معرّف المدرسة مطلوب');
      return;
    }
    setLoading(true);
    try {
      const url =
        `/api/exams/coordinator/overview?schoolId=${encodeURIComponent(
          schoolIdInput
        )}&coordinatorId=${encodeURIComponent(
          coordinatorId
        )}&coordinatorName=${encodeURIComponent(coordinatorName)}`;
      const data = await coordinatorFetch<{ success?: boolean; error?: string }>(
        url
      );
      if (data && data.success) {
        onLogin({
          coordinatorId: coordinatorId.trim(),
          coordinatorName: coordinatorName.trim(),
          schoolId: schoolIdInput.trim(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل التحقق';
      if (coordinatorId.trim().startsWith('test-')) {
        // نسمح بالدخول في الوضع التجريبي حتى لو فشل الفحص
        onLogin({
          coordinatorId: coordinatorId.trim(),
          coordinatorName: coordinatorName.trim(),
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
            <ShieldCheck className="w-8 h-8 text-[#610000]" />
          </div>
          <CardTitle className="text-xl text-gray-900">
            دخول المنسّق
          </CardTitle>
          <CardDescription className="text-gray-500">
            منسّق الامتحانات — إشراف شامل على كل امتحانات المدرسة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="coordinatorId"
                className="text-sm font-medium text-gray-700"
              >
                معرّف المنسّق <span className="text-red-500">*</span>
              </Label>
              <Input
                id="coordinatorId"
                value={coordinatorId}
                onChange={(e) => setCoordinatorId(e.target.value)}
                placeholder="مثال: test-coordinator-001"
                className="text-right font-mono text-sm"
                autoComplete="off"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="coordinatorName"
                className="text-sm font-medium text-gray-700"
              >
                الاسم الكامل <span className="text-red-500">*</span>
              </Label>
              <Input
                id="coordinatorName"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder="الاسم كما هو مسجّل في المدرسة"
                className="text-right"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="schoolIdLogin"
                className="text-sm font-medium text-gray-700"
              >
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

            <Alert className="bg-amber-50 border-amber-200">
              <Info className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                للتجربة استخدم:{' '}
                <span className="font-mono font-bold">test-coordinator-001</span>
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

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onBack}
            >
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
//  CoordinatorDashboard — الحاوية مع 4 تبويبات
// ============================================================

function CoordinatorDashboard({
  coordinator,
  showToast,
}: {
  coordinator: CoordinatorInfo;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'exams' | 'violations' | 'appeals'
  >('overview');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(v as 'overview' | 'exams' | 'violations' | 'appeals')
        }
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">نظرة عامة</span>
            <span className="sm:hidden">عامة</span>
          </TabsTrigger>
          <TabsTrigger value="exams" className="gap-1">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">الامتحانات</span>
            <span className="sm:hidden">الامتحانات</span>
          </TabsTrigger>
          <TabsTrigger value="violations" className="gap-1">
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">المخالفات</span>
            <span className="sm:hidden">المخالفات</span>
          </TabsTrigger>
          <TabsTrigger value="appeals" className="gap-1">
            <Gavel className="w-4 h-4" />
            <span className="hidden sm:inline">التظلّمات</span>
            <span className="sm:hidden">التظلّمات</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab coordinator={coordinator} />
        </TabsContent>

        <TabsContent value="exams" className="mt-4">
          <ExamsTab
            coordinator={coordinator}
            showToast={showToast}
            onOpenExam={(id) => setSelectedExamId(id)}
          />
        </TabsContent>

        <TabsContent value="violations" className="mt-4">
          <ViolationsTab coordinator={coordinator} />
        </TabsContent>

        <TabsContent value="appeals" className="mt-4">
          <AppealsTab coordinator={coordinator} />
        </TabsContent>
      </Tabs>

      {/* Exam detail dialog (opened from Exams tab) */}
      <ExamDetailPanel
        examId={selectedExamId}
        coordinator={coordinator}
        onClose={() => setSelectedExamId(null)}
        showToast={showToast}
      />
    </div>
  );
}

// ============================================================
//  Reusable bits
// ============================================================

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  accent: string;
}) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
          </div>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
        <div className="h-8 bg-slate-200 rounded animate-pulse w-2/3" />
        <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="text-gray-700 font-medium">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="w-4 h-4" />
      <AlertTitle>حدث خطأ</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
        <span>{message}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5 ml-1" />
          إعادة المحاولة
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
      <p className="text-xs text-gray-500">
        إجمالي {pagination.total} • صفحة {pagination.page} من {pagination.totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <ChevronRight className="w-4 h-4 ml-1" />
          السابق
        </Button>
        <span className="text-sm text-gray-600 px-2">
          {pagination.page} / {pagination.totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          التالي
          <ChevronLeft className="w-4 h-4 mr-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
//  OverviewTab — نظرة عامة
// ============================================================

function OverviewTab({ coordinator }: { coordinator: CoordinatorInfo }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl('/api/exams/coordinator/overview', coordinator);
      const res = await coordinatorFetch<OverviewResponse>(url);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب النظرة العامة');
    } finally {
      setLoading(false);
    }
  }, [coordinator]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-[#610000] animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error || 'لا توجد بيانات'}
        onRetry={load}
      />
    );
  }

  const k = data.kpis;
  const otherSubs = Math.max(
    0,
    k.submissions.total - k.submissions.graded - k.submissions.inProgress
  );

  const examsByStatusData = ([
    { key: 'DRAFT', count: k.exams.draft },
    { key: 'PUBLISHED', count: k.exams.published },
    { key: 'CLOSED', count: k.exams.closed },
    { key: 'ARCHIVED', count: k.exams.archived },
  ] as const).map((d) => ({
    name: EXAM_STATUS_LABELS[d.key as ExamStatus],
    count: d.count,
    color: STATUS_COLORS[d.key as ExamStatus],
  }));

  const violationsByTypeData = Object.entries(k.violations.byType).map(
    ([type, count]) => ({
      name: VIOLATION_TYPE_LABELS[type] || type,
      count,
      color: VIOLATION_COLORS[type] || '#64748b',
    })
  );

  const submissionsPieData = [
    {
      name: SUBMISSION_STATUS_LABELS.GRADED,
      value: k.submissions.graded,
      color: SUBMISSION_COLORS.GRADED,
    },
    {
      name: SUBMISSION_STATUS_LABELS.IN_PROGRESS,
      value: k.submissions.inProgress,
      color: SUBMISSION_COLORS.IN_PROGRESS,
    },
    { name: 'أخرى', value: otherSubs, color: SUBMISSION_COLORS.OTHER },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Header row with refresh */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">نظرة عامة على المدرسة</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<FileText className="w-5 h-5" />}
          label="إجمالي الامتحانات"
          value={k.exams.total}
          hint={`مسودات: ${k.exams.draft} • منشورة: ${k.exams.published}`}
          accent="#610000"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="الامتحانات المنشورة"
          value={k.exams.published}
          hint="متاحة للطلاب"
          accent="#10b981"
        />
        <KpiCard
          icon={<FileText className="w-5 h-5" />}
          label="المسودات"
          value={k.exams.draft}
          hint="قيد الإعداد"
          accent="#64748b"
        />
        <KpiCard
          icon={<Inbox className="w-5 h-5" />}
          label="إجمالي التسليمات"
          value={k.submissions.total}
          hint={`مصحّحة: ${k.submissions.graded} • جارية: ${k.submissions.inProgress}`}
          accent="#3b82f6"
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="نسبة النجاح العامة"
          value={`${k.submissions.passRate}%`}
          hint="من التسليمات المصحّحة"
          accent="#10b981"
        />
        <KpiCard
          icon={<Gavel className="w-5 h-5" />}
          label="التظلّمات المعلّقة"
          value={k.appeals.pending}
          hint={`من أصل ${k.appeals.total} تظلّم`}
          accent="#f59e0b"
        />
        <KpiCard
          icon={<ShieldAlert className="w-5 h-5" />}
          label="المخالفات"
          value={k.violations.total}
          hint="على مستوى المدرسة"
          accent="#ef4444"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Exams by status — bar */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#610000]" />
              توزيع الامتحانات حسب الحالة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56" dir="rtl">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={examsByStatusData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RTooltip
                    contentStyle={{
                      direction: 'rtl',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {examsByStatusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Submissions by status — pie */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#610000]" />
              توزيع التسليمات حسب الحالة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submissionsPieData.length === 0 ? (
              <EmptyState
                icon={<Inbox className="w-6 h-6" />}
                title="لا توجد تسليمات بعد"
              />
            ) : (
              <div className="h-56" dir="rtl">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={submissionsPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                      label={(entry) => `${entry.value}`}
                      labelLine={false}
                    >
                      {submissionsPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        direction: 'rtl',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 13,
                      }}
                    />
                    <RLegend
                      wrapperStyle={{ fontSize: 12, direction: 'rtl' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Violations by type — bar */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#610000]" />
              توزيع المخالفات حسب النوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            {violationsByTypeData.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="w-6 h-6" />}
                title="لا توجد مخالفات مسجّلة"
                description="جميع الطلاب التزموا بقواعد الامتحانات"
              />
            ) : (
              <div className="h-64" dir="rtl">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={violationsByTypeData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11 }}
                    />
                    <RTooltip
                      contentStyle={{
                        direction: 'rtl',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {violationsByTypeData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-column sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top teachers */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-[#610000]" />
              أكثر المعلمين نشاطاً
            </CardTitle>
            <CardDescription>حسب عدد الامتحانات المنشأة</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topTeachers.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6" />}
                title="لا يوجد معلمون بعد"
              />
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto pl-1">
                {data.topTeachers.map((t, idx) => (
                  <li
                    key={t.teacherId + idx}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#610000]/10 text-[#610000] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {t.teacherName}
                        </p>
                        <p className="text-xs text-gray-400 truncate font-mono">
                          {t.teacherId}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-[#610000]/10 text-[#610000] border-[#610000]/20">
                      {t.examsCount} امتحان
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming exams ending soon */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              امتحانات تنتهي قريباً
            </CardTitle>
            <CardDescription>خلال 24 ساعة القادمة</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingExams.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="لا توجد امتحانات تنتهي قريباً"
              />
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto pl-1">
                {data.upcomingExams.map((e) => (
                  <li
                    key={e.id}
                    className="p-3 rounded-lg border border-amber-100 bg-amber-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {e.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {e.teacherName || 'معلم'} • {e.submissionsCount} تسليم
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex-shrink-0">
                        <Clock className="w-3 h-3 ml-1" />
                        {formatCountdown(e.endDate)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject stats table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#610000]" />
            إحصائيات حسب المادة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.subjectStats.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-6 h-6" />}
              title="لا توجد إحصائيات مواد بعد"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-gray-500 border-b">
                    <th className="py-2 px-2 font-medium">المادة</th>
                    <th className="py-2 px-2 font-medium text-center">عدد الامتحانات</th>
                    <th className="py-2 px-2 font-medium text-center">متوسط الدرجات</th>
                    <th className="py-2 px-2 font-medium text-center">نسبة النجاح</th>
                    <th className="py-2 px-2 font-medium text-center">تسليمات مصحّحة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjectStats.map((s) => (
                    <tr
                      key={s.subject}
                      className="border-b last:border-0 hover:bg-slate-50"
                    >
                      <td className="py-2 px-2 font-medium text-gray-900">
                        {s.subject}
                      </td>
                      <td className="py-2 px-2 text-center">{s.examCount}</td>
                      <td className="py-2 px-2 text-center">
                        <span className="font-mono">{s.avgScore}%</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant="outline"
                          className={
                            s.passRate >= 60
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : s.passRate >= 30
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {s.passRate}%
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600">
                        {s.gradedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending appeals alert section */}
      {data.pendingAppealsExams.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertTitle className="text-amber-900">
            امتحانات تنتظر تظلّمات معلّقة ({data.pendingAppealsExams.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {data.pendingAppealsExams.map((p) => (
                <li
                  key={p.examId}
                  className="text-sm text-amber-800 flex items-center gap-2 flex-wrap"
                >
                  <Gavel className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{p.examTitle}</span>
                  <span className="text-amber-600">•</span>
                  <span>{p.subject}</span>
                  <span className="text-amber-600">•</span>
                  <span>{p.teacherName || 'معلم'}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Recent exams */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#610000]" />
            أحدث الامتحانات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentExams.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="لا توجد امتحانات بعد"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.recentExams.map((e) => (
                <Card key={e.id} className="border border-slate-200">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {e.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={examStatusBadgeClass(e.status)}
                      >
                        {EXAM_STATUS_LABELS[e.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <p className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {e.subject}
                      </p>
                      <p className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {e.teacherName || 'معلم'}
                      </p>
                      <p className="flex items-center gap-1">
                        <ListChecks className="w-3 h-3" />
                        {e.questionsCount} سؤال
                      </p>
                      <p className="flex items-center gap-1">
                        <Inbox className="w-3 h-3" />
                        {e.submissionsCount} تسليم
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      <Calendar className="w-3 h-3 inline ml-1" />
                      {formatDateShort(e.startDate)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  ExamsTab — قائمة الامتحانات + فلاتر + ترقيم
// ============================================================

function ExamsTab({
  coordinator,
  showToast,
  onOpenExam,
}: {
  coordinator: CoordinatorInfo;
  showToast: (type: ToastMessage['type'], text: string) => void;
  onOpenExam: (id: string) => void;
}) {
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt-desc');
  const [page, setPage] = useState(1);

  const pageSize = 10;

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl('/api/exams/coordinator/exams', coordinator, {
        status: statusFilter !== 'all' ? statusFilter : null,
        subject: subjectFilter.trim() || null,
        search: search.trim() || null,
        sort,
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await coordinatorFetch<ExamsListResponse>(url);
      setExams(data.exams || []);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب الامتحانات');
    } finally {
      setLoading(false);
    }
  }, [coordinator, statusFilter, subjectFilter, search, sort, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchExams();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchExams]);

  // إعادة الضبط للصفحة الأولى عند تغيير أي فلتر (مؤجَّل لتجنّب setState المتزامن)
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(t);
  }, [statusFilter, subjectFilter, search, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">جميع امتحانات المدرسة</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchExams}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Filter bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">الحالة</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
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
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">المادة</Label>
              <Input
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                placeholder="اسم المادة"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">بحث بالعنوان</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث..."
                  className="text-sm pr-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">الترتيب</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(statusFilter !== 'all' ||
            subjectFilter ||
            search) && (
            <div className="mt-3 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">فلاتر مفعّلة</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setStatusFilter('all');
                  setSubjectFilter('');
                  setSearch('');
                }}
              >
                <X className="w-3 h-3 ml-1" />
                مسح الفلاتر
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchExams} />}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && exams.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent>
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="لا توجد امتحانات مطابقة"
              description="جرّب تعديل الفلاتر أو إنشاء امتحان جديد"
            />
          </CardContent>
        </Card>
      )}

      {/* Exams list — table on desktop, cards on mobile */}
      {!loading && !error && exams.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="border-0 shadow-sm hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-xs text-gray-500 border-b bg-slate-50">
                      <th className="py-3 px-3 font-medium">العنوان / المادة</th>
                      <th className="py-3 px-2 font-medium">المعلم</th>
                      <th className="py-3 px-2 font-medium">الفصل</th>
                      <th className="py-3 px-2 font-medium text-center">الحالة</th>
                      <th className="py-3 px-2 font-medium text-center">أسئلة</th>
                      <th className="py-3 px-2 font-medium text-center">تسليمات</th>
                      <th className="py-3 px-2 font-medium text-center">مصحّحة</th>
                      <th className="py-3 px-2 font-medium text-center">المتوسط</th>
                      <th className="py-3 px-2 font-medium text-center">النجاح</th>
                      <th className="py-3 px-2 font-medium text-center">تظلّمات</th>
                      <th className="py-3 px-2 font-medium text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                        onClick={() => onOpenExam(e.id)}
                      >
                        <td className="py-3 px-3">
                          <p className="font-medium text-gray-900 line-clamp-1">
                            {e.title}
                          </p>
                          <p className="text-xs text-gray-500">{e.subject}</p>
                        </td>
                        <td className="py-3 px-2 text-gray-600">
                          {e.teacherName}
                        </td>
                        <td className="py-3 px-2 text-gray-600">
                          {e.classroomName || '—'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge
                            variant="outline"
                            className={examStatusBadgeClass(e.status)}
                          >
                            {EXAM_STATUS_LABELS[e.status]}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-center text-gray-600">
                          {e.questionsCount}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-600">
                          {e.submissionsCount}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-600">
                          {e.gradedCount}
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-gray-700">
                          {e.avgScore}%
                        </td>
                        <td className="py-3 px-2 text-center">
                          {e.gradedCount > 0 ? (
                            <span
                              className={
                                e.passRate >= 60
                                  ? 'text-emerald-600 font-medium'
                                  : e.passRate >= 30
                                  ? 'text-amber-600 font-medium'
                                  : 'text-red-600 font-medium'
                              }
                            >
                              {e.passRate}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {e.pendingAppealsCount > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              {e.pendingAppealsCount}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onOpenExam(e.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {exams.map((e) => (
              <Card
                key={e.id}
                className="border border-slate-200 cursor-pointer active:bg-slate-50"
                onClick={() => onOpenExam(e.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 line-clamp-1">
                        {e.title}
                      </p>
                      <p className="text-xs text-gray-500">{e.subject}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={examStatusBadgeClass(e.status)}
                    >
                      {EXAM_STATUS_LABELS[e.status]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                    <p>المعلم: {e.teacherName}</p>
                    <p>الفصل: {e.classroomName || '—'}</p>
                    <p>أسئلة: {e.questionsCount}</p>
                    <p>تسليمات: {e.submissionsCount}</p>
                    <p>مصحّحة: {e.gradedCount}</p>
                    <p>المتوسط: {e.avgScore}%</p>
                    <p>
                      النجاح:{' '}
                      {e.gradedCount > 0 ? `${e.passRate}%` : '—'}
                    </p>
                    <p>
                      تظلّمات:{' '}
                      {e.pendingAppealsCount > 0 ? (
                        <span className="text-amber-700 font-medium">
                          {e.pendingAppealsCount}
                        </span>
                      ) : (
                        '0'
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
//  ExamDetailPanel — حوار تفاصيل الامتحان + إجراءات إدارية
// ============================================================

function ExamDetailPanel({
  examId,
  coordinator,
  onClose,
  showToast,
}: {
  examId: string | null;
  coordinator: CoordinatorInfo;
  onClose: () => void;
  showToast: (type: ToastMessage['type'], text: string) => void;
}) {
  const [data, setData] = useState<ExamDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // sub-dialogs state
  const [showReassign, setShowReassign] = useState(false);
  const [showForceClose, setShowForceClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(
        `/api/exams/coordinator/exams/${examId}`,
        coordinator
      );
      const res = await coordinatorFetch<ExamDetailResponse>(url);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب تفاصيل الامتحان');
    } finally {
      setLoading(false);
    }
  }, [examId, coordinator]);

  useEffect(() => {
    if (!examId) {
      // مؤجَّل لتجنّب setState المتزامن داخل الـ effect
      const t = setTimeout(() => setData(null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [examId, load]);

  const performAction = async (
    action: string,
    body?: Record<string, unknown>
  ) => {
    if (!examId) return;
    setActionLoading(action);
    try {
      const url = buildUrl(
        `/api/exams/coordinator/exams/${examId}`,
        coordinator
      );
      const res = await coordinatorFetch<AdminActionResponse>(url, {
        method: 'PATCH',
        body: JSON.stringify({ action, ...body }),
      });
      showToast('success', res.message || 'تم تنفيذ الإجراء');
      await load();
    } catch (err: unknown) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'فشل تنفيذ الإجراء'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const submissionsByStatusData = data
    ? Object.entries(data.stats.submissionsByStatus).map(([status, count]) => ({
        name: SUBMISSION_STATUS_LABELS[status] || status,
        count,
        color:
          SUBMISSION_COLORS[status] ||
          '#' +
            Math.floor(Math.random() * 0xffffff)
              .toString(16)
              .padStart(6, '0'),
      }))
    : [];

  const exam = data?.exam;
  const stats = data?.stats;

  return (
    <Dialog open={!!examId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#610000]" />
            تفاصيل الامتحان
          </DialogTitle>
          <DialogDescription>
            إدارة الامتحان على مستوى المدرسة — الإجراءات الإدارية
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#610000] animate-spin mb-3" />
            <p className="text-sm text-gray-500">جارٍ تحميل التفاصيل...</p>
          </div>
        )}

        {error && !loading && (
          <ErrorState message={error} onRetry={load} />
        )}

        {exam && stats && !loading && (
          <ScrollArea className="flex-1 max-h-[60vh] pr-2">
            <div className="space-y-4">
              {/* Exam header card */}
              <Card className="border border-slate-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">
                        {exam.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {exam.subject} • {exam.teacherName}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={examStatusBadgeClass(exam.status)}
                    >
                      {EXAM_STATUS_LABELS[exam.status]}
                    </Badge>
                  </div>
                  {exam.description && (
                    <p className="text-sm text-gray-600 bg-slate-50 p-2 rounded">
                      {exam.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500">الفصل</p>
                      <p className="font-medium text-gray-900">
                        {exam.classroomName || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">المدة</p>
                      <p className="font-medium text-gray-900">
                        {exam.durationMinutes} دقيقة
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">الدرجة الكلية</p>
                      <p className="font-medium text-gray-900">
                        {exam.totalPoints}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">درجة النجاح</p>
                      <p className="font-medium text-gray-900">
                        {exam.passingScore ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">عدد الأسئلة</p>
                      <p className="font-medium text-gray-900">
                        {exam.questionsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">التسليمات</p>
                      <p className="font-medium text-gray-900">
                        {exam.submissionsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">يبدأ</p>
                      <p className="font-medium text-gray-900">
                        {formatDateShort(exam.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">ينتهي</p>
                      <p className="font-medium text-gray-900">
                        {formatDateShort(exam.endDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {exam.antiCheatEnabled && (
                      <Badge className="bg-red-50 text-red-700 border-red-200">
                        <ShieldAlert className="w-3 h-3 ml-1" />
                        مكافحة الغش مفعّلة
                      </Badge>
                    )}
                    {exam.shuffleQuestions && (
                      <Badge variant="outline">خلط الأسئلة</Badge>
                    )}
                    {exam.shuffleOptions && (
                      <Badge variant="outline">خلط الخيارات</Badge>
                    )}
                    {exam.parentVisible && (
                      <Badge variant="outline">مرئي لأولياء الأمور</Badge>
                    )}
                    {exam.ipRestriction && (
                      <Badge variant="outline">
                        تقييد IP: {exam.ipRestriction}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Detailed stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">المتوسط</p>
                    <p className="text-xl font-bold text-gray-900">
                      {stats.avgScore}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">أعلى درجة</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {stats.maxScore}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">أدنى درجة</p>
                    <p className="text-xl font-bold text-red-600">
                      {stats.minScore}%
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">نسبة النجاح</p>
                    <p
                      className={`text-xl font-bold ${
                        stats.passRate >= 60
                          ? 'text-emerald-600'
                          : stats.passRate >= 30
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {stats.passRate}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Submissions by status — bar */}
              {submissionsByStatusData.length > 0 && (
                <Card className="border border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      توزيع التسليمات حسب الحالة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48" dir="rtl">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={submissionsByStatusData}
                          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <RTooltip
                            contentStyle={{
                              direction: 'rtl',
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              fontSize: 13,
                            }}
                          />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {submissionsByStatusData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Counts row */}
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                  <Activity className="w-3 h-3 ml-1" />
                  مصحّحة: {stats.gradedCount}
                </Badge>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 ml-1" />
                  ناجح: {stats.passCount}
                </Badge>
                <Badge className="bg-red-50 text-red-700 border-red-200">
                  <ShieldAlert className="w-3 h-3 ml-1" />
                  مخالفات: {stats.violationsCount}
                </Badge>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                  <Gavel className="w-3 h-3 ml-1" />
                  تظلّمات: {stats.appealsCount}
                </Badge>
              </div>

              {/* Recent submissions */}
              {data.recentSubmissions.length > 0 && (
                <Card className="border border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      أحدث التسليمات ({data.recentSubmissions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-right text-xs text-gray-500 border-b">
                            <th className="py-2 px-2 font-medium">الطالب</th>
                            <th className="py-2 px-2 font-medium text-center">الحالة</th>
                            <th className="py-2 px-2 font-medium text-center">النسبة</th>
                            <th className="py-2 px-2 font-medium text-center">الدرجة</th>
                            <th className="py-2 px-2 font-medium text-center">مخالفات</th>
                            <th className="py-2 px-2 font-medium">التسليم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentSubmissions.map((s) => (
                            <tr
                              key={s.id}
                              className="border-b last:border-0 hover:bg-slate-50"
                            >
                              <td className="py-2 px-2 font-medium text-gray-900">
                                {s.studentName}
                                {s._count.appeals > 0 && (
                                  <Badge className="mr-2 bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                    {s._count.appeals} تظلّم
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <Badge variant="outline" className="text-xs">
                                  {SUBMISSION_STATUS_LABELS[s.status] || s.status}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-center font-mono">
                                {s.percentage !== null
                                  ? `${s.percentage}%`
                                  : '—'}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {s.totalScore ?? '—'}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {s.tabSwitches +
                                  s.copyAttempts +
                                  s.focusEvents >
                                0 ? (
                                  <span className="text-red-600 font-medium">
                                    {s.tabSwitches + s.copyAttempts + s.focusEvents}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">0</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-xs text-gray-500">
                                {formatDateShort(s.submittedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Admin actions toolbar */}
              <Card className="border-2 border-[#610000]/20 bg-[#610000]/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#610000]" />
                    إجراءات إدارية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {exam.status === 'DRAFT' && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={
                          actionLoading !== null || exam.questionsCount === 0
                        }
                        onClick={() => performAction('publish')}
                      >
                        {actionLoading === 'publish' ? (
                          <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 ml-1" />
                        )}
                        نشر
                      </Button>
                    )}
                    {exam.status === 'PUBLISHED' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          disabled={actionLoading !== null}
                          onClick={() => performAction('close')}
                        >
                          {actionLoading === 'close' ? (
                            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                          ) : (
                            <Ban className="w-4 h-4 ml-1" />
                          )}
                          إغلاق
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          disabled={actionLoading !== null}
                          onClick={() => setShowForceClose(true)}
                        >
                          <AlertTriangle className="w-4 h-4 ml-1" />
                          إغلاق إجباري
                        </Button>
                      </>
                    )}
                    {exam.status === 'CLOSED' && (
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={actionLoading !== null}
                        onClick={() => performAction('archive')}
                      >
                        {actionLoading === 'archive' ? (
                          <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                        ) : (
                          <Archive className="w-4 h-4 ml-1" />
                        )}
                        أرشفة
                      </Button>
                    )}
                    {exam.status === 'ARCHIVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading !== null}
                        onClick={() => performAction('unarchive')}
                      >
                        {actionLoading === 'unarchive' ? (
                          <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                        ) : (
                          <ArchiveRestore className="w-4 h-4 ml-1" />
                        )}
                        إزالة الأرشفة
                      </Button>
                    )}

                    {/* Reassign — except ARCHIVED */}
                    {exam.status !== 'ARCHIVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading !== null}
                        onClick={() => setShowReassign(true)}
                      >
                        <UserCog className="w-4 h-4 ml-1" />
                        إعادة تعيين معلم
                      </Button>
                    )}

                    {/* Delete — always */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 mr-auto"
                      disabled={actionLoading !== null}
                      onClick={() => setShowDelete(true)}
                    >
                      <Trash2 className="w-4 h-4 ml-1" />
                      حذف نهائي
                    </Button>
                  </div>

                  {exam.status === 'DRAFT' && exam.questionsCount === 0 && (
                    <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      لا يمكن نشر امتحان بدون أسئلة
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Sub-dialog: Reassign */}
      <ReassignDialog
        open={showReassign}
        onClose={() => setShowReassign(false)}
        onConfirm={async (teacherId, teacherName) => {
          setShowReassign(false);
          await performAction('reassign', {
            teacherId,
            teacherName,
          });
        }}
      />

      {/* Sub-dialog: Force close confirmation */}
      <ConfirmForceCloseDialog
        open={showForceClose}
        examTitle={exam?.title || ''}
        onClose={() => setShowForceClose(false)}
        onConfirm={async () => {
          setShowForceClose(false);
          await performAction('force-close');
        }}
      />

      {/* Sub-dialog: Delete (type-to-confirm) */}
      <ConfirmDeleteDialog
        open={showDelete}
        examTitle={exam?.title || ''}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          setShowDelete(false);
          await performAction('delete');
          // بعد الحذف لا يوجد امتحان — أغلق اللوحة
          setTimeout(() => {
            onClose();
          }, 600);
        }}
      />
    </Dialog>
  );
}

// ============================================================
//  ReassignDialog — إعادة تعيين معلم
// ============================================================

function ReassignDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (teacherId: string, teacherName: string) => Promise<void>;
}) {
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // مؤجَّل لتجنّب setState المتزامن داخل الـ effect
      const t = setTimeout(() => {
        setTeacherId('');
        setTeacherName('');
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!teacherId.trim() || !teacherName.trim()) return;
    setLoading(true);
    try {
      await onConfirm(teacherId.trim(), teacherName.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-[#610000]" />
            إعادة تعيين معلم
          </DialogTitle>
          <DialogDescription>
            سيتم تحويل ملكية الامتحان إلى معلم آخر في نفس المدرسة
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">معرّف المعلم الجديد</Label>
            <Input
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              placeholder="مثال: teacher-002"
              className="font-mono text-sm"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">اسم المعلم الجديد</Label>
            <Input
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="الاسم الكامل"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            className="bg-[#610000] hover:bg-[#4a0000] text-white"
            disabled={
              loading || !teacherId.trim() || !teacherName.trim()
            }
            onClick={handleConfirm}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <UserCog className="w-4 h-4 ml-1" />
            )}
            تأكيد إعادة التعيين
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
//  ConfirmForceCloseDialog — تأكيد الإغلاق الإجباري
// ============================================================

function ConfirmForceCloseDialog({
  open,
  examTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  examTitle: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            تأكيد الإغلاق الإجباري
          </DialogTitle>
          <DialogDescription>
            سيتم إغلاق الامتحان فوراً وإغلاق جميع المحاولات النشطة كذلك.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive" className="my-2">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            الامتحان: <strong>{examTitle}</strong>
            <br />
            سيتم تحويل كل التسليمات النشطة (IN_PROGRESS) إلى مغلق تلقائياً
            (AUTO_CLOSED). لا يمكن التراجع.
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={loading}
            onClick={handleConfirm}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Ban className="w-4 h-4 ml-1" />
            )}
            نعم، إغلاق إجباري
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
//  ConfirmDeleteDialog — حذف نهائي (كتابة العنوان للتأكيد)
// ============================================================

function ConfirmDeleteDialog({
  open,
  examTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  examTitle: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setTyped(''), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const matches = typed.trim() === examTitle.trim();

  const handleConfirm = async () => {
    if (!matches) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" />
            حذف نهائي للامتحان
          </DialogTitle>
          <DialogDescription>
            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الامتحان وكل أسئلته
            وتسليماته وإجاباته ومخالفاته وتظلّماته.
          </DialogDescription>
        </DialogHeader>
        <Alert variant="destructive" className="my-2">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            لتأكيد الحذف، اكتب عنوان الامتحان بالضبط:
            <br />
            <strong className="font-mono">{examTitle}</strong>
          </AlertDescription>
        </Alert>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="اكتب عنوان الامتحان هنا"
          className="my-2"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={loading || !matches}
            onClick={handleConfirm}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 ml-1 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 ml-1" />
            )}
            حذف نهائي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
//  ViolationsTab — المخالفات
// ============================================================

function ViolationsTab({ coordinator }: { coordinator: CoordinatorInfo }) {
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const pageSize = 15;

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl('/api/exams/coordinator/violations', coordinator, {
        type: typeFilter !== 'all' ? typeFilter : null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await coordinatorFetch<ViolationsResponse>(url);
      setViolations(data.violations || []);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب المخالفات');
    } finally {
      setLoading(false);
    }
  }, [coordinator, typeFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchViolations();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchViolations]);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(t);
  }, [typeFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">
          سجل المخالفات على مستوى المدرسة
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchViolations}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">نوع المخالفة</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {Object.entries(VIOLATION_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">من تاريخ</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">إلى تاريخ</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorState message={error} onRetry={fetchViolations} />}

      {loading && (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && !error && violations.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent>
            <EmptyState
              icon={<ShieldCheck className="w-6 h-6" />}
              title="لا توجد مخالفات مسجّلة"
              description="جميع الطلاب التزموا بقواعد الامتحانات"
            />
          </CardContent>
        </Card>
      )}

      {!loading && !error && violations.length > 0 && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-xs text-gray-500 border-b bg-slate-50">
                      <th className="py-3 px-3 font-medium">النوع</th>
                      <th className="py-3 px-2 font-medium">الطالب</th>
                      <th className="py-3 px-2 font-medium">الامتحان</th>
                      <th className="py-3 px-2 font-medium hidden md:table-cell">المادة</th>
                      <th className="py-3 px-2 font-medium hidden md:table-cell">المعلم</th>
                      <th className="py-3 px-2 font-medium hidden lg:table-cell">التفاصيل</th>
                      <th className="py-3 px-2 font-medium">التوقيت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v) => (
                      <tr
                        key={v.id}
                        className="border-b last:border-0 hover:bg-slate-50"
                      >
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={violationBadgeClass(v.type)}
                          >
                            <ShieldAlert className="w-3 h-3 ml-1" />
                            {VIOLATION_TYPE_LABELS[v.type] || v.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 font-medium text-gray-900">
                          {v.studentName}
                        </td>
                        <td className="py-3 px-2 text-gray-700">
                          {v.examTitle}
                        </td>
                        <td className="py-3 px-2 text-gray-600 hidden md:table-cell">
                          {v.subject}
                        </td>
                        <td className="py-3 px-2 text-gray-600 hidden md:table-cell">
                          {v.teacherName || '—'}
                        </td>
                        <td className="py-3 px-2 text-gray-500 text-xs hidden lg:table-cell max-w-xs">
                          {v.details || '—'}
                        </td>
                        <td className="py-3 px-2 text-xs text-gray-500 whitespace-nowrap">
                          {formatDateShort(v.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
//  AppealsTab — التظلّمات
// ============================================================

function AppealsTab({ coordinator }: { coordinator: CoordinatorInfo }) {
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const pageSize = 12;

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl('/api/exams/coordinator/appeals', coordinator, {
        status: statusFilter !== 'all' ? statusFilter : null,
        page: String(page),
        pageSize: String(pageSize),
      });
      const data = await coordinatorFetch<AppealsResponse>(url);
      setAppeals(data.appeals || []);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل جلب التظلّمات');
    } finally {
      setLoading(false);
    }
  }, [coordinator, statusFilter, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchAppeals();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchAppeals]);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(t);
  }, [statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">
          تظلّمات الطلاب على مستوى المدرسة
        </h2>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="PENDING">معلّق</SelectItem>
              <SelectItem value="APPROVED">مقبول</SelectItem>
              <SelectItem value="REJECTED">مرفوض</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAppeals}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 ml-1 ${loading ? 'animate-spin' : ''}`}
            />
            تحديث
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchAppeals} />}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && !error && appeals.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent>
            <EmptyState
              icon={<Gavel className="w-6 h-6" />}
              title="لا توجد تظلّمات"
              description="لم يقدّم أي طالب تظلّماً على تصحيح بعد"
            />
          </CardContent>
        </Card>
      )}

      {!loading && !error && appeals.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {appeals.map((a) => (
              <Card key={a.id} className="border border-slate-200">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {a.studentName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {a.examTitle} • {a.subject}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={appealStatusBadgeClass(a.status)}
                    >
                      {APPEAL_STATUS_LABELS[a.status]}
                    </Badge>
                  </div>

                  {/* Question */}
                  <div className="bg-slate-50 p-2 rounded text-sm">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <ListChecks className="w-3 h-3" />
                      {QUESTION_TYPE_LABELS[a.questionType] || a.questionType} •{' '}
                      {a.questionPoints} درجة
                    </p>
                    <p className="text-gray-700 line-clamp-2">
                      {a.questionText}
                    </p>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded">
                      <p className="text-gray-500">الدرجة الحالية</p>
                      <p className="font-bold text-gray-900">
                        {a.currentScore ?? '—'} / {a.maxScore ?? '—'}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded">
                      <p className="text-gray-500">المطلوبة</p>
                      <p className="font-bold text-blue-700">
                        {a.requestedScore ?? '—'}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded">
                      <p className="text-gray-500">نسبة الامتحان</p>
                      <p className="font-bold text-emerald-700">
                        {a.submissionPercentage !== null
                          ? `${a.submissionPercentage}%`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">سبب التظلّم:</p>
                    <p className="text-sm text-gray-700 bg-amber-50/50 border border-amber-100 p-2 rounded">
                      {a.reason}
                    </p>
                  </div>

                  {/* Teacher reply if exists */}
                  {a.teacherReply && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">رد المعلم:</p>
                      <p className="text-sm text-gray-700 bg-slate-50 p-2 rounded">
                        {a.teacherReply}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-400 pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {a.teacherName || 'معلم'}
                    </span>
                    <span>{formatDateShort(a.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
