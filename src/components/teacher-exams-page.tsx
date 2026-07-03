'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight, RefreshCw, Search, FileText, ListChecks,
  ClipboardCheck, Clock, Award, Eye, AlertTriangle, Sparkles,
  CalendarDays, GraduationCap, CheckCircle2, XCircle, HelpCircle,
  ShieldCheck, Lock, BookOpen, Trophy, BarChart3,
  Plus, Trash2, Loader2, Save, Send, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface TeacherExamsPageProps {
  onBack: () => void;
  schoolId: string;
  teacherId: string;
  teacherName: string;
}

// ===== Types =====
type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
type TimeStatus = 'UPCOMING' | 'OPEN' | 'ENDED';

interface ExamListItem {
  id: string;
  title: string;
  subject: string;
  classroomName: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  status: ExamStatus;
  totalPoints: number;
  passingScore: number | null;
  maxAttempts: number;
  hasPassword: boolean;
  timeStatus: TimeStatus;
  submissionsCount: number;
  questionsCount: number;
}

interface ExamQuestion {
  id: string;
  type: string;
  text: string;
  options: string[] | null;
  correctAnswer: string | null;
  correctText: string | null;
  rubric: Record<string, unknown> | null;
  points: number;
  order: number;
  explanation: string | null;
  attachmentUrl: string | null;
  textModeration: string | null;
  imageModeration: string | null;
}

interface ExamDetail {
  id: string;
  title: string;
  description: string;
  subject: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string;
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
  status: ExamStatus;
  totalPoints: number;
  passingScore: number | null;
  createdAt: string;
  updatedAt: string;
  questionsCount: number;
  submissionsCount: number;
  questions: ExamQuestion[];
}

interface SubmissionsStats {
  total: number;
  inProgress: number;
  submitted: number;
  graded: number;
  autoClosed: number;
  needsGrading: number;
  suspiciousCount: number;
  avgScore: number;
}

interface ExamsListResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  exams: ExamListItem[];
}

interface ExamDetailResponse {
  success: boolean;
  exam: ExamDetail;
}

interface SubmissionsResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: SubmissionsStats;
  submissions: unknown[];
}

// ===== Create Exam types =====
type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY';

interface DraftQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string;
  correctText: string;
  rubric: string;
  points: number;
  explanation: string;
}

interface CreateExamForm {
  title: string;
  subject: string;
  description: string;
  classroomName: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  passingScore: number;
  password: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReview: boolean;
  showResultImmediately: boolean;
  parentVisible: boolean;
  antiCheatEnabled: boolean;
  questions: DraftQuestion[];
}

const ARABIC_OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

function optionLetter(i: number): string {
  return ARABIC_OPTION_LETTERS[i] || String(i + 1);
}

function makeEmptyQuestion(index: number): DraftQuestion {
  return {
    id: `q-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'MCQ',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    correctText: '',
    rubric: '',
    points: 1,
    explanation: '',
  };
}

function makeEmptyCreateForm(): CreateExamForm {
  return {
    title: '',
    subject: '',
    description: '',
    classroomName: '',
    startDate: '',
    endDate: '',
    durationMinutes: 60,
    passingScore: 50,
    password: '',
    shuffleQuestions: false,
    shuffleOptions: false,
    allowReview: true,
    showResultImmediately: false,
    parentVisible: false,
    antiCheatEnabled: true,
    questions: [],
  };
}

// ===== Helpers =====
function formatArabicDate(iso: string): string {
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

function formatArabicDateShort(iso: string): string {
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

function statusLabel(s: ExamStatus): string {
  switch (s) {
    case 'DRAFT': return 'مسودة';
    case 'PUBLISHED': return 'منشور';
    case 'CLOSED': return 'مغلق';
    case 'ARCHIVED': return 'مؤرشف';
    default: return s;
  }
}

function statusBadgeClass(s: ExamStatus): string {
  switch (s) {
    case 'DRAFT': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    case 'PUBLISHED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'CLOSED': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'ARCHIVED': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

function timeStatusLabel(t: TimeStatus): string {
  switch (t) {
    case 'UPCOMING': return 'قادم';
    case 'OPEN': return 'مفتوح الآن';
    case 'ENDED': return 'منتهي';
    default: return t;
  }
}

function timeStatusBadgeClass(t: TimeStatus): string {
  switch (t) {
    case 'UPCOMING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'OPEN': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'ENDED': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  }
}

function questionTypeLabel(t: string): string {
  switch (t) {
    case 'MCQ': return 'اختيار من متعدد';
    case 'TRUE_FALSE': return 'صح / خطأ';
    case 'SHORT': return 'إجابة قصيرة';
    case 'ESSAY': return 'سؤال مقالي';
    case 'IMAGE_ANSWER': return 'إجابة بصورة';
    case 'FILE_PDF': return 'ملف PDF';
    default: return t;
  }
}

function questionTypeBadgeClass(t: string): string {
  switch (t) {
    case 'MCQ': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800';
    case 'TRUE_FALSE': return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800';
    case 'SHORT': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'ESSAY': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'IMAGE_ANSWER': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'FILE_PDF': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

// ===== KPI Cards config =====
const kpiConfig = [
  {
    key: 'total',
    label: 'إجمالي الامتحانات',
    icon: FileText,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
  },
  {
    key: 'published',
    label: 'منشور',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    key: 'upcoming',
    label: 'قادم',
    icon: Clock,
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    key: 'submissions',
    label: 'إجمالي التسليمات',
    icon: ClipboardCheck,
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
  },
] as const;

export default function TeacherExamsPage({
  onBack,
  schoolId,
  teacherId,
  teacherName,
}: TeacherExamsPageProps) {
  // ===== State =====
  const [fadeIn, setFadeIn] = useState(false);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExamStatus>('all');

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailExam, setDetailExam] = useState<ExamDetail | null>(null);
  const [submissionsStats, setSubmissionsStats] = useState<SubmissionsStats | null>(null);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateExamForm>(makeEmptyCreateForm());
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

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

  // ===== Fetch exams =====
  const fetchExams = useCallback(async (silent: boolean = false) => {
    if (!mountedRef.current) return;
    if (!silent) {
      const t = setTimeout(() => setLoading(true), 0);
      void t;
    }
    if (!silent) {
      const t = setTimeout(() => setError(null), 0);
      void t;
    }
    try {
      const params = new URLSearchParams();
      params.set('schoolId', schoolId);
      params.set('teacherId', teacherId);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/exams/teacher?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'فشل جلب الامتحانات');
      }
      if (!mountedRef.current) return;
      const list = (data as ExamsListResponse).exams || [];
      const t = setTimeout(() => setExams(list), 0);
      void t;
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'فشل جلب الامتحانات';
      const t = setTimeout(() => setError(msg), 0);
      void t;
      if (!silent) toast.error(msg);
    } finally {
      if (!mountedRef.current) return;
      const t = setTimeout(() => setLoading(false), 0);
      void t;
    }
  }, [schoolId, teacherId, debouncedSearch, statusFilter]);

  // ===== Initial fetch + auto-refresh + focus =====
  useEffect(() => {
    fetchExams(false);
    const interval = setInterval(() => {
      fetchExams(true);
    }, 60_000);
    const onFocus = () => fetchExams(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [debouncedSearch, statusFilter, schoolId, teacherId]);

  // ===== Fetch exam detail =====
  const openExamDetail = useCallback(async (examId: string) => {
    if (!mountedRef.current) return;
    const t1 = setTimeout(() => {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError(null);
      setDetailExam(null);
      setSubmissionsStats(null);
    }, 0);
    void t1;
    try {
      const params = new URLSearchParams();
      params.set('schoolId', schoolId);
      params.set('teacherId', teacherId);

      const [examRes, subsRes] = await Promise.allSettled([
        fetch(`/api/exams/teacher/${examId}?${params.toString()}`),
        fetch(`/api/exams/teacher/${examId}/submissions?${params.toString()}&limit=1`),
      ]);

      if (!mountedRef.current) return;

      if (examRes.status === 'fulfilled') {
        const examData = await examRes.value.json();
        if (!examRes.value.ok) {
          throw new Error(examData?.error || 'فشل جلب تفاصيل الامتحان');
        }
        const t = setTimeout(() => setDetailExam((examData as ExamDetailResponse).exam), 0);
        void t;
      } else {
        throw new Error('فشل الاتصال بالخادم');
      }

      if (subsRes.status === 'fulfilled') {
        const subsData = await subsRes.value.json();
        if (subsRes.value.ok && subsData?.stats) {
          const t = setTimeout(() => setSubmissionsStats(subsData.stats as SubmissionsStats), 0);
          void t;
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'فشل جلب تفاصيل الامتحان';
      const t = setTimeout(() => setDetailError(msg), 0);
      void t;
      toast.error(msg);
    } finally {
      if (!mountedRef.current) return;
      const t = setTimeout(() => setDetailLoading(false), 0);
      void t;
    }
  }, [schoolId, teacherId]);

  // ===== Create exam handlers =====
  const updateCreateField = useCallback((patch: Partial<CreateExamForm>) => {
    setCreateForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const addQuestion = useCallback(() => {
    setCreateForm((prev) => ({
      ...prev,
      questions: [...prev.questions, makeEmptyQuestion(prev.questions.length)],
    }));
  }, []);

  const updateQuestion = useCallback((qid: string, patch: Partial<DraftQuestion>) => {
    setCreateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    }));
  }, []);

  const removeQuestion = useCallback((qid: string) => {
    setCreateForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== qid),
    }));
  }, []);

  const addOption = useCallback((qid: string) => {
    setCreateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qid || q.options.length >= 8) return q;
        return { ...q, options: [...q.options, ''] };
      }),
    }));
  }, []);

  const updateOption = useCallback((qid: string, optIndex: number, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qid) return q;
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        let newCorrect = q.correctAnswer;
        if (q.correctAnswer === q.options[optIndex]) {
          newCorrect = value;
        }
        return { ...q, options: newOptions, correctAnswer: newCorrect };
      }),
    }));
  }, []);

  const removeOption = useCallback((qid: string, optIndex: number) => {
    setCreateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qid || q.options.length <= 2) return q;
        const removedValue = q.options[optIndex];
        const newOptions = q.options.filter((_, i) => i !== optIndex);
        let newCorrect = q.correctAnswer;
        if (q.correctAnswer === removedValue) newCorrect = '';
        return { ...q, options: newOptions, correctAnswer: newCorrect };
      }),
    }));
  }, []);

  const resetCreateForm = useCallback(() => {
    setCreateForm(makeEmptyCreateForm());
    setCreateErrors({});
  }, []);

  const validateCreateForm = useCallback((): {
    ok: boolean;
    errors: Record<string, string>;
    message?: string;
  } => {
    const errors: Record<string, string> = {};
    const f = createForm;
    let message: string | undefined;

    if (!f.title.trim()) errors.title = 'عنوان الامتحان مطلوب';
    if (!f.subject.trim()) errors.subject = 'المادة مطلوبة';

    if (!f.startDate) errors.startDate = 'وقت الفتح مطلوب';
    if (!f.endDate) errors.endDate = 'وقت الإغلاق مطلوب';
    if (f.startDate && f.endDate) {
      const s = new Date(f.startDate);
      const e = new Date(f.endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s >= e) {
        errors.endDate = 'وقت الإغلاق يجب أن يكون بعد وقت الفتح';
      }
    }

    if (!f.durationMinutes || f.durationMinutes < 1) {
      errors.durationMinutes = 'المدة يجب أن تكون دقيقة على الأقل';
    }

    for (let i = 0; i < f.questions.length; i++) {
      const q = f.questions[i];
      const key = `q-${q.id}`;
      if (!q.text.trim()) {
        errors[key] = 'نص السؤال مطلوب';
        if (!message) message = `السؤال ${i + 1}: نص السؤال مطلوب`;
        continue;
      }
      if (q.type === 'MCQ') {
        const nonEmpty = q.options.filter((o) => o.trim().length > 0);
        if (nonEmpty.length < 2) {
          errors[key] = 'يتطلب خيارين على الأقل';
          if (!message) message = `السؤال ${i + 1}: يتطلب خيارين على الأقل`;
        } else if (!q.correctAnswer) {
          errors[key] = 'حدد الإجابة الصحيحة';
          if (!message) message = `السؤال ${i + 1}: حدد الإجابة الصحيحة`;
        }
      }
      if (q.type === 'TRUE_FALSE' && !q.correctAnswer) {
        errors[key] = 'حدد الإجابة الصحيحة';
        if (!message) message = `السؤال ${i + 1}: حدد الإجابة الصحيحة`;
      }
      if (q.points < 0 || q.points > 100) {
        errors[key] = 'الدرجة بين 0 و 100';
        if (!message) message = `السؤال ${i + 1}: الدرجة يجب أن تكون بين 0 و 100`;
      }
    }

    return { ok: Object.keys(errors).length === 0, errors, message };
  }, [createForm]);

  const submitCreate = useCallback(
    async (publish: boolean) => {
      const validation = validateCreateForm();
      if (!validation.ok) {
        setCreateErrors(validation.errors);
        toast.error(validation.message || 'يرجى تصحيح الأخطاء في النموذج');
        return;
      }

      setCreateErrors({});
      setCreateSubmitting(true);

      try {
        const f = createForm;
        const body: Record<string, unknown> = {
          title: f.title.trim(),
          subject: f.subject.trim(),
          startDate: new Date(f.startDate).toISOString(),
          endDate: new Date(f.endDate).toISOString(),
          durationMinutes: f.durationMinutes,
          shuffleQuestions: f.shuffleQuestions,
          shuffleOptions: f.shuffleOptions,
          allowReview: f.allowReview,
          showResultImmediately: f.showResultImmediately,
          parentVisible: f.parentVisible,
          antiCheatEnabled: f.antiCheatEnabled,
          passingScore: f.passingScore,
        };
        if (f.description.trim()) body.description = f.description.trim();
        if (f.classroomName.trim()) body.classroomName = f.classroomName.trim();
        if (f.password.trim()) body.password = f.password.trim();

        const questions = f.questions.map((q, i) => {
          const out: Record<string, unknown> = {
            type: q.type,
            text: q.text.trim(),
            points: q.points,
            order: i + 1,
          };
          if (q.type === 'MCQ') {
            out.options = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
            out.correctAnswer = q.correctAnswer;
          } else if (q.type === 'TRUE_FALSE') {
            out.correctAnswer = q.correctAnswer;
          } else if (q.type === 'SHORT') {
            if (q.correctText.trim()) out.correctText = q.correctText.trim();
          } else if (q.type === 'ESSAY') {
            if (q.rubric.trim()) out.rubric = { text: q.rubric.trim() };
          }
          if (q.explanation.trim()) out.explanation = q.explanation.trim();
          return out;
        });
        if (questions.length > 0) body.questions = questions;

        const params = new URLSearchParams();
        params.set('schoolId', schoolId);
        params.set('teacherId', teacherId);

        const res = await fetch(`/api/exams/teacher?${params.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'فشل إنشاء الامتحان');
        }

        const newExamId: string | undefined = data?.examId;

        if (publish && newExamId) {
          try {
            const pubRes = await fetch(
              `/api/exams/teacher/${newExamId}/publish?${params.toString()}`,
              { method: 'POST' }
            );
            const pubData = await pubRes.json();
            if (!pubRes.ok) {
              toast.warning(
                `تم حفظ الامتحان كمسودة، لكن فشل النشر: ${pubData?.error || 'خطأ غير معروف'}`
              );
            } else {
              toast.success('تم إنشاء الامتحان ونشره بنجاح');
            }
          } catch (pubErr) {
            const msg = pubErr instanceof Error ? pubErr.message : 'فشل النشر';
            toast.warning(`تم حفظ الامتحان كمسودة، لكن فشل النشر: ${msg}`);
          }
        } else {
          toast.success('تم حفظ الامتحان كمسودة');
        }

        if (mountedRef.current) {
          setShowCreateDialog(false);
          resetCreateForm();
        }
        fetchExams(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل إنشاء الامتحان';
        toast.error(msg);
      } finally {
        if (mountedRef.current) setCreateSubmitting(false);
      }
    },
    [createForm, validateCreateForm, schoolId, teacherId, fetchExams, resetCreateForm]
  );

  // ===== Compute KPIs =====
  const kpis = {
    total: exams.length,
    published: exams.filter((e) => e.status === 'PUBLISHED').length,
    upcoming: exams.filter((e) => e.timeStatus === 'UPCOMING').length,
    submissions: exams.reduce((sum, e) => sum + (e.submissionsCount || 0), 0),
  };

  // ===== Render =====
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-violet-300 transition-colors shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">العودة للوحة التحكم</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold truncate">إدارة الامتحانات</h1>
                <p className="text-violet-200 text-xs truncate">{teacherName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => setShowCreateDialog(true)}
                size="sm"
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white border-0 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">إنشاء امتحان جديد</span>
              </Button>
              <Button
                onClick={() => fetchExams(false)}
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
            <div className="absolute -inset-[2px] bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl blur-[1px] opacity-60" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-l from-violet-700 via-purple-700 to-fuchsia-700 p-6 md:p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center ring-4 ring-white/20 shrink-0">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold mb-1">إدارة الامتحانات الإلكترونية</h2>
                      <p className="text-violet-100/90 text-sm">
                        تابع امتحاناتك، التسليمات، والإحصائيات في مكان واحد
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiConfig.map((k) => {
            const Icon = k.icon;
            const value = kpis[k.key];
            return (
              <Card
                key={k.key}
                className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <CardContent className="p-5">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${k.gradient} flex items-center justify-center shadow-md mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-[#2A374E] dark:text-white mb-0.5">
                    {loading && exams.length === 0 ? '—' : value}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {k.label}
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
                <Label htmlFor="exam-search" className="sr-only">
                  بحث
                </Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    id="exam-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث بالعنوان أو المادة..."
                    className="pr-9 h-10"
                  />
                </div>
              </div>

              {/* Status filter */}
              <div className="md:w-48">
                <Label htmlFor="exam-status" className="sr-only">
                  الحالة
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as 'all' | ExamStatus)}
                >
                  <SelectTrigger id="exam-status" className="w-full h-10">
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

              {/* Refresh button */}
              <Button
                onClick={() => fetchExams(false)}
                variant="outline"
                className="h-10 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20"
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
              <h3 className="font-bold text-[#2A374E] dark:text-white mb-1">فشل تحميل الامتحانات</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
              <Button
                onClick={() => fetchExams(false)}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading skeletons */}
        {loading && exams.length === 0 && !error && (
          <div className="space-y-4 mb-6">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && exams.length === 0 && (
          <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700 shadow-sm mb-6">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center">
                <FileText className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="font-bold text-[#2A374E] dark:text-white text-lg mb-1">
                لا توجد امتحانات بعد
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                لم يتم العثور على امتحانات تطابق معايير البحث الحالية. حاول تعديل الفلاتر أو إنشاء امتحان جديد من خلال منشئ الامتحانات.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Exams list */}
        {!error && exams.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-violet-600" />
                <h2 className="text-base font-bold text-[#2A374E] dark:text-white">
                  قائمة الامتحانات
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {exams.length}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1 teacher-exams-scroll">
              {exams.map((exam) => (
                <Card
                  key={exam.id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <CardContent className="p-5">
                    {/* Top row: title + status badges */}
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-[#2A374E] dark:text-white text-base leading-snug break-words">
                            {exam.title}
                          </h3>
                          {exam.hasPassword && (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[10px] border ${questionTypeBadgeClass('MCQ')}`}>
                            <BookOpen className="w-3 h-3 ml-1" />
                            {exam.subject}
                          </Badge>
                          {exam.classroomName && (
                            <Badge variant="outline" className="text-[10px]">
                              <GraduationCap className="w-3 h-3 ml-1" />
                              {exam.classroomName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <Badge className={`text-[10px] border ${statusBadgeClass(exam.status)}`}>
                          {statusLabel(exam.status)}
                        </Badge>
                        <Badge className={`text-[10px] border ${timeStatusBadgeClass(exam.timeStatus)}`}>
                          {timeStatusLabel(exam.timeStatus)}
                        </Badge>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                      <div className="flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-violet-500" />
                        <span>{exam.questionsCount} سؤال</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClipboardCheck className="w-3.5 h-3.5 text-rose-500" />
                        <span>{exam.submissionsCount} تسليم</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{exam.durationMinutes} دقيقة</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-fuchsia-500" />
                        <span>{exam.totalPoints} نقطة</span>
                      </div>
                      {exam.passingScore !== null && (
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-emerald-500" />
                          <span>نجاح: {exam.passingScore}%</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.maxAttempts} محاولة</span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-3 flex-wrap">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span dir="auto">
                        {formatArabicDateShort(exam.startDate)} ← {formatArabicDateShort(exam.endDate)}
                      </span>
                    </div>

                    {/* Action button */}
                    <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        onClick={() => openExamDetail(exam.id)}
                        size="sm"
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white h-9"
                      >
                        <Eye className="w-4 h-4" />
                        عرض التفاصيل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto bg-[#1a2332] text-white/70 text-center text-xs py-3">
        <div className="container mx-auto px-4 flex items-center justify-center gap-2 flex-wrap">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>إدارة الامتحانات</span>
          <span className="opacity-50">|</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={(v) => {
        if (mountedRef.current) {
          const t = setTimeout(() => setDetailOpen(v), 0);
          void t;
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-600" />
              تفاصيل الامتحان
            </DialogTitle>
            <DialogDescription className="text-xs">
              عرض كامل لمعلومات الامتحان، الأسئلة، والإحصائيات
            </DialogDescription>
          </DialogHeader>

          {/* Detail body (scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 teacher-exams-scroll">
            {/* Loading */}
            {detailLoading && (
              <div className="space-y-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
                <Skeleton className="h-32 w-full mt-4" />
              </div>
            )}

            {/* Error */}
            {detailError && !detailLoading && (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="font-bold text-[#2A374E] dark:text-white mb-1">فشل تحميل التفاصيل</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{detailError}</p>
              </div>
            )}

            {/* Detail content */}
            {detailExam && !detailLoading && !detailError && (
              <div className="space-y-5">
                {/* Title block */}
                <div className="rounded-xl bg-gradient-to-l from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20 p-4 border border-violet-200 dark:border-violet-800">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                    <h3 className="text-lg font-bold text-[#2A374E] dark:text-white leading-snug">
                      {detailExam.title}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`text-[10px] border ${statusBadgeClass(detailExam.status)}`}>
                        {statusLabel(detailExam.status)}
                      </Badge>
                      <Badge className={`text-[10px] border ${timeStatusBadgeClass(
                        new Date() < new Date(detailExam.startDate)
                          ? 'UPCOMING'
                          : new Date() > new Date(detailExam.endDate)
                          ? 'ENDED'
                          : 'OPEN'
                      )}`}>
                        {timeStatusLabel(
                          new Date() < new Date(detailExam.startDate)
                            ? 'UPCOMING'
                            : new Date() > new Date(detailExam.endDate)
                            ? 'ENDED'
                            : 'OPEN'
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge className={`text-[10px] border ${questionTypeBadgeClass('MCQ')}`}>
                      <BookOpen className="w-3 h-3 ml-1" />
                      {detailExam.subject}
                    </Badge>
                    {detailExam.classroomName && (
                      <Badge variant="outline" className="text-[10px]">
                        <GraduationCap className="w-3 h-3 ml-1" />
                        {detailExam.classroomName}
                      </Badge>
                    )}
                    {detailExam.hasPassword && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <Lock className="w-3 h-3 ml-1" />
                        محمي بكلمة سر
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description */}
                {detailExam.description && (
                  <div>
                    <h4 className="text-sm font-bold text-[#2A374E] dark:text-white mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-violet-600" />
                      الوصف
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                      {detailExam.description}
                    </p>
                  </div>
                )}

                {/* Dates & duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                      تاريخ البدء
                    </div>
                    <p className="text-sm font-medium text-[#2A374E] dark:text-white" dir="auto">
                      {formatArabicDate(detailExam.startDate)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <CalendarDays className="w-3.5 h-3.5 text-rose-500" />
                      تاريخ الانتهاء
                    </div>
                    <p className="text-sm font-medium text-[#2A374E] dark:text-white" dir="auto">
                      {formatArabicDate(detailExam.endDate)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Clock className="w-3.5 h-3.5 text-violet-500" />
                      المدة
                    </div>
                    <p className="text-sm font-medium text-[#2A374E] dark:text-white">
                      {detailExam.durationMinutes} دقيقة
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <Award className="w-3.5 h-3.5 text-fuchsia-500" />
                      إجمالي النقاط
                    </div>
                    <p className="text-sm font-medium text-[#2A374E] dark:text-white">
                      {detailExam.totalPoints} نقطة
                      {detailExam.passingScore !== null && (
                        <span className="text-xs text-gray-500 mr-2">
                          (نجاح: {detailExam.passingScore}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Settings */}
                <div>
                  <h4 className="text-sm font-bold text-[#2A374E] dark:text-white mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-violet-600" />
                    الإعدادات
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <SettingChip label="خلط الأسئلة" enabled={detailExam.shuffleQuestions} />
                    <SettingChip label="خلط الخيارات" enabled={detailExam.shuffleOptions} />
                    <SettingChip label="السماح بالمراجعة" enabled={detailExam.allowReview} />
                    <SettingChip label="إظهار النتيجة فوراً" enabled={detailExam.showResultImmediately} />
                    <SettingChip label="ظاهر لأولياء الأمور" enabled={detailExam.parentVisible} />
                    <SettingChip label="مكافحة الغش" enabled={detailExam.antiCheatEnabled} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                      <RefreshCw className="w-3 h-3" />
                      {detailExam.maxAttempts} محاولة كحد أقصى
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                      <FileText className="w-3 h-3" />
                      حد الملف: {detailExam.maxFileSizeMb}MB
                    </span>
                  </div>
                </div>

                {/* Submissions summary */}
                {submissionsStats && (
                  <div>
                    <h4 className="text-sm font-bold text-[#2A374E] dark:text-white mb-2 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-rose-600" />
                      ملخص التسليمات
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <StatBox label="إجمالي التسليمات" value={submissionsStats.total} color="violet" />
                      <StatBox label="قيد التنفيذ" value={submissionsStats.inProgress} color="amber" />
                      <StatBox label="مُسلَّمة" value={submissionsStats.submitted} color="fuchsia" />
                      <StatBox label="مصححة" value={submissionsStats.graded} color="emerald" />
                      <StatBox label="بانتظار التصحيح" value={submissionsStats.needsGrading} color="rose" />
                      <StatBox
                        label="متوسط الدرجة"
                        value={`${Math.round(submissionsStats.avgScore || 0)}%`}
                        color="violet"
                      />
                    </div>
                  </div>
                )}

                {/* Questions list */}
                <div>
                  <h4 className="text-sm font-bold text-[#2A374E] dark:text-white mb-2 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-violet-600" />
                    الأسئلة ({detailExam.questions.length})
                  </h4>
                  {detailExam.questions.length === 0 ? (
                    <div className="text-center py-6 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        لا توجد أسئلة في هذا الامتحان بعد
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailExam.questions.map((q, idx) => (
                        <QuestionCard key={q.id} question={q} index={idx} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Exam Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(v) => {
          if (!createSubmitting) {
            setShowCreateDialog(v);
            if (!v) resetCreateForm();
          }
        }}
      >
        <DialogContent
          className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0"
          onPointerDownOutside={(e) => {
            if (createSubmitting) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (createSubmitting) e.preventDefault();
          }}
        >
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-600" />
              إنشاء امتحان جديد
            </DialogTitle>
            <DialogDescription className="text-xs">
              املأ بيانات الامتحان الأساسية، ثم أضف الأسئلة. يمكنك الحفظ كمسودة أو النشر مباشرةً.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto p-6 teacher-exams-scroll">
            <div className="space-y-6">
              {/* Section 1: Basic exam data */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-[#2A374E] dark:text-white">
                    بيانات الامتحان الأساسية
                  </h3>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="ce-title" className="text-sm font-medium">
                    عنوان الامتحان <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="ce-title"
                    value={createForm.title}
                    onChange={(e) => updateCreateField({ title: e.target.value })}
                    placeholder="مثال: امتحان الفصل الأول - الرياضيات"
                    className={createErrors.title ? 'border-rose-400' : ''}
                  />
                  {createErrors.title && (
                    <p className="text-xs text-rose-500">{createErrors.title}</p>
                  )}
                </div>

                {/* Subject + Classroom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-subject" className="text-sm font-medium">
                      المادة <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="ce-subject"
                      value={createForm.subject}
                      onChange={(e) => updateCreateField({ subject: e.target.value })}
                      placeholder="مثال: الرياضيات"
                      className={createErrors.subject ? 'border-rose-400' : ''}
                    />
                    {createErrors.subject && (
                      <p className="text-xs text-rose-500">{createErrors.subject}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-classroom" className="text-sm font-medium">
                      الفصل المستهدف
                    </Label>
                    <Input
                      id="ce-classroom"
                      value={createForm.classroomName}
                      onChange={(e) => updateCreateField({ classroomName: e.target.value })}
                      placeholder="مثال: الصف السادس - أ"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="ce-desc" className="text-sm font-medium">
                    الوصف
                  </Label>
                  <Textarea
                    id="ce-desc"
                    value={createForm.description}
                    onChange={(e) => updateCreateField({ description: e.target.value })}
                    placeholder="وصف مختصر للامتحان (اختياري)"
                    rows={2}
                  />
                </div>

                {/* Start + End dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-start" className="text-sm font-medium">
                      وقت الفتح <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="ce-start"
                      type="datetime-local"
                      value={createForm.startDate}
                      onChange={(e) => updateCreateField({ startDate: e.target.value })}
                      className={createErrors.startDate ? 'border-rose-400' : ''}
                    />
                    {createErrors.startDate && (
                      <p className="text-xs text-rose-500">{createErrors.startDate}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-end" className="text-sm font-medium">
                      وقت الإغلاق <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="ce-end"
                      type="datetime-local"
                      value={createForm.endDate}
                      onChange={(e) => updateCreateField({ endDate: e.target.value })}
                      className={createErrors.endDate ? 'border-rose-400' : ''}
                    />
                    {createErrors.endDate && (
                      <p className="text-xs text-rose-500">{createErrors.endDate}</p>
                    )}
                  </div>
                </div>

                {/* Duration + Passing score */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-duration" className="text-sm font-medium">
                      المدة بالدقائق <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="ce-duration"
                      type="number"
                      min={1}
                      value={createForm.durationMinutes}
                      onChange={(e) =>
                        updateCreateField({ durationMinutes: parseInt(e.target.value) || 0 })
                      }
                      className={createErrors.durationMinutes ? 'border-rose-400' : ''}
                    />
                    {createErrors.durationMinutes && (
                      <p className="text-xs text-rose-500">{createErrors.durationMinutes}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ce-passing" className="text-sm font-medium">
                      درجة النجاح (%)
                    </Label>
                    <Input
                      id="ce-passing"
                      type="number"
                      min={0}
                      max={100}
                      value={createForm.passingScore}
                      onChange={(e) =>
                        updateCreateField({ passingScore: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="ce-password" className="text-sm font-medium">
                    كلمة سر الدخول (اختياري)
                  </Label>
                  <Input
                    id="ce-password"
                    type="text"
                    value={createForm.password}
                    onChange={(e) => updateCreateField({ password: e.target.value })}
                    placeholder="اتركها فارغة لعدم الحماية (4 أحرف على الأقل)"
                  />
                </div>

                {/* Settings toggles */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الإعدادات</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <ToggleRow
                      label="خلط الأسئلة"
                      checked={createForm.shuffleQuestions}
                      onCheckedChange={(v) => updateCreateField({ shuffleQuestions: v })}
                    />
                    <ToggleRow
                      label="خلط الخيارات"
                      checked={createForm.shuffleOptions}
                      onCheckedChange={(v) => updateCreateField({ shuffleOptions: v })}
                    />
                    <ToggleRow
                      label="السماح بالمراجعة"
                      checked={createForm.allowReview}
                      onCheckedChange={(v) => updateCreateField({ allowReview: v })}
                    />
                    <ToggleRow
                      label="إظهار النتيجة فوراً"
                      checked={createForm.showResultImmediately}
                      onCheckedChange={(v) => updateCreateField({ showResultImmediately: v })}
                    />
                    <ToggleRow
                      label="ظاهر لأولياء الأمور"
                      checked={createForm.parentVisible}
                      onCheckedChange={(v) => updateCreateField({ parentVisible: v })}
                    />
                    <ToggleRow
                      label="مكافحة الغش"
                      checked={createForm.antiCheatEnabled}
                      onCheckedChange={(v) => updateCreateField({ antiCheatEnabled: v })}
                    />
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700" />

              {/* Section 2: Questions */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center shrink-0">
                      <ListChecks className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-[#2A374E] dark:text-white">
                      الأسئلة ({createForm.questions.length})
                    </h3>
                  </div>
                  <Button
                    type="button"
                    onClick={addQuestion}
                    size="sm"
                    variant="outline"
                    className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة سؤال
                  </Button>
                </div>

                {createForm.questions.length === 0 ? (
                  <div className="text-center py-8 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      يمكنك إضافة الأسئلة لاحقاً من تعديل الامتحان
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {createForm.questions.map((q, qIdx) => (
                      <DraftQuestionCard
                        key={q.id}
                        question={q}
                        index={qIdx}
                        error={createErrors[`q-${q.id}`]}
                        onChange={(patch) => updateQuestion(q.id, patch)}
                        onRemove={() => removeQuestion(q.id)}
                        onAddOption={() => addOption(q.id)}
                        onUpdateOption={(oi, val) => updateOption(q.id, oi, val)}
                        onRemoveOption={(oi) => removeOption(q.id, oi)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => submitCreate(true)}
              disabled={createSubmitting}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg"
            >
              {createSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              نشر الامتحان
            </Button>
            <Button
              type="button"
              onClick={() => submitCreate(false)}
              disabled={createSubmitting}
              variant="outline"
              className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20"
            >
              {createSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ المسودة
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!createSubmitting) {
                  setShowCreateDialog(false);
                  resetCreateForm();
                }
              }}
              variant="ghost"
              disabled={createSubmitting}
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom scrollbar styles (scoped via Tailwind class + global tag) */}
      <style jsx global>{`
        .teacher-exams-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgb(167 139 250) transparent;
        }
        .teacher-exams-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .teacher-exams-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .teacher-exams-scroll::-webkit-scrollbar-thumb {
          background-color: rgb(167 139 250);
          border-radius: 9999px;
        }
        .teacher-exams-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgb(139 92 246);
        }
      `}</style>
    </div>
  );
}

// ===== Sub-components =====

function SettingChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
        enabled
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
      }`}
    >
      {enabled ? (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: 'violet' | 'emerald' | 'amber' | 'rose' | 'fuchsia';
}) {
  const colorMap: Record<string, string> = {
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    fuchsia: 'bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800',
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <div className="text-lg font-bold mb-0.5">{value}</div>
      <div className="text-[10px] opacity-90">{label}</div>
    </div>
  );
}

function QuestionCard({ question, index }: { question: ExamQuestion; index: number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Question header */}
      <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <Badge className={`text-[10px] border ${questionTypeBadgeClass(question.type)}`}>
            {questionTypeLabel(question.type)}
          </Badge>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {question.points} نقطة
          </span>
        </div>
      </div>

      {/* Question text */}
      <div className="p-3">
        <p className="text-sm text-[#2A374E] dark:text-white leading-relaxed mb-3 whitespace-pre-wrap">
          {question.text}
        </p>

        {/* Options (MCQ / TRUE_FALSE) */}
        {Array.isArray(question.options) && question.options.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {question.options.map((opt, i) => {
              const isCorrect = opt === question.correctAnswer;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border ${
                    isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white dark:bg-gray-900 border border-current text-[10px] font-bold flex items-center justify-center shrink-0">
                    {String.fromCharCode(1571 + i)}
                  </span>
                  <span className="flex-1 break-words">{opt}</span>
                  {isCorrect && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Correct text (SHORT / ESSAY) */}
        {!Array.isArray(question.options) || question.options.length === 0 ? (
          question.correctAnswer || question.correctText ? (
            <div className="mb-3 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
                <CheckCircle2 className="w-3 h-3" />
                الإجابة الصحيحة
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 whitespace-pre-wrap">
                {question.correctAnswer || question.correctText}
              </p>
            </div>
          ) : null
        ) : null}

        {/* Explanation */}
        {question.explanation && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-semibold mb-1">
              <HelpCircle className="w-3 h-3" />
              الشرح
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
              {question.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Create Exam sub-components =====

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
      <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function DraftQuestionCard({
  question: q,
  index,
  error,
  onChange,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: {
  question: DraftQuestion;
  index: number;
  error?: string;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (optIndex: number, value: string) => void;
  onRemoveOption: (optIndex: number) => void;
}) {
  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        error
          ? 'border-rose-300 dark:border-rose-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <Select
            value={q.type}
            onValueChange={(v) => onChange({ type: v as QuestionType })}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MCQ">اختيار من متعدد</SelectItem>
              <SelectItem value="TRUE_FALSE">صح / خطأ</SelectItem>
              <SelectItem value="SHORT">إجابة قصيرة</SelectItem>
              <SelectItem value="ESSAY">سؤال مقالي</SelectItem>
            </SelectContent>
          </Select>
          {error && (
            <span className="text-xs text-rose-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={q.points}
              onChange={(e) => onChange({ points: parseInt(e.target.value) || 0 })}
              className="w-16 h-8 text-xs"
            />
            <span className="text-xs text-amber-600 dark:text-amber-400">نقطة</span>
          </div>
          <Button
            type="button"
            onClick={onRemove}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Question text */}
        <Textarea
          value={q.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="نص السؤال..."
          rows={2}
          className={error && !q.text.trim() ? 'border-rose-400' : ''}
        />

        {/* MCQ options */}
        {q.type === 'MCQ' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              الخيارات (اضغط على الحرف لتحديد الإجابة الصحيحة):
            </p>
            {q.options.map((opt, oi) => {
              const isCorrect = !!q.correctAnswer && q.correctAnswer === opt && opt.trim().length > 0;
              return (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ correctAnswer: opt })}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isCorrect
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-emerald-400'
                    }`}
                    aria-label={`تحديد كإجابة صحيحة: ${optionLetter(oi)}`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      optionLetter(oi)
                    )}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => onUpdateOption(oi, e.target.value)}
                    placeholder={`الخيار ${optionLetter(oi)}`}
                    className="flex-1 h-8 text-sm"
                  />
                  {q.options.length > 2 && (
                    <Button
                      type="button"
                      onClick={() => onRemoveOption(oi)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {q.options.length < 8 && (
              <Button
                type="button"
                onClick={onAddOption}
                size="sm"
                variant="ghost"
                className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة خيار
              </Button>
            )}
          </div>
        )}

        {/* TRUE_FALSE */}
        {q.type === 'TRUE_FALSE' && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 dark:text-gray-400">الإجابة الصحيحة:</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ correctAnswer: 'true' })}
                className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  q.correctAnswer === 'true'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                صحيح
              </button>
              <button
                type="button"
                onClick={() => onChange({ correctAnswer: 'false' })}
                className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  q.correctAnswer === 'false'
                    ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-500 text-rose-700 dark:text-rose-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-rose-400'
                }`}
              >
                <XCircle className="w-4 h-4" />
                خطأ
              </button>
            </div>
          </div>
        )}

        {/* SHORT */}
        {q.type === 'SHORT' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 dark:text-gray-400">الإجابة النموذجية</Label>
            <Input
              value={q.correctText}
              onChange={(e) => onChange({ correctText: e.target.value })}
              placeholder="الإجابة الصحيحة (اختياري)"
              className="h-9 text-sm"
            />
          </div>
        )}

        {/* ESSAY */}
        {q.type === 'ESSAY' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500 dark:text-gray-400">معايير التصحيح</Label>
            <Textarea
              value={q.rubric}
              onChange={(e) => onChange({ rubric: e.target.value })}
              placeholder="معايير تصحيح السؤال المقالي (اختياري)..."
              rows={2}
            />
          </div>
        )}

        {/* Explanation */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500 dark:text-gray-400">تفسير الإجابة (اختياري)</Label>
          <Textarea
            value={q.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="شرح يظهر للطالب بعد التصحيح..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
