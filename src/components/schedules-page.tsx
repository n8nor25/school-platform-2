'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, Calendar, Download, ExternalLink, Filter,
  GraduationCap, Loader2, Clock, User, BookOpen, FileText,
  AlertCircle, FolderOpen, CalendarDays, Users, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SchedulesPageProps {
  onBack: () => void;
  schoolId: string;
}

interface Schedule {
  id: string;
  schoolId: string;
  title: string;
  category: 'class' | 'teacher' | 'daily';
  grade: string | null;
  section: string | null;
  teacherName: string | null;
  dayOfWeek: number | null;
  filePath: string;
  fileName: string;
  type: string;
  active: boolean;
  archived: boolean;
  createdAt: string;
}

type CategoryFilter = 'all' | 'class' | 'teacher' | 'daily';

const categoryConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  class: {
    label: 'الصفوف',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: <GraduationCap className="w-3.5 h-3.5" />,
  },
  teacher: {
    label: 'المعلمين',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    icon: <User className="w-3.5 h-3.5" />,
  },
  daily: {
    label: 'اليومي',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

const tabs: { key: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'الكل', icon: <FolderOpen className="w-4 h-4" /> },
  { key: 'class', label: 'الصفوف', icon: <GraduationCap className="w-4 h-4" /> },
  { key: 'teacher', label: 'المعلمين', icon: <User className="w-4 h-4" /> },
  { key: 'daily', label: 'اليومي', icon: <Clock className="w-4 h-4" /> },
];

const dayLabels: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export default function SchedulesPage({ onBack, schoolId }: SchedulesPageProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [cardDelays, setCardDelays] = useState<boolean>(false);

  // Fetch schedules on mount
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/schedules?schoolId=${encodeURIComponent(schoolId)}`);
        if (!res.ok) throw new Error('فشل في تحميل الجداول');
        const data = await res.json();
        setSchedules(data);
      } catch {
        setError('فشل في تحميل جداول الحصص. حاول مرة أخرى.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedules();
  }, [schoolId]);

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Stagger card animations after data loads
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setCardDelays(true), 200);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Filter schedules by active tab
  const filteredSchedules = activeTab === 'all'
    ? schedules
    : schedules.filter((s) => s.category === activeTab);

  // Count by category
  const counts = {
    all: schedules.length,
    class: schedules.filter((s) => s.category === 'class').length,
    teacher: schedules.filter((s) => s.category === 'teacher').length,
    daily: schedules.filter((s) => s.category === 'daily').length,
  };

  const handleOpenFile = (filePath: string) => {
    window.open(filePath, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
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
              <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">جداول الحصص</h1>
                <p className="text-blue-200 text-xs">عرض وتحميل جداول الحصص الدراسية</p>
              </div>
            </div>
            <div className="w-28" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {/* Hero Section */}
        <div
          className={`mb-8 transition-all duration-700 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          <div className="relative">
            {/* Gradient border wrapper */}
            <div className="absolute -inset-[2px] bg-gradient-to-r from-[#2A374E] via-amber-500 to-[#2A374E] rounded-2xl blur-[1px]" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Top accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-[#2A374E] via-amber-500 to-[#2A374E]" />

                <div className="p-6 md:p-8">
                  {/* Logo & Title */}
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#2A374E] to-[#3d4f6e] rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-white dark:ring-gray-700">
                      <Calendar className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-[#2A374E] dark:text-white mb-2">
                      جداول الحصص
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      عرض وتحميل جداول الحصص الدراسية للصفوف والمعلمين
                    </p>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-800">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.class}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">جداول الصفوف</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center border border-purple-100 dark:border-purple-800">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{counts.teacher}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">جداول المعلمين</div>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center border border-amber-100 dark:border-amber-800">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.daily}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">جداول يومية</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div
          className={`mb-6 transition-all duration-700 delay-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-[#2A374E] dark:text-gray-300" />
            <span className="text-sm font-bold text-[#2A374E] dark:text-gray-200">تصفية حسب النوع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] text-white shadow-lg scale-105'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-md border border-gray-200 dark:border-gray-600 hover:border-[#2A374E] dark:hover:border-gray-400'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <Badge
                    className={`text-xs font-bold px-1.5 py-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {counts[tab.key]}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
              <div className="absolute inset-0 border-4 border-[#2A374E] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">جارٍ تحميل جداول الحصص...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1">خطأ في التحميل</h3>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredSchedules.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <CalendarDays className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
              {activeTab === 'all' ? 'لا توجد جداول حصص' : `لا توجد جداول ${categoryConfig[activeTab]?.label || ''}`}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {activeTab === 'all'
                ? 'لم يتم إضافة أي جداول حصص بعد'
                : 'لا توجد جداول من هذا النوع حالياً'}
            </p>
            {activeTab !== 'all' && (
              <Button
                onClick={() => setActiveTab('all')}
                variant="outline"
                className="border-[#2A374E] text-[#2A374E] dark:border-gray-500 dark:text-gray-300"
              >
                <FolderOpen className="w-4 h-4 ml-2" />
                عرض كل الجداول
              </Button>
            )}
          </div>
        )}

        {/* Schedules Grid */}
        {!loading && !error && filteredSchedules.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchedules.map((schedule, index) => {
              const config = categoryConfig[schedule.category];
              const isCurrent = schedule.type === 'حالي';

              return (
                <Card
                  key={schedule.id}
                  className={`border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 overflow-hidden group ${
                    cardDelays ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: cardDelays ? `${index * 80}ms` : '0ms' }}
                >
                  <CardContent className="p-0">
                    {/* Card top accent */}
                    <div className={`h-1 ${
                      schedule.category === 'class'
                        ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                        : schedule.category === 'teacher'
                        ? 'bg-gradient-to-r from-purple-400 to-purple-600'
                        : 'bg-gradient-to-r from-amber-400 to-amber-600'
                    }`} />

                    <div className="p-5">
                      {/* Header: Category + Type badges */}
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={`${config.bgColor} ${config.color} ${config.borderColor} border text-xs font-bold flex items-center gap-1`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                        <Badge
                          className={`text-xs font-bold ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <Sparkles className="w-3 h-3 ml-1" />
                          {schedule.type}
                        </Badge>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-[#2A374E] dark:text-white mb-3 line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {schedule.title}
                      </h3>

                      {/* Details */}
                      <div className="space-y-2 mb-4">
                        {/* Grade & Section */}
                        {(schedule.grade || schedule.section) && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>
                              {schedule.grade || ''}
                              {schedule.grade && schedule.section ? ' / ' : ''}
                              {schedule.section || ''}
                            </span>
                          </div>
                        )}

                        {/* Teacher Name */}
                        {schedule.teacherName && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Users className="w-4 h-4 text-purple-500 shrink-0" />
                            <span>{schedule.teacherName}</span>
                          </div>
                        )}

                        {/* Day of Week */}
                        {schedule.dayOfWeek != null && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{dayLabels[schedule.dayOfWeek] || `يوم ${schedule.dayOfWeek}`}</span>
                          </div>
                        )}

                        {/* File Name */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate">{schedule.fileName}</span>
                        </div>

                        {/* Created Date */}
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatDate(schedule.createdAt)}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <Button
                          onClick={() => handleOpenFile(schedule.filePath)}
                          className="flex-1 bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] hover:from-[#1e2a3e] hover:to-[#2A374E] text-white shadow-md hover:shadow-lg transition-all duration-300 text-sm h-10"
                        >
                          <ExternalLink className="w-4 h-4 ml-1.5" />
                          عرض الجدول
                        </Button>
                        <Button
                          onClick={() => handleOpenFile(schedule.filePath)}
                          variant="outline"
                          className="border-[#2A374E]/30 text-[#2A374E] dark:border-gray-500 dark:text-gray-300 hover:bg-[#2A374E]/5 dark:hover:bg-gray-700 transition-all duration-300 h-10 px-3"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        {!loading && !error && filteredSchedules.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              عرض {filteredSchedules.length} من {schedules.length} جدول
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
