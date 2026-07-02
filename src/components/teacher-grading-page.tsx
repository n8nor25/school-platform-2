'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowRight, RefreshCw, Search, ListChecks, ClipboardCheck,
  AlertTriangle, Sparkles, GraduationCap, CheckCircle2, XCircle,
  ShieldCheck, FileText, BookOpen, Award, Eye, Clock, Flag,
  Loader2, Save, Image as ImageIcon, FileText as PdfIcon,
  HelpCircle, ChevronLeft, Megaphone, AlertOctagon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ============================================================
// Props
// ============================================================
interface TeacherGradingPageProps {
  onBack: () => void;
  schoolId: string;
  teacherId: string;
  teacherName: string;
}

// ============================================================
// Types
// ============================================================
type SubmissionStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'GRADED'
  | 'AUTO_CLOSED'
  | 'FLAGGED';

interface ExamListItem {
  id: string;
  title: string;
  subject: string;
  classroomName: string;
  submissionsCount: number;
  questionsCount: number;
}

interface SubmissionListItem {
  id: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  autoClosedAt: string | null;
  status: SubmissionStatus;
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
  answersCount: number;
  violationsCount: number;
  appealsCount: number;
  suspicious: boolean;
  needsGrading: boolean;
  // Augmented fields for display/filtering
  examId: string;
  examTitle: string;
  examSubject: string;
  examClassroomName: string;
}

interface SubmissionAnswerQuestion {
  id: string;
  type: string;
  text: string;
  options: string[] | null;
  correctAnswer: string | null;
  correctText: string | null;
  rubric: Record<string, unknown> | null;
  points: number;
  explanation: string | null;
}

interface SubmissionAnswer {
  id: string;
  questionId: string;
  textAnswer: string | null;
  imageAnswerUrl: string | null;
  fileAnswerUrl: string | null;
  imageHash: string | null;
  textModeration: string | null;
  imageModeration: string | null;
  fileModeration: string | null;
  moderationNotes: string | null;
  score: number | null;
  maxScore: number;
  isCorrect: boolean | null;
  teacherNote: string | null;
  aiSuggestedScore: number | null;
  aiConfidence: number | null;
  gradedAt: string | null;
  gradedById: string | null;
  createdAt: string;
  question: SubmissionAnswerQuestion;
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
  status: SubmissionStatus;
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
  answers: SubmissionAnswer[];
  violations: Array<{
    id: string;
    type: string;
    severity: number;
    details: string;
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

interface ExamListResponse {
  success: boolean;
  exams: ExamListItem[];
}

interface SubmissionsListResponse {
  success: boolean;
  submissions: SubmissionListItem[];
  stats: {
    total: number;
    inProgress: number;
    submitted: number;
    graded: number;
    autoClosed: number;
    needsGrading: number;
    suspiciousCount: number;
    avgScore: number;
  };
}

interface SubmissionDetailResponse {
  success: boolean;
  submission: SubmissionDetail;
}

interface FinalizeResponse {
  success: boolean;
  message: string;
  result: {
    submissionId: string;
    status: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    gradedAt: string;
    gradedByName: string;
  };
}

// ============================================================
// Helpers
// ============================================================
function formatArabicDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatArabicDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function submissionStatusLabel(s: SubmissionStatus): string {
  switch (s) {
    case 'IN_PROGRESS':
      return 'قيد الإجراء';
    case 'SUBMITTED':
      return 'بانتظار التصحيح';
    case 'GRADED':
      return 'تم التصحيح';
    case 'AUTO_CLOSED':
      return 'إغلاق تلقائي';
    case 'FLAGGED':
      return 'مُعلَّم';
    default:
      return s;
  }
}

function submissionStatusBadgeClass(s: SubmissionStatus): string {
  switch (s) {
    case 'IN_PROGRESS':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    case 'SUBMITTED':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'GRADED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'AUTO_CLOSED':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'FLAGGED':
      return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

function questionTypeLabel(t: string): string {
  switch (t) {
    case 'MCQ':
      return 'اختيار من متعدد';
    case 'TRUE_FALSE':
      return 'صح / خطأ';
    case 'SHORT':
      return 'إجابة قصيرة';
    case 'ESSAY':
      return 'سؤال مقالي';
    case 'IMAGE_ANSWER':
      return 'إجابة بصورة';
    case 'FILE_PDF':
      return 'ملف PDF';
    default:
      return t;
  }
}

function questionTypeBadgeClass(t: string): string {
  switch (t) {
    case 'MCQ':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800';
    case 'TRUE_FALSE':
      return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800';
    case 'SHORT':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'ESSAY':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'IMAGE_ANSWER':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'FILE_PDF':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

const MANUAL_TYPES = ['SHORT', 'ESSAY', 'IMAGE_ANSWER', 'FILE_PDF'];
const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل'];

function isSuspicious(s: {
  tabSwitches: number;
  copyAttempts: number;
  focusEvents: number;
}): boolean {
  return s.tabSwitches >= 5 || s.copyAttempts >= 3 || s.focusEvents >= 10;
}

// ============================================================
// KPI Cards config
// ============================================================
const kpiConfig = [
  {
    key: 'pending',
    label: 'بانتظار التصحيح',
    icon: ClipboardCheck,
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    key: 'graded',
    label: 'تم تصحيحها',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    key: 'appeals',
    label: 'طعون مفتوحة',
    icon: Flag,
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
  },
] as const;

// ============================================================
// Main Component
// ============================================================
export default function TeacherGradingPage({
  onBack,
  schoolId,
  teacherId,
  teacherName,
}: TeacherGradingPageProps) {
  // ===== State =====
  const [fadeIn, setFadeIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [examFilters, setExamFilters] = useState<ExamListItem[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [examFilter, setExamFilter] = useState<string>('all');

  // Grading dialog state
  const [gradingOpen, setGradingOpen] = useState(false);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingDetail, setGradingDetail] = useState<SubmissionDetail | null>(null);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [gradeNotes, setGradeNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Mounted ref (prevent setState after unmount)
  const mountedRef = useRef(true);

  // ===== Restore fadeIn =====
  useEffect(() => {
    const t = setTimeout(() => setFadeIn(true), 0);
    return () => clearTimeout(t);
  }, []);

  // ===== mountedRef lifecycle =====
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ===== Debounced search (300ms) =====
  useEffect(() => {
    const t = setTimeout(() => {
      if (mountedRef.current) setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ===== Fetch flow: exams → per-exam submissions → merge =====
  const fetchSubmissions = useCallback(
    async (silent: boolean = false) => {
      if (!mountedRef.current) return;
      if (!silent) {
        const t = setTimeout(() => {
          setLoading(true);
          setError(null);
        }, 0);
        void t;
      }
      try {
        const params = new URLSearchParams();
        params.set('schoolId', schoolId);
        params.set('teacherId', teacherId);
        params.set('limit', '100');

        // 1) Fetch all exams for this teacher
        const examsRes = await fetch(`/api/exams/teacher?${params.toString()}`);
        const examsData = await examsRes.json();
        if (!examsRes.ok) {
          throw new Error(examsData?.error || 'فشل جلب الامتحانات');
        }
        if (!mountedRef.current) return;

        const examsList: ExamListItem[] = (examsData as ExamListResponse).exams || [];
        const t1 = setTimeout(() => setExamFilters(examsList), 0);
        void t1;

        // 2) For each exam with submissionsCount > 0, fetch submissions
        const examsWithSubs = examsList.filter((e) => (e.submissionsCount || 0) > 0);
        const submissionsParams = new URLSearchParams();
        submissionsParams.set('schoolId', schoolId);
        submissionsParams.set('teacherId', teacherId);
        submissionsParams.set('limit', '200');

        const perExam = await Promise.allSettled(
          examsWithSubs.map((exam) =>
            fetch(
              `/api/exams/teacher/${exam.id}/submissions?${submissionsParams.toString()}`
            )
              .then(async (r) => {
                const data = await r.json();
                if (!r.ok) {
                  throw new Error(data?.error || 'فشل جلب التسليمات');
                }
                const subs = (data as SubmissionsListResponse).submissions || [];
                // Augment with exam metadata for display
                return subs.map((s) => ({
                  ...s,
                  examId: exam.id,
                  examTitle: exam.title,
                  examSubject: exam.subject,
                  examClassroomName: exam.classroomName || '',
                })) as SubmissionListItem[];
              })
          )
        );

        if (!mountedRef.current) return;

        // 3) Merge into one flat list
        const merged: SubmissionListItem[] = [];
        let failures = 0;
        for (const r of perExam) {
          if (r.status === 'fulfilled') {
            merged.push(...r.value);
          } else {
            failures++;
          }
        }

        // Sort: needsGrading first, then by submittedAt desc
        merged.sort((a, b) => {
          if (a.needsGrading !== b.needsGrading) {
            return a.needsGrading ? -1 : 1;
          }
          const aT = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const bT = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return bT - aT;
        });

        const t2 = setTimeout(() => setSubmissions(merged), 0);
        void t2;

        // If every per-exam fetch failed, surface an error
        if (failures > 0 && merged.length === 0 && examsWithSubs.length > 0) {
          throw new Error('فشل جلب التسليمات من جميع الامتحانات');
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : 'فشل جلب التسليمات';
        const t = setTimeout(() => setError(msg), 0);
        void t;
        if (!silent) toast.error(msg);
      } finally {
        if (!mountedRef.current) return;
        const t = setTimeout(() => setLoading(false), 0);
        void t;
      }
    },
    [schoolId, teacherId]
  );

  // ===== Initial fetch + auto-refresh + focus =====
  useEffect(() => {
    fetchSubmissions(false);
    const interval = setInterval(() => {
      fetchSubmissions(true);
    }, 60_000);
    const onFocus = () => fetchSubmissions(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchSubmissions]);

  // ===== Compute KPIs =====
  const kpis = useMemo(
    () => ({
      pending: submissions.filter((s) => s.needsGrading).length,
      graded: submissions.filter((s) => s.status === 'GRADED').length,
      appeals: submissions.filter((s) => (s.appealsCount || 0) > 0).length,
    }),
    [submissions]
  );

  // ===== Compute exams with pending submissions (for filter dropdown) =====
  const examsWithPending = useMemo(() => {
    const ids = new Set<string>();
    submissions.forEach((s) => {
      if (s.needsGrading) ids.add(s.examId);
    });
    return examFilters.filter((e) => ids.has(e.id));
  }, [submissions, examFilters]);

  // ===== Compute filtered list (display) =====
  const filteredSubmissions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return submissions
      .filter((s) => s.needsGrading) // Only show submissions needing manual grading
      .filter((s) => (examFilter === 'all' ? true : s.examId === examFilter))
      .filter((s) =>
        q.length === 0
          ? true
          : (s.studentName || '').toLowerCase().includes(q) ||
            (s.studentId || '').toLowerCase().includes(q)
      );
  }, [submissions, debouncedSearch, examFilter]);

  // ===== Open grading dialog =====
  const openGradingDialog = useCallback(
    async (submissionId: string) => {
      if (!mountedRef.current) return;
      const t1 = setTimeout(() => {
        setGradingOpen(true);
        setGradingLoading(true);
        setGradingError(null);
        setGradingDetail(null);
        setGrades({});
        setGradeNotes('');
      }, 0);
      void t1;
      try {
        const params = new URLSearchParams();
        params.set('schoolId', schoolId);
        params.set('teacherId', teacherId);

        const res = await fetch(
          `/api/exams/teacher/submissions/${submissionId}?${params.toString()}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'فشل جلب تفاصيل التسليم');
        }
        if (!mountedRef.current) return;

        const detail = (data as SubmissionDetailResponse).submission;

        // Pre-populate grades from existing answer scores (manual types only)
        const initialGrades: Record<string, number> = {};
        detail.answers.forEach((a) => {
          if (MANUAL_TYPES.includes(a.question.type)) {
            if (a.score !== null && a.score !== undefined) {
              initialGrades[a.id] = a.score;
            }
          }
        });

        const t2 = setTimeout(() => {
          setGradingDetail(detail);
          setGrades(initialGrades);
        }, 0);
        void t2;
      } catch (err) {
        if (!mountedRef.current) return;
        const msg =
          err instanceof Error ? err.message : 'فشل جلب تفاصيل التسليم';
        const t = setTimeout(() => setGradingError(msg), 0);
        void t;
        toast.error(msg);
      } finally {
        if (!mountedRef.current) return;
        const t = setTimeout(() => setGradingLoading(false), 0);
        void t;
      }
    },
    [schoolId, teacherId]
  );

  // ===== Update a single grade =====
  const updateGrade = (answerId: string, score: number) => {
    const t = setTimeout(() => {
      setGrades((prev) => ({ ...prev, [answerId]: score }));
    }, 0);
    void t;
  };

  // ===== Compute total assigned score for the open dialog =====
  const dialogTotals = useMemo(() => {
    if (!gradingDetail) {
      return {
        assigned: 0,
        max: 0,
        percentage: 0,
        passingScore: 0,
        passed: false,
        ungradedManual: 0,
      };
    }
    let assigned = 0;
    let max = 0;
    let ungradedManual = 0;
    gradingDetail.answers.forEach((a) => {
      const points = a.maxScore || a.question.points || 0;
      max += points;
      if (MANUAL_TYPES.includes(a.question.type)) {
        const s = grades[a.id];
        if (s === undefined || Number.isNaN(s)) {
          ungradedManual += 1;
          // ungraded manual answers count as 0 in the preview
        } else {
          assigned += Math.max(0, Math.min(points, Number(s)));
        }
      } else {
        // MCQ/TRUE_FALSE — use existing auto-graded score
        assigned += a.score || 0;
      }
    });
    const examTotal = gradingDetail.exam.totalPoints || max;
    const passingScore = gradingDetail.exam.passingScore ?? 0;
    const percentage = examTotal > 0 ? (assigned / examTotal) * 100 : 0;
    return {
      assigned,
      max: examTotal,
      percentage: Math.round(percentage * 100) / 100,
      passingScore,
      passed: assigned >= passingScore,
      ungradedManual,
    };
  }, [gradingDetail, grades]);

  // ===== Save grades + finalize =====
  const handleSaveGrade = async () => {
    if (!gradingDetail || submitting) return;
    if (!mountedRef.current) return;

    // Confirm if there are ungraded manual answers
    if (dialogTotals.ungradedManual > 0) {
      const ok = window.confirm(
        `يوجد ${dialogTotals.ungradedManual} إجابة بدون درجة. سيتم احتسابها كصفر. هل تريد المتابعة؟`
      );
      if (!ok) return;
    }

    const t1 = setTimeout(() => setSubmitting(true), 0);
    void t1;
    try {
      const params = new URLSearchParams();
      params.set('schoolId', schoolId);
      params.set('teacherId', teacherId);

      // 1) Save each manual answer's score (POST /api/exams/teacher/answers/[ansId])
      const manualAnswers = gradingDetail.answers.filter((a) =>
        MANUAL_TYPES.includes(a.question.type)
      );

      const gradeResults = await Promise.allSettled(
        manualAnswers.map((a) => {
          const raw = grades[a.id];
          const score =
            raw === undefined || raw === null || Number.isNaN(raw)
              ? 0
              : Math.max(0, Math.min(a.maxScore || a.question.points || 0, Number(raw)));
          return fetch(
            `/api/exams/teacher/answers/${a.id}?${params.toString()}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ score }),
            }
          ).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || `فشل حفظ درجة إجابة (${a.id})`);
            }
          });
        })
      );

      const failures = gradeResults.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      if (failures.length > 0) {
        const firstErr =
          failures[0].reason instanceof Error
            ? failures[0].reason.message
            : 'فشل حفظ درجة أحد الإجابات';
        throw new Error(
          `فشل حفظ ${failures.length} من ${manualAnswers.length} إجابة: ${firstErr}`
        );
      }

      // 2) Finalize the submission (POST /api/exams/teacher/submissions/[subId]/finalize)
      const finalizeRes = await fetch(
        `/api/exams/teacher/submissions/${gradingDetail.id}/finalize?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: gradeNotes.trim() || undefined,
            force: true,
          }),
        }
      );
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalizeData?.error || 'فشل إنهاء التصحيح');
      }

      const result = (finalizeData as FinalizeResponse).result;
      toast.success(
        `تم حفظ الدرجة النهائية: ${result.totalScore}/${result.maxScore} (${Math.round(result.percentage)}%)`,
        {
          description: result.passed ? 'الطالب ناجح' : 'الطالب راسب',
        }
      );

      // Close dialog & refresh list
      const t2 = setTimeout(() => {
        setGradingOpen(false);
        setGradingDetail(null);
        setGrades({});
        setGradeNotes('');
      }, 0);
      void t2;

      fetchSubmissions(true);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'فشل حفظ الدرجة';
      toast.error(msg);
    } finally {
      if (!mountedRef.current) return;
      const t = setTimeout(() => setSubmitting(false), 0);
      void t;
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-fuchsia-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-fuchsia-300 transition-colors shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">العودة للوحة التحكم</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-r from-fuchsia-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold truncate">تصحيح الدرجات</h1>
                <p className="text-fuchsia-200 text-xs truncate">{teacherName}</p>
              </div>
            </div>
            <Button
              onClick={() => fetchSubmissions(false)}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white shrink-0"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {/* Page intro banner */}
        <div
          className={`mb-6 transition-all duration-700 ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute -inset-[2px] bg-gradient-to-r from-fuchsia-500 via-purple-500 to-rose-500 rounded-2xl blur-[1px] opacity-60" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-l from-fuchsia-700 via-purple-700 to-rose-700 p-6 md:p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center ring-4 ring-white/20 shrink-0">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold mb-1">تصحيح التسليمات</h2>
                      <p className="text-fuchsia-100/90 text-sm">
                        راجع إجابات الطلاب، صحّح الأسئلة المقالية، واحفظ النتائج النهائية
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {kpiConfig.map((k) => {
            const Icon = k.icon;
            const value = kpis[k.key];
            return (
              <Card
                key={k.key}
                className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow-md shrink-0`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-3xl font-bold text-[#2A374E] dark:text-white mb-0.5">
                      {loading && submissions.length === 0 ? '—' : value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {k.label}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters row */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="flex-1">
                <Label htmlFor="grading-search" className="sr-only">
                  بحث
                </Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="grading-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث باسم الطالب..."
                    className="pr-9 h-10"
                  />
                </div>
              </div>

              {/* Exam filter */}
              <div className="md:w-64">
                <Label htmlFor="grading-exam" className="sr-only">
                  الامتحان
                </Label>
                <Select
                  value={examFilter}
                  onValueChange={(v) => setExamFilter(v)}
                >
                  <SelectTrigger id="grading-exam" className="w-full h-10">
                    <SelectValue placeholder="كل الامتحانات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الامتحانات</SelectItem>
                    {examsWithPending.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Refresh button */}
              <Button
                onClick={() => fetchSubmissions(false)}
                variant="outline"
                className="h-10 border-fuchsia-200 dark:border-fuchsia-800 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {error && !loading && (
          <Card className="border-rose-200 dark:border-rose-800 shadow-sm mb-6">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="font-bold text-[#2A374E] dark:text-white mb-1">
                فشل تحميل التسليمات
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
              <Button
                onClick={() => fetchSubmissions(false)}
                className="bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading skeletons */}
        {loading && submissions.length === 0 && !error && (
          <div className="space-y-4 mb-6">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                    <Skeleton className="h-9 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredSubmissions.length === 0 && (
          <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700 shadow-sm mb-6">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="font-bold text-[#2A374E] dark:text-white text-lg mb-1">
                لا توجد تسليمات بانتظار التصحيح
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                رائع! لقد أكملت تصحيح كل التسليمات الحالية. عد لاحقاً للتحقق من وصول تسليمات جديدة.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submissions list */}
        {!error && filteredSubmissions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-fuchsia-600" />
                <h2 className="text-base font-bold text-[#2A374E] dark:text-white">
                  قائمة التسليمات
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredSubmissions.length}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1 teacher-grading-scroll">
              {filteredSubmissions.map((sub) => (
                <SubmissionCard
                  key={sub.id}
                  submission={sub}
                  onGrade={() => openGradingDialog(sub.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto bg-[#1a2332] text-white/70 text-center text-xs py-3">
        <div className="container mx-auto px-4 flex items-center justify-center gap-2 flex-wrap">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>تصحيح الدرجات</span>
          <span className="opacity-50">|</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Grading Dialog */}
      <Dialog
        open={gradingOpen}
        onOpenChange={(v) => {
          if (submitting) return; // don't allow closing mid-submit
          if (mountedRef.current) {
            const t = setTimeout(() => {
              setGradingOpen(v);
              if (!v) {
                setGradingDetail(null);
                setGrades({});
                setGradeNotes('');
                setGradingError(null);
              }
            }, 0);
            void t;
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0">
          {/* Header (sticky) */}
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-fuchsia-600" />
              تصحيح التسليم
            </DialogTitle>
            <DialogDescription className="text-xs">
              راجع إجابات الطالب، عيّن الدرجات، ثم احفظ النتيجة النهائية
            </DialogDescription>

            {/* Submission summary header */}
            {gradingDetail && (
              <div className="mt-3 rounded-lg bg-gradient-to-l from-fuchsia-50 to-purple-50 dark:from-fuchsia-900/20 dark:to-purple-900/20 p-3 border border-fuchsia-200 dark:border-fuchsia-800">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#2A374E] dark:text-white text-base leading-snug">
                      {gradingDetail.studentName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {gradingDetail.exam.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <Badge
                      className={`text-[10px] border ${submissionStatusBadgeClass(gradingDetail.status)}`}
                    >
                      {submissionStatusLabel(gradingDetail.status)}
                    </Badge>
                    {isSuspicious(gradingDetail) && (
                      <Badge className="text-[10px] border bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800">
                        <AlertOctagon className="w-3 h-3 ml-1" />
                        مشبوه
                      </Badge>
                    )}
                    {gradingDetail.appealsCount > 0 && (
                      <Badge className="text-[10px] border bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                        <Flag className="w-3 h-3 ml-1" />
                        {gradingDetail.appealsCount} طعن
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-fuchsia-500" />
                    تسليم: {formatArabicDate(gradingDetail.submittedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 text-violet-500" />
                    المحاولة: {gradingDetail.attemptNumber}
                  </span>
                  {isSuspicious(gradingDetail) && (
                    <>
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <Eye className="w-3.5 h-3.5" />
                        تبديل تبويب: {gradingDetail.tabSwitches}
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        نسخ: {gradingDetail.copyAttempts}
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <Eye className="w-3.5 h-3.5" />
                        فقد تركيز: {gradingDetail.focusEvents}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 teacher-grading-scroll">
            {/* Loading */}
            {gradingLoading && (
              <div className="space-y-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {/* Error */}
            {gradingError && !gradingLoading && (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="font-bold text-[#2A374E] dark:text-white mb-1">
                  فشل تحميل التفاصيل
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{gradingError}</p>
              </div>
            )}

            {/* Grading content */}
            {gradingDetail && !gradingLoading && !gradingError && (
              <div className="space-y-4">
                {/* Appeals notice */}
                {gradingDetail.appeals && gradingDetail.appeals.length > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-xs mb-2">
                      <Megaphone className="w-3.5 h-3.5" />
                      طعون الطالب ({gradingDetail.appeals.length})
                    </div>
                    <ul className="space-y-2">
                      {gradingDetail.appeals.map((ap) => (
                        <li
                          key={ap.id}
                          className="text-xs text-amber-800 dark:text-amber-200 bg-white/50 dark:bg-black/20 rounded p-2"
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <Badge
                              variant="outline"
                              className="text-[9px] border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                            >
                              {ap.status}
                            </Badge>
                            {ap.requestedScore !== null && (
                              <span className="text-[10px]">
                                الدرجة المطلوبة: {ap.requestedScore}
                              </span>
                            )}
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{ap.reason}</p>
                          {ap.teacherReply && (
                            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 italic">
                              رد المعلم: {ap.teacherReply}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Answers */}
                {gradingDetail.answers.length === 0 ? (
                  <div className="text-center py-6 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      لا توجد إجابات في هذا التسليم
                    </p>
                  </div>
                ) : (
                  gradingDetail.answers.map((ans, idx) => (
                    <AnswerCard
                      key={ans.id}
                      answer={ans}
                      index={idx}
                      score={grades[ans.id]}
                      onScoreChange={(s) => updateGrade(ans.id, s)}
                      disabled={submitting}
                    />
                  ))
                )}

                {/* Notes */}
                <div>
                  <Label
                    htmlFor="grade-notes"
                    className="text-sm font-bold text-[#2A374E] dark:text-white mb-1.5 flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-fuchsia-600" />
                    ملاحظات عامة (اختياري)
                  </Label>
                  <Textarea
                    id="grade-notes"
                    value={gradeNotes}
                    onChange={(e) => setGradeNotes(e.target.value)}
                    placeholder="ملاحظات للطالب بشأن التسليم بشكل عام..."
                    rows={2}
                    disabled={submitting}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer (sticky) */}
          {gradingDetail && !gradingLoading && !gradingError && (
            <DialogFooter className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                {/* Score summary */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-fuchsia-200 dark:border-fuchsia-800">
                    <Award className="w-4 h-4 text-fuchsia-600" />
                    <span className="text-sm font-bold text-[#2A374E] dark:text-white">
                      {dialogTotals.assigned}
                      <span className="text-gray-400 mx-0.5">/</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                        {dialogTotals.max}
                      </span>
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold ${
                      dialogTotals.passed
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {dialogTotals.passed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {dialogTotals.percentage}%
                    {dialogTotals.passed ? ' (ناجح)' : ' (راسب)'}
                  </div>
                  {dialogTotals.ungradedManual > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {dialogTotals.ungradedManual} إجابة بدون درجة (تُحسب كصفر)
                    </div>
                  )}
                </div>

                {/* Save button */}
                <Button
                  onClick={handleSaveGrade}
                  disabled={submitting}
                  className="bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white h-10 shrink-0"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      حفظ الدرجة
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .teacher-grading-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgb(217 70 239) transparent;
        }
        .teacher-grading-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .teacher-grading-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .teacher-grading-scroll::-webkit-scrollbar-thumb {
          background-color: rgb(217 70 239);
          border-radius: 9999px;
        }
        .teacher-grading-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgb(190 24 93);
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Sub-component: SubmissionCard
// ============================================================
function SubmissionCard({
  submission,
  onGrade,
}: {
  submission: SubmissionListItem;
  onGrade: () => void;
}) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-5">
        {/* Top: student name + badges */}
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-[#2A374E] dark:text-white text-base leading-snug break-words">
                {submission.studentName || 'طالب بدون اسم'}
              </h3>
              <Badge variant="outline" className="text-[10px] shrink-0">
                <RefreshCw className="w-3 h-3 ml-1" />
                محاولة {submission.attemptNumber}
              </Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-[10px] border bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                <FileText className="w-3 h-3 ml-1" />
                {submission.examTitle}
              </Badge>
              {submission.examSubject && (
                <Badge variant="outline" className="text-[10px]">
                  <BookOpen className="w-3 h-3 ml-1" />
                  {submission.examSubject}
                </Badge>
              )}
              {submission.examClassroomName && (
                <Badge variant="outline" className="text-[10px]">
                  <GraduationCap className="w-3 h-3 ml-1" />
                  {submission.examClassroomName}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <Badge
              className={`text-[10px] border ${submissionStatusBadgeClass(submission.status)}`}
            >
              {submissionStatusLabel(submission.status)}
            </Badge>
            {submission.appealsCount > 0 && (
              <Badge className="text-[10px] border bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                <Flag className="w-3 h-3 ml-1" />
                {submission.appealsCount} طعن
              </Badge>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-fuchsia-500" />
            <span>تسلّم: {formatArabicDateShort(submission.submittedAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-violet-500" />
            <span>{submission.answersCount} إجابة</span>
          </div>
          {submission.violationsCount > 0 && (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{submission.violationsCount} مخالفة</span>
            </div>
          )}
        </div>

        {/* Suspicious indicator */}
        {submission.suspicious && (
          <div className="mb-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 font-semibold mb-1">
              <AlertOctagon className="w-3.5 h-3.5" />
              نشاط مشبوه
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-rose-700 dark:text-rose-300">
              <span>تبديل تبويب: {submission.tabSwitches}</span>
              <span>محاولات نسخ: {submission.copyAttempts}</span>
              <span>فقد تركيز: {submission.focusEvents}</span>
            </div>
          </div>
        )}

        {/* Score (if already graded) */}
        {submission.status === 'GRADED' &&
          submission.totalScore !== null &&
          submission.maxScore !== null && (
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/20 border border-fuchsia-200 dark:border-fuchsia-800">
                <Award className="w-4 h-4 text-fuchsia-600" />
                <span className="text-sm font-bold text-[#2A374E] dark:text-white">
                  {submission.totalScore} / {submission.maxScore}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({Math.round(submission.percentage || 0)}%)
                </span>
              </div>
              <Badge
                className={`text-[10px] border ${
                  submission.passed
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                {submission.passed ? 'ناجح' : 'راسب'}
              </Badge>
            </div>
          )}

        {/* Action button */}
        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            onClick={onGrade}
            size="sm"
            className="bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white h-9"
          >
            <ClipboardCheck className="w-4 h-4" />
            تصحيح
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Sub-component: AnswerCard
// ============================================================
function AnswerCard({
  answer,
  index,
  score,
  onScoreChange,
  disabled,
}: {
  answer: SubmissionAnswer;
  index: number;
  score: number | undefined;
  onScoreChange: (score: number) => void;
  disabled: boolean;
}) {
  const q = answer.question;
  const isManual = MANUAL_TYPES.includes(q.type);
  const maxScore = answer.maxScore || q.points || 0;
  const isFlagged =
    answer.textModeration === 'FLAGGED' || answer.textModeration === 'BLOCKED';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Question header */}
      <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-rose-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <Badge className={`text-[10px] border ${questionTypeBadgeClass(q.type)}`}>
            {questionTypeLabel(q.type)}
          </Badge>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {q.points} نقطة
          </span>
        </div>
        {!isManual && answer.score !== null && (
          <Badge className="text-[10px] border bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 ml-1" />
            مصحح: {answer.score}/{maxScore}
          </Badge>
        )}
        {isFlagged && (
          <Badge className="text-[10px] border bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 ml-1" />
            مراجعة
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {/* Question text */}
        <p className="text-sm text-[#2A374E] dark:text-white leading-relaxed mb-3 whitespace-pre-wrap">
          {q.text}
        </p>

        {/* MCQ / TRUE_FALSE: show options with student's answer + correct */}
        {Array.isArray(q.options) && q.options.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {q.options.map((opt, i) => {
              const isCorrect = opt === q.correctAnswer;
              const isStudentChoice = opt === answer.textAnswer;
              const isWrongChoice = isStudentChoice && !isCorrect;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border ${
                    isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : isWrongChoice
                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white dark:bg-gray-900 border border-current text-[10px] font-bold flex items-center justify-center shrink-0">
                    {ARABIC_LETTERS[i] || String(i + 1)}
                  </span>
                  <span className="flex-1 break-words">{opt}</span>
                  {isCorrect && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  {isWrongChoice && (
                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                  {isStudentChoice && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-current/10 font-semibold">
                      إجابة الطالب
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Student's text answer (SHORT / ESSAY) */}
        {(q.type === 'SHORT' || q.type === 'ESSAY') && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1">
              <FileText className="w-3 h-3" />
              إجابة الطالب
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-2.5">
              {answer.textAnswer && answer.textAnswer.trim().length > 0 ? (
                <p className="text-sm text-[#2A374E] dark:text-white whitespace-pre-wrap leading-relaxed">
                  {answer.textAnswer}
                </p>
              ) : (
                <p className="text-xs text-gray-400 italic">لم يقدم الطالب إجابة نصية</p>
              )}
            </div>
          </div>
        )}

        {/* Image answer */}
        {q.type === 'IMAGE_ANSWER' && answer.imageAnswerUrl && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1">
              <ImageIcon className="w-3 h-3" />
              صورة الطالب
            </div>
            <div className="rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <img
                src={answer.imageAnswerUrl}
                alt="إجابة الطالب"
                className="w-full max-h-80 object-contain"
              />
            </div>
          </div>
        )}

        {/* PDF answer */}
        {q.type === 'FILE_PDF' && answer.fileAnswerUrl && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1">
              <PdfIcon className="w-3 h-3" />
              ملف الطالب (PDF)
            </div>
            <a
              href={answer.fileAnswerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
            >
              <PdfIcon className="w-3.5 h-3.5" />
              فتح الملف
            </a>
          </div>
        )}

        {/* AI suggested score (if any) */}
        {isManual && answer.aiSuggestedScore !== null && (
          <div className="mb-3 rounded-md bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-violet-700 dark:text-violet-300 font-semibold">
                <Sparkles className="w-3 h-3" />
                اقتراح AI: {answer.aiSuggestedScore} / {maxScore}
              </div>
              {answer.aiConfidence !== null && (
                <span className="text-[10px] text-violet-600 dark:text-violet-400">
                  ثقة: {Math.round((answer.aiConfidence || 0) * 100)}%
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                onClick={() => onScoreChange(Number(answer.aiSuggestedScore))}
                disabled={disabled}
              >
                اعتماد
              </Button>
            </div>
          </div>
        )}

        {/* Correct answer (for SHORT / ESSAY) */}
        {isManual && (q.correctAnswer || q.correctText) && (
          <div className="mb-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
              <CheckCircle2 className="w-3 h-3" />
              الإجابة النموذجية
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-200 whitespace-pre-wrap">
              {q.correctAnswer || q.correctText}
            </p>
          </div>
        )}

        {/* Explanation */}
        {q.explanation && (
          <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-semibold mb-1">
              <HelpCircle className="w-3 h-3" />
              الشرح
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
              {q.explanation}
            </p>
          </div>
        )}

        {/* Teacher grading input (manual types only) */}
        {isManual && (
          <div className="rounded-md bg-fuchsia-50/50 dark:bg-fuchsia-900/10 border border-fuchsia-200 dark:border-fuchsia-800 p-3">
            <Label
              htmlFor={`grade-${answer.id}`}
              className="text-xs font-bold text-[#2A374E] dark:text-white mb-2 flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-fuchsia-600" />
              درجة المعلم (0 — {maxScore})
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                id={`grade-${answer.id}`}
                type="number"
                min={0}
                max={maxScore}
                step="0.5"
                value={score === undefined ? '' : score}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    // leave undefined
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isNaN(n)) {
                    onScoreChange(Math.max(0, Math.min(maxScore, n)));
                  }
                }}
                disabled={disabled}
                className="w-24 h-9"
                placeholder="—"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  onClick={() => onScoreChange(maxScore)}
                  disabled={disabled}
                >
                  درجة كاملة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                  onClick={() => onScoreChange(maxScore / 2)}
                  disabled={disabled}
                >
                  نصف الدرجة
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  onClick={() => onScoreChange(0)}
                  disabled={disabled}
                >
                  صفر
                </Button>
              </div>
            </div>
            {answer.gradedAt && (
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
                مصحح سابقاً بواسطة {answer.gradedById || 'المعلم'} في{' '}
                {formatArabicDateShort(answer.gradedAt)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
