'use client';

/**
 * ============================================================
 *  ParentAnalyticsPage — تحليلات مقارنة لأداء الطالب
 *  ============================================================
 *  بوابة احترافية لأولياء الأمور تعرض:
 *    • شاشة دخول (معرّف الطالب + المدرسة)
 *    • KPIs (المتوسط، الترتيب، عدد الامتحانات، اتجاه التحسّن)
 *    • خط زمني مقارن (طالب vs متوسط الفصل)
 *    • تفصيل المواد (رادار)
 *    • توزيع درجات الفصل + موضع الطالب
 *    • أحدث النتائج في جدول
 *
 *  تستهلك: GET /api/exams/analytics?schoolId=...&studentId=...
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight, ArrowUp, ArrowDown, Minus, Trophy, Users, Target,
  TrendingUp, TrendingDown, Award, BookOpen, BarChart3, Loader2,
  LogOut, GraduationCap, Medal, AlertCircle, RefreshCw, Star,
  ChartLine, ChartPie, Sparkles, Search,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend as RLegend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell,
  PieChart, Pie, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ParentAnalyticsPageProps {
  onBack: () => void;
  schoolId?: string;
}

interface StudentInfo {
  studentId: string;
  studentName: string;
  schoolId: string;
}

interface TimelineItem {
  examId: string;
  examTitle: string;
  subject: string;
  date: string | null;
  studentPct: number;
  classAvgPct: number;
  classSize: number;
}

interface SubjectItem {
  subject: string;
  studentPct: number;
  classAvgPct: number;
  examCount: number;
}

interface DistributionItem {
  range: string;
  label: string;
  count: number;
  isStudent: boolean;
}

interface AnalyticsResponse {
  success: boolean;
  student: { id: string; name: string; classroomId: string | null; classroomName: string };
  kpis: {
    avgScore: number;
    classAvgScore: number;
    rank: number;
    classSize: number;
    totalExams: number;
    passedCount: number;
    improvementTrend: number;
  };
  timeline: TimelineItem[];
  subjectBreakdown: SubjectItem[];
  distribution: DistributionItem[];
}

const SUBJECT_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

const DISTRIBUTION_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function shortTitle(title: string, max = 18): string {
  if (title.length <= max) return title;
  return title.slice(0, max - 1) + '…';
}

// ============================================================
//  Main Component
// ============================================================
export default function ParentAnalyticsPage({ onBack, schoolId }: ParentAnalyticsPageProps) {
  const [student, setStudent] = useState<StudentInfo | null>(null);

  const handleLogin = (info: StudentInfo) => setStudent(info);
  const handleLogout = () => setStudent(null);

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={student ? handleLogout : onBack}
              className="flex items-center gap-2 text-white hover:text-emerald-300 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium">{student ? 'تبديل الطالب' : 'العودة للبوابة'}</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">تحليلات الأداء المقارنة</h1>
                <p className="text-emerald-200 text-xs">متابعة احترافية لمستوى ابنك</p>
              </div>
            </div>
            <div className="w-28" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {!student ? (
          <LoginScreen onLogin={handleLogin} schoolId={schoolId} />
        ) : (
          <AnalyticsDashboard student={student} onBack={onBack} />
        )}
      </main>

      <footer className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white mt-auto">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-300" />
              <span className="text-sm font-medium">تحليلات الأداء المقارنة</span>
            </div>
            <p className="text-sm text-blue-200/70">
              © {new Date().getFullYear()} جميع الحقوق محفوظة - المنصة التعليمية
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
//  Login Screen
// ============================================================
function LoginScreen({
  onLogin, schoolId,
}: {
  onLogin: (info: StudentInfo) => void;
  schoolId?: string;
}) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [schoolIdInput, setSchoolIdInput] = useState(schoolId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!studentId.trim()) { setError('معرّف الطالب مطلوب'); return; }
    if (!studentName.trim()) { setError('اسم الطالب مطلوب'); return; }
    if (!schoolIdInput.trim()) { setError('معرّف المدرسة مطلوب'); return; }
    setLoading(true);
    try {
      // نسمح بالدخول حتى لو فشل الفحص (وضع عدم الاتصال أو لا توجد بيانات)
      onLogin({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        schoolId: schoolIdInput.trim(),
      });
    } catch {
      onLogin({
        studentId: studentId.trim(),
        studentName: studentName.trim(),
        schoolId: schoolIdInput.trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card className="shadow-2xl border-0 overflow-hidden">
        {/* Top accent */}
        <div className="h-2 bg-gradient-to-l from-emerald-500 via-teal-500 to-emerald-500" />
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg">
              <BarChart3 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white mb-1">
              تحليلات الأداء
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              أدخل بيانات ابنك لعرض التحليلات المقارنة التفصيلية
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                معرّف الطالب <span className="text-red-500">*</span>
              </Label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="مثال: stu-2024-001"
                className="text-right"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                اسم الطالب <span className="text-red-500">*</span>
              </Label>
              <Input
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="الاسم كما هو مسجّل في المدرسة"
                className="text-right"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                معرّف المدرسة <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolId"
                value={schoolIdInput}
                onChange={(e) => setSchoolIdInput(e.target.value)}
                placeholder="معرّف المدرسة"
                className="text-right font-mono text-sm"
                autoComplete="off"
                disabled={!!schoolId}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري التحقق...</>
              ) : (
                <><Search className="w-4 h-4 ml-2" /> عرض التحليلات</>
              )}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
            <div className="flex gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-medium">ماذا سترى؟</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-700 dark:text-emerald-400">
                  <li>مقارنة أداء ابنك بمتوسط الفصل</li>
                  <li>ترتيبه بين زملائه</li>
                  <li>تطوّر مستواه عبر الامتحانات</li>
                  <li>نقاط القوة والضعف في كل مادة</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
//  Analytics Dashboard
// ============================================================
function AnalyticsDashboard({ student, onBack }: { student: StudentInfo; onBack: () => void }) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        schoolId: student.schoolId,
        studentId: student.studentId,
        studentName: student.studentName,
      });
      const res = await fetch(`/api/exams/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'فشل جلب التحليلات');
      } else {
        setData(json);
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-500 dark:text-gray-400">جاري حساب التحليلات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>تعذّر عرض التحليلات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={load} variant="outline" className="w-full mt-4">
          <RefreshCw className="w-4 h-4 ml-2" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!data) return null;

  // Empty state
  if (data.timeline.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-4">
          <BookOpen className="w-12 h-12 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold text-[#2A374E] dark:text-white mb-2">
          لا توجد نتائج بعد
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          لم يُسجَّل لابنك أي امتحان مصحّح بعد. ستظهر التحليلات تلقائياً عند توفر النتائج.
        </p>
        <Button onClick={onBack} variant="outline">
          <ArrowRight className="w-4 h-4 ml-2" /> العودة للبوابة
        </Button>
      </div>
    );
  }

  const k = data.kpis;
  const diff = k.avgScore - k.classAvgScore;
  const isUp = diff > 0;
  const isFlat = Math.abs(diff) < 0.5;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] p-6 md:p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full translate-x-1/4 translate-y-1/4" />
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/20 shrink-0">
                <GraduationCap className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                    تقرير الأداء
                  </Badge>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">{data.student.name}</h2>
                <p className="text-emerald-100/90 text-sm">
                  الفصل: {data.student.classroomName} • {k.totalExams} امتحان مُصحَّح
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average */}
        <KpiCard
          icon={<Target className="w-5 h-5" />}
          label="متوسط نسبتك"
          value={`${k.avgScore}%`}
          accent="from-emerald-500 to-teal-600"
          subtitle={
            <span className={isUp ? 'text-emerald-600' : isFlat ? 'text-gray-500' : 'text-rose-600'}>
              {isUp ? <ArrowUp className="w-3 h-3 inline" /> : isFlat ? <Minus className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />}
              {' '}{Math.abs(diff).toFixed(1)}% عن الفصل
            </span>
          }
        />
        {/* Rank */}
        <KpiCard
          icon={<Trophy className="w-5 h-5" />}
          label="ترتيبك في الفصل"
          value={k.rank > 0 ? `#${k.rank}` : '—'}
          accent="from-amber-500 to-orange-500"
          subtitle={
            <span className="text-gray-500">
              {k.classSize > 0 ? `من ${k.classSize} طالب` : 'غير متاح'}
            </span>
          }
        />
        {/* Total Exams */}
        <KpiCard
          icon={<BookOpen className="w-5 h-5" />}
          label="امتحانات مؤدّاة"
          value={String(k.totalExams)}
          accent="from-sky-500 to-blue-600"
          subtitle={
            <span className="text-emerald-600">{k.passedCount} ناجح</span>
          }
        />
        {/* Improvement */}
        <KpiCard
          icon={k.improvementTrend > 0 ? <TrendingUp className="w-5 h-5" /> : k.improvementTrend < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
          label="اتجاه التحسّن"
          value={k.improvementTrend > 0 ? `+${k.improvementTrend}%` : `${k.improvementTrend}%`}
          accent={
            k.improvementTrend > 0
              ? 'from-green-500 to-emerald-600'
              : k.improvementTrend < 0
                ? 'from-rose-500 to-red-600'
                : 'from-gray-500 to-gray-600'
          }
          subtitle={<span className="text-gray-500">آخر vs أول امتحان</span>}
        />
      </div>

      {/* Timeline Chart */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-l from-emerald-500 to-teal-600 p-4">
            <div className="flex items-center gap-2 text-white">
              <ChartLine className="w-5 h-5" />
              <h3 className="font-bold">تطوّر الأداء عبر الامتحانات</h3>
              <Badge className="bg-white/20 text-white border-white/30 text-xs mr-auto">
                {data.timeline.length} امتحان
              </Badge>
            </div>
          </div>
          <div className="p-4 md:p-6 bg-white dark:bg-gray-800">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={data.timeline.map((t) => ({
                name: shortTitle(t.examTitle),
                subject: t.subject,
                'ابنك': t.studentPct,
                'متوسط الفصل': t.classAvgPct,
              }))}>
                <defs>
                  <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="classGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'inherit' }} stroke="#6b7280" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#6b7280" />
                <RTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.98)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    fontFamily: 'inherit',
                    direction: 'rtl',
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937' }}
                />
                <RLegend />
                <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'حد النجاح', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
                <Area type="monotone" dataKey="متوسط الفصل" stroke="#94a3b8" strokeWidth={2} fill="url(#classGrad)" />
                <Area type="monotone" dataKey="ابنك" stroke="#10b981" strokeWidth={3} fill="url(#studentGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Subject Breakdown + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Radar */}
        {data.subjectBreakdown.length > 0 && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-l from-purple-500 to-violet-600 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Target className="w-5 h-5" />
                  <h3 className="font-bold">نقاط القوة والضعف حسب المادة</h3>
                </div>
              </div>
              <div className="p-4 md:p-6 bg-white dark:bg-gray-800">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={data.subjectBreakdown.map((s) => ({
                    subject: s.subject,
                    'ابنك': s.studentPct,
                    'متوسط الفصل': s.classAvgPct,
                  }))}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontFamily: 'inherit' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.98)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontFamily: 'inherit',
                        direction: 'rtl',
                      }}
                    />
                    <RLegend />
                    <Radar name="ابنك" dataKey="ابنك" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.45} strokeWidth={2} />
                    <Radar name="متوسط الفصل" dataKey="متوسط الفصل" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Distribution */}
        {data.distribution.some((d) => d.count > 0) && (
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-l from-rose-500 to-red-500 p-4">
                <div className="flex items-center gap-2 text-white">
                  <ChartPie className="w-5 h-5" />
                  <h3 className="font-bold">توزيع مستويات الفصل</h3>
                </div>
              </div>
              <div className="p-4 md:p-6 bg-white dark:bg-gray-800">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.distribution.map((d) => ({
                    name: d.label,
                    'عدد الطلاب': d.count,
                    isStudent: d.isStudent,
                    fill: d.isStudent ? '#10b981' : '#94a3b8',
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'inherit' }} stroke="#6b7280" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <RTooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.98)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        fontFamily: 'inherit',
                        direction: 'rtl',
                      }}
                    />
                    <Bar dataKey="عدد الطلاب" radius={[8, 8, 0, 0]}>
                      {data.distribution.map((d, i) => (
                        <Cell key={i} fill={d.isStudent ? '#10b981' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 ml-1 align-middle" />
                  مستوى ابنك الحالي
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subject Comparison Table */}
      {data.subjectBreakdown.length > 0 && (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-l from-sky-500 to-blue-600 p-4">
              <div className="flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-bold">تفصيل المواد الدراسية</h3>
              </div>
            </div>
            <div className="p-4 md:p-6 bg-white dark:bg-gray-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-right py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">المادة</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">نسبة ابنك</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">متوسط الفصل</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">الفرق</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">عدد الامتحانات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjectBreakdown.map((s, i) => {
                    const d = s.studentPct - s.classAvgPct;
                    const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                    return (
                      <tr key={s.subject} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="font-medium text-gray-800 dark:text-white">{s.subject}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className="inline-flex items-center justify-center min-w-[60px] px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold">
                            {s.studentPct}%
                          </span>
                        </td>
                        <td className="text-center py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">
                          {s.classAvgPct}%
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`inline-flex items-center gap-1 font-bold ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                            {d > 0 ? <ArrowUp className="w-3 h-3" /> : d < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {Math.abs(d).toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center py-3 px-2 text-gray-500 dark:text-gray-400">
                          {s.examCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Exams Timeline Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-l from-amber-500 to-orange-500 p-4">
            <div className="flex items-center gap-2 text-white">
              <Medal className="w-5 h-5" />
              <h3 className="font-bold">سجلّ الامتحانات الأخيرة</h3>
            </div>
          </div>
          <div className="p-4 md:p-6 bg-white dark:bg-gray-800">
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {data.timeline.slice().reverse().map((t) => {
                const passed = t.studentPct >= 50;
                const aboveAvg = t.studentPct > t.classAvgPct;
                return (
                  <div
                    key={t.examId}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${passed ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                      {passed ? <Award className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-rose-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 dark:text-white truncate">{t.examTitle}</h4>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <Badge variant="outline" className="text-xs">{t.subject}</Badge>
                        <span>{formatDate(t.date)}</span>
                        <span>•</span>
                        <span>{t.classSize} طالب</span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className={`text-2xl font-bold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.studentPct}%
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        الفصل: {t.classAvgPct}%
                        {aboveAvg ? <ArrowUp className="w-3 h-3 inline text-emerald-500 mr-1" /> : <ArrowDown className="w-3 h-3 inline text-rose-500 mr-1" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insight Card */}
      <InsightCard data={data} />
    </div>
  );
}

// ============================================================
//  KPI Card
// ============================================================
function KpiCard({
  icon, label, value, accent, subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-r ${accent} flex items-center justify-center text-white shadow-md`}>
            {icon}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-[#2A374E] dark:text-white mb-1">{value}</p>
        {subtitle && <div className="text-xs">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
//  Insight Card — رؤى ذكية مُشتقّة من البيانات
// ============================================================
function InsightCard({ data }: { data: AnalyticsResponse }) {
  const insights: Array<{ icon: React.ReactNode; text: string; color: string }> = [];

  const k = data.kpis;
  // 1) مقارنة بالفصل
  if (k.avgScore > k.classAvgScore + 5) {
    insights.push({
      icon: <Star className="w-4 h-4" />,
      text: `أداء ابنك أعلى من متوسط الفصل بـ ${(k.avgScore - k.classAvgScore).toFixed(1)}% — استمرّ في تشجيعه!`,
      color: 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
    });
  } else if (k.avgScore < k.classAvgScore - 5) {
    insights.push({
      icon: <AlertCircle className="w-4 h-4" />,
      text: `أداء ابنك أقل من متوسط الفصل بـ ${(k.classAvgScore - k.avgScore).toFixed(1)}% — قد يحتاج إلى دعم إضافي.`,
      color: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20',
    });
  }
  // 2) الترتيب
  if (k.rank > 0 && k.classSize > 0) {
    const topPct = (k.rank / k.classSize) * 100;
    if (topPct <= 25) {
      insights.push({
        icon: <Trophy className="w-4 h-4" />,
        text: `ابنك ضمن أعلى 25% من فصله (ترتيب ${k.rank} من ${k.classSize})`,
        color: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
      });
    }
  }
  // 3) التحسّن
  if (k.improvementTrend > 5) {
    insights.push({
      icon: <TrendingUp className="w-4 h-4" />,
      text: `تحسّن ملحوظ بمقدار ${k.improvementTrend}% بين أول وآخر امتحان — اتجاه إيجابي`,
      color: 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
    });
  } else if (k.improvementTrend < -5) {
    insights.push({
      icon: <TrendingDown className="w-4 h-4" />,
      text: `انخفاض بمقدار ${Math.abs(k.improvementTrend)}% — يُنصح بمراجعة المواد الأساسية`,
      color: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20',
    });
  }
  // 4) أفضل/أضعف مادة
  if (data.subjectBreakdown.length >= 2) {
    const sorted = [...data.subjectBreakdown].sort((a, b) => b.studentPct - a.studentPct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    insights.push({
      icon: <BookOpen className="w-4 h-4" />,
      text: `أقوى مادة: ${best.subject} (${best.studentPct}%) • يحتاج تركيزاً في: ${worst.subject} (${worst.studentPct}%)`,
      color: 'text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/20',
    });
  }

  if (insights.length === 0) return null;

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] p-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold">رؤى ذكية</h3>
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-gray-800 space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-xl ${ins.color}`}>
              {ins.icon}
              <p className="text-sm font-medium leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
