'use client';

/**
 * ============================================================
 *  صفحة نتائج الامتحانات لولي الأمر
 *  Parent Exam Results Page
 * ============================================================
 *  يجلب البيانات من:
 *    GET /api/parent/exams?schoolId=X&studentId=Y
 *
 *  المميزات:
 *    • تخطيط RTL، ألوان زمردی/تركوازی (مطابقة لبوابة أولياء الأمور)
 *    • تذييل لاصق في أسفل الشاشة (min-h-screen flex flex-col + mt-auto)
 *    • تحميل تلقائي عند التركيب + كل 60 ثانية + عند التركيز على النافذة
 *    • بحث فوري (300ms debounce) + فلتر حالة (الكل / تم التصحيح / بانتظار)
 *    • 4 بطاقات KPI: إجمالي / ناجح / راسب / متوسط النسبة المئوية
 *    • قائمة التسليمات مع شارات الحالة + النسبة + النجاح/الرسوب
 *    • نافذة تفاصيل مبسّطة (معلومات + نتيجة بدون تفصيل الأسئلة)
 *    • مرجع mountedRef لمنع setState بعد فك التركيب
 *    • set-state-in-effect: setState داخل useEffect عبر setTimeout(0)
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight, RefreshCw, Search, FileText, ListChecks,
  CheckCircle2, XCircle, Clock, Eye, AlertTriangle, Sparkles,
  CalendarDays, GraduationCap, Award, BarChart3,
  Hash, Info, UserX, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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

// ===== Types =====

interface ParentExamsPageProps {
  onBack: () => void;
  schoolId: string;
  child: {
    id: string;
    name: string;
    studentNumber: string;
    classroomName?: string | null;
    gradeName?: string | null;
  };
}

type SubmissionStatus = 'SUBMITTED' | 'GRADED' | 'AUTO_CLOSED';

interface SubmissionResult {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  classroomName: string;
  submittedAt: string | null;
  status: string;
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  gradedAt: string | null;
  attemptNumber: number;
  durationMinutes: number;
  examEndDate: string;
}

interface ExamsApiResponse {
  success: boolean;
  count: number;
  student: {
    id: string;
    name: string;
    studentNumber: string;
    classroomName?: string | null;
    gradeName?: string | null;
  };
  submissions: SubmissionResult[];
}

// ===== Helpers =====

function formatArabicDate(iso: string | null): string {
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

function formatArabicDateShort(iso: string | null): string {
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

function statusLabel(s: string): string {
  switch (s) {
    case 'GRADED': return 'تم التصحيح';
    case 'SUBMITTED': return 'بانتظار التصحيح';
    case 'AUTO_CLOSED': return 'أُغلق تلقائياً';
    default: return s;
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case 'GRADED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'SUBMITTED': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'AUTO_CLOSED': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
}

// ===== KPI Cards config =====
const kpiConfig = [
  {
    key: 'total',
    label: 'إجمالي الامتحانات',
    icon: FileText,
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    key: 'passed',
    label: 'ناجح',
    icon: CheckCircle2,
    gradient: 'from-teal-500 to-emerald-600',
    bg: 'bg-teal-50 dark:bg-teal-900/20',
  },
  {
    key: 'failed',
    label: 'راسب',
    icon: XCircle,
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
  },
  {
    key: 'avg',
    label: 'متوسط النسبة المئوية',
    icon: BarChart3,
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
] as const;

// ===== Main Component =====

export default function ParentExamsPage({
  onBack,
  schoolId,
  child,
}: ParentExamsPageProps) {
  // ===== State =====
  const [fadeIn, setFadeIn] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'graded' | 'pending'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSubmission, setDetailSubmission] = useState<SubmissionResult | null>(null);

  // Mounted ref (prevent setState after unmount)
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ===== Debounced search (300ms) =====
  useEffect(() => {
    const t = setTimeout(() => {
      if (mountedRef.current) setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ===== Fetch submissions =====
  const childId = child.id;
  const fetchSubmissions = useCallback(async (silent: boolean = false) => {
    if (!mountedRef.current) return;
    if (!schoolId || !childId) return;

    if (!silent) {
      const t = setTimeout(() => setLoading(true), 0);
      void t;
      const t2 = setTimeout(() => setError(null), 0);
      void t2;
      const t3 = setTimeout(() => setNotFound(false), 0);
      void t3;
    }

    try {
      const params = new URLSearchParams();
      params.set('schoolId', schoolId);
      params.set('studentId', childId);
      params.set('limit', '200');

      const res = await fetch(`/api/parent/exams?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (res.status === 404) {
        if (!mountedRef.current) return;
        const t = setTimeout(() => {
          setNotFound(true);
          setError(null);
          setSubmissions([]);
          setLoading(false);
          setLastUpdated(new Date());
        }, 0);
        void t;
        return;
      }

      if (!res.ok) {
        let msg = 'فشل جلب نتائج الامتحانات';
        try {
          const j = await res.json();
          if (j?.error) msg = typeof j.error === 'string' ? j.error : msg;
        } catch { /* noop */ }
        throw new Error(msg);
      }

      const data = (await res.json()) as ExamsApiResponse;
      if (!mountedRef.current) return;

      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      const t = setTimeout(() => {
        setSubmissions(list);
        setError(null);
        setNotFound(false);
        setLoading(false);
        setLastUpdated(new Date());
      }, 0);
      void t;
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'فشل جلب نتائج الامتحانات';
      const t = setTimeout(() => {
        setError(msg);
        setNotFound(false);
        setLoading(false);
      }, 0);
      void t;
      if (!silent) toast.error(msg);
    }
  }, [schoolId, childId]);

  // ===== Initial fetch + auto-refresh + focus =====
  useEffect(() => {
    if (!schoolId || !childId) return;
    // set-state-in-effect: defer to avoid lint warnings during render
    const t = setTimeout(() => {
      fetchSubmissions(false);
    }, 0);
    intervalRef.current = setInterval(() => {
      fetchSubmissions(true);
    }, 60_000);

    const onFocus = () => fetchSubmissions(true);
    window.addEventListener('focus', onFocus);
    const visHandler = () => {
      if (document.visibilityState === 'visible') fetchSubmissions(true);
    };
    document.addEventListener('visibilitychange', visHandler);

    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [fetchSubmissions, schoolId, childId]);

  // ===== Filtered submissions (client-side search + status filter) =====
  const filteredSubmissions = submissions.filter((s) => {
    // Status filter
    if (statusFilter === 'graded' && s.status !== 'GRADED') return false;
    if (statusFilter === 'pending' && s.status === 'GRADED') return false;

    // Search filter (by examTitle or subject)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      const title = (s.examTitle || '').toLowerCase();
      const subject = (s.subject || '').toLowerCase();
      if (!title.includes(q) && !subject.includes(q)) return false;
    }
    return true;
  });

  // ===== Compute KPIs =====
  const gradedSubs = submissions.filter((s) => s.status === 'GRADED');
  const passedCount = gradedSubs.filter((s) => s.passed === true).length;
  const failedCount = gradedSubs.filter((s) => s.passed === false).length;
  const avgPercentage =
    gradedSubs.length > 0
      ? Math.round(
          gradedSubs.reduce((sum, s) => sum + (s.percentage ?? 0), 0) /
            gradedSubs.length
        )
      : 0;

  const kpis = {
    total: submissions.length,
    passed: passedCount,
    failed: failedCount,
    avg: avgPercentage,
  };

  // ===== Open detail dialog =====
  const openDetail = useCallback((sub: SubmissionResult) => {
    if (!mountedRef.current) return;
    const t = setTimeout(() => {
      setDetailSubmission(sub);
      setDetailOpen(true);
    }, 0);
    void t;
  }, []);

  // ===== Render =====
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-[1280px]">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-emerald-300 transition-colors shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">العودة للوحة التحكم</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold truncate">نتائج الامتحانات</h1>
                <p className="text-emerald-200 text-xs truncate">{child.name}</p>
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

      <main className="flex-1 container mx-auto px-4 py-6 max-w-[1280px] w-full">
        {/* Child info bar */}
        <Card className="mb-6 border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-base text-[#2A374E] dark:text-white">
                    {child.name}
                  </h2>
                  <Badge variant="outline" className="text-[10px]">
                    <Hash className="w-3 h-3 ml-1" />
                    {child.studentNumber}
                  </Badge>
                  {child.classroomName && (
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 border">
                      <GraduationCap className="w-3 h-3 ml-1" />
                      {child.classroomName}
                    </Badge>
                  )}
                  {child.gradeName && (
                    <Badge variant="outline" className="text-[10px]">
                      {child.gradeName}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  متابعة نتائج الامتحانات الإلكترونية
                </p>
              </div>
              {lastUpdated && (
                <div className="text-[11px] text-muted-foreground hidden md:flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  آخر تحديث: {formatArabicDateShort(lastUpdated.toISOString())}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Page intro banner */}
        <div
          className={`mb-6 transition-all duration-700 ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute -inset-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-2xl blur-[1px] opacity-60" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-l from-emerald-700 via-teal-700 to-emerald-700 p-6 md:p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center ring-4 ring-white/20 shrink-0">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold mb-1">نتائج الامتحانات الإلكترونية</h2>
                      <p className="text-emerald-100/90 text-sm">
                        تابع نتائج امتحانات ابنك في مكان واحد — مباشرة بعد التصحيح
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
            const display = k.key === 'avg' ? `${value}%` : value;
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
                    {loading && submissions.length === 0 ? '—' : display}
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
                  onValueChange={(v) => setStatusFilter(v as 'all' | 'graded' | 'pending')}
                >
                  <SelectTrigger id="exam-status" className="w-full h-10">
                    <SelectValue placeholder="كل الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="graded">تم التصحيح</SelectItem>
                    <SelectItem value="pending">بانتظار التصحيح</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Refresh button */}
              <Button
                onClick={() => fetchSubmissions(false)}
                variant="outline"
                className="h-10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Not found (404) state */}
        {notFound && !loading && (
          <Card className="border-amber-200 dark:border-amber-900/50 mb-6">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <UserX className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-lg text-amber-700 dark:text-amber-400 mb-2">الطالب غير موجود</h3>
              <p className="text-sm text-muted-foreground mb-4">
                لم يتم العثور على سجل مرتبط بهذا الطالب. قد يكون رقم الطالب غير صحيح أو تمت أرشفته.
              </p>
              <Button
                onClick={() => fetchSubmissions(false)}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && !loading && !notFound && (
          <Card className="border-rose-200 dark:border-rose-800 shadow-sm mb-6">
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="font-bold text-[#2A374E] dark:text-white mb-1">فشل تحميل النتائج</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
              <Button
                onClick={() => fetchSubmissions(false)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading skeletons */}
        {loading && submissions.length === 0 && !error && !notFound && (
          <div className="space-y-4 mb-6">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
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
        {!loading && !error && !notFound && submissions.length === 0 && (
          <Card className="border-dashed border-2 border-emerald-200 dark:border-emerald-900/50 shadow-sm mb-6">
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                <FileText className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="font-bold text-[#2A374E] dark:text-white text-lg mb-1">
                لا توجد نتائج متاحة بعد
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                لم يتم تسجيل أي نتائج امتحانات لهذا الطالب حتى الآن. ستظهر النتائج هنا فور تصحيح الأوراق من قبل المعلمين.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty filter result */}
        {!loading && !error && !notFound && submissions.length > 0 && filteredSubmissions.length === 0 && (
          <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-sm mb-6">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Search className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="font-bold text-[#2A374E] dark:text-white mb-1">لا توجد نتائج مطابقة</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                جرّب تعديل البحث أو فلتر الحالة
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submissions list */}
        {!error && !notFound && filteredSubmissions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-[#2A374E] dark:text-white">
                  قائمة النتائج
                </h2>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredSubmissions.length}
                </Badge>
              </div>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1 parent-exams-scroll">
              {filteredSubmissions.map((sub) => {
                const isGraded = sub.status === 'GRADED';
                const passed = sub.passed === true;
                const failed = sub.passed === false;
                const hasScore = isGraded && sub.totalScore !== null && sub.maxScore !== null;
                const pct = sub.percentage !== null ? Math.round(sub.percentage) : null;

                return (
                  <Card
                    key={sub.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <CardContent className="p-5">
                      {/* Top row: title + status badge */}
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-[#2A374E] dark:text-white text-base leading-snug break-words mb-1">
                            {sub.examTitle}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="text-[10px] border bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                              <BookOpen className="w-3 h-3 ml-1" />
                              {sub.subject}
                            </Badge>
                            {sub.classroomName && (
                              <Badge variant="outline" className="text-[10px]">
                                <GraduationCap className="w-3 h-3 ml-1" />
                                {sub.classroomName}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              <Hash className="w-3 h-3 ml-1" />
                              محاولة {sub.attemptNumber}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          <Badge className={`text-[10px] border ${statusBadgeClass(sub.status)}`}>
                            {statusLabel(sub.status)}
                          </Badge>
                        </div>
                      </div>

                      {/* Score row */}
                      {hasScore && (
                        <div className="flex items-center gap-4 mb-3 flex-wrap">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-[#2A374E] dark:text-white">
                              {Number(sub.totalScore).toFixed(1)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              / {Number(sub.maxScore).toFixed(1)}
                            </span>
                          </div>
                          {pct !== null && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-bold ${
                              passed
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : failed
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              <BarChart3 className="w-3.5 h-3.5" />
                              {pct}%
                            </div>
                          )}
                          {(passed || failed) && (
                            <Badge className={`text-[10px] border ${
                              passed
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}>
                              {passed ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 ml-1" />
                                  ناجح
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 ml-1" />
                                  راسب
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Pending hint */}
                      {!isGraded && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            لم تُصحَّح الورقة بعد. ستظهر النتيجة فور اعتمادها من المعلم.
                          </p>
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                          <span>التسليم: {formatArabicDateShort(sub.submittedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>المدة: {sub.durationMinutes} دقيقة</span>
                        </div>
                        {sub.gradedAt && (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                            <span>التصحيح: {formatArabicDateShort(sub.gradedAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      <div className="flex justify-end">
                        <Button
                          onClick={() => openDetail(sub)}
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        >
                          <Eye className="w-4 h-4" />
                          عرض التفاصيل
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        if (mountedRef.current) {
          const t = setTimeout(() => setDetailOpen(open), 0);
          void t;
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-right text-lg font-bold text-[#2A374E] dark:text-white">
              {detailSubmission?.examTitle ?? '—'}
            </DialogTitle>
            <DialogDescription className="text-right">
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {detailSubmission && (
                  <Badge className={`text-[10px] border ${statusBadgeClass(detailSubmission.status)}`}>
                    {statusLabel(detailSubmission.status)}
                  </Badge>
                )}
                {detailSubmission?.subject && (
                  <Badge variant="outline" className="text-[10px]">
                    <BookOpen className="w-3 h-3 ml-1" />
                    {detailSubmission.subject}
                  </Badge>
                )}
                {detailSubmission?.classroomName && (
                  <Badge variant="outline" className="text-[10px]">
                    <GraduationCap className="w-3 h-3 ml-1" />
                    {detailSubmission.classroomName}
                  </Badge>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-2 parent-exams-scroll">
            {detailSubmission && (
              <div className="space-y-4">
                {/* Student info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">الطالب</p>
                    <p className="text-sm font-semibold text-[#2A374E] dark:text-white truncate">
                      {child.name}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">المحاولة</p>
                    <p className="text-sm font-semibold text-[#2A374E] dark:text-white">
                      رقم {detailSubmission.attemptNumber}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">وقت التسليم</p>
                    <p className="text-sm font-semibold text-[#2A374E] dark:text-white">
                      {formatArabicDate(detailSubmission.submittedAt)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">مدة الامتحان</p>
                    <p className="text-sm font-semibold text-[#2A374E] dark:text-white">
                      {detailSubmission.durationMinutes} دقيقة
                    </p>
                  </div>
                </div>

                {/* Score block (only if graded) */}
                {detailSubmission.status === 'GRADED' &&
                  detailSubmission.totalScore !== null &&
                  detailSubmission.maxScore !== null && (
                    <div className="rounded-xl overflow-hidden shadow-md">
                      <div className={`p-4 text-white text-center ${
                        detailSubmission.passed === true
                          ? 'bg-gradient-to-l from-emerald-600 to-teal-600'
                          : detailSubmission.passed === false
                          ? 'bg-gradient-to-l from-rose-600 to-red-600'
                          : 'bg-gradient-to-l from-slate-600 to-slate-700'
                      }`}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Award className="w-5 h-5" />
                          <span className="text-sm font-medium opacity-90">النتيجة النهائية</span>
                        </div>
                        <div className="flex items-baseline justify-center gap-1 mb-2">
                          <span className="text-4xl font-bold">
                            {Number(detailSubmission.totalScore).toFixed(1)}
                          </span>
                          <span className="text-lg opacity-90">
                            / {Number(detailSubmission.maxScore).toFixed(1)}
                          </span>
                        </div>
                        {detailSubmission.percentage !== null && (
                          <div className="flex items-center justify-center gap-3 text-sm">
                            <span className="font-bold">
                              {Math.round(detailSubmission.percentage)}%
                            </span>
                            {detailSubmission.passed === true && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                ناجح
                              </span>
                            )}
                            {detailSubmission.passed === false && (
                              <span className="flex items-center gap-1">
                                <XCircle className="w-4 h-4" />
                                راسب
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Grading info */}
                {detailSubmission.gradedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>اعتُمدت النتيجة في: {formatArabicDate(detailSubmission.gradedAt)}</span>
                  </div>
                )}

                {/* Exam end date */}
                {detailSubmission.examEndDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                    <span>إغلاق الامتحان: {formatArabicDateShort(detailSubmission.examEndDate)}</span>
                  </div>
                )}

                {/* Pending notice */}
                {detailSubmission.status !== 'GRADED' && (
                  <div className="flex items-start gap-2 px-3 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      لم تُصحَّح الورقة بعد. ستظهر النتيجة التفصيلية فور اعتمادها من المعلم المختص.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              onClick={() => {
                if (mountedRef.current) {
                  const t = setTimeout(() => {
                    setDetailOpen(false);
                    setDetailSubmission(null);
                  }, 0);
                  void t;
                }
              }}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              تم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky Footer */}
      <footer className="mt-auto bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white py-6">
        <div className="container mx-auto px-4 max-w-[1280px] text-center">
          <p className="text-sm text-emerald-100">
            © {new Date().getFullYear()} نتائج الامتحانات — بوابة أولياء الأمور
          </p>
        </div>
      </footer>

      {/* Custom scrollbar styling (emerald/teal to match parent portal) */}
      <style jsx global>{`
        .parent-exams-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgb(16 185 129) transparent;
        }
        .parent-exams-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .parent-exams-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .parent-exams-scroll::-webkit-scrollbar-thumb {
          background-color: rgb(16 185 129);
          border-radius: 9999px;
        }
        .parent-exams-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgb(5 150 105);
        }
      `}</style>
    </div>
  );
}

// ===== End of component =====
