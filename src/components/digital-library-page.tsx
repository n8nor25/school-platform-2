'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, BookOpen, FlaskConical, BookMarked, Newspaper,
  MonitorPlay, FileSearch, Download, Eye, Loader2, Library,
  Search, Sparkles, FileText, ExternalLink, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface DigitalLibraryPageProps {
  onBack: () => void;
  schoolId: string;
}

interface LibraryItem {
  id: string;
  title: string;
  category: string;
  grade?: string;
  section?: string;
  teacherName?: string;
  filePath: string;
  fileName: string;
  type: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const libraryCategories = [
  {
    id: 'textbooks',
    label: 'كتب دراسية',
    description: 'الكتب المقررة لجميع المراحل الدراسية',
    icon: BookOpen,
    color: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    id: 'scientific',
    label: 'مراجع علمية',
    description: 'مراجع ومراجع علمية متخصصة',
    icon: FlaskConical,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    id: 'literary',
    label: 'كتب أدبية',
    description: 'روايات وشعر وأدب عربي وعالمي',
    icon: BookMarked,
    color: 'from-amber-500 to-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    id: 'magazines',
    label: 'مجلات ودوريات',
    description: 'مجلات علمية وثقافية ودوريات أكاديمية',
    icon: Newspaper,
    color: 'from-rose-500 to-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-700 dark:text-rose-400',
    badgeBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  },
  {
    id: 'interactive',
    label: 'محتوى تفاعلي',
    description: 'فيديوهات تعليمية ومحتوى تفاعلي رقمي',
    icon: MonitorPlay,
    color: 'from-violet-500 to-violet-600',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-400',
    badgeBg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  },
  {
    id: 'research',
    label: 'أبحاث ورسائل',
    description: 'أبحاث أكاديمية ورسائل ماجستير ودكتوراه',
    icon: FileSearch,
    color: 'from-teal-500 to-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-400',
    badgeBg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  },
];

function getCategoryInfo(categoryId: string) {
  return libraryCategories.find(c => c.id === categoryId) || libraryCategories[0];
}

export default function DigitalLibraryPage({ onBack, schoolId }: DigitalLibraryPageProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fadeIn, setFadeIn] = useState<boolean>(false);

  // Fetch library items on mount
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/schedules?schoolId=${encodeURIComponent(schoolId)}&category=library`);
        if (!res.ok) throw new Error('فشل في تحميل المكتبة الرقمية');
        const data = await res.json();
        setItems(data);
      } catch {
        setError('فشل في تحميل المكتبة الرقمية. حاول مرة أخرى.');
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, [schoolId]);

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Filter items by category and search
  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === 'all' || (item.grade || '').toLowerCase() === activeCategory || (item.section || '').toLowerCase() === activeCategory;
    const matchesSearch = !searchQuery.trim() || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" dir="rtl">
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
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                <Library className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">المكتبة الرقمية</h1>
                <p className="text-blue-200 text-xs">تصفح الكتب والمراجع الرقمية</p>
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
            <div className="absolute -inset-[2px] bg-gradient-to-r from-[#2A374E] via-emerald-500 to-[#2A374E] rounded-2xl blur-[1px]" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Top accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-[#2A374E] via-emerald-500 to-[#2A374E]" />

                <div className="p-6 md:p-8">
                  {/* Hero Content */}
                  <div className="text-center mb-6">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#2A374E] to-[#3d4f6e] rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-white dark:ring-gray-700">
                      <Library className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-[#2A374E] dark:text-white mb-2">
                      المكتبة الرقمية
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto">
                      مكتبة رقمية شاملة تحتوي على الكتب الدراسية والمراجع العلمية والمحتوى التفاعلي
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                        <BookOpen className="w-3 h-3 ml-1" />
                        كتب دراسية
                      </Badge>
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                        <FlaskConical className="w-3 h-3 ml-1" />
                        مراجع علمية
                      </Badge>
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                        <BookMarked className="w-3 h-3 ml-1" />
                        كتب أدبية
                      </Badge>
                      <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
                        <MonitorPlay className="w-3 h-3 ml-1" />
                        محتوى تفاعلي
                      </Badge>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="max-w-lg mx-auto relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث في المكتبة الرقمية..."
                      className="h-12 text-right text-base pr-12 pl-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-xl shadow-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className={`mb-6 transition-all duration-700 delay-100 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-[#2A374E] dark:text-gray-400" />
            <h3 className="text-lg font-bold text-[#2A374E] dark:text-white">تصفية حسب التصنيف</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeCategory === 'all'
                  ? 'bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] text-white shadow-lg scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-md border border-gray-200 dark:border-gray-700'
              }`}
            >
              الكل
            </button>
            {libraryCategories.map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeCategory === cat.id
                      ? `bg-gradient-to-r ${cat.color} text-white shadow-lg scale-105`
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-md border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full" />
              <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">جارٍ تحميل المكتبة الرقمية...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-12 h-12 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
              حدث خطأ
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] hover:from-[#1e2a3e] hover:to-[#2A374E] text-white"
            >
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Library Items Grid */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className={`transition-all duration-700 delay-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                المحتوى المتاح
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                  {filteredItems.length} عنصر
                </Badge>
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const catInfo = getCategoryInfo(item.grade || item.section || 'textbooks');
                const CatIcon = catInfo.icon;
                return (
                  <Card
                    key={item.id}
                    className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
                  >
                    <CardContent className="p-0">
                      {/* Card Top Color Bar */}
                      <div className={`h-1.5 bg-gradient-to-r ${catInfo.color}`} />

                      <div className="p-5">
                        {/* Category Badge & Type */}
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`${catInfo.badgeBg} border-0 text-xs font-medium`}>
                            <CatIcon className="w-3 h-3 ml-1" />
                            {catInfo.label}
                          </Badge>
                          {item.type && (
                            <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                              {item.type}
                            </Badge>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-base font-bold text-gray-800 dark:text-white mb-2 line-clamp-2 group-hover:text-[#2A374E] dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h4>

                        {/* Author if available */}
                        {item.teacherName && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            {item.teacherName}
                          </p>
                        )}

                        {/* File Info */}
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-4">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[180px]">{item.fileName}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            asChild
                            className="flex-1 h-9 text-xs font-bold bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] hover:from-[#1e2a3e] hover:to-[#2A374E] text-white shadow-md"
                          >
                            <a href={item.filePath} target="_blank" rel="noopener noreferrer">
                              <Eye className="w-4 h-4 ml-1" />
                              عرض
                            </a>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            className="flex-1 h-9 text-xs font-bold border-gray-200 dark:border-gray-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700"
                          >
                            <a href={item.filePath} download>
                              <Download className="w-4 h-4 ml-1" />
                              تحميل
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State with Categories */}
        {!loading && !error && items.length === 0 && (
          <div className={`transition-all duration-700 delay-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {/* Coming Soon Card */}
            <Card className="border-0 shadow-xl overflow-hidden mb-8">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] p-8 md:p-12 text-center text-white relative overflow-hidden">
                  {/* Decorative circles */}
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-8 -translate-y-8" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-16 translate-y-16" />

                  <div className="relative z-10">
                    <div className="w-24 h-24 mx-auto bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mb-6 ring-4 ring-white/20">
                      <Sparkles className="w-12 h-12 text-emerald-300" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-3">
                      المكتبة الرقمية قريباً
                    </h3>
                    <p className="text-blue-200 text-lg max-w-xl mx-auto mb-6">
                      نعمل على تجهيز مكتبة رقمية شاملة تحتوي على الكتب الدراسية والمراجع العلمية والمحتوى التفاعلي. ترقبوا الإطلاق!
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <Badge className="bg-white/15 text-white border-white/20 text-sm px-4 py-1.5">
                        <BookOpen className="w-4 h-4 ml-1.5" />
                        كتب دراسية
                      </Badge>
                      <Badge className="bg-white/15 text-white border-white/20 text-sm px-4 py-1.5">
                        <FlaskConical className="w-4 h-4 ml-1.5" />
                        مراجع علمية
                      </Badge>
                      <Badge className="bg-white/15 text-white border-white/20 text-sm px-4 py-1.5">
                        <MonitorPlay className="w-4 h-4 ml-1.5" />
                        محتوى تفاعلي
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Preview Cards */}
            <h3 className="text-lg font-bold text-[#2A374E] dark:text-white mb-4 flex items-center gap-2">
              <Library className="w-5 h-5 text-emerald-500" />
              أقسام المكتبة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {libraryCategories.map((cat) => {
                const CatIcon = cat.icon;
                return (
                  <Card
                    key={cat.id}
                    className={`border ${cat.borderColor} ${cat.bgColor} shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden group`}
                  >
                    <CardContent className="p-5">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${cat.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-md`}>
                        <CatIcon className="w-7 h-7" />
                      </div>
                      <h4 className={`text-lg font-bold ${cat.textColor} mb-2`}>
                        {cat.label}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                        {cat.description}
                      </p>
                      <Badge className={`${cat.badgeBg} border-0 text-xs`}>
                        قريباً
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No Search Results */}
        {!loading && !error && items.length > 0 && filteredItems.length === 0 && (
          <div className={`text-center py-16 transition-all duration-700 delay-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="w-24 h-24 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
              لم يتم العثور على نتائج
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              جرب البحث بكلمات مختلفة أو غير التصنيف
            </p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
              variant="outline"
              className="border-[#2A374E] text-[#2A374E] dark:border-gray-500 dark:text-gray-300"
            >
              عرض الكل
            </Button>
          </div>
        )}

        {/* Stats Footer */}
        {!loading && !error && items.length > 0 && (
          <div className={`mt-8 transition-all duration-700 delay-300 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-[#2A374E] dark:text-white">
                      {items.filter(i => (i.grade || i.section || 'textbooks') === 'textbooks').length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">كتب دراسية</div>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <FlaskConical className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-[#2A374E] dark:text-white">
                      {items.filter(i => (i.grade || i.section || '') === 'scientific').length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">مراجع علمية</div>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                      <BookMarked className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-[#2A374E] dark:text-white">
                      {items.filter(i => (i.grade || i.section || '') === 'literary').length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">كتب أدبية</div>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center">
                      <MonitorPlay className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="text-2xl font-bold text-[#2A374E] dark:text-white">
                      {items.filter(i => ['interactive', 'magazines', 'research'].includes(i.grade || i.section || '')).length}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">محتوى آخر</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] text-white py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Library className="w-5 h-5 text-emerald-300" />
            <span className="font-bold">المكتبة الرقمية</span>
          </div>
          <p className="text-blue-200 text-sm">
            مكتبة رقمية شاملة للكتب والمراجع والمحتوى التعليمي
          </p>
        </div>
      </footer>
    </div>
  );
}
