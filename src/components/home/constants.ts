import type { SchoolData } from './types'

export const navLinks = [
  { label: 'الرئيسية', href: '#', active: true },
  { label: 'من نحن', href: '#welcome' },
  { label: 'أحدث الأخبار', href: '#news' },
  { label: 'الخدمات الإلكترونية', href: '#services', isServicesDropdown: true },
  { label: 'الحياة الطلابية', href: '#student-life', isStudentLife: true },
  { label: 'معرض الصور', href: '#gallery' },
  { label: 'اتصل بنا', href: '#contact' },
]

export const serviceDropdownItems = [
  { label: 'نتائج الطلاب', icon: 'clipboard_list', action: 'results' },
  { label: 'جداول الحصص', icon: 'calendar_month', action: 'schedules' },
  { label: 'المكتبة الرقمية', icon: 'auto_stories', action: 'library' },
  { label: 'أولياء الأمور', icon: 'family_restroom', action: 'parents' },
]

const subjectColors: Record<string, string> = {
  'رياضيات': 'bg-orange-500',
  'عربي': 'bg-blue-600',
  'لغة عربية': 'bg-blue-600',
  'انجليزي': 'bg-sky-500',
  'لغة انجليزية': 'bg-sky-500',
  'علوم': 'bg-purple-600',
  'دراسات': 'bg-amber-600',
  'تربية دينية': 'bg-emerald-600',
  'حاسب آلي': 'bg-cyan-600',
  'إدارة': 'bg-pink-600',
}

export function getSubjectColor(subject: string): string {
  for (const [key, color] of Object.entries(subjectColors)) {
    if (subject.includes(key)) return color
  }
  return 'bg-gray-500'
}

export const defaultSchoolData: SchoolData = {
  school: {
    id: 'demo',
    name: 'المدرسة الإعدادية النموذجية',
    subdomain: 'demo',
    description: 'مدرسة رائدة في التعليم الإعدادي',
    logoUrl: null,
    primaryColor: '#610000',
    secondaryColor: '#009688',
    address: 'الشارع الرئيسي، المدينة',
    phone: '0123456789',
    email: 'info@school.edu',
    facebookUrl: null,
    isActive: true,
  },
  settings: {
    heroTitle: 'المدرسة الإعدادية النموذجية',
    heroSubtitle: 'نحو تعليم متميز ومستقبل مشرق',
    bannerTitle: 'مرحباً بكم في مدرستنا',
    bannerImageUrl: null,
    vision: 'نسعى لتقديم تعليم عصري متميز يُعد طلابنا ليكونوا قادة المستقبل، من خلال بيئة تعليمية محفزة وكوادر تعليمية مؤهلة.',
    aboutImage: null,
    aboutVideoUrl: null,
    showNewsTicker: true,
    showHeroBanner: true,
    showLiveStream: false,
    liveStreamUrl: null,
    facebookUrl: null,
    youtubeUrl: null,
    showSlider: true,
    showAbout: true,
    showNews: true,
    showServices: true,
    showGallery: true,
    showTeachers: true,
    showStats: true,
    showContact: true,
  },
  stats: {
    students: 0,
    teachers: 0,
    classes: 0,
    years: 0,
  },
}
