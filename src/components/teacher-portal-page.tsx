'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowRight, ArrowLeft, LogOut, LogIn, Mail, Phone, User, BookOpen,
  Users, GraduationCap, ClipboardCheck, CalendarDays, Megaphone,
  Lightbulb, ShieldCheck, Clock, Sparkles, Star, AlertTriangle,
  FileText, ListChecks, CalendarClock, BookMarked, Bell, ChevronLeft,
  TestTube2, MailCheck, PhoneCall, IdCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Dynamic import of the exams page (avoid blocking initial bundle)
const TeacherExamsPage = dynamic(() => import('./teacher-exams-page'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">جارٍ التحميل...</p>
      </div>
    </div>
  ),
});

// Dynamic import of the grading page (avoid blocking initial bundle)
const TeacherGradingPage = dynamic(() => import('./teacher-grading-page'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">جارٍ التحميل...</p>
      </div>
    </div>
  ),
});

interface TeacherPortalPageProps {
  onBack: () => void;
  schoolId: string;
}

// ===== Types =====
interface ClassroomInfo {
  id: string;
  name: string;
  gradeLevel: string;
  section?: string;
  studentCount?: number;
}

interface LoginResponse {
  teacherId: string;
  name: string;
  subject: string;
  email: string;
  phone: string;
  imageUrl?: string | null;
  classrooms: ClassroomInfo[];
  testMode: boolean;
  fakeTeacher?: boolean;
  warning?: string;
}

interface DashboardNewsItem {
  id: string;
  title: string;
  excerpt: string;
  image: string | null;
  category: string;
  createdAt: string;
}

interface DashboardData {
  teacher: {
    id: string;
    name: string;
    subject: string;
    email: string;
    phone: string;
    imageUrl: string | null;
  };
  classrooms: ClassroomInfo[];
  stats: {
    totalStudents: number;
    totalClasses: number;
    examsThisWeek: number;
    pendingGrading: number;
  };
  recentNews: DashboardNewsItem[];
  todaySchedule: Array<{
    id: string;
    title: string;
    category: string;
    grade: string;
    section: string;
    fileName: string;
    filePath: string;
  }>;
  fakeTeacher: boolean;
}

// ===== Static config =====
const SESSION_KEY = 'teacher-portal-session';

const statsConfig = [
  {
    key: 'totalStudents' as const,
    label: 'إجمالي الطلاب',
    icon: Users,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
  },
  {
    key: 'totalClasses' as const,
    label: 'عدد الفصول',
    icon: BookOpen,
    gradient: 'from-fuchsia-500 to-pink-600',
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
  },
  {
    key: 'examsThisWeek' as const,
    label: 'امتحانات هذا الأسبوع',
    icon: FileText,
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    key: 'pendingGrading' as const,
    label: 'درجات بانتظار التصحيح',
    icon: ClipboardCheck,
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
  },
];

const quickActions = [
  {
    title: 'إدارة الامتحانات',
    description: 'إنشاء ومتابعة الامتحانات الإلكترونية',
    icon: FileText,
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
  },
  {
    title: 'تصحيح الدرجات',
    description: 'مراجعة إجابات الطلاب وتصحيحها',
    icon: ListChecks,
    color: 'from-fuchsia-500 to-pink-600',
    bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
    borderColor: 'border-fuchsia-200 dark:border-fuchsia-800',
  },
  {
    title: 'سجل الحضور',
    description: 'تسجيل ومتابعة حضور الطلاب',
    icon: ClipboardCheck,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  {
    title: 'جداول الحصص',
    description: 'عرض ومتابعة الجداول الأسبوعية',
    icon: CalendarClock,
    color: 'from-rose-500 to-red-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
];

const teacherTips = [
  {
    title: 'التحضير الجيد للحصة',
    description: 'حضّر دروسك مسبقاً وحدّد أهدافاً واضحة لكل حصة لتسهيل عملية التعليم.',
    icon: BookMarked,
    color: 'from-violet-500 to-purple-600',
    emoji: '📖',
  },
  {
    title: 'التفاعل مع الطلاب',
    description: 'شجّع المشاركة الفعّالة واستخدم الأسئلة المفتوحة لتحفيز التفكير النقدي.',
    icon: Users,
    color: 'from-fuchsia-500 to-pink-600',
    emoji: '💬',
  },
  {
    title: 'التصحيح في الوقت المناسب',
    description: 'صحّح أوراق الامتحانات سريعاً وقدّم تغذية راجعة بنّاءة تساعد الطلاب على التحسّن.',
    icon: ListChecks,
    color: 'from-amber-500 to-orange-600',
    emoji: '✅',
  },
  {
    title: 'متابعة الحضور بانتظام',
    description: 'سجّل الحضور يومياً وتواصل مع أولياء الأمور عند تكرار غياب الطالب.',
    icon: ClipboardCheck,
    color: 'from-rose-500 to-red-600',
    emoji: '📝',
  },
  {
    title: 'تنويع أساليب التقييم',
    description: 'استخدم الاختبارات القصيرة والمشاريع والواجبات للحصول على صورة شاملة عن المستوى.',
    icon: Lightbulb,
    color: 'from-teal-500 to-cyan-600',
    emoji: '💡',
  },
  {
    title: 'التطوير المهني المستمر',
    description: 'اطلع على أحدث الأساليب التعليمية وحاضر الورش التدريبية لتطوير مهاراتك.',
    icon: GraduationCap,
    color: 'from-emerald-500 to-teal-600',
    emoji: '🎓',
  },
];

function categoryBadgeClass(category: string): string {
  const c = (category || '').trim();
  const map: Record<string, string> = {
    'تنبيه': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    'أخبار': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    'إعلان': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'فعالية': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  };
  return map[c] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function TeacherPortalPage({ onBack, schoolId }: TeacherPortalPageProps) {
  // ===== State =====
  const [fadeIn, setFadeIn] = useState(false);
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  // Login form state
  const [teacherCode, setTeacherCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Session state
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Sub-page navigation
  const [showExamsPage, setShowExamsPage] = useState(false);
  const [showGradingPage, setShowGradingPage] = useState(false);

  // ===== Restore session on mount =====
  useEffect(() => {
    let restored: LoginResponse | null = null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) restored = JSON.parse(raw) as LoginResponse;
    } catch {
      restored = null;
    }
    // set-state-in-effect pattern
    const t = setTimeout(() => {
      if (restored) setSession(restored);
      setFadeIn(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // ===== Fetch dashboard when session changes =====
  useEffect(() => {
    if (!session) {
      const t = setTimeout(() => setDashboard(null), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    const t1 = setTimeout(() => setDashboardLoading(true), 0);
    async function run() {
      try {
        const res = await fetch(
          `/api/teacher/dashboard?schoolId=${encodeURIComponent(
            schoolId
          )}&teacherId=${encodeURIComponent(session.teacherId)}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'فشل تحميل البيانات');
        }
        if (cancelled) return;
        const t = setTimeout(() => setDashboard(data as DashboardData), 0);
        void t;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل تحميل البيانات';
        toast.error(msg);
      } finally {
        if (cancelled) return;
        const t = setTimeout(() => setDashboardLoading(false), 0);
        void t;
      }
    }
    run();
    return () => {
      cancelled = true;
      clearTimeout(t1);
    };
  }, [session, schoolId]);

  // Staggered card animation for quick actions
  useEffect(() => {
    if (!session) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    quickActions.forEach((_, index) => {
      timeouts.push(
        setTimeout(() => {
          setVisibleCards((prev) =>
            prev.includes(index) ? prev : [...prev, index]
          );
        }, 300 + index * 120)
      );
    });
    return () => timeouts.forEach(clearTimeout);
  }, [session]);

  // ===== Handlers =====
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!teacherCode.trim() || !phone.trim()) {
      const t = setTimeout(() => setLoginError('يرجى إدخال كود المعلم ورقم الهاتف'), 0);
      return () => clearTimeout(t);
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, teacherCode: teacherCode.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'فشل تسجيل الدخول');
      }
      const loginData = data as LoginResponse;
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(loginData));
      } catch {
        // ignore quota errors
      }
      const t = setTimeout(() => {
        setSession(loginData);
        setVisibleCards([]);
      }, 0);
      void t;
      if (loginData.testMode) {
        toast.success('تم تسجيل الدخول في وضع التجربة');
      } else {
        toast.success(`مرحباً ${loginData.name}`);
      }
      if (loginData.warning) {
        toast.info(loginData.warning);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      const t = setTimeout(() => setLoginError(msg), 0);
      void t;
    } finally {
      const t = setTimeout(() => setSubmitting(false), 0);
      void t;
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    const t = setTimeout(() => {
      setSession(null);
      setDashboard(null);
      setTeacherCode('');
      setPhone('');
      setVisibleCards([]);
    }, 0);
    void t;
    toast.info('تم تسجيل الخروج من بوابة المعلم');
  };

  const handleQuickAction = (title: string) => {
    if (title === 'إدارة الامتحانات') {
      const t = setTimeout(() => setShowExamsPage(true), 0);
      void t;
      return;
    }
    if (title === 'تصحيح الدرجات') {
      const t = setTimeout(() => setShowGradingPage(true), 0);
      void t;
      return;
    }
    toast.info(`${title} — قريباً`, {
      description: 'هذه الخدمة قيد التطوير وستتوفر في الإصدار القادم.',
    });
  };

  // ===== Render: Login Form =====
  if (!session) {
    return (
      <div
        className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
        dir="rtl"
      >
        {/* Header */}
        <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-white hover:text-violet-300 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
                <span className="font-medium">العودة للرئيسية</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">بوابة المعلم</h1>
                  <p className="text-violet-200 text-xs">منصة المعلمين الإلكترونية</p>
                </div>
              </div>
              <div className="w-28" />
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8 max-w-md flex items-center justify-center">
          <div
            className={`w-full transition-all duration-700 ${
              fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <Card className="border-0 shadow-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Gradient header */}
                <div className="bg-gradient-to-l from-violet-600 via-purple-600 to-fuchsia-600 p-8 text-white text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
                  <div className="relative z-10">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-4 ring-white/10">
                      <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-1">تسجيل دخول المعلم</h2>
                    <p className="text-violet-100 text-sm">
                      أدخل بياناتك للوصول إلى لوحة التحكم
                    </p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="teacherCode" className="text-sm font-medium flex items-center gap-1.5">
                      <IdCard className="w-4 h-4 text-violet-600" />
                      كود المعلم / البريد الإلكتروني
                    </Label>
                    <Input
                      id="teacherCode"
                      type="text"
                      value={teacherCode}
                      onChange={(e) => setTeacherCode(e.target.value)}
                      placeholder="example@school.edu"
                      autoComplete="username"
                      disabled={submitting}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-violet-600" />
                      رقم الهاتف
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      autoComplete="tel"
                      disabled={submitting}
                      className="h-11"
                      dir="ltr"
                    />
                  </div>

                  {loginError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium text-base shadow-lg"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        جاري الدخول...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        دخول بوابة المعلم
                      </>
                    )}
                  </Button>

                  {/* Test mode hint */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                    <TestTube2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold mb-0.5">وضع التجربة</p>
                      <p>
                        ابدأ رقم الهاتف بـ <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">test-</code>
                        {' '}مثال: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">test-001</code>
                        {' '}لتجربة البوابة ببيانات تجريبية دون الحاجة لحساب حقيقي.
                      </p>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Sticky footer */}
        <footer className="mt-auto bg-[#1a2332] text-white/70 text-center text-xs py-3">
          <div className="container mx-auto px-4">
            بوابة المعلم الإلكترونية &copy; {new Date().getFullYear()}
          </div>
        </footer>
      </div>
    );
  }

  // ===== Render: Exams Management Sub-page =====
  if (showExamsPage && session) {
    return (
      <TeacherExamsPage
        onBack={() => {
          const t = setTimeout(() => setShowExamsPage(false), 0);
          void t;
        }}
        schoolId={schoolId}
        teacherId={session.teacherId}
        teacherName={session.name}
      />
    );
  }

  // ===== Render: Grading Sub-page =====
  if (showGradingPage && session) {
    return (
      <TeacherGradingPage
        onBack={() => {
          const t = setTimeout(() => setShowGradingPage(false), 0);
          void t;
        }}
        schoolId={schoolId}
        teacherId={session.teacherId}
        teacherName={session.name}
      />
    );
  }

  // ===== Render: Dashboard =====
  const stats = dashboard?.stats ?? {
    totalStudents: 0,
    totalClasses: 0,
    examsThisWeek: 0,
    pendingGrading: 0,
  };
  const classrooms = dashboard?.classrooms ?? session.classrooms ?? [];
  const recentNews = dashboard?.recentNews ?? [];
  const todaySchedule = dashboard?.todaySchedule ?? [];
  const isFake = Boolean(session.fakeTeacher || dashboard?.fakeTeacher);

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
              <span className="font-medium hidden sm:inline">العودة للرئيسية</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base md:text-xl font-bold truncate">{session.name}</h1>
                <p className="text-violet-200 text-xs truncate">{session.subject}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {/* Welcome banner */}
        <div
          className={`mb-6 transition-all duration-700 ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute -inset-[2px] bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl blur-[1px] opacity-60" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-l from-violet-700 via-purple-700 to-fuchsia-700 p-6 md:p-10 text-white relative overflow-hidden">
                  {/* Decorative */}
                  <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/4 translate-y-1/4" />

                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {session.imageUrl ? (
                        <img
                          src={session.imageUrl}
                          alt={session.name}
                          className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover ring-4 ring-white/20 shadow-2xl"
                        />
                      ) : (
                        <div className="w-24 h-24 md:w-28 md:h-28 bg-white/20 backdrop-blur rounded-full flex items-center justify-center ring-4 ring-white/20 shadow-2xl">
                          <User className="w-12 h-12 md:w-14 md:h-14 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-center md:text-right">
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-2 flex-wrap">
                        <Sparkles className="w-5 h-5 text-violet-200" />
                        <Badge className="bg-white/15 text-white border-white/20 text-xs">
                          بوابة المعلم
                        </Badge>
                        {session.testMode && (
                          <Badge className="bg-amber-400/30 text-amber-100 border-amber-300/30 text-xs flex items-center gap-1">
                            <TestTube2 className="w-3 h-3" />
                            وضع التجربة
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold mb-1">
                        أهلاً {session.name}
                      </h2>
                      <p className="text-violet-100/90 text-sm md:text-base">
                        معلم {session.subject}
                      </p>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4 text-xs">
                        {session.email && (
                          <div className="flex items-center gap-1.5 text-violet-100">
                            <Mail className="w-4 h-4" />
                            <span dir="ltr">{session.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-violet-100">
                          <BookOpen className="w-4 h-4" />
                          <span>{classrooms.length} فصل</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-violet-100">
                          <ShieldCheck className="w-4 h-4" />
                          <span>دخول آمن</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Fake teacher warning */}
        {isFake && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold mb-0.5">بيانات تجريبية</p>
              <p className="leading-relaxed">
                لا يوجد معلمون مسجّلون في هذه المدرسة بعد. أنت تستعرض البوابة ببيانات
                تجريبية — الإحصائيات والفصول الفارضة هي للعرض فقط.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {dashboardLoading && !dashboard && (
          <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-white/60 dark:bg-gray-800/60 animate-pulse" />
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-6 h-6 text-violet-600" />
            <h2 className="text-xl md:text-2xl font-bold text-[#2A374E] dark:text-white">
              نظرة سريعة
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsConfig.map((s) => {
              const Icon = s.icon;
              const value = stats[s.key];
              return (
                <Card
                  key={s.key}
                  className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <CardContent className="p-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-md mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-[#2A374E] dark:text-white mb-0.5">
                      {dashboardLoading && !dashboard ? '—' : value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {s.label}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-violet-600" />
            <h2 className="text-xl md:text-2xl font-bold text-[#2A374E] dark:text-white">
              الإجراءات السريعة
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const visible = visibleCards.includes(index);
              return (
                <Card
                  key={action.title}
                  className={`border ${action.borderColor} ${action.bgColor} shadow-sm hover:shadow-lg transition-all duration-500 cursor-pointer group overflow-hidden ${
                    visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  onClick={() => handleQuickAction(action.title)}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform shrink-0`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[#2A374E] dark:text-white text-base mb-0.5">
                        {action.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {action.description}
                      </p>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-violet-600 transition-colors shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Two-column layout: My Classes + Announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* My Classes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6 text-violet-600" />
              <h2 className="text-xl md:text-2xl font-bold text-[#2A374E] dark:text-white">
                فصولي
              </h2>
            </div>
            {classrooms.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700">
                <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">لا توجد فصول مُسندة إليك حالياً.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
                {classrooms.map((c) => (
                  <Card
                    key={c.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#2A374E] dark:text-white text-sm truncate">
                            {c.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {c.gradeLevel}
                            {c.section ? ` - شعبة ${c.section}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Users className="w-4 h-4 text-violet-500" />
                        <span className="font-bold text-violet-700 dark:text-violet-300 text-sm">
                          {c.studentCount ?? 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* School Announcements */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-6 h-6 text-violet-600" />
              <h2 className="text-xl md:text-2xl font-bold text-[#2A374E] dark:text-white">
                إعلانات المدرسة
              </h2>
            </div>
            {recentNews.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700">
                <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">لا توجد إعلانات حالياً.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pl-1">
                {recentNews.map((n) => (
                  <Card
                    key={n.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {n.image ? (
                          <img
                            src={n.image}
                            alt={n.title}
                            className="w-14 h-14 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center shrink-0">
                            <Megaphone className="w-6 h-6 text-violet-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={`text-[10px] px-2 py-0.5 ${categoryBadgeClass(n.category)}`}>
                              {n.category}
                            </Badge>
                            <span className="text-[10px] text-gray-400">
                              {formatDate(n.createdAt)}
                            </span>
                          </div>
                          <h3 className="font-bold text-[#2A374E] dark:text-white text-sm leading-snug mb-1">
                            {n.title}
                          </h3>
                          {n.excerpt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                              {n.excerpt}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Today's schedule (only if data exists) */}
        {todaySchedule.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <CalendarClock className="w-6 h-6 text-violet-600" />
              <h2 className="text-xl md:text-2xl font-bold text-[#2A374E] dark:text-white">
                جدول اليوم
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todaySchedule.map((s) => (
                <Card key={s.id} className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#2A374E] dark:text-white text-sm truncate">
                        {s.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {s.grade || '—'}
                        {s.section ? ` - ${s.section}` : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Tips for Teachers */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-6 h-6 text-violet-600" />
            <h2 className="text-xl md:text-2xl font-bold text-[#2A374E] dark:text-white">
              نصائح للمعلمين
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherTips.map((tip) => {
              const Icon = tip.icon;
              return (
                <Card
                  key={tip.title}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <CardContent className="p-5">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tip.color} flex items-center justify-center shadow-md mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-[#2A374E] dark:text-white text-sm mb-1">
                      {tip.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {tip.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
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
    </div>
  );
}
