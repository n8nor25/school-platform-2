'use client';

/**
 * ============================================================
 *  صفحة تسجيل الحضور للمعلم
 *  Teacher Attendance Recording Page
 * ============================================================
 *  تتفاعل مع:
 *    GET  /api/students?schoolId=&classroomId=&limit=200
 *    GET  /api/attendance?schoolId=&classroomId=&date=YYYY-MM-DD&includeStats=true
 *    POST /api/attendance/bulk   { schoolId, date, records: [...] }
 *
 *  المميزات:
 *    • اختيار فصل + تاريخ ثم تحميل القائمة
 *    • جلب السجل الموجود مسبقاً ودمجه مع الطلاب
 *    • 4 أزرار حالة لكل طالب (حاضر/غائب/متأخر/بعذر)
 *    • ملاحظة + وقت الوصول (اختياري)
 *    • 4 بطاقات KPI تحية مباشرة
 *    • إجراءات جماعية: الكل حاضر، الكل غائب، مسح الكل
 *    • حفظ السجل عبر bulk POST
 *    • حالات: فارغ (اختر فصل وتاريخ) / تحميل (هيكل عظمي) / خطأ / جاهز
 *    • mountedRef لمنع setState بعد فك التركيب
 *    • set-state-in-effect: setTimeout(0) داخل useEffect
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowRight, RefreshCw, Users, CalendarDays, Save, Loader2,
  CheckCircle2, XCircle, Clock, ShieldCheck, ClipboardCheck,
  AlertTriangle, Sparkles, GraduationCap, BookOpen, IdCard,
  StickyNote, ChevronDown, ChevronUp, Info, UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
interface TeacherAttendancePageProps {
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

// Statuses stored in DB as Arabic strings (see /api/attendance GET handler)
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface StudentRow {
  id: string;
  name: string;
  studentNumber: string;
  existingStatus?: string | null;
  existingNotes?: string | null;
  existingArrivalTime?: string | null;
  existingRecordId?: string | null;
}

interface StudentApiResponse {
  id: string;
  name: string;
  studentNumber: string;
  classroomId?: string | null;
  archived?: boolean;
  status?: string;
  [k: string]: unknown;
}

interface AttendanceRecordApi {
  id: string;
  studentId: string;
  date: string;
  status: string;
  arrivalTime?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  student?: {
    id?: string;
    name?: string;
    studentNumber?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface AttendanceListResponse {
  records?: AttendanceRecordApi[];
  stats?: {
    total?: number;
    present?: number;
    absent?: number;
    late?: number;
    excused?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

interface BulkSaveResponse {
  success?: boolean;
  message?: string;
  results?: {
    created?: number;
    updated?: number;
    errors?: number;
  };
  error?: string;
}

// ============================================================
// Constants
// ============================================================

const STATUS_AR: Record<AttendanceStatus, string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  LATE: 'متأخر',
  EXCUSED: 'غائب بعذر',
};

const STATUS_FROM_AR: Record<string, AttendanceStatus> = {
  'حاضر': 'PRESENT',
  'غائب': 'ABSENT',
  'متأخر': 'LATE',
  'غائب بعذر': 'EXCUSED',
};

interface StatusMeta {
  key: AttendanceStatus;
  label: string;
  icon: typeof CheckCircle2;
  // Unselected (outline) styling
  outline: string;
  // Selected (filled) styling
  filled: string;
  // KPI card colors
  kpiBg: string;
  kpiGradient: string;
  kpiText: string;
  badge: string;
}

const STATUS_META: StatusMeta[] = [
  {
    key: 'PRESENT',
    label: 'حاضر',
    icon: CheckCircle2,
    outline:
      'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
    filled:
      'bg-emerald-500 hover:bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/30',
    kpiBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    kpiGradient: 'from-emerald-500 to-teal-600',
    kpiText: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    key: 'ABSENT',
    label: 'غائب',
    icon: XCircle,
    outline:
      'border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30',
    filled:
      'bg-rose-500 hover:bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-500/30',
    kpiBg: 'bg-rose-50 dark:bg-rose-900/20',
    kpiGradient: 'from-rose-500 to-red-600',
    kpiText: 'text-rose-700 dark:text-rose-300',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  {
    key: 'LATE',
    label: 'متأخر',
    icon: Clock,
    outline:
      'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30',
    filled:
      'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-500/30',
    kpiBg: 'bg-amber-50 dark:bg-amber-900/20',
    kpiGradient: 'from-amber-500 to-orange-600',
    kpiText: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    key: 'EXCUSED',
    label: 'بعذر',
    icon: ShieldCheck,
    outline:
      'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50',
    filled:
      'bg-slate-600 hover:bg-slate-700 border-slate-600 text-white shadow-md shadow-slate-500/30',
    kpiBg: 'bg-slate-50 dark:bg-slate-800/40',
    kpiGradient: 'from-slate-500 to-slate-700',
    kpiText: 'text-slate-700 dark:text-slate-300',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
];

// ============================================================
// Helpers
// ============================================================

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstLetter(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  return n.charAt(0).toUpperCase();
}

// arrivalTime may be stored as an ISO string or HH:mm — normalize for <input type="time">
function toTimeInputValue(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

// ============================================================
// Main Component
// ============================================================

export default function TeacherAttendancePage({
  onBack,
  schoolId,
  teacherName,
  classrooms,
}: TeacherAttendancePageProps) {
  // ===== State =====
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(
    classrooms[0]?.id ?? ''
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [pendingStatus, setPendingStatus] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [pendingArrivalTime, setPendingArrivalTime] = useState<
    Record<string, string>
  >({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>(
    {}
  );

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const hasEditsRef = useRef(false);

  // ===== Mount cleanup =====
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ===== Compute KPI counts from pendingStatus (live) =====
  const kpiCounts = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    for (const id in pendingStatus) {
      const s = pendingStatus[id];
      if (s) counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [pendingStatus]);

  const totalMarked = useMemo(
    () => kpiCounts.PRESENT + kpiCounts.ABSENT + kpiCounts.LATE + kpiCounts.EXCUSED,
    [kpiCounts]
  );

  const totalStudents = students.length;

  // ===== Fetch students + existing attendance =====
  const fetchList = useCallback(
    async (manual = false) => {
      if (!schoolId || !selectedClassroomId || !selectedDate) {
        if (mountedRef.current) {
          const t = setTimeout(
            () => setError('يرجى اختيار فصل وتاريخ صحيحين'),
            0
          );
          void t;
        }
        return;
      }
      if (mountedRef.current) {
        const t1 = setTimeout(() => {
          setLoading(true);
          setError(null);
        }, 0);
        void t1;
      }
      try {
        // Fetch students for this class (no archived by default)
        const studentsUrl = `/api/students?schoolId=${encodeURIComponent(
          schoolId
        )}&classroomId=${encodeURIComponent(selectedClassroomId)}&limit=200`;
        const studentsRes = await fetch(studentsUrl, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!studentsRes.ok) {
          let m = 'فشل تحميل قائمة الطلاب';
          try {
            const j = await studentsRes.json();
            if (j?.error) m = typeof j.error === 'string' ? j.error : m;
          } catch {
            /* noop */
          }
          throw new Error(m);
        }
        const studentsData = (await studentsRes.json()) as
          | StudentApiResponse[]
          | { students?: StudentApiResponse[] };

        const studentsArr: StudentApiResponse[] = Array.isArray(studentsData)
          ? studentsData
          : Array.isArray((studentsData as { students?: unknown })?.students)
            ? ((studentsData as { students: StudentApiResponse[] }).students)
            : [];

        // Fetch existing attendance for this class+date (with stats)
        const attUrl = `/api/attendance?schoolId=${encodeURIComponent(
          schoolId
        )}&classroomId=${encodeURIComponent(
          selectedClassroomId
        )}&date=${encodeURIComponent(selectedDate)}&includeStats=true`;
        const attRes = await fetch(attUrl, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!attRes.ok) {
          // Non-fatal: continue with empty attendance
          console.warn('[attendance] could not load existing records');
        }

        let records: AttendanceRecordApi[] = [];
        if (attRes.ok) {
          const attJson = (await attRes.json()) as AttendanceListResponse;
          if (Array.isArray(attJson?.records)) {
            records = attJson.records;
          } else if (Array.isArray(attJson)) {
            records = attJson as unknown as AttendanceRecordApi[];
          }
        }

        // Build a lookup: studentId -> record
        const recordByStudent = new Map<string, AttendanceRecordApi>();
        for (const r of records) {
          const sid = r.studentId || (r.student?.id as string | undefined);
          if (sid) recordByStudent.set(sid, r);
        }

        // Build StudentRow array + pre-populate pending maps
        const rows: StudentRow[] = studentsArr.map((s) => {
          const rec = recordByStudent.get(s.id);
          return {
            id: s.id,
            name: s.name,
            studentNumber: s.studentNumber,
            existingStatus: rec?.status ?? null,
            existingNotes: rec?.notes ?? null,
            existingArrivalTime: rec?.arrivalTime ?? null,
            existingRecordId: rec?.id ?? null,
          };
        });

        // Sort by name for stable ordering
        rows.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'ar')
        );

        const newPendingStatus: Record<string, AttendanceStatus> = {};
        const newPendingNotes: Record<string, string> = {};
        const newPendingArrival: Record<string, string> = {};
        for (const r of rows) {
          if (r.existingStatus && STATUS_FROM_AR[r.existingStatus]) {
            newPendingStatus[r.id] = STATUS_FROM_AR[r.existingStatus];
          }
          if (r.existingNotes) newPendingNotes[r.id] = r.existingNotes;
          if (r.existingArrivalTime) {
            const t = toTimeInputValue(r.existingArrivalTime);
            if (t) newPendingArrival[r.id] = t;
          }
        }

        if (!mountedRef.current) return;
        // set-state-in-effect pattern: defer setState
        const t2 = setTimeout(() => {
          setStudents(rows);
          setPendingStatus(newPendingStatus);
          setPendingNotes(newPendingNotes);
          setPendingArrivalTime(newPendingArrival);
          setExpandedNotes({});
          setLoaded(true);
          setLoading(false);
          setError(null);
          hasEditsRef.current = false;
        }, 0);
        void t2;
      } catch (err) {
        if (!mountedRef.current) return;
        const msg =
          err instanceof Error ? err.message : 'فشل تحميل القائمة';
        const t3 = setTimeout(() => {
          setError(msg);
          setLoading(false);
        }, 0);
        void t3;
        if (manual) toast.error(msg);
      }
    },
    [schoolId, selectedClassroomId, selectedDate]
  );

  // ===== Window focus refresh (only if no edits) =====
  useEffect(() => {
    const onFocus = () => {
      if (!loaded || loading || saving) return;
      if (hasEditsRef.current) return; // don't clobber unsaved edits
      fetchList(false);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchList, loaded, loading, saving]);

  // ===== Handlers =====
  const handleLoadClick = () => {
    if (!selectedClassroomId) {
      toast.error('يرجى اختيار فصل أولاً');
      return;
    }
    if (!selectedDate) {
      toast.error('يرجى اختيار تاريخ صحيح');
      return;
    }
    fetchList(true);
  };

  const handleRefreshClick = () => {
    if (loaded) {
      if (hasEditsRef.current) {
        toast.warning('لديك تعديلات غير محفوظة. سيتم استبدالها.');
      }
    }
    fetchList(true);
  };

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    if (!mountedRef.current) return;
    hasEditsRef.current = true;
    const t = setTimeout(() => {
      setPendingStatus((prev) => ({ ...prev, [studentId]: status }));
    }, 0);
    void t;
  };

  const toggleNotes = (studentId: string) => {
    if (!mountedRef.current) return;
    const t = setTimeout(() => {
      setExpandedNotes((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
    }, 0);
    void t;
  };

  const setNotes = (studentId: string, value: string) => {
    if (!mountedRef.current) return;
    hasEditsRef.current = true;
    const t = setTimeout(() => {
      setPendingNotes((prev) => ({ ...prev, [studentId]: value }));
    }, 0);
    void t;
  };

  const setArrival = (studentId: string, value: string) => {
    if (!mountedRef.current) return;
    hasEditsRef.current = true;
    const t = setTimeout(() => {
      setPendingArrivalTime((prev) => ({ ...prev, [studentId]: value }));
    }, 0);
    void t;
  };

  const setAll = (status: AttendanceStatus | null) => {
    if (!mountedRef.current) return;
    if (students.length === 0) {
      toast.info('لا يوجد طلاب في القائمة');
      return;
    }
    hasEditsRef.current = true;
    const t = setTimeout(() => {
      if (status === null) {
        setPendingStatus({});
        setPendingNotes({});
        setPendingArrivalTime({});
        setExpandedNotes({});
      } else {
        const next: Record<string, AttendanceStatus> = {};
        for (const s of students) next[s.id] = status;
        setPendingStatus(next);
        // Clear arrival times unless LATE
        if (status !== 'LATE') {
          setPendingArrivalTime({});
        }
      }
    }, 0);
    void t;
    if (status === null) {
      toast.info('تم مسح كل الحالات');
    } else {
      const meta = STATUS_META.find((m) => m.key === status);
      toast.success(`تم تعيين ${students.length} طالب إلى "${
        meta?.label ?? status
      }"`);
    }
  };

  const handleSave = async () => {
    if (!mountedRef.current) return;
    // Validation: at least 1 status set
    const statusEntries = Object.entries(pendingStatus);
    if (statusEntries.length === 0) {
      toast.error('يرجى تعيين حالة الحضور لطالب واحد على الأقل قبل الحفظ');
      return;
    }
    if (!selectedDate) {
      toast.error('التاريخ غير صحيح');
      return;
    }
    if (!selectedClassroomId) {
      toast.error('الفصل غير محدد');
      return;
    }

    const t1 = setTimeout(() => setSaving(true), 0);
    void t1;

    try {
      // Build records array — only students with a pending status
      const records = statusEntries.map(([studentId, status]) => ({
        studentId,
        status: STATUS_AR[status],
        classroomId: selectedClassroomId,
        arrivalTime: pendingArrivalTime[studentId] || null,
        notes: pendingNotes[studentId]?.trim() || null,
        recordedBy: teacherName,
      }));

      const res = await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          date: selectedDate,
          records,
        }),
      });

      const data = (await res.json()) as BulkSaveResponse;

      if (!res.ok) {
        throw new Error(data?.error || 'فشل حفظ السجل');
      }

      const created = data?.results?.created ?? 0;
      const updated = data?.results?.updated ?? 0;
      const errors = data?.results?.errors ?? 0;
      const totalSaved = created + updated;

      toast.success(
        `تم حفظ سجل الحضور بنجاح (${totalSaved} طالب)`
      );
      if (errors > 0) {
        toast.warning(`تعذّر حفظ ${errors} سجل — حاول مرة أخرى`);
      }

      // Reload the list to reflect saved state
      hasEditsRef.current = false;
      await fetchList(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'فشل حفظ السجل';
      toast.error(msg);
    } finally {
      if (!mountedRef.current) return;
      const t2 = setTimeout(() => setSaving(false), 0);
      void t2;
    }
  };

  // ===== Render helpers =====

  const renderKpiCard = (meta: StatusMeta) => {
    const count = kpiCounts[meta.key] || 0;
    const pct =
      totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
    const Icon = meta.icon;
    return (
      <Card
        key={meta.key}
        className={`border-0 shadow-md overflow-hidden ${meta.kpiBg}`}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${meta.kpiGradient} flex items-center justify-center shadow shrink-0`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-2xl font-bold ${meta.kpiText} leading-tight`}>
                {count}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {meta.label}
              </div>
            </div>
            <div className={`text-xs font-semibold ${meta.kpiText} shrink-0`}>
              {pct}%
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSkeletons = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-9 w-20 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderError = () => (
    <Card className="border-rose-200 dark:border-rose-900/50">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
        </div>
        <h3 className="font-bold text-lg text-rose-700 dark:text-rose-400 mb-2">
          تعذّر تحميل القائمة
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {error || 'حدث خطأ غير متوقع'}
        </p>
        <Button
          onClick={() => fetchList(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      </CardContent>
    </Card>
  );

  const renderEmptyInitial = () => (
    <Card className="border-dashed border-2 border-violet-200 dark:border-violet-800/60">
      <CardContent className="p-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center mb-4">
          <ClipboardCheck className="w-8 h-8 text-violet-600 dark:text-violet-300" />
        </div>
        <h3 className="font-bold text-lg text-[#2A374E] dark:text-white mb-1">
          ابدأ بتسجيل الحضور
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          اختر فصلاً وتاريخاً ثم اضغط «تحميل القائمة» لعرض الطلاب وأي سجل حضور
          مسجّل مسبقاً لهذا اليوم.
        </p>
      </CardContent>
    </Card>
  );

  const renderNoStudents = () => (
    <Card className="border-dashed border-2 border-amber-200 dark:border-amber-800/60">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
          <UserX className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="font-bold text-lg text-amber-700 dark:text-amber-400 mb-1">
          لا يوجد طلاب في هذا الفصل
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          تأكد من أن الفصل المحدد يحتوي على طلاب مسجّلين في النظام.
        </p>
      </CardContent>
    </Card>
  );

  const renderStudentRow = (s: StudentRow) => {
    const current = pendingStatus[s.id];
    const notesOpen = expandedNotes[s.id] === true;
    const hasExisting =
      s.existingStatus && STATUS_FROM_AR[s.existingStatus as string];

    // Static ring color per status (Tailwind can't generate dynamic class names)
    const ringClass = current
      ? current === 'PRESENT'
        ? 'ring-1 ring-emerald-200 dark:ring-emerald-800'
        : current === 'ABSENT'
          ? 'ring-1 ring-rose-200 dark:ring-rose-800'
          : current === 'LATE'
            ? 'ring-1 ring-amber-200 dark:ring-amber-800'
            : 'ring-1 ring-slate-200 dark:ring-slate-700'
      : '';

    return (
      <Card
        key={s.id}
        className={`border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${ringClass}`}
      >
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Avatar + info */}
            <div className="flex items-center gap-3 sm:flex-1 min-w-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                {firstLetter(s.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[#2A374E] dark:text-white text-sm truncate">
                    {s.name}
                  </h3>
                  {hasExisting && !current && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                    >
                      مسجّل: {s.existingStatus}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <IdCard className="w-3.5 h-3.5" />
                  <span dir="ltr">{s.studentNumber || '—'}</span>
                </div>
              </div>
            </div>

            {/* Status buttons */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:justify-end">
              {STATUS_META.map((meta) => {
                const Icon = meta.icon;
                const selected = current === meta.key;
                return (
                  <Button
                    key={meta.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(s.id, meta.key)}
                    className={`h-9 px-2.5 text-xs gap-1.5 rounded-lg border-2 transition-all ${
                      selected
                        ? meta.filled
                        : meta.outline + ' bg-white dark:bg-transparent'
                    }`}
                    aria-pressed={selected}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-semibold">{meta.label}</span>
                  </Button>
                );
              })}

              {/* Notes toggle (visible when ABSENT or EXCUSED, or always available) */}
              {(current === 'ABSENT' || current === 'EXCUSED') && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleNotes(s.id)}
                  className={`h-9 px-2.5 text-xs gap-1.5 rounded-lg ${
                    notesOpen
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  aria-label="إضافة ملاحظة"
                  aria-expanded={notesOpen}
                >
                  <StickyNote className="w-4 h-4" />
                  <span className="font-semibold hidden sm:inline">ملاحظة</span>
                  {notesOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Arrival time (only when LATE) */}
          {current === 'LATE' && (
            <div className="mt-3 flex items-center gap-2 flex-wrap bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <Label
                htmlFor={`arrival-${s.id}`}
                className="text-xs font-medium text-amber-700 dark:text-amber-300 shrink-0"
              >
                وقت الحضور
              </Label>
              <Input
                id={`arrival-${s.id}`}
                type="time"
                value={pendingArrivalTime[s.id] ?? ''}
                onChange={(e) => setArrival(s.id, e.target.value)}
                className="h-8 w-32 text-sm border-amber-200 dark:border-amber-800"
                dir="ltr"
              />
            </div>
          )}

          {/* Notes (collapsible, only for ABSENT/EXCUSED) */}
          {(current === 'ABSENT' || current === 'EXCUSED') && notesOpen && (
            <div className="mt-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
              <Label
                htmlFor={`notes-${s.id}`}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5 mb-1.5"
              >
                <StickyNote className="w-3.5 h-3.5" />
                ملاحظة (اختياري)
              </Label>
              <Textarea
                id={`notes-${s.id}`}
                value={pendingNotes[s.id] ?? ''}
                onChange={(e) => setNotes(s.id, e.target.value)}
                placeholder="مثال: عذر طبي، ظرف عائلي..."
                rows={2}
                className="text-sm resize-none"
                maxLength={500}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ===== No classrooms edge case =====
  if (classrooms.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
        dir="rtl"
      >
        <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
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
                <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                  <ClipboardCheck className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base md:text-xl font-bold truncate">
                    سجل الحضور
                  </h1>
                  <p className="text-amber-200 text-xs truncate">
                    {teacherName}
                  </p>
                </div>
              </div>
              <div className="w-12" />
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8 max-w-md flex items-center justify-center">
          <Card className="border-amber-200 dark:border-amber-800/60 shadow-lg w-full">
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="font-bold text-lg text-[#2A374E] dark:text-white mb-2">
                لا توجد فصول مرتبطة بك
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                لا يمكن تسجيل الحضور دون فصل دراسي. تواصل مع إدارة المدرسة لربط
                فصلك بحسابك.
              </p>
              <Button
                onClick={onBack}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
              >
                <ArrowRight className="w-4 h-4" />
                العودة للوحة التحكم
              </Button>
            </CardContent>
          </Card>
        </main>

        <footer className="mt-auto bg-[#1a2332] text-white/70 text-center text-xs py-3">
          <div className="container mx-auto px-4 flex items-center justify-center gap-2 flex-wrap">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>بوابة المعلم الإلكترونية</span>
            <span className="opacity-50">|</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    );
  }

  // ===== Main render =====
  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Sticky header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-violet-300 transition-colors shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">رجوع للوحة</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold truncate">
                  سجل الحضور
                </h1>
                <p className="text-amber-200 text-xs truncate">
                  {teacherName}
                </p>
              </div>
            </div>
            <div className="w-12 sm:w-20" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {/* Selection bar */}
        <Card className="border-0 shadow-lg mb-6 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-l from-violet-700 via-purple-700 to-fuchsia-700 p-4 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-200" />
                <h2 className="font-bold text-sm md:text-base">
                  تحديد الفصل والتاريخ
                </h2>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Classroom */}
              <div className="md:col-span-5 space-y-1.5">
                <Label
                  htmlFor="classroom-select"
                  className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-violet-600" />
                  الفصل
                </Label>
                <Select
                  value={selectedClassroomId}
                  onValueChange={(v) => {
                    if (!mountedRef.current) return;
                    const t = setTimeout(() => {
                      setSelectedClassroomId(v);
                      // Reset loaded state when classroom changes
                      setLoaded(false);
                      setStudents([]);
                      setPendingStatus({});
                      setPendingNotes({});
                      setPendingArrivalTime({});
                      setExpandedNotes({});
                      hasEditsRef.current = false;
                    }, 0);
                    void t;
                  }}
                  disabled={loading || saving}
                >
                  <SelectTrigger
                    id="classroom-select"
                    className="h-11 w-full"
                  >
                    <SelectValue placeholder="اختر فصلاً" />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.gradeLevel ? ` - ${c.gradeLevel}` : ''}
                        {c.section ? ` (شعبة ${c.section})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="md:col-span-3 space-y-1.5">
                <Label
                  htmlFor="date-input"
                  className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-violet-600" />
                  التاريخ
                </Label>
                <Input
                  id="date-input"
                  type="date"
                  value={selectedDate}
                  max={todayISO()}
                  onChange={(e) => {
                    if (!mountedRef.current) return;
                    const v = e.target.value;
                    const t = setTimeout(() => {
                      setSelectedDate(v);
                      if (loaded) {
                        setLoaded(false);
                        setStudents([]);
                        setPendingStatus({});
                        setPendingNotes({});
                        setPendingArrivalTime({});
                        setExpandedNotes({});
                        hasEditsRef.current = false;
                      }
                    }, 0);
                    void t;
                  }}
                  disabled={loading || saving}
                  className="h-11"
                  dir="ltr"
                />
              </div>

              {/* Load button */}
              <div className="md:col-span-2">
                <Button
                  type="button"
                  onClick={handleLoadClick}
                  disabled={loading || saving}
                  className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">جارٍ التحميل</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span className="text-sm">تحميل القائمة</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Refresh button */}
              <div className="md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRefreshClick}
                  disabled={loading || saving || !loaded}
                  className="w-full h-11 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                  <span className="text-sm">تحديث</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards (only after loading a class) */}
        {loaded && totalStudents > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {STATUS_META.map((meta) => renderKpiCard(meta))}
          </div>
        )}

        {/* Bulk action bar (only after loading + has students) */}
        {loaded && totalStudents > 0 && (
          <Card className="border-0 shadow-md mb-6 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#2A374E] dark:text-white">
                      إجراءات جماعية
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {totalMarked} / {totalStudents} طالب مسجّل
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAll('PRESENT')}
                    disabled={saving}
                    className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 h-9"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    الكل حاضر
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAll('ABSENT')}
                    disabled={saving}
                    className="border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 h-9"
                  >
                    <XCircle className="w-4 h-4" />
                    الكل غائب
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAll(null)}
                    disabled={saving}
                    className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 h-9"
                  >
                    <RefreshCw className="w-4 h-4" />
                    مسح الكل
                  </Button>

                  <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || totalMarked === 0}
                    className="h-9 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-md disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جارٍ الحفظ
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        حفظ السجل
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main content area */}
        {!loaded ? (
          loading ? (
            renderSkeletons()
          ) : error ? (
            renderError()
          ) : (
            renderEmptyInitial()
          )
        ) : totalStudents === 0 ? (
          renderNoStudents()
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pl-1 pr-1 -mr-1 teacher-attendance-scroll">
            {students.map((s) => renderStudentRow(s))}
          </div>
        )}

        {/* Footer hint */}
        {loaded && totalStudents > 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              اضغط على زر الحالة المناسبة لكل طالب. يمكنك إضافة ملاحظة عند الغياب
              أو الغياب بعذر، وتحديد وقت الحضور عند التأخر. لا تنسَ الضغط على
              «حفظ السجل» عند الانتهاء.
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

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .teacher-attendance-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .teacher-attendance-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .teacher-attendance-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(139, 92, 246, 0.3);
          border-radius: 9999px;
        }
        .teacher-attendance-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(139, 92, 246, 0.5);
        }
        .teacher-attendance-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
        }
      `}</style>
    </div>
  );
}
