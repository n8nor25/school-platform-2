'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight, Search, CalendarDays, Phone, Mail, MapPin,
  Megaphone, BookOpenCheck, Users, Heart, Lightbulb,
  Monitor, Brain, ClipboardCheck, GraduationCap, MessageSquare,
  Shield, Clock, ChevronLeft, Sparkles, Star, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ParentsPortalPageProps {
  onBack: () => void;
  schoolId: string;
}

const quickActions = [
  {
    title: 'متابعة النتائج',
    description: 'استعلم عن نتائج ابنك',
    icon: <Search className="w-7 h-7" />,
    color: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    title: 'جداول الحصص',
    description: 'عرض جداول الحصص الأسبوعية',
    icon: <CalendarDays className="w-7 h-7" />,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  {
    title: 'التواصل مع المدرسة',
    description: 'تواصل مع إدارة المدرسة',
    icon: <MessageSquare className="w-7 h-7" />,
    color: 'from-sky-500 to-blue-600',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    borderColor: 'border-sky-200 dark:border-sky-800',
  },
  {
    title: 'الإعلانات المدرسية',
    description: 'آخر الأخبار والتنبيهات',
    icon: <Megaphone className="w-7 h-7" />,
    color: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
];

const parentTips = [
  {
    title: 'متابعة الواجبات يومياً',
    description: 'تأكد من إنجاز ابنك لواجباته المدرسية يومياً وراجعها معه لتعزيز الفهم والاستيعاب',
    icon: <ClipboardCheck className="w-6 h-6" />,
    color: 'from-emerald-500 to-teal-500',
    emoji: '📋',
  },
  {
    title: 'التواصل المستمر مع المعلمين',
    description: 'حافظ على تواصل دوري مع معلمي ابنك لمتابعة مستواه الأكاديمي والسلوكي',
    icon: <Users className="w-6 h-6" />,
    color: 'from-blue-500 to-indigo-500',
    emoji: '🤝',
  },
  {
    title: 'توفير بيئة دراسية مناسبة',
    description: 'أمّن لابنك مكاناً هادئاً ومريحاً للدراسة بعيداً عن المشتتات والإزعاج',
    icon: <BookOpenCheck className="w-6 h-6" />,
    color: 'from-amber-500 to-yellow-500',
    emoji: '🏠',
  },
  {
    title: 'تشجيع القراءة والاطلاع',
    description: 'شجّع ابنك على القراءة اليومية ووفّر له كتباً وقصصاً تناسب عمره واهتماماته',
    icon: <Lightbulb className="w-6 h-6" />,
    color: 'from-purple-500 to-violet-500',
    emoji: '📚',
  },
  {
    title: 'مراقبة استخدام التكنولوجيا',
    description: 'راقب وقت شاشة ابنك وتأكد من استخدام التقنية بطريقة مفيدة وآمنة للتعلم',
    icon: <Monitor className="w-6 h-6" />,
    color: 'from-rose-500 to-pink-500',
    emoji: '💻',
  },
  {
    title: 'الاهتمام بالصحة النفسية',
    description: 'اهتم بالصحة النفسية لابنك واستمع لمشاعره وكون له دائماً سنداً وداعماً',
    icon: <Heart className="w-6 h-6" />,
    color: 'from-red-500 to-rose-500',
    emoji: '❤️',
  },
];

const announcements = [
  {
    title: 'بدء التسجيل للفصل الدراسي الثاني',
    date: 'قبل يومين',
    badge: 'تسجيل',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    title: 'اجتماع أولياء الأمور يوم الخميس',
    date: 'قبل 3 أيام',
    badge: 'اجتماع',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    title: 'مسابقة القراءة الكبرى',
    date: 'قبل 5 أيام',
    badge: 'مسابقة',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
];

export default function ParentsPortalPage({ onBack, schoolId }: ParentsPortalPageProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Staggered card animation
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    quickActions.forEach((_, index) => {
      timeouts.push(
        setTimeout(() => {
          setVisibleCards((prev) => [...prev, index]);
        }, 300 + index * 150)
      );
    });
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-emerald-300 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium">العودة للرئيسية</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">بوابة أولياء الأمور</h1>
                <p className="text-emerald-200 text-xs">متابعة وتواصل مع المدرسة</p>
              </div>
            </div>
            <div className="w-28" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {/* Hero Section */}
        <div
          className={`mb-8 transition-all duration-700 ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute -inset-[2px] bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 rounded-2xl blur-[1px] opacity-60" />
            <Card className="relative border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] p-8 md:p-12 text-white relative overflow-hidden">
                  {/* Decorative elements */}
                  <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full translate-x-1/4 translate-y-1/4" />
                  <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-white/5 rounded-full" />

                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Icon */}
                    <div className="shrink-0">
                      <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/20">
                        <Users className="w-12 h-12 md:w-14 md:h-14 text-white" />
                      </div>
                    </div>

                    {/* Text */}
                    <div className="flex-1 text-center md:text-right">
                      <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                        <Sparkles className="w-5 h-5 text-emerald-300" />
                        <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-xs">
                          منصة تفاعلية
                        </Badge>
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
                        بوابة أولياء الأمور
                      </h2>
                      <p className="text-emerald-100/90 text-base md:text-lg leading-relaxed max-w-2xl">
                        منصة متكاملة لمتابعة أداء أبنائكم الدراسي والتواصل المباشر مع المدرسة.
                        نوفر لكم كل ما تحتاجون لمساندة أبنائكم في رحلتهم التعليمية.
                      </p>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-5">
                        <div className="flex items-center gap-1.5 text-sm text-emerald-200">
                          <Shield className="w-4 h-4" />
                          <span>بيانات آمنة</span>
                        </div>
                        <span className="text-emerald-400">|</span>
                        <div className="flex items-center gap-1.5 text-sm text-emerald-200">
                          <Clock className="w-4 h-4" />
                          <span>تحديث فوري</span>
                        </div>
                        <span className="text-emerald-400">|</span>
                        <div className="flex items-center gap-1.5 text-sm text-emerald-200">
                          <GraduationCap className="w-4 h-4" />
                          <span>متابعة شاملة</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions - 2x2 Grid */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Star className="w-6 h-6 text-emerald-600" />
            <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white">الخدمات السريعة</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {quickActions.map((action, index) => (
              <Card
                key={action.title}
                className={`border-0 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer group overflow-hidden ${
                  visibleCards.includes(index)
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <CardContent className="p-0">
                  <div className="flex items-center gap-5 p-6">
                    {/* Icon */}
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${action.color} flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                    >
                      {action.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {action.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                      <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>

                  {/* Bottom accent */}
                  <div className={`h-1 bg-gradient-to-l ${action.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Results Query Card (Standalone) */}
        <div
          className={`mb-10 transition-all duration-700 delay-500 ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-l from-emerald-500 to-teal-600 p-[2px] rounded-t-xl">
                <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-t-xl">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                      <Search className="w-10 h-10 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-right">
                      <h3 className="text-2xl font-bold text-[#2A374E] dark:text-white mb-2">
                        استعلم عن نتائج ابنك
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                        يمكنك الآن الاستعلام عن نتائج ابنك بسهولة. اختر الصف الدراسي وأدخل رقم الجلوس لعرض النتائج التفصيلية والنسب المئوية وحالة النجاح.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Button
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8 py-6 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                      >
                        <Search className="w-5 h-5 ml-2" />
                        استعلام الآن
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Announcements Section */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-6 h-6 text-rose-600" />
            <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white">الإعلانات المدرسية</h2>
          </div>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              {/* Header bar */}
              <div className="bg-gradient-to-l from-rose-500 to-red-500 p-4">
                <div className="flex items-center gap-2 text-white">
                  <Megaphone className="w-5 h-5" />
                  <h3 className="font-bold">آخر الأخبار والتنبيهات</h3>
                  <Badge className="bg-white/20 text-white border-white/30 text-xs mr-auto">
                    3 إعلانات جديدة
                  </Badge>
                </div>
              </div>
              {/* Announcements list */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {announcements.map((announcement, index) => (
                  <div
                    key={index}
                    className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 group-hover:scale-150 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          {announcement.title}
                        </h4>
                      </div>
                      <Badge className={`text-xs shrink-0 ${announcement.badgeColor}`}>
                        {announcement.badge}
                      </Badge>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{announcement.date}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 text-center">
                <Button variant="ghost" className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium">
                  عرض جميع الإعلانات
                  <ChevronLeft className="w-4 h-4 mr-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips for Parents Section */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Brain className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white">نصائح لأولياء الأمور</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {parentTips.map((tip, index) => (
              <Card
                key={tip.title}
                className="border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group overflow-hidden"
              >
                <CardContent className="p-0">
                  {/* Top gradient accent */}
                  <div className={`h-1.5 bg-gradient-to-l ${tip.color}`} />
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-r ${tip.color} flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-md`}
                      >
                        {tip.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-2 text-base">
                          {tip.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                          {tip.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Contact School Section */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Phone className="w-6 h-6 text-sky-600" />
            <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white">التواصل مع المدرسة</h2>
          </div>
          <Card className="border-0 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-l from-sky-500 to-blue-600 p-[2px] rounded-t-xl">
                <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-t-xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Phone */}
                    <div className="flex items-center gap-4 p-5 bg-sky-50 dark:bg-sky-900/10 rounded-2xl border border-sky-100 dark:border-sky-800/30">
                      <div className="w-14 h-14 bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
                        <Phone className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">الهاتف</h4>
                        <p className="text-lg font-bold text-[#2A374E] dark:text-white" dir="ltr">+20 123 456 7890</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">السبت - الخميس: 8 ص - 3 م</p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-4 p-5 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                      <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
                        <Mail className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">البريد الإلكتروني</h4>
                        <p className="text-base font-bold text-[#2A374E] dark:text-white break-all">info@school.edu.eg</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">نرد خلال 24 ساعة</p>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-4 p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                      <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
                        <MapPin className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">العنوان</h4>
                        <p className="text-base font-bold text-[#2A374E] dark:text-white">شارع المدارس، المدينة</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">بجوار حديقة الأمل</p>
                      </div>
                    </div>
                  </div>

                  {/* Additional info */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-[#2A374E] to-[#3d4f6e] rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#2A374E] dark:text-white">ساعات العمل الرسمية</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">السبت - الخميس: 7:30 صباحاً - 3:00 مساءً</p>
                        </div>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                      >
                        <MessageSquare className="w-4 h-4 ml-2" />
                        إرسال رسالة
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule Preview Card */}
        <div className="mb-10">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-l from-amber-500 to-orange-500 p-4">
                <div className="flex items-center gap-2 text-white">
                  <CalendarDays className="w-5 h-5" />
                  <h3 className="font-bold">جداول الحصص</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                    <CalendarDays className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1 text-center md:text-right">
                    <h3 className="text-xl font-bold text-[#2A374E] dark:text-white mb-2">
                      عرض جداول الحصص الأسبوعية
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                      تابع جدول الحصص اليومي والأسبوعي لابنك. يمكنك معرفة مواعيد كل مادة والمعلم المسؤول والمواصفات التفصيلية لكل حصة.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Button
                      variant="outline"
                      className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-900/20 font-bold px-6 py-5"
                    >
                      <CalendarDays className="w-5 h-5 ml-2" />
                      عرض الجداول
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Motivational Quote */}
        <div className="mb-6">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] p-6 md:p-8 text-white text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <Star className="w-7 h-7 text-white" />
                </div>
                <p className="text-xl md:text-2xl font-bold mb-2 leading-relaxed">
                  &ldquo;الأسرة هي المدرسة الأولى، والوالدان هما المعلمان الأعظم&rdquo;
                </p>
                <p className="text-emerald-200 text-sm">معاً نصنع مستقبلاً مشرقاً لأبنائنا</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-l from-[#2A374E] to-[#3d4f6e] text-white mt-auto">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-300" />
              <span className="text-sm font-medium">بوابة أولياء الأمور</span>
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
