'use client';

/**
 * ============================================================
 *  صفحة جداول الحصص للمعلم
 *  Teacher Schedules Viewing Page
 * ============================================================
 *  تتفاعل مع:
 *    GET /api/schedules?schoolId=X&includeArchived=true
 *
 *  المميزات:
 *    • عرض جداول المعلم الشخصية + جداول الفصول + الجداول اليومية
 *    • فلترة بالبحث والنوع (حالي/أرشيف) والفئة (معلم/فصل/يومي)
 *    • 4 بطاقات KPI (إجمالي/حالي/أرشيف/شخصية)
 *    • مربع تفاصيل لكل جدول مع معاينة (PDF/صورة) أو رابط تحميل
 *    • شارة "متعلق بفصلك" للجداول المرتبطة بفصول المعلم
 *    • حالات: تحميل (هيكل عظمي) / خطأ (مع إعادة المحاولة) / فارغ / جاهز
 *    • mountedRef لمنع setState بعد فك التركيب
 *    • set-state-in-effect: setTimeout(0) داخل useEffect
 *    • تحديث تلقائي كل 60 ثانية + عند التركيز على النافذة
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowRight, RefreshCw, Loader2, Download, Eye, CalendarClock,
  FileText, AlertTriangle, Info, Sparkles, GraduationCap,
  ShieldCheck, Search, CalendarDays, User, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ============================================================
// Props
// ============================================================
interface TeacherSchedulesPageProps {
  onBack: () => void;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classrooms: Array<{
    id: string;
    name: string;
    gradeLevel: string;
    section: string;
  }>;
}

// ============================================================
// Types
// ============================================================
interface ScheduleItem {
  id: string;
  title: string;
  category: string;
  grade?: string | null;
  section?: string | null;
  teacherName?: string | null;
  dayOfWeek?: number | null;
  filePath: string;
  fileName: string;
  type: string;
  active: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt?: string;
  [k: string]: unknown;
}

// ============================================================
// Constants
// ============================================================

const DAYS_AR: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

interface CategoryMeta {
  label: string;
  badge: string;
  iconBg: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  class: {
    label: 'جدول فصل',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    iconBg: 'from-emerald-500 to-teal-600',
  },
  teacher: {
    label: 'جدول معلم',
    badge:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    iconBg: 'from-violet-500 to-purple-600',
  },
  daily: {
    label: 'جدول يومي',
    badge:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    iconBg: 'from-amber-500 to-orange-600',
  },
};

function getCategoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      label: category || 'جدول',
      badge:
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      iconBg: 'from-slate-500 to-slate-700',
    }
  );
}

// ============================================================
// Helpers
// ============================================================

function formatArabicDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatArabicTime(date: Date): string {
  try {
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function isPdf(filePath: string): boolean {
  return /\.pdf(\?|$)/i.test(filePath);
}

function isImage(filePath: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(filePath);
}

function normalizeStr(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

// ============================================================
// Main Component
// ============================================================

export default function TeacherSchedulesPage({
  onBack,
  schoolId,
  teacherName,
  classrooms,
}: TeacherSchedulesPageProps) {
  // ===== State =====
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'حالي' | 'أرشيف'>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'teacher' | 'class' | 'daily'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail dialog
  const [detailSchedule, setDetailSchedule] = useState<ScheduleItem | null>(
    null
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ===== Mount cleanup =====
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ===== Fetch schedules =====
  const fetchSchedules = useCallback(
    async (manual = false) => {
      if (!schoolId) return;
      if (manual && mountedRef.current) {
        const t = setTimeout(() => setRefreshing(true), 0);
        void t;
      }
      try {
        // Fetch all schedules (current + archived) and filter client-side
        const url = `/api/schedules?schoolId=${encodeURIComponent(
          schoolId
        )}&includeArchived=true`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) {
          let m = 'فشل تحميل جداول الحصص';
          try {
            const j = await res.json();
            if (j?.error)
              m = typeof j.error === 'string' ? j.error : m;
          } catch {
            /* noop */
          }
          throw new Error(m);
        }
        const data = await res.json();
        const arr: ScheduleItem[] = Array.isArray(data)
          ? data
          : Array.isArray((data as { schedules?: unknown })?.schedules)
            ? (data as { schedules: ScheduleItem[] }).schedules
            : [];
        if (!mountedRef.current) return;
        const t = setTimeout(() => {
          setSchedules(arr);
          setLoading(false);
          setRefreshing(false);
          setError(null);
          setLastUpdated(new Date());
        }, 0);
        void t;
      } catch (err) {
        if (!mountedRef.current) return;
        const msg =
          err instanceof Error ? err.message : 'فشل تحميل جداول الحصص';
        const t = setTimeout(() => {
          setError(msg);
          setLoading(false);
          setRefreshing(false);
        }, 0);
        void t;
        if (manual) toast.error(msg);
      }
    },
    [schoolId]
  );

  // ===== Initial fetch + 60s interval + window focus =====
  useEffect(() => {
    const t = setTimeout(() => fetchSchedules(false), 0);
    intervalRef.current = setInterval(() => fetchSchedules(false), 60000);
    const onFocus = () => fetchSchedules(false);
    window.addEventListener('focus', onFocus);
    const visHandler = () => {
      if (document.visibilityState === 'visible') fetchSchedules(false);
    };
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [fetchSchedules]);

  // ===== Derived: teacher-normalized names =====
  const normalizedTeacherName = normalizeStr(teacherName);
  const teacherClassroomGrades = useMemo(
    () =>
      classrooms
        .map((c) => normalizeStr(c.gradeLevel))
        .filter((g) => g.length > 0),
    [classrooms]
  );
  const teacherClassroomSections = useMemo(
    () =>
      classrooms
        .map((c) => normalizeStr(c.section))
        .filter((s) => s.length > 0),
    [classrooms]
  );

  // ===== Filtered schedules =====
  const filteredSchedules = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return schedules.filter((s) => {
      // Type filter
      if (typeFilter === 'حالي' && s.type !== 'حالي') return false;
      if (typeFilter === 'أرشيف' && s.type !== 'أرشيف') return false;
      // Category filter
      if (categoryFilter !== 'all' && s.category !== categoryFilter)
        return false;
      // Search
      if (search) {
        const title = (s.title || '').toLowerCase();
        if (!title.includes(search)) return false;
      }
      return true;
    });
  }, [schedules, typeFilter, categoryFilter, searchQuery]);

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const total = filteredSchedules.length;
    const current = filteredSchedules.filter((s) => s.type === 'حالي').length;
    const archive = filteredSchedules.filter((s) => s.type === 'أرشيف')
      .length;
    const personal = filteredSchedules.filter(
      (s) => normalizeStr(s.teacherName) === normalizedTeacherName
    ).length;
    return { total, current, archive, personal };
  }, [filteredSchedules, normalizedTeacherName]);

  // ===== Helpers: match classroom =====
  const isRelatedToMyClassroom = useCallback(
    (s: ScheduleItem): boolean => {
      if (s.category !== 'class') return false;
      const g = normalizeStr(s.grade);
      const sec = normalizeStr(s.section);
      if (g && teacherClassroomGrades.includes(g)) return true;
      if (sec && teacherClassroomSections.includes(sec)) return true;
      return false;
    },
    [teacherClassroomGrades, teacherClassroomSections]
  );

  // ===== Handlers =====
  const handleRefresh = () => fetchSchedules(true);

  const handleDownload = (s: ScheduleItem) => {
    if (!s.filePath) {
      toast.error('لا يوجد ملف متاح للتحميل');
      return;
    }
    try {
      window.open(s.filePath, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('تعذّر فتح الملف');
    }
  };

  const handleView = (s: ScheduleItem) => {
    const t = setTimeout(() => {
      setDetailSchedule(s);
      setDetailOpen(true);
    }, 0);
    void t;
  };

  const handleCloseDetail = () => {
    const t = setTimeout(() => setDetailOpen(false), 0);
    void t;
    const t2 = setTimeout(() => setDetailSchedule(null), 200);
    void t2;
  };

  // ===== Render helpers =====
  const renderKpiCard = (
    label: string,
    value: number,
    gradient: string,
    bg: string,
    textColor: string,
    Icon: typeof CalendarClock
  ) => (
    <Card className={`border-0 shadow-sm overflow-hidden ${bg}`}>
      <CardContent className="p-4">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md mb-2`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className={`text-2xl font-bold ${textColor} mb-0.5`}>{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </CardContent>
    </Card>
  );

  const renderSkeletons = () => (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3 rounded-lg" />
                <Skeleton className="h-4 w-1/3 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderError = () => (
    <Card className="border-rose-200 dark:border-rose-900/50">
      <CardContent className="p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
        </div>
        <h3 className="font-bold text-lg text-rose-700 dark:text-rose-400 mb-2">
          تعذّر تحميل الجداول
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error || 'حدث خطأ غير متوقع'}
        </p>
        <Button
          onClick={() => {
            const t = setTimeout(() => {
              setLoading(true);
              setError(null);
              fetchSchedules(true);
            }, 0);
            void t;
          }}
          className="bg-rose-600 hover:bg-rose-700 text-white"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      </CardContent>
    </Card>
  );

  const renderEmpty = () => (
    <Card className="border-dashed border-2 border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-900/10">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
          <CalendarClock className="w-8 h-8 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="font-bold text-lg text-violet-800 dark:text-violet-300 mb-1">
          لا توجد جداول متاحة
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          لم يتم العثور على جداول حصص تطابق الفلاتر الحالية. جرّب تعديل الفلاتر
          أو تحديث القائمة لاحقاً.
        </p>
      </CardContent>
    </Card>
  );

  const renderScheduleCard = (s: ScheduleItem) => {
    const meta = getCategoryMeta(s.category);
    const isCurrent = s.type === 'حالي';
    const isPersonal =
      normalizeStr(s.teacherName) === normalizedTeacherName &&
      normalizedTeacherName.length > 0;
    const relatedToClass = isRelatedToMyClassroom(s);

    return (
      <Card
        key={s.id}
        className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      >
        <CardContent className="p-4 space-y-3">
          {/* Title + badges */}
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${meta.iconBg} flex items-center justify-center shrink-0`}
            >
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#2A374E] dark:text-white text-sm leading-snug">
                {s.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge className={`text-[10px] px-2 py-0.5 ${meta.badge}`}>
                  {meta.label}
                </Badge>
                <Badge
                  className={`text-[10px] px-2 py-0.5 ${
                    isCurrent
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s.type}
                </Badge>
                {isPersonal && (
                  <Badge className="text-[10px] px-2 py-0.5 bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">
                    جدولي
                  </Badge>
                )}
                {relatedToClass && (
                  <Badge className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    متعلق بفصلك
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            {s.grade && (
              <div className="flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-violet-500" />
                <span>المرحلة: {s.grade}</span>
              </div>
            )}
            {s.section && (
              <div className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-violet-500" />
                <span>الشعبة: {s.section}</span>
              </div>
            )}
            {s.teacherName && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-violet-500" />
                <span>المعلم: {s.teacherName}</span>
              </div>
            )}
            {typeof s.dayOfWeek === 'number' &&
              s.dayOfWeek >= 0 &&
              s.dayOfWeek <= 6 &&
              DAYS_AR[s.dayOfWeek] && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5 text-violet-500" />
                  <span>اليوم: {DAYS_AR[s.dayOfWeek]}</span>
                </div>
              )}
          </div>

          {/* Created at */}
          <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <CalendarClock className="w-3 h-3" />
            <span>أُضيف في: {formatArabicDate(s.createdAt)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(s)}
              className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 h-9"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs">تحميل الجدول</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleView(s)}
              className="h-9"
            >
              <Eye className="w-4 h-4" />
              <span className="text-xs">عرض</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ===== Detail dialog render =====
  const renderDetailDialog = () => {
    if (!detailSchedule) return null;
    const s = detailSchedule;
    const meta = getCategoryMeta(s.category);
    const isCurrent = s.type === 'حالي';
    const showIframe = isPdf(s.filePath);
    const showImage = isImage(s.filePath);

    return (
      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          const t = setTimeout(() => setDetailOpen(o), 0);
          void t;
          if (!o) {
            const t2 = setTimeout(() => setDetailSchedule(null), 200);
            void t2;
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 flex-wrap">
              <CalendarClock className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{s.title}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              تفاصيل الجدول: {s.title}
            </DialogDescription>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Badge className={`text-xs ${meta.badge}`}>{meta.label}</Badge>
              <Badge
                className={`text-xs ${
                  isCurrent
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {s.type}
              </Badge>
              {normalizeStr(s.teacherName) === normalizedTeacherName &&
                normalizedTeacherName.length > 0 && (
                  <Badge className="text-xs bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">
                    جدولي
                  </Badge>
                )}
            </div>
          </DialogHeader>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30 text-xs">
            {s.grade && (
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">
                  المرحلة
                </div>
                <div className="font-medium text-[#2A374E] dark:text-white">
                  {s.grade}
                </div>
              </div>
            )}
            {s.section && (
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">
                  الشعبة
                </div>
                <div className="font-medium text-[#2A374E] dark:text-white">
                  {s.section}
                </div>
              </div>
            )}
            {s.teacherName && (
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-0.5">
                  المعلم
                </div>
                <div className="font-medium text-[#2A374E] dark:text-white">
                  {s.teacherName}
                </div>
              </div>
            )}
            {typeof s.dayOfWeek === 'number' &&
              s.dayOfWeek >= 0 &&
              s.dayOfWeek <= 6 &&
              DAYS_AR[s.dayOfWeek] && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-0.5">
                    اليوم
                  </div>
                  <div className="font-medium text-[#2A374E] dark:text-white">
                    {DAYS_AR[s.dayOfWeek]}
                  </div>
                </div>
              )}
            <div>
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">
                تاريخ الإضافة
              </div>
              <div className="font-medium text-[#2A374E] dark:text-white">
                {formatArabicDate(s.createdAt)}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <div className="text-gray-500 dark:text-gray-400 mb-0.5">
                اسم الملف
              </div>
              <div
                className="font-medium text-[#2A374E] dark:text-white truncate"
                dir="ltr"
                title={s.fileName}
              >
                {s.fileName}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 min-h-0 overflow-auto">
            {showIframe ? (
              <iframe
                src={s.filePath}
                title={s.title}
                className="w-full h-[60vh] border rounded-lg bg-white"
              />
            ) : showImage ? (
              <img
                src={s.filePath}
                alt={s.title}
                className="max-w-full max-h-[60vh] mx-auto rounded-lg"
              />
            ) : (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  لا يمكن عرض هذا النوع من الملفات مباشرة. يمكنك تحميله للاطلاع
                  عليه.
                </p>
                <Button
                  variant="outline"
                  onClick={() => handleDownload(s)}
                  className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                >
                  <Download className="w-4 h-4" />
                  تحميل الملف
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => handleDownload(s)}
              className="border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
            >
              <Download className="w-4 h-4" />
              تحميل
            </Button>
            <Button variant="outline" onClick={handleCloseDetail}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ===== Main render =====
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Sticky header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-violet-300 transition-colors shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">رجوع</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-r from-rose-500 to-fuchsia-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                <CalendarClock className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold truncate">
                  جداول الحصص
                </h1>
                <p className="text-violet-200 text-xs truncate">{teacherName}</p>
              </div>
            </div>
            <div className="w-20 shrink-0" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl space-y-6">
        {/* Intro card */}
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-l from-violet-600 via-purple-600 to-fuchsia-600 p-5 md:p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-violet-200" />
                    <h2 className="text-lg md:text-xl font-bold">
                      جداول الحصص
                    </h2>
                  </div>
                  <p className="text-violet-100/90 text-sm">
                    استعرض جداول الحصص الخاصة بك وبفصولك الدراسية
                  </p>
                </div>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="bg-white/15 hover:bg-white/25 border-white/20 text-white hover:text-white shrink-0"
                  size="sm"
                >
                  {refreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="text-xs">تحديث</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters row */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  النوع
                </Label>
                <Select
                  value={typeFilter}
                  onValueChange={(v) => {
                    const t = setTimeout(
                      () => setTypeFilter(v as typeof typeFilter),
                      0
                    );
                    void t;
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="كل الأنواع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    <SelectItem value="حالي">حالي</SelectItem>
                    <SelectItem value="أرشيف">أرشيف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  الفئة
                </Label>
                <Select
                  value={categoryFilter}
                  onValueChange={(v) => {
                    const t = setTimeout(
                      () => setCategoryFilter(v as typeof categoryFilter),
                      0
                    );
                    void t;
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="teacher">جداول المعلمين</SelectItem>
                    <SelectItem value="class">جداول الفصول</SelectItem>
                    <SelectItem value="daily">جداول يومية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  بحث
                </Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالعنوان..."
                    className="h-10 pr-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {renderKpiCard(
            'إجمالي الجداول',
            kpis.total,
            'from-violet-500 to-purple-600',
            'bg-violet-50 dark:bg-violet-900/10',
            'text-violet-700 dark:text-violet-300',
            CalendarClock
          )}
          {renderKpiCard(
            'جداول حالية',
            kpis.current,
            'from-emerald-500 to-teal-600',
            'bg-emerald-50 dark:bg-emerald-900/10',
            'text-emerald-700 dark:text-emerald-300',
            CalendarDays
          )}
          {renderKpiCard(
            'جداول أرشيف',
            kpis.archive,
            'from-slate-500 to-slate-700',
            'bg-slate-50 dark:bg-slate-800/40',
            'text-slate-700 dark:text-slate-300',
            FileText
          )}
          {renderKpiCard(
            'جداولي الشخصية',
            kpis.personal,
            'from-fuchsia-500 to-pink-600',
            'bg-fuchsia-50 dark:bg-fuchsia-900/10',
            'text-fuchsia-700 dark:text-fuchsia-300',
            User
          )}
        </div>

        {/* Last updated hint */}
        {lastUpdated && !loading && !error && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <Info className="w-3 h-3" />
            <span>
              آخر تحديث:{' '}
              {formatArabicTime(
                lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated)
              )}
            </span>
          </div>
        )}

        {/* Schedules list */}
        {loading ? (
          renderSkeletons()
        ) : error ? (
          renderError()
        ) : filteredSchedules.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1 pr-1 -mr-1 teacher-schedules-scroll">
            {filteredSchedules.map(renderScheduleCard)}
          </div>
        )}

        {/* Footer hint */}
        {!loading && !error && filteredSchedules.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              اضغط على «عرض» لمعاينة الجدول أو «تحميل الجدول» لتنزيله. يتم تحديث
              القائمة تلقائياً كل 60 ثانية.
            </p>
          </div>
        )}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto bg-[#1a2332] text-white/70 text-center text-xs py-3">
        <div className="container mx-auto px-4 flex items-center justify-center gap-2 flex-wrap">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>بوابة المعلم الإلكترونية</span>
          <span className="opacity-50">|</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>

      {/* Detail dialog */}
      {renderDetailDialog()}

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .teacher-schedules-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .teacher-schedules-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .teacher-schedules-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(139, 92, 246, 0.3);
          border-radius: 9999px;
        }
        .teacher-schedules-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(139, 92, 246, 0.5);
        }
        .teacher-schedules-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
        }
      `}</style>
    </div>
  );
}
