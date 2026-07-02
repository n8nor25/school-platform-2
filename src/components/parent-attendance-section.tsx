'use client';

/**
 * ============================================================
 *  قسم سجل الحضور والغياب لولي الأمر
 *  Parent Attendance Section
 * ============================================================
 *  يجلب البيانات من:
 *    GET /api/parent/attendance?schoolId&studentNumber&parentPhone&limit=90
 *
 *  المميزات:
 *    • تحميل تلقائي عند التركيب + كل 60 ثانية + عند التركيز على النافذة
 *    • حالات: تحميل (هيكل عظمي) / خطأ (مع إعادة المحاولة) / فارغ / نجاح
 *    • خطأ 404: بطاقة خاصة مع اقتراح أرقام طالب صحيحة
 *    • رأس بتدرّج زمردی-تركوازی + عدّاد التتابع + زر تحديث يدوي
 *    • بطاقة "حالة اليوم"
 *    • 4 مؤشرات أداء في شبكة
 *    • خريطة حرارية لآخر 35 يوماً (5 أسابيع × 7 أيام)
 *    • قائمة السجلات (أحدث 6 افتراضياً، مع زر توسيع)
 *    • مرجع mountedRef لمنع setState بعد فك التركيب
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CalendarCheck, CheckCircle2, XCircle, Clock, ShieldCheck, UserX,
  RefreshCw, Flame, TrendingUp, CalendarDays, AlertCircle, Loader2,
  ChevronDown, Calendar, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ===== Types =====

interface ParentAttendanceSectionProps {
  schoolId: string;
  studentNumber: string;
  parentPhone: string;
  childName: string;
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'UNKNOWN';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  arrivalTime?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
}

interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  presentRate: number;
  absentRate: number;
  streak: number;
}

interface AttendanceResponse {
  student?: {
    id?: string;
    name?: string;
    studentNumber?: string;
    [k: string]: unknown;
  };
  records: AttendanceRecord[];
  stats: AttendanceStats;
  latest?: AttendanceRecord | null;
  range?: { from?: string; to?: string };
  testMode?: boolean;
}

// ===== Helpers =====

function normalizeStatus(raw: string | undefined | null): AttendanceStatus {
  if (!raw) return 'UNKNOWN';
  const s = String(raw).trim().toUpperCase();
  if (s === 'PRESENT' || s === 'حاضر' || s === 'حاضر/' || s.includes('PRESENT') || s.includes('حاضر')) return 'PRESENT';
  if (s === 'LATE' || s === 'متأخر' || s.includes('LATE') || s.includes('متأخر')) return 'LATE';
  if (s === 'EXCUSED' || s === 'غائب بعذر' || s.includes('EXCUSED') || s.includes('بعذر')) return 'EXCUSED';
  if (s === 'ABSENT' || s === 'غائب' || s.includes('ABSENT') || s.includes('غائب')) return 'ABSENT';
  return 'UNKNOWN';
}

const STATUS_META: Record<AttendanceStatus, {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  icon: typeof CheckCircle2;
  heat: string;
}> = {
  PRESENT: {
    label: 'حاضر',
    shortLabel: 'حاضر',
    color: 'emerald',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
    heat: 'bg-emerald-500',
  },
  ABSENT: {
    label: 'غائب',
    shortLabel: 'غائب',
    color: 'red',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: XCircle,
    heat: 'bg-red-500',
  },
  LATE: {
    label: 'متأخر',
    shortLabel: 'متأخر',
    color: 'amber',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    icon: Clock,
    heat: 'bg-amber-500',
  },
  EXCUSED: {
    label: 'غائب بعذر',
    shortLabel: 'بعذر',
    color: 'sky',
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    icon: ShieldCheck,
    heat: 'bg-sky-500',
  },
  UNKNOWN: {
    label: 'غير مسجّل',
    shortLabel: '—',
    color: 'slate',
    bg: 'bg-slate-100 dark:bg-slate-800/40',
    text: 'text-slate-500 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    icon: Info,
    heat: 'bg-slate-300 dark:bg-slate-700',
  },
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  // Accept ISO strings and yyyy-mm-dd
  return new Date(key.length > 10 ? key : key + 'T00:00:00');
}

function formatLongDate(d: Date): string {
  try {
    return d.toLocaleDateString('ar-EG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return d.toDateString();
  }
}

function formatShortDate(d: Date): string {
  try {
    return d.toLocaleDateString('ar-EG', {
      month: 'short', day: 'numeric',
    });
  } catch {
    return formatDateKey(d);
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const WEEKDAY_LABELS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

// Build a 5-week (35-day) grid ending today, grouped by week (Sat..Fri).
function buildHeatmap(records: AttendanceRecord[]): {
  weeks: { date: Date; key: string; status: AttendanceStatus }[][];
  todayKey: string;
} {
  const recordMap = new Map<string, AttendanceStatus>();
  for (const r of records) {
    if (!r?.date) continue;
    const d = parseDateKey(r.date);
    if (isNaN(d.getTime())) continue;
    recordMap.set(formatDateKey(d), normalizeStatus(r.status));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKey(today);

  // Find the Saturday of the week containing (today - 28 days).
  // 35 days = 5 weeks ending on the current week.
  const start = new Date(today);
  start.setDate(start.getDate() - 34); // 35 days including today
  // Shift to the Saturday on or before `start`
  const startDay = start.getDay(); // 0=Sun .. 6=Sat
  const satOffset = (startDay + 1) % 7; // days back to Saturday
  start.setDate(start.getDate() - satOffset);

  const weeks: { date: Date; key: string; status: AttendanceStatus }[][] = [];
  for (let w = 0; w < 5; w++) {
    const week: { date: Date; key: string; status: AttendanceStatus }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = formatDateKey(date);
      const status = recordMap.get(key) ?? (date > today ? 'UNKNOWN' : 'UNKNOWN');
      week.push({ date, key, status });
    }
    weeks.push(week);
  }
  return { weeks, todayKey };
}

// ===== Main Component =====

export default function ParentAttendanceSection({
  schoolId, studentNumber, parentPhone, childName,
}: ParentAttendanceSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fetchData = useCallback(async (manual = false) => {
    if (!studentNumber || !parentPhone) {
      if (mountedRef.current) {
        setError('بيانات الطالب غير مكتملة');
        setLoading(false);
      }
      return;
    }
    if (manual) {
      if (mountedRef.current) setRefreshing(true);
    }
    try {
      const url = `/api/parent/attendance?schoolId=${encodeURIComponent(schoolId)}&studentNumber=${encodeURIComponent(studentNumber)}&parentPhone=${encodeURIComponent(parentPhone)}&limit=90`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (res.status === 404) {
        if (mountedRef.current) {
          setNotFound(true);
          setError(null);
          setData(null);
          setLoading(false);
          setRefreshing(false);
          setLastUpdated(new Date());
        }
        return;
      }
      if (!res.ok) {
        let msg = 'تعذّر تحميل سجل الحضور';
        try {
          const j = await res.json();
          if (j?.error) msg = typeof j.error === 'string' ? j.error : msg;
        } catch { /* noop */ }
        if (mountedRef.current) {
          setError(msg);
          setNotFound(false);
          setData(null);
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }
      const json = (await res.json()) as AttendanceResponse;
      if (!mountedRef.current) return;
      setData(json);
      setError(null);
      setNotFound(false);
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    } catch {
      if (!mountedRef.current) return;
      setError('تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.');
      setNotFound(false);
      setData(null);
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId, studentNumber, parentPhone]);

  // Initial fetch + 60s interval + window focus
  useEffect(() => {
    if (!schoolId || !studentNumber || !parentPhone) return;
    // set-state-in-effect: defer to avoid lint warnings during render
    const t = setTimeout(() => {
      fetchData(false);
    }, 0);
    intervalRef.current = setInterval(() => {
      fetchData(false);
    }, 60000);

    const onFocus = () => fetchData(false);
    window.addEventListener('focus', onFocus);
    const visHandler = () => {
      if (document.visibilityState === 'visible') fetchData(false);
    };
    document.addEventListener('visibilitychange', visHandler);

    return () => {
      clearTimeout(t);
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [fetchData, schoolId, studentNumber, parentPhone]);

  // ===== Render helpers =====

  const renderSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );

  const renderError = () => (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardContent className="p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="font-bold text-lg text-red-700 dark:text-red-400 mb-2">تعذّر تحميل السجل</h3>
        <p className="text-sm text-muted-foreground mb-4">{error || 'حدث خطأ غير متوقع'}</p>
        <Button
          onClick={() => {
            setLoading(true);
            setError(null);
            setTimeout(() => fetchData(true), 0);
          }}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      </CardContent>
    </Card>
  );

  const renderNotFound = () => (
    <Card className="border-amber-200 dark:border-amber-900/50">
      <CardContent className="p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
          <UserX className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="font-bold text-lg text-amber-700 dark:text-amber-400 mb-2">رقم الطالب غير موجود</h3>
        <p className="text-sm text-muted-foreground mb-4">
          لم يتم العثور على سجل حضور مرتبط برقم الطالب المدخل.
        </p>
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">جرّب أحد هذه الأرقام الصحيحة:</p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['2024001', '2024002', '2024003'].map((n) => (
              <Badge key={n} className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800">
                {n}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmpty = () => (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <CalendarDays className="w-7 h-7 text-slate-500" />
        </div>
        <h3 className="font-bold text-lg mb-1">لا توجد سجلات حضور بعد</h3>
        <p className="text-sm text-muted-foreground">لم يتم تسجيل أي بيانات حضور لهذا الطالب حتى الآن.</p>
      </CardContent>
    </Card>
  );

  // ===== Success rendering =====

  const renderSuccess = () => {
    if (!data) return null;
    const records = Array.isArray(data.records) ? data.records : [];
    const stats = data.stats ?? { total: 0, present: 0, absent: 0, late: 0, excused: 0, presentRate: 0, absentRate: 0, streak: 0 };

    if (records.length === 0 && stats.total === 0) return renderEmpty();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatDateKey(today);
    const todayRecord = records.find((r) => {
      if (!r?.date) return false;
      const d = parseDateKey(r.date);
      return !isNaN(d.getTime()) && formatDateKey(d) === todayKey;
    }) || (data.latest && (() => {
      const d = parseDateKey(data.latest.date);
      return !isNaN(d.getTime()) && formatDateKey(d) === todayKey ? data.latest : null;
    })());

    const todayStatus = todayRecord ? normalizeStatus(todayRecord.status) : null;
    const todayMeta = todayStatus ? STATUS_META[todayStatus] : null;
    const TodayIcon = todayMeta?.icon ?? CalendarDays;

    const { weeks } = buildHeatmap(records);

    // Sort records by date desc for display
    const sortedRecords = [...records].sort((a, b) => {
      const da = parseDateKey(a.date).getTime();
      const db = parseDateKey(b.date).getTime();
      return db - da;
    });
    const visibleRecords = showAllRecords ? sortedRecords : sortedRecords.slice(0, 6);

    const kpis = [
      {
        label: 'نسبة الحضور',
        value: `${Math.round(stats.presentRate || 0)}%`,
        icon: TrendingUp,
        gradient: 'from-emerald-500 to-teal-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      },
      {
        label: 'أيام الحضور',
        value: String(stats.present ?? 0),
        icon: CheckCircle2,
        gradient: 'from-emerald-500 to-emerald-600',
        bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      },
      {
        label: 'أيام الغياب',
        value: String(stats.absent ?? 0),
        icon: XCircle,
        gradient: 'from-red-500 to-rose-500',
        bg: 'bg-red-50 dark:bg-red-900/10',
      },
      {
        label: 'التأخير',
        value: String(stats.late ?? 0),
        icon: Clock,
        gradient: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50 dark:bg-amber-900/10',
      },
    ];

    return (
      <div className="space-y-4">
        {/* Header bar */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-l from-emerald-600 via-emerald-600 to-teal-600 p-4 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">سجل الحضور والغياب</h3>
                  <p className="text-emerald-50 text-xs">{childName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {typeof stats.streak === 'number' && stats.streak > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 text-sm font-semibold backdrop-blur">
                    <Flame className="w-4 h-4 text-amber-200" />
                    <span>تتابع {stats.streak} يوم</span>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur"
                >
                  {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span className="hidden sm:inline">تحديث</span>
                </Button>
              </div>
            </div>
            {lastUpdated && (
              <p className="text-[11px] text-emerald-50/80 mt-2">
                آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        {/* Today's status */}
        <Card className={`border-2 ${todayMeta ? todayMeta.border : 'border-slate-200 dark:border-slate-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${todayMeta ? todayMeta.bg : 'bg-slate-100 dark:bg-slate-800'}`}>
                <TodayIcon className={`w-6 h-6 ${todayMeta ? todayMeta.text : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">حالة اليوم</p>
                {todayMeta ? (
                  <>
                    <p className={`font-bold text-lg ${todayMeta.text}`}>{todayMeta.label}</p>
                    {todayRecord?.arrivalTime && (
                      <p className="text-xs text-muted-foreground">
                        وقت الحضور: {formatTime(todayRecord.arrivalTime)}
                      </p>
                    )}
                    {todayRecord?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        ملاحظة: {todayRecord.notes}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-bold text-base text-slate-500 dark:text-slate-400">لم يُسجَّل بعد</p>
                )}
              </div>
              <div className="text-left shrink-0">
                <p className="text-xs text-muted-foreground">{formatShortDate(today)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${kpi.gradient} flex items-center justify-center mb-2 shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-extrabold leading-tight">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Heatmap */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-semibold text-sm">خريطة الحضور (آخر 5 أسابيع)</h4>
              </div>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="min-w-[320px]">
                {/* Day cells (Sat..Fri columns) */}
                <div className="grid grid-cols-5 gap-1.5">
                  {weeks.map((week, wi) => (
                    <div key={`wk-${wi}`} className="space-y-1">
                      <div className="grid grid-cols-7 gap-1">
                        {week.map((day, di) => {
                          const meta = STATUS_META[day.status];
                          const isToday = day.key === todayKey;
                          const isFuture = day.date > today;
                          return (
                            <div
                              key={`d-${wi}-${di}`}
                              title={`${formatShortDate(day.date)} — ${meta.label}`}
                              className={`aspect-square rounded-[3px] ${isFuture ? 'bg-slate-50 dark:bg-slate-900/40' : meta.heat} ${isToday ? 'ring-2 ring-offset-1 ring-emerald-500 dark:ring-offset-background' : ''}`}
                            />
                          );
                        })}
                      </div>
                      {wi === 0 && (
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAY_LABELS.map((label, li) => (
                            <div key={`wl-${li}`} className="text-[8px] text-muted-foreground text-center leading-tight">
                              {label.charAt(0)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500" />حاضر</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500" />متأخر</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500" />غائب</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-500" />بعذر</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700" />لا سجل</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records list */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">السجلات التفصيلية</h4>
              <Badge variant="secondary" className="text-xs">{sortedRecords.length} سجل</Badge>
            </div>
            {sortedRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات لعرضها</p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleRecords.map((rec) => {
                    const status = normalizeStatus(rec.status);
                    const meta = STATUS_META[status];
                    const Icon = meta.icon;
                    const date = parseDateKey(rec.date);
                    return (
                      <div
                        key={rec.id}
                        className={`flex items-center gap-3 rounded-lg border ${meta.border} ${meta.bg} p-3`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white/60 dark:bg-black/20`}>
                          <Icon className={`w-5 h-5 ${meta.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${meta.text}`}>{meta.label}</span>
                            {rec.arrivalTime && (
                              <span className="text-xs text-muted-foreground">
                                · {formatTime(rec.arrivalTime)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {isNaN(date.getTime()) ? rec.date : formatLongDate(date)}
                          </p>
                          {rec.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {rec.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {sortedRecords.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRecords((v) => !v)}
                    className="w-full mt-3 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                  >
                    {showAllRecords ? 'عرض أقل' : `عرض جميع السجلات (${sortedRecords.length})`}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAllRecords ? 'rotate-180' : ''}`} />
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ===== Main render =====

  let content: React.ReactNode;
  if (loading) {
    content = renderSkeleton();
  } else if (notFound) {
    content = renderNotFound();
  } else if (error) {
    content = renderError();
  } else if (data) {
    content = renderSuccess();
  } else {
    content = renderSkeleton();
  }

  return (
    <section className="space-y-3">
      {content}
    </section>
  );
}
