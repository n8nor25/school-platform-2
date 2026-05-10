'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, GraduationCap, Search, AlertCircle, CheckCircle2,
  XCircle, Trophy, TrendingUp, BarChart3, Star, RotateCcw,
  ChevronDown, Loader2, Award, Users, Percent, Heart, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ResultsPageProps {
  onBack: () => void;
  schoolId: string;
}

interface GradeOption {
  id: string;
  gradeName: string;
  studentCount: number;
  updatedAt: string;
  term: string;
  archived: boolean;
}

interface SubjectDetail {
  subject: string;
  subjectLabel?: string;
  score: number;
  max: number;
  minPass: number;
  passed: boolean;
}

interface PassStatus {
  passed: boolean;
  totalPass: boolean;
  addedSubjectPass: boolean;
  notAddedSubjectPass: boolean;
  minPassingPercent: number;
  studentAddedTotal: number;
  maxAddedTotal: number;
  subjectDetails: {
    added: SubjectDetail[];
    notAdded: SubjectDetail[];
  };
}

interface StudentResult {
  seatNumber: string;
  studentName: string;
  arabic: number;
  english: number;
  social: number;
  math: number;
  science: number;
  total: number;
  religion: number;
  art: number;
  computer: number;
}

interface MaxScores {
  arabic: number;
  english: number;
  social: number;
  math: number;
  science: number;
  religion: number;
  art: number;
  computer: number;
  total: number;
}

interface QueryResult {
  student: StudentResult;
  maxScores: MaxScores;
  passStatus: PassStatus;
  gradeName: string;
  term: string;
}

const subjectLabels: Record<string, string> = {
  arabic: 'عربي',
  english: 'انجليزي',
  social: 'دراسات',
  math: 'رياضيات',
  science: 'علوم',
  religion: 'دين',
  art: 'فنية',
  computer: 'كمبيوتر',
};

function getScoreColor(percentage: number): string {
  if (percentage >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (percentage >= 70) return 'text-blue-600 dark:text-blue-400';
  if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBg(percentage: number): string {
  if (percentage >= 85) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
  if (percentage >= 70) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  if (percentage >= 50) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function getProgressBarColor(percentage: number): string {
  if (percentage >= 85) return 'bg-emerald-500';
  if (percentage >= 70) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function ResultsPage({ onBack, schoolId }: ResultsPageProps) {
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [seatNumber, setSeatNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [gradesLoading, setGradesLoading] = useState<boolean>(true);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<boolean>(false);
  const [fadeIn, setFadeIn] = useState<boolean>(false);

  // Fetch available grades on mount
  useEffect(() => {
    const fetchGrades = async () => {
      try {
        setGradesLoading(true);
        const res = await fetch(`/api/exam-results?archived=false&schoolId=${encodeURIComponent(schoolId)}`);
        if (!res.ok) throw new Error('فشل في تحميل الصفوف');
        const data = await res.json();
        setGrades(data);
      } catch {
        setError('فشل في تحميل الصفوف الدراسية. حاول مرة أخرى.');
      } finally {
        setGradesLoading(false);
      }
    };
    fetchGrades();
  }, []);

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = async () => {
    if (!selectedGradeId) {
      setError('يرجى اختيار الصف الدراسي والترم');
      return;
    }
    if (!seatNumber.trim()) {
      setError('يرجى إدخال رقم الجلوس');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/exam-results/query?gradeId=${encodeURIComponent(selectedGradeId)}&seat=${encodeURIComponent(seatNumber.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'فشل في البحث عن النتيجة');
        return;
      }

      setResult(data);
    } catch {
      setError('فشل في الاتصال بالخادم. تأكد من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedGradeId('');
    setSelectedGrade('');
    setSeatNumber('');
    setResult(null);
    setError(null);
    setSearched(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Compute statistics from result
  const computeStats = () => {
    if (!result) return null;
    const { student, maxScores, passStatus } = result;
    const totalMax = maxScores.total || 1;
    const totalPercent = Math.round((student.total / totalMax) * 100);

    const addedSubjects = passStatus.subjectDetails.added;
    const avgAdded = addedSubjects.length > 0
      ? Math.round(addedSubjects.reduce((sum, s) => sum + (s.max > 0 ? (s.score / s.max) * 100 : 0), 0) / addedSubjects.length)
      : 0;

    const highestSubject = [...addedSubjects].sort((a, b) => {
      const pA = a.max > 0 ? (a.score / a.max) * 100 : 0;
      const pB = b.max > 0 ? (b.score / b.max) * 100 : 0;
      return pB - pA;
    })[0];

    const addedTotalPercent = passStatus.maxAddedTotal > 0
      ? Math.round((passStatus.studentAddedTotal / passStatus.maxAddedTotal) * 100)
      : 0;

    return {
      totalPercent,
      avgAdded,
      addedTotalPercent,
      highestSubject: highestSubject ? {
        name: subjectLabels[highestSubject.subject] || highestSubject.subject,
        percent: Math.round(highestSubject.max > 0 ? (highestSubject.score / highestSubject.max) * 100 : 0),
      } : null,
      passedSubjects: addedSubjects.filter(s => s.passed).length,
      totalAddedSubjects: addedSubjects.length,
    };
  };

  const stats = computeStats();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" dir="rtl">
      {/* Header */}
      <header className="bg-[#2A374E] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium">العودة للرئيسية</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">نتائج الطلاب</h1>
                <p className="text-blue-200 text-xs">استعلام عن نتائج الامتحانات</p>
              </div>
            </div>
            <div className="w-28" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        {/* Search Section */}
        <div
          className={`mb-8 transition-all duration-700 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          <div className="relative">
            {/* Gradient border wrapper */}
            <div className="absolute -inset-[2px] bg-gradient-to-r from-[#2A374E] via-red-500 to-[#2A374E] rounded-2xl blur-[1px]" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Top accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-[#2A374E] via-red-500 to-[#2A374E]" />
                
                <div className="p-6 md:p-8">
                  {/* Logo & Title */}
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#2A374E] to-[#3d4f6e] rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-white dark:ring-gray-700">
                      <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-[#2A374E] dark:text-white mb-2">
                      نتائج الطلاب
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      منصة لعرض نتائج الطلاب وتتبعها
                    </p>
                  </div>

                  {/* Search Form */}
                  <div className="space-y-5 max-w-lg mx-auto">
                    {/* Grade Select */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        الصف الدراسي
                      </label>
                      <Select
                        value={selectedGradeId}
                        onValueChange={(val) => {
                          setSelectedGradeId(val);
                          const g = grades.find(gr => gr.id === val);
                          setSelectedGrade(g?.gradeName || '');
                          setError(null);
                        }}
                        dir="rtl"
                      >
                        <SelectTrigger className="w-full h-12 text-right bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-base">
                          <SelectValue placeholder={gradesLoading ? 'جارٍ التحميل...' : 'اختر الصف والترم'} />
                        </SelectTrigger>
                        <SelectContent>
                          {grades.map((grade) => (
                            <SelectItem key={grade.id} value={grade.id}>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-[#2A374E] dark:text-blue-300" />
                                <span className="font-medium">{grade.gradeName}</span>
                                {grade.term && (
                                  <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400">
                                    {grade.term}
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-400">
                                  ({grade.studentCount} طالب)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Seat Number Input */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        رقم الجلوس
                      </label>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={seatNumber}
                          onChange={(e) => {
                            const arabicMap: Record<string, string> = {
                              '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
                              '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
                            }
                            const val = e.target.value.replace(/[٠-٩]/g, (c) => arabicMap[c] || c).replace(/[^0-9]/g, '')
                            setSeatNumber(val);
                            setError(null);
                          }}
                          onKeyDown={handleKeyPress}
                          placeholder="أدخل رقم الجلوس بالأرقام"
                          className="h-12 text-right text-lg pr-4 pl-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                          disabled={loading}
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Search Button */}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleSearch}
                        disabled={loading || !selectedGrade || !seatNumber.trim()}
                        className="flex-1 h-12 text-lg font-bold bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] hover:from-[#1e2a3e] hover:to-[#2A374E] text-white shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>جارٍ البحث...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Search className="w-5 h-5" />
                            <span>بحث</span>
                          </div>
                        )}
                      </Button>
                      {(searched || result) && (
                        <Button
                          onClick={handleReset}
                          variant="outline"
                          className="h-12 px-4 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
              <div className="absolute inset-0 border-4 border-[#2A374E] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">جارٍ البحث عن النتيجة...</p>
          </div>
        )}

        {/* No Results State */}
        {searched && !loading && !result && !error && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
              لم يتم العثور على نتيجة
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              تأكد من رقم الجلوس والصف الدراسي وحاول مرة أخرى
            </p>
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-[#2A374E] text-[#2A374E] dark:border-gray-500 dark:text-gray-300"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              محاولة جديدة
            </Button>
          </div>
        )}

        {/* Results Display */}
        {result && !loading && (
          <div className="space-y-6">
            {/* Student Info Card */}
            <Card className="border-0 shadow-xl overflow-hidden">
              <CardContent className="p-0">
                {/* Card header with gradient */}
                <div className="bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] p-6 text-white">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="text-2xl md:text-3xl font-bold mb-1">
                        {result.student.studentName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-blue-200">
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-4 h-4" />
                          {result.gradeName}
                        </span>
                        {result.term && (
                          <>
                            <span className="text-blue-300">|</span>
                            <span className="flex items-center gap-1 text-amber-200">
                              {result.term}
                            </span>
                          </>
                        )}
                        <span className="text-blue-300">|</span>
                        <span>رقم الجلوس: {result.student.seatNumber}</span>
                      </div>
                    </div>
                    {/* Pass/Fail Badge */}
                    <div
                      className={`px-6 py-3 rounded-xl font-bold text-lg shadow-lg transition-all duration-500 ${
                        result.passStatus.passed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.passStatus.passed ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <XCircle className="w-6 h-6" />
                        )}
                        <span>{result.passStatus.passed ? 'ناجح' : 'راسب'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Score Section */}
                <div className="p-6 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-[#2A374E] dark:text-white">
                      المجموع الكلي
                    </span>
                    <div className="text-left">
                      <span className="text-3xl font-bold text-[#2A374E] dark:text-white">
                        {result.student.total}
                      </span>
                      <span className="text-gray-400 text-lg mr-1">
                        / {result.maxScores.total}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          stats
                            ? getProgressBarColor(stats.totalPercent)
                            : 'bg-[#2A374E]'
                        }`}
                        style={{
                          width: `${Math.min(
                            (result.student.total / (result.maxScores.total || 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                      <span>0</span>
                      <span className="font-bold text-gray-600 dark:text-gray-300">
                        {stats ? `${stats.totalPercent}%` : ''}
                      </span>
                      <span>{result.maxScores.total}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subjects Table Card */}
            <Card className="border-0 shadow-xl overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <h4 className="text-lg font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-red-500" />
                    تفاصيل المواد
                  </h4>
                </div>

                {/* Added to total subjects */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                      المواد المضافة للمجموع
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                          <th className="text-right py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">المادة</th>
                          <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">الدرجة</th>
                          <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">من</th>
                          <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">النسبة</th>
                          <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.passStatus.subjectDetails.added.map((subject, index) => {
                          const percentage = subject.max > 0 ? Math.round((subject.score / subject.max) * 100) : 0;
                          return (
                            <tr
                              key={subject.subject}
                              className={`border-b border-gray-100 dark:border-gray-700/50 transition-colors duration-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                                index % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/30'
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    {subjectLabels[subject.subject] || subject.subject}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`font-bold text-lg ${getScoreColor(percentage)}`}>
                                  {subject.score}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400">
                                {subject.max}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getProgressBarColor(percentage)}`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className={`font-bold text-sm ${getScoreColor(percentage)}`}>
                                    {percentage}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge
                                  className={`text-xs font-bold ${
                                    subject.passed
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}
                                >
                                  {subject.passed ? 'ناجح' : 'راسب'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Total Row */}
                        <tr className="bg-[#2A374E] text-white">
                          <td className="py-3 px-4 font-bold" colSpan={1}>
                            المجموع
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-lg">
                            {result.student.total}
                          </td>
                          <td className="py-3 px-4 text-center text-blue-200">
                            {result.maxScores.total}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-white rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      (result.student.total / (result.maxScores.total || 1)) * 100,
                                      100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="font-bold text-sm">
                                {stats ? `${stats.totalPercent}%` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              className={`text-xs font-bold ${
                                result.passStatus.totalPass
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-red-500 text-white'
                              }`}
                            >
                              {result.passStatus.totalPass ? 'ناجح' : 'راسب'}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Not added to total subjects */}
                <div className="p-5 pt-0">
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Percent className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        المواد غير المضافة للمجموع
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {result.passStatus.subjectDetails.notAdded.map((subject) => {
                        const percentage = subject.max > 0 ? Math.round((subject.score / subject.max) * 100) : 0;
                        return (
                          <div
                            key={subject.subject}
                            className={`rounded-xl p-4 border transition-all duration-300 hover:shadow-md ${getScoreBg(percentage)}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                                {subjectLabels[subject.subject] || subject.subject}
                              </span>
                              <Badge
                                className={`text-xs ${
                                  subject.passed
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}
                              >
                                {subject.passed ? 'ناجح' : 'راسب'}
                              </Badge>
                            </div>
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className={`text-2xl font-bold ${getScoreColor(percentage)}`}>
                                {subject.score}
                              </span>
                              <span className="text-gray-400 text-sm">/ {subject.max}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200/50 dark:bg-gray-600/50 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getProgressBarColor(percentage)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Section */}
            {stats && (
              <Card className="border-0 shadow-xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h4 className="text-lg font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-red-500" />
                      إحصائيات الأداء
                    </h4>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Total Percentage */}
                      <div className="bg-gradient-to-br from-[#2A374E] to-[#3d4f6e] rounded-xl p-4 text-white text-center shadow-md">
                        <div className="w-10 h-10 mx-auto mb-2 bg-white/20 rounded-full flex items-center justify-center">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <div className="text-2xl font-bold">{stats.totalPercent}%</div>
                        <div className="text-blue-200 text-xs mt-1">النسبة الكلية</div>
                      </div>

                      {/* Average of added subjects */}
                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
                        <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-white">{stats.avgAdded}%</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">متوسط المواد</div>
                      </div>

                      {/* Highest subject */}
                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
                        <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                          <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-white">
                          {stats.highestSubject ? `${stats.highestSubject.percent}%` : '-'}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                          أعلى مادة ({stats.highestSubject?.name || '-'})
                        </div>
                      </div>

                      {/* Passed subjects count */}
                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-center shadow-md hover:shadow-lg transition-shadow">
                        <div className="w-10 h-10 mx-auto mb-2 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="text-2xl font-bold text-gray-800 dark:text-white">
                          {stats.passedSubjects}/{stats.totalAddedSubjects}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">مواد ناجحة</div>
                      </div>
                    </div>

                    {/* Detailed pass/fail breakdown */}
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Condition 1: Half total of added subjects */}
                      <div className={`rounded-xl p-3 border ${
                        result.passStatus.totalPass
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          {result.passStatus.totalPass ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`font-bold text-sm ${
                            result.passStatus.totalPass
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}>
                            مجموع المواد: {result.passStatus.totalPass ? 'ناجح' : 'راسب'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mr-7">
                          {result.passStatus.studentAddedTotal} من {result.passStatus.maxAddedTotal} ≥ {result.passStatus.minPassingPercent}%
                        </p>
                      </div>

                      {/* Condition 2: Pass in each added subject */}
                      <div className={`rounded-xl p-3 border ${
                        result.passStatus.addedSubjectPass
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          {result.passStatus.addedSubjectPass ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`font-bold text-sm ${
                            result.passStatus.addedSubjectPass
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}>
                            مواد المجموع: {result.passStatus.addedSubjectPass ? 'ناجح' : 'راسب'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mr-7">
                          كل مادة أساسية ≥ {result.passStatus.minPassingPercent}% من العظمى
                        </p>
                      </div>

                      {/* Condition 3: Pass in not-added subjects */}
                      <div className={`rounded-xl p-3 border ${
                        result.passStatus.notAddedSubjectPass
                          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          {result.passStatus.notAddedSubjectPass ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                          <span className={`font-bold text-sm ${
                            result.passStatus.notAddedSubjectPass
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}>
                            مواد إضافية: {result.passStatus.notAddedSubjectPass ? 'ناجح' : 'راسب'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mr-7">
                          دين، فنية، كمبيوتر ≥ {result.passStatus.minPassingPercent}%
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Congratulatory / Encouragement Message */}
            {result && (
              <div>
                {result.passStatus.passed ? (
                  <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-700 shadow-lg shadow-amber-100/50 dark:shadow-amber-900/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/20 dark:via-yellow-900/10 dark:to-orange-900/20" />
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400" />
                    <div className="relative p-6 text-center">
                      <div className="flex justify-center gap-2 mb-3">
                        <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
                        <Sparkles className="w-8 h-8 text-yellow-500 animate-pulse" style={{ animationDelay: '0.5s' }} />
                        <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" style={{ animationDelay: '1s' }} />
                      </div>
                      <h4 className="text-xl font-bold text-amber-700 dark:text-amber-300 mb-2">
                        🎉 كل التهاني والتبريكات! 🎉
                      </h4>
                      <p className="text-amber-600 dark:text-amber-400 text-base leading-relaxed mb-1">
                        بنتيجتك المتميزة، أسأل الله لك دوام التوفيق والنجاح
                      </p>
                      <p className="text-amber-600/80 dark:text-amber-400/80 text-sm leading-relaxed mb-3">
                        في مسيرتك الدراسية وحياتك القادمة، فأنت أهلٌ للتميز دائماً
                      </p>
                      <div className="flex items-center justify-center gap-2 text-amber-500 dark:text-amber-400">
                        <Heart className="w-4 h-4 fill-amber-500" />
                        <span className="text-sm font-medium">بكل الحب والتمنيات</span>
                        <Heart className="w-4 h-4 fill-amber-500" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-700 shadow-lg shadow-blue-100/50 dark:shadow-blue-900/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/10 dark:to-purple-900/20" />
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400" />
                    <div className="relative p-6 text-center">
                      <div className="flex justify-center gap-2 mb-3">
                        <Sparkles className="w-6 h-6 text-blue-500 animate-pulse" />
                        <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" style={{ animationDelay: '0.5s' }} />
                        <Sparkles className="w-6 h-6 text-blue-500 animate-pulse" style={{ animationDelay: '1s' }} />
                      </div>
                      <h4 className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                        لا تيأس، فكل نجاح يبدأ بخطوة 💪
                      </h4>
                      <p className="text-blue-600 dark:text-blue-400 text-base leading-relaxed mb-1">
                        اجعل هذه التجربة دافعاً للتميز في المرة القادمة
                      </p>
                      <p className="text-blue-600/80 dark:text-blue-400/80 text-sm leading-relaxed mb-3">
                        نؤمن بك وبقدراتك، والمستقبل بين يديك فلا تستسلم أبداً
                      </p>
                      <div className="flex items-center justify-center gap-2 text-blue-500 dark:text-blue-400">
                        <Heart className="w-4 h-4 fill-blue-500" />
                        <span className="text-sm font-medium">بكل الحب والتمنيات</span>
                        <Heart className="w-4 h-4 fill-blue-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Note */}
            <div className="mt-4 mb-4">
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-700 dark:text-amber-400 text-sm leading-relaxed">
                  هذه النتائج إرشادية وللاستعلام الرسمي يرجى مراجعة إدارة المدرسة
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state - no search yet */}
        {!searched && !loading && !result && (
          <div
            className={`text-center py-12 transition-all duration-700 delay-300 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#2A374E]/10 to-red-500/10 dark:from-[#2A374E]/20 dark:to-red-500/20 rounded-full flex items-center justify-center">
              <GraduationCap className="w-16 h-16 text-[#2A374E]/30 dark:text-white/20" />
            </div>
            <h3 className="text-xl font-bold text-gray-400 dark:text-gray-500 mb-2">
              ابحث عن نتيجتك
            </h3>
            <p className="text-gray-400 dark:text-gray-600 max-w-sm mx-auto">
              اختر الصف الدراسي وأدخل رقم الجلوس للاستعلام عن نتيجة الامتحان
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#2A374E] text-white py-4 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-blue-200 text-sm">
            جميع الحقوق محفوظة © {new Date().getFullYear()} - نظام نتائج الطلاب
          </p>
        </div>
      </footer>
    </div>
  );
}
