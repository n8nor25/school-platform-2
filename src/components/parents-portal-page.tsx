'use client';

/**
 * ============================================================
 *  بوابة أولياء الأمور
 *  Parents Portal Page
 * ============================================================
 *  المكوّنات:
 *    ① ParentLogin     — تسجيل دخول ولي الأمر (رقم الطالب + الهاتف)
 *    ② ParentDashboard — لوحة المتابعة بعد الدخول
 *
 *  التكامل:
 *    • POST /api/parent/login?schoolId=X  body {schoolId, studentNumber, parentPhone}
 *    • GET  /api/parent/attendance?schoolId&studentNumber&parentPhone&limit=90
 *    • GET  /api/news?schoolId&limit=30
 *
 *  الجلسة: sessionStorage key = "parents-portal-session"
 *
 *  ملاحظات تصميمية:
 *    • تخطيط RTL، ألوان زمردی/تركوازی (لا أزرق ولا بنفسجي كلون أساسي)
 *    • تذييل لاصق في أسفل الشاشة (min-h-screen flex flex-col + mt-auto)
 *    • set-state-in-effect: setState داخل useEffect عبر setTimeout(0)
 *    • لا تكرار: "متابعة النتائج" كإجراء سريع فقط (بدون بطاقة "استعلم عن نتائج ابنك")
 * ============================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight, CalendarDays, Phone, Mail, MapPin,
  Megaphone, BookOpenCheck, Users, Heart, Lightbulb,
  Monitor, ClipboardCheck, GraduationCap, MessageSquare,
  Shield, Sparkles, LogOut,
  Loader2, AlertTriangle, FlaskConical, BookOpen,
  Search, TrendingUp, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import ParentAttendanceSection from './parent-attendance-section';

// ===== Types =====

interface ChildInfo {
  id: string;
  studentNumber: string;
  name: string;
  classroomId?: string | null;
  classroomName?: string | null;
  gradeName?: string | null;
}

interface ParentSession {
  parentName: string;
  parentPhone: string;
  children: ChildInfo[];
  testMode?: boolean;
  fakeStudent?: boolean;
  originalStudentNumber?: string | null;
  warning?: string | null;
}

interface NewsItem {
  id: string;
  title: string;
  excerpt?: string | null;
  content?: string | null;
  image?: string | null;
  category?: string | null;
  active?: boolean;
  createdAt: string;
}

interface ParentsPortalPageProps {
  onBack: () => void;
  schoolId: string;
  onOpenExams?: (child: ChildInfo) => void;
  onOpenAnalytics?: (child: ChildInfo) => void;
}

// ===== Constants =====

const SESSION_KEY = 'parents-portal-session';

const NEWS_CATEGORY_META: Record<string, { label: string; cls: string }> = {
  'تنبيه':   { label: 'تنبيه',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' },
  'فعاليات': { label: 'فعاليات', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  'أخبار':   { label: 'أخبار',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  'إعلان':   { label: 'إعلان',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  'عام':     { label: 'عام',     cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
};

function getNewsCategoryMeta(category?: string | null) {
  if (!category) return { label: 'عام', cls: NEWS_CATEGORY_META['عام'].cls };
  return NEWS_CATEGORY_META[category] ?? { label: category, cls: NEWS_CATEGORY_META['عام'].cls };
}

const PARENT_TIPS = [
  {
    title: 'متابعة الواجبات يومياً',
    description: 'تأكد من إنجاز ابنك لواجباته المدرسية يومياً وراجعها معه لتعزيز الفهم والاستيعاب',
    icon: ClipboardCheck,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'التواصل المستمر مع المعلمين',
    description: 'حافظ على تواصل دوري مع معلمي ابنك لمتابعة مستواه الأكاديمي والسلوكي',
    icon: Users,
    gradient: 'from-teal-500 to-emerald-500',
  },
  {
    title: 'توفير بيئة دراسية مناسبة',
    description: 'أمّن لابنك مكاناً هادئاً ومريحاً للدراسة بعيداً عن المشتتات والإزعاج',
    icon: BookOpenCheck,
    gradient: 'from-amber-500 to-yellow-500',
  },
  {
    title: 'تشجيع القراءة والاطلاع',
    description: 'شجّع ابنك على القراءة اليومية ووفّر له كتباً وقصصاً تناسب عمره واهتماماته',
    icon: Lightbulb,
    gradient: 'from-purple-500 to-violet-500',
  },
  {
    title: 'مراقبة استخدام التكنولوجيا',
    description: 'راقب وقت شاشة ابنك وتأكد من استخدام التقنية بطريقة مفيدة وآمنة للتعلم',
    icon: Monitor,
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    title: 'الاهتمام بالصحة النفسية',
    description: 'اهتم بالصحة النفسية لابنك واستمع لمشاعره وكون له دائماً سنداً وداعماً',
    icon: Heart,
    gradient: 'from-red-500 to-rose-500',
  },
];

// ===== Helpers =====

function timeAgo(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diff = Math.max(0, now - date.getTime());
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days >= 30) return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    if (days >= 1) return `قبل ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}`;
    if (hours >= 1) return `قبل ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`;
    if (minutes >= 1) return `قبل ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
    return 'الآن';
  } catch {
    return '';
  }
}

// ===== Main Component =====

export default function ParentsPortalPage({ onBack, schoolId, onOpenExams, onOpenAnalytics }: ParentsPortalPageProps) {
  const [session, setSession] = useState<ParentSession | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore session from sessionStorage on mount (deferred to avoid lint warning)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { session: ParentSession; selectedChildId?: string };
          if (parsed?.session && Array.isArray(parsed.session.children) && parsed.session.children.length > 0) {
            setSession(parsed.session);
            const firstChildId = parsed.session.children[0].id;
            setSelectedChildId(parsed.selectedChildId || firstChildId);
          }
        }
      } catch {
        // ignore
      } finally {
        setRestored(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = useCallback((s: ParentSession) => {
    setSession(s);
    const firstChildId = s.children?.[0]?.id ?? null;
    setSelectedChildId(firstChildId);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ session: s, selectedChildId: firstChildId }));
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    setSelectedChildId(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleSwitchChild = useCallback((childId: string) => {
    setSelectedChildId(childId);
    if (session) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ session, selectedChildId: childId }));
      } catch {
        // ignore
      }
    }
  }, [session]);

  // ===== Render =====

  if (!restored) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

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
              className="flex items-center gap-2 text-white hover:text-emerald-300 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">العودة للرئيسية</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">بوابة أولياء الأمور</h1>
                <p className="text-emerald-200 text-xs hidden sm:block">متابعة وتواصل مع المدرسة</p>
              </div>
            </div>
            {session ? (
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            ) : (
              <div className="w-8 sm:w-28" />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-[1280px] w-full">
        {!session ? (
          <ParentLogin schoolId={schoolId} onLogin={handleLogin} />
        ) : (
          <ParentDashboard
            session={session}
            schoolId={schoolId}
            selectedChildId={selectedChildId}
            onSwitchChild={handleSwitchChild}
            onLogout={handleLogout}
            onOpenExams={onOpenExams}
            onOpenAnalytics={onOpenAnalytics}
          />
        )}
      </main>

      {/* Sticky Footer */}
      <footer className="mt-auto bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white py-6">
        <div className="container mx-auto px-4 max-w-[1280px] text-center">
          <p className="text-sm text-emerald-100">
            © {new Date().getFullYear()} بوابة أولياء الأمور — جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// ① Parent Login
// ============================================================

function ParentLogin({
  schoolId, onLogin,
}: {
  schoolId: string;
  onLogin: (s: ParentSession) => void;
}) {
  const [studentNumber, setStudentNumber] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNumber.trim() || !parentPhone.trim()) {
      setError('يرجى إدخال رقم الطالب وهاتف ولي الأمر');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parent/login?schoolId=${encodeURIComponent(schoolId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          studentNumber: studentNumber.trim(),
          parentPhone: parentPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || (res.status === 404 ? 'رقم الطالب أو هاتف ولي الأمر غير صحيح' : 'تعذّر تسجيل الدخول');
        throw new Error(typeof msg === 'string' ? msg : 'تعذّر تسجيل الدخول');
      }
      if (!data?.children || !Array.isArray(data.children) || data.children.length === 0) {
        throw new Error('لم يتم العثور على أبناء مرتبطين بهذا الحساب');
      }
      const sessionData: ParentSession = {
        parentName: data.parentName || 'ولي الأمر',
        parentPhone: data.parentPhone || parentPhone.trim(),
        children: data.children,
        testMode: !!data.testMode,
        fakeStudent: !!data.fakeStudent,
        originalStudentNumber: data.originalStudentNumber ?? null,
        warning: data.warning ?? null,
      };
      onLogin(sessionData);
      toast.success(`مرحباً ${sessionData.parentName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذّر تسجيل الدخول';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-md mx-auto transition-all duration-700 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
      <Card className="overflow-hidden border-0 shadow-2xl">
        {/* Gradient header */}
        <div className="bg-gradient-to-l from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-teal-300/10 rounded-full translate-x-1/4 translate-y-1/4" />
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur">
              <Users className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-1">تسجيل دخول ولي الأمر</h2>
            <p className="text-emerald-50 text-sm">أدخل بيانات الطالب للوصول إلى لوحة المتابعة</p>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="studentNumber" className="text-sm font-semibold">
                رقم الطالب
              </Label>
              <Input
                id="studentNumber"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="مثال: 2024002"
                disabled={loading}
                autoComplete="off"
                inputMode="numeric"
                className="text-base h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parentPhone" className="text-sm font-semibold">
                هاتف ولي الأمر
              </Label>
              <Input
                id="parentPhone"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="مثال: 01023456789"
                disabled={loading}
                autoComplete="off"
                inputMode="tel"
                className="text-base h-11"
                dir="ltr"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  دخول البوابة
                </>
              )}
            </Button>
          </form>

          {/* Test mode hint */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FlaskConical className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">وضع التجربة</p>
                <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                  لإضافة بادئة <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">test-</code> قبل رقم الطالب
                  لعرض بيانات تجريبية. مثلاً:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800 font-mono">
                    2024002 / 01023456789
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800 font-mono">
                    test-001
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ② Parent Dashboard
// ============================================================

function ParentDashboard({
  session, schoolId, selectedChildId, onSwitchChild, onLogout,
  onOpenExams, onOpenAnalytics,
}: {
  session: ParentSession;
  schoolId: string;
  selectedChildId: string | null;
  onSwitchChild: (id: string) => void;
  onLogout: () => void;
  onOpenExams?: (child: ChildInfo) => void;
  onOpenAnalytics?: (child: ChildInfo) => void;
}) {
  const selectedChild = session.children.find((c) => c.id === selectedChildId) ?? session.children[0];

  const announcementsRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [showAllNews, setShowAllNews] = useState(false);

  // Fetch news
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const res = await fetch(`/api/news?schoolId=${encodeURIComponent(schoolId)}&limit=30`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          if (!res.ok) throw new Error();
          const data = await res.json();
          if (!cancelled && Array.isArray(data)) {
            setNews(data.filter((n: NewsItem) => n.active !== false));
          }
        } catch {
          // silent
        } finally {
          if (!cancelled) setNewsLoading(false);
        }
      })();
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [schoolId]);

  const isFakeStudent = !!session.fakeStudent || (selectedChild?.id?.startsWith('test-student-') ?? false);

  const handleAction = useCallback((action: string) => {
    if (!selectedChild) return;
    switch (action) {
      case 'exams':
        if (onOpenExams) {
          onOpenExams(selectedChild);
        } else {
          toast.info('نتائج الامتحانات غير متاحة حالياً');
        }
        break;
      case 'analytics':
        if (onOpenAnalytics) {
          onOpenAnalytics(selectedChild);
        } else {
          toast.info('تحليلات الأداء غير متاحة حالياً');
        }
        break;
      case 'schedules':
        toast.info('جداول الحصص — قريباً');
        break;
      case 'library':
        toast.info('المكتبة الرقمية — قريباً');
        break;
      case 'announcements':
        announcementsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'contact':
        contactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
    }
  }, [selectedChild, onOpenExams, onOpenAnalytics]);

  // Quick actions — NO duplicates. Results/announcements appear ONLY here.
  const quickActions: { key: string; title: string; description: string; icon: typeof Search; gradient: string; bg: string; border: string }[] = [
    {
      key: 'exams',
      title: 'نتائج الامتحانات',
      description: 'استعلم عن نتائج ابنك',
      icon: Search,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      key: 'analytics',
      title: 'تحليلات الأداء',
      description: 'تحليل أداء ابنك الأكاديمي',
      icon: TrendingUp,
      gradient: 'from-teal-500 to-emerald-500',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      border: 'border-teal-200 dark:border-teal-800',
    },
    {
      key: 'schedules',
      title: 'جداول الحصص',
      description: 'عرض جداول الحصص الأسبوعية',
      icon: CalendarDays,
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
    },
    {
      key: 'library',
      title: 'المكتبة الرقمية',
      description: 'مراجع وكتب إلكترونية',
      icon: BookOpen,
      gradient: 'from-rose-500 to-pink-500',
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-200 dark:border-rose-800',
    },
    {
      key: 'announcements',
      title: 'الإعلانات المدرسية',
      description: 'آخر الأخبار والتنبيهات',
      icon: Megaphone,
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      key: 'contact',
      title: 'التواصل مع المدرسة',
      description: 'تواصل مع إدارة المدرسة',
      icon: MessageSquare,
      gradient: 'from-teal-500 to-emerald-600',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      border: 'border-teal-200 dark:border-teal-800',
    },
  ].filter((a) => a.key !== 'exams' || onOpenExams).filter((a) => a.key !== 'analytics' || onOpenAnalytics);

  const visibleNews = showAllNews ? news : news.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl shadow-xl">
        <div className="bg-gradient-to-l from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-300/10 rounded-full translate-x-1/4 translate-y-1/4" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-xl md:text-2xl font-bold">مرحباً، {session.parentName}</h2>
                {session.testMode && (
                  <Badge className="bg-amber-400 text-amber-900 border-0 font-semibold">
                    <FlaskConical className="w-3 h-3" />
                    وضع التجربة
                  </Badge>
                )}
              </div>
              {selectedChild && (
                <p className="text-emerald-50 text-sm md:text-base">
                  متابعة الطالب: <span className="font-semibold">{selectedChild.name}</span>
                  {selectedChild.classroomName && (
                    <span className="text-emerald-100/80"> — {selectedChild.classroomName}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fake student warning banner */}
      {isFakeStudent && (
        <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-200 dark:bg-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-1">تنبيه: بيانات تجريبية</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
                  أنت تستخدم بيانات طالب تجريبي. قد لا تطابق السجلات الواقع. يُنصح بتسجيل الخروج وإدخال رقم طالب صحيح.
                </p>
                {session.originalStudentNumber && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                    رقم الطالب الأصلي: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">{session.originalStudentNumber}</code>
                    {selectedChild?.studentNumber && selectedChild.studentNumber !== session.originalStudentNumber && (
                      <>
                        {' '}— الرقم الحالي: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">{selectedChild.studentNumber}</code>
                      </>
                    )}
                  </p>
                )}
                <Button
                  onClick={onLogout}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج وإدخال رقم طالب صحيح
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Child selector (if multiple children) */}
      {session.children.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-semibold text-sm">اختر الطالب</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {session.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSwitchChild(child.id)}
                  className={`shrink-0 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    child.id === selectedChild?.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  {child.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick actions grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-base">الإجراءات السريعة</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className={`group text-right p-4 rounded-xl border-2 ${action.border} ${action.bg} hover:shadow-md transition-all hover:-translate-y-0.5`}
              >
                <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center mb-2 shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-semibold text-sm mb-0.5">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attendance section */}
      {selectedChild && (
        <ParentAttendanceSection
          schoolId={schoolId}
          studentNumber={selectedChild.studentNumber}
          parentPhone={session.parentPhone}
          childName={selectedChild.name}
        />
      )}

      {/* Announcements section */}
      <div ref={announcementsRef} className="scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-base">الإعلانات المدرسية</h3>
          </div>
          {!newsLoading && news.length > 0 && (
            <Badge variant="secondary" className="text-xs">{news.length} إعلان</Badge>
          )}
        </div>

        {newsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              لا توجد إعلانات حالياً
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleNews.map((item) => {
                const meta = getNewsCategoryMeta(item.category);
                return (
                  <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                            <Megaphone className="w-7 h-7 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={`text-[10px] ${meta.cls} border`}>{meta.label}</Badge>
                            <span className="text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
                          </div>
                          <h4 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{item.title}</h4>
                          {item.excerpt && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.excerpt}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {news.length > 4 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllNews((v) => !v)}
                className="w-full mt-3 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
              >
                {showAllNews ? 'عرض أقل' : `عرض جميع الإعلانات (${news.length})`}
                <ChevronDown className={`w-4 h-4 transition-transform ${showAllNews ? 'rotate-180' : ''}`} />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Tips for parents */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-base">نصائح لأولياء الأمور</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PARENT_TIPS.map((tip) => {
            const Icon = tip.icon;
            return (
              <Card key={tip.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tip.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">{tip.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Contact section */}
      <div ref={contactRef} className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-base">تواصل مع المدرسة</h3>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">الهاتف</p>
                  <p className="text-sm font-semibold truncate" dir="ltr">01000000000</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/10">
                <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
                  <p className="text-sm font-semibold truncate" dir="ltr">info@school.edu</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">العنوان</p>
                  <p className="text-sm font-semibold truncate">العنوان البريدي للمدرسة</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
