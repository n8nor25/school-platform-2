'use client'

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mail, Facebook, Youtube, Search, Menu, X,
  ChevronLeft, ChevronRight, Clock, BookOpen, Calendar,
  GraduationCap, ClipboardList, Activity, MessageSquare,
  Camera, Users, MapPin, Send, Star, Award, TrendingUp,
  School, Eye, ArrowUp, Shield, Play, Globe
} from 'lucide-react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel'


import Autoplay from 'embla-carousel-autoplay'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay as SwiperAutoplay, EffectCreative, EffectCoverflow } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import 'swiper/css/effect-creative'
import 'swiper/css/effect-coverflow'
import { useAdminStore } from '@/lib/admin-store'
import { AdminLayout } from '@/components/admin/admin-layout'
import { AdminLogin } from '@/components/admin/admin-login'
import StudentLifePage from '@/components/student-life-page'
import ResultsPage from '@/components/results-page'
import SchedulesPage from '@/components/schedules-page'
import DigitalLibraryPage from '@/components/digital-library-page'
import ParentsPortalPage from '@/components/parents-portal-page'
import { CustomSectionRenderer } from '@/components/home/CustomSectionRenderer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ===== Types =====
interface SchoolData {
  school: {
    id: string
    name: string
    subdomain: string
    description: string
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
    address: string
    phone: string
    email: string
    facebookUrl: string | null
    isActive: boolean
  }
  settings: {
    heroTitle: string
    heroSubtitle: string
    bannerTitle: string | null
    bannerImageUrl: string | null
    vision: string | null
    aboutImage: string | null
    aboutVideoUrl: string | null
    showNewsTicker: boolean
    showHeroBanner: boolean
    showLiveStream: boolean
    liveStreamUrl: string | null
    facebookUrl: string | null
    youtubeUrl: string | null
    showSlider: boolean
    showAbout: boolean
    showNews: boolean
    showServices: boolean
    showGallery: boolean
    showTeachers: boolean
    showStats: boolean
    showContact: boolean
  } | null
  stats: {
    students: number
    teachers: number
    classes: number
    years: number
  } | null
}

interface NewsItem {
  id: string
  title: string
  slug: string | null
  excerpt: string | null
  content: string | null
  image: string | null
  category: string
  active: boolean
  createdAt: string
}

interface GalleryItem {
  id: string
  title: string | null
  imageUrl: string
  createdAt: string
}

interface Teacher {
  id: string
  name: string
  subject: string
  email: string | null
  imageUrl: string | null
  sortOrder: number
  active: boolean
}

interface SliderItem {
  id: string
  imageUrl: string
  title: string | null
  subtitle: string | null
  link: string | null
  sortOrder: number
  active: boolean
}

interface CustomSectionItem {
  id: string
  title: string
  content: string
  imageUrl: string | null
  layout: string
  active: boolean
  sortOrder: number
}


// ===== Default/Fallback Data =====
const defaultSchoolData: SchoolData = {
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

const navLinks = [
  { label: 'الرئيسية', href: '#', active: true },
  { label: 'من نحن', href: '#welcome' },
  { label: 'أحدث الأخبار', href: '#news' },
  { label: 'الخدمات الإلكترونية', href: '#services', isServicesDropdown: true },
  { label: 'الحياة الطلابية', href: '#student-life', isStudentLife: true },
  { label: 'معرض الصور', href: '#gallery' },
  { label: 'اتصل بنا', href: '#contact' },
]

const serviceDropdownItems = [
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

function getSubjectColor(subject: string): string {
  for (const [key, color] of Object.entries(subjectColors)) {
    if (subject.includes(key)) return color
  }
  return 'bg-gray-500'
}

// ===== Main Component =====
export default function HomePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-m3-surface">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-m3-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-m3-on-surface-variant text-sm">جاري التحميل...</p>
        </div>
      </div>
    }>
      <HomePage />
    </Suspense>
  )
}

function HomePage() {
  const { isAdminMode, selectedSchoolId, schools, setSelectedSchoolId, setSchools, _hasHydrated } = useAdminStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const logoClickCount = useRef(0)
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlSubdomain = searchParams.get('school')
  const hasAppliedUrlSchool = useRef(false)

  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [sliders, setSliders] = useState<SliderItem[]>([])
  const [customSections, setCustomSections] = useState<CustomSectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showResultsPage, setShowResultsPage] = useState(false)
  const [showStudentLife, setShowStudentLife] = useState(false)
  const [showSchedulesPage, setShowSchedulesPage] = useState(false)
  const [showLibraryPage, setShowLibraryPage] = useState(false)
  const [showParentsPage, setShowParentsPage] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [activeNavIndex, setActiveNavIndex] = useState(0)
  const [activeSliderIndex, setActiveSliderIndex] = useState(0)
  const [sliderApi, setSliderApi] = useState<any>(null)

  // Handle logo click for admin entry (5 clicks within 3 seconds)
  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current)
    logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0 }, 3000)
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0
      setShowAdminLogin(true)
    }
  }, [])

  // Wait for Zustand hydration before fetching
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (_hasHydrated) setHydrated(true)
  }, [_hasHydrated])

  // Fetch schools list (only after hydration)
  useEffect(() => {
    if (!hydrated) return
    async function fetchSchools() {
      try {
        const res = await fetch('/api/schools')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setSchools(data)
          }
        }
      } catch {
        // Silently fail
      }
    }
    fetchSchools()
  }, [setSchools, hydrated])

  // Apply school from URL ?school=subdomain on first load
  useEffect(() => {
    if (!hydrated || !urlSubdomain || hasAppliedUrlSchool.current) return
    if (schools.length === 0) return
    const matched = schools.find(s => s.subdomain === urlSubdomain)
    if (matched && matched.id !== selectedSchoolId) {
      setSelectedSchoolId(matched.id)
      hasAppliedUrlSchool.current = true
    }
  }, [hydrated, urlSubdomain, schools, setSelectedSchoolId, selectedSchoolId])

  // If no school selected and no URL param, but schools are loaded, select first
  useEffect(() => {
    if (!hydrated || urlSubdomain) return
    if (schools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(schools[0].id)
    }
  }, [hydrated, urlSubdomain, schools, selectedSchoolId, setSelectedSchoolId])

  // Update URL when school changes (not on initial URL-driven load)
  const prevSchoolIdRef = useRef(selectedSchoolId)
  useEffect(() => {
    if (!hydrated || !selectedSchoolId || schools.length === 0) return
    // Skip the initial sync from URL
    if (hasAppliedUrlSchool.current && prevSchoolIdRef.current === selectedSchoolId) return
    const currentSchool = schools.find(s => s.id === selectedSchoolId)
    if (!currentSchool) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('school', currentSchool.subdomain)
    const newUrl = `${pathname}?${params.toString()}`
    router.replace(newUrl, { scroll: false })
    prevSchoolIdRef.current = selectedSchoolId
  }, [selectedSchoolId, schools, hydrated, router, pathname, searchParams])

  // Fetch data
  useEffect(() => {
    if (!hydrated) return
    async function fetchData() {
      setLoading(true)
      // Clear old data when switching schools
      setSchoolData(null)
      setNews([])
      setGallery([])
      setTeachers([])
      setSliders([])
      setCustomSections([])
      try {
        const sid = selectedSchoolId
        if (!sid) {
          // Don't fetch until we have a school ID
          setLoading(false)
          return
        }
        const schoolUrl = `/api/school?schoolId=${sid}`
        const newsUrl = `/api/news?limit=10&schoolId=${sid}`
        const galleryUrl = `/api/gallery?limit=8&schoolId=${sid}`
        const teachersUrl = `/api/teachers?schoolId=${sid}`
        const slidersUrl = `/api/sliders?schoolId=${sid}`
        const customSectionsUrl = `/api/custom-sections?schoolId=${sid}`
        const [schoolRes, newsRes, galleryRes, teachersRes, slidersRes, customSectionsRes] = await Promise.allSettled([
          fetch(schoolUrl),
          fetch(newsUrl),
          fetch(galleryUrl),
          fetch(teachersUrl),
          fetch(slidersUrl),
          fetch(customSectionsUrl),
        ])

        if (schoolRes.status === 'fulfilled' && schoolRes.value.ok) {
          const data = await schoolRes.value.json()
          if (data.school) {
            setSchoolData(data)
          }
        }
        if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
          const data = await newsRes.value.json()
          if (Array.isArray(data)) {
            setNews(data)
          }
        }
        if (galleryRes.status === 'fulfilled' && galleryRes.value.ok) {
          const data = await galleryRes.value.json()
          if (Array.isArray(data)) {
            setGallery(data)
          }
        }
        if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
          const data = await teachersRes.value.json()
          if (Array.isArray(data)) {
            setTeachers(data)
          }
        }
        if (slidersRes.status === 'fulfilled' && slidersRes.value.ok) {
          const data = await slidersRes.value.json()
          if (Array.isArray(data)) {
            setSliders(data)
          }
        }
        if (customSectionsRes.status === 'fulfilled' && customSectionsRes.value.ok) {
          const data = await customSectionsRes.value.json()
          if (Array.isArray(data)) {
            setCustomSections(data)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedSchoolId, hydrated])

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const school = schoolData?.school || defaultSchoolData.school
  const settings = schoolData?.settings || defaultSchoolData.settings
  const stats = schoolData?.stats || defaultSchoolData.stats

  // Featured news (with images)
  const featuredNews = news.filter(n => n.image).slice(0, 5)
  const newsWithImage = featuredNews.length > 0 ? featuredNews : news.slice(0, 5)

  // Active sliders
  const activeSliders = sliders.filter(s => s.active)

  // Sync headline index with slider carousel
  useEffect(() => {
    setActiveSliderIndex(0)
  }, [activeSliders.length > 0 ? activeSliders[0]?.id : (newsWithImage.length > 0 ? newsWithImage[0]?.id : '')])

  // Listen for carousel select events to sync activeSliderIndex
  useEffect(() => {
    if (!sliderApi) return
    const onSelect = () => {
      setActiveSliderIndex(sliderApi.selectedScrollSnap())
    }
    sliderApi.on('select', onSelect)
    onSelect() // Initialize
    return () => {
      sliderApi.off('select', onSelect)
    }
  }, [sliderApi])

  // Alert/announcement news
  const alertNews = news.filter(n => n.category === 'تنبيه')

  // If in admin mode, render admin layout
  if (isAdminMode) {
    return <AdminLayout />
  }

  // If showing student life page, render it
  if (showStudentLife) {
    return <StudentLifePage onBack={() => setShowStudentLife(false)} />
  }

  // If showing results page, render it
  if (showResultsPage) {
    return <ResultsPage onBack={() => setShowResultsPage(false)} schoolId={selectedSchoolId} />
  }

  // If showing schedules page, render it
  if (showSchedulesPage) {
    return <SchedulesPage onBack={() => setShowSchedulesPage(false)} schoolId={selectedSchoolId} />
  }

  // If showing digital library page, render it
  if (showLibraryPage) {
    return <DigitalLibraryPage onBack={() => setShowLibraryPage(false)} schoolId={selectedSchoolId} />
  }

  // If showing parents portal page, render it
  if (showParentsPage) {
    return <ParentsPortalPage onBack={() => setShowParentsPage(false)} schoolId={selectedSchoolId} />
  }

  // Show loading until store is hydrated from localStorage
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-m3-surface">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-m3-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-m3-on-surface-variant text-sm">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  // ===== RENDER =====
  return (
    <div className="min-h-screen flex flex-col bg-m3-surface">
    {/* ===== STICKY TOP SECTION ===== */}
    <div className="sticky top-0 z-50 shadow-lg">
      {/* ===== 1. TOP BAR ===== */}
      <div className="bg-m3-primary text-m3-on-primary text-xs">
        <div className="max-w-[1280px] mx-auto px-4 py-0.5 flex flex-wrap items-center justify-between gap-1">
          {/* Right side in RTL = visual left: Social icons */}
          <div className="flex items-center gap-2">
            {school.facebookUrl && (
              <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-m3-on-primary-container transition-colors min-h-[24px] flex items-center" aria-label="Facebook">
                <span className="material-symbols-outlined text-sm">public</span>
              </a>
            )}
            {school.email && (
              <a href={`mailto:${school.email}`} className="flex items-center gap-1 hover:text-m3-on-primary-container transition-colors min-h-[24px]">
                <span className="material-symbols-outlined text-sm">mail</span>
              </a>
            )}
            {school.phone && (
              <a href={`tel:${school.phone}`} className="flex items-center gap-1 hover:text-m3-on-primary-container transition-colors min-h-[24px]">
                <span className="material-symbols-outlined text-sm">call</span>
              </a>
            )}
            {/* School Name Display */}
            {school.name && (
              <span className="flex items-center gap-1 text-[10px] text-white/90 bg-white/10 px-2 py-0.5 rounded">
                <span className="material-symbols-outlined text-xs">school</span>
                {school.name}
              </span>
            )}
          </div>
          {/* Left side in RTL = visual right: Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                type="search"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-28 h-6 text-[10px] bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:w-40 transition-all rounded-md"
              />
              <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/50" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== 2. MAIN HEADER ===== */}
      <header className="bg-m3-surface-container-lowest shadow-sm border-b border-m3-outline-variant/30">
        <div className="max-w-[1280px] mx-auto px-4 py-1.5 flex items-center gap-3">
          {/* Right side in RTL: School Logo & Name (يمنى) */}
          <div className="flex items-center gap-2 shrink-0">
            <div onClick={handleLogoClick} className="cursor-pointer" title="اضغط 5 مرات للدخول للإدارة">
              {school.logoUrl ? (
                <img src={school.logoUrl} alt={school.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-m3-primary/30 shadow-md hover:shadow-lg transition-shadow" />
              ) : (
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-m3-primary to-m3-primary-container flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                  <span className="material-symbols-outlined text-m3-on-primary text-lg md:text-xl">account_balance</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base lg:text-lg font-bold text-m3-primary truncate">{school.name}</h1>
              {settings?.heroSubtitle && (
                <p className="text-[10px] md:text-xs text-m3-on-surface-variant mt-0 truncate max-w-[200px] md:max-w-none">{settings.heroSubtitle}</p>
              )}
            </div>
          </div>

          {/* Left side in RTL: Banner Ad (يسرى - يتمدد) */}
          <div className="flex-1 min-w-0">
            {settings?.showHeroBanner ? (
              <div className="relative h-10 md:h-14 rounded-lg overflow-hidden hidden md:block group">
                <img
                  src={settings.bannerImageUrl || 'https://picsum.photos/seed/banner1/800/150'}
                  alt={settings.bannerTitle || 'إعلان'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-m3-primary/60 via-m3-primary/30 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-end pr-4">
                  <span className="text-white font-bold text-xs md:text-sm drop-shadow-md">
                    {settings.bannerTitle || 'مساحة إعلانية'}
                  </span>
                </div>
                {/* Ad badge */}
                <div className="absolute top-1 left-1 bg-black/40 backdrop-blur-sm text-white text-[8px] px-1 py-0.5 rounded font-medium">
                  AD
                </div>
              </div>
            ) : (
              <div className="hidden md:block" />
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden min-h-[36px] min-w-[36px] shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="القائمة"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* ===== 3. NAVIGATION BAR ===== */}
      <nav className="bg-m3-on-secondary-fixed text-white shadow-lg border-b-4 border-m3-primary">
        <div className="max-w-[1280px] mx-auto px-4">
          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center h-12">
            {navLinks.map((link, index) => (
              link.isServicesDropdown ? (
                <DropdownMenu key={link.href}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`px-5 h-full flex items-center text-sm font-semibold transition-colors min-h-[44px] gap-1 ${
                        index === activeNavIndex
                          ? 'border-b-2 border-m3-primary-container bg-white/5 text-white'
                          : 'hover:text-m3-primary-container hover:bg-white/5'
                      }`}
                      onClick={() => setActiveNavIndex(index)}
                    >
                      {link.label}
                      <ChevronLeft className="w-3.5 h-3.5 rotate-[-90deg]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-white dark:bg-gray-800 border shadow-lg rounded-lg min-w-[200px]" dir="rtl">
                    {serviceDropdownItems.map((item) => (
                      <DropdownMenuItem
                        key={item.action}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-m3-primary/10 focus:bg-m3-primary/10 text-gray-800 dark:text-gray-200"
                        onClick={() => {
                          if (item.action === 'results') setShowResultsPage(true)
                          if (item.action === 'schedules') setShowSchedulesPage(true)
                          if (item.action === 'library') setShowLibraryPage(true)
                          if (item.action === 'parents') setShowParentsPage(true)
                        }}
                      >
                        <span className="material-symbols-outlined text-base text-m3-primary">{item.icon}</span>
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <a
                  key={link.href}
                  href={link.isStudentLife ? undefined : link.href}
                  onClick={(e) => {
                    if (link.isStudentLife) {
                      e.preventDefault()
                      setShowStudentLife(true)
                    }
                    setActiveNavIndex(index)
                  }}
                  className={`px-5 h-full flex items-center text-sm font-semibold transition-colors min-h-[44px] ${
                    index === activeNavIndex
                      ? 'border-b-2 border-m3-primary-container bg-white/5 text-white'
                      : 'hover:text-m3-primary-container hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </a>
              )
            ))}
          </div>
          {/* Mobile Nav */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="lg:hidden overflow-hidden"
              >
                {navLinks.map((link, index) => (
                  link.isServicesDropdown ? (
                    <div key={link.href} className="border-b border-white/10">
                      <div className="block px-4 py-3 text-sm font-medium text-white min-h-[44px] flex items-center">
                        {link.label}
                      </div>
                      {serviceDropdownItems.map((item) => (
                        <button
                          key={item.action}
                          onClick={() => {
                            if (item.action === 'results') setShowResultsPage(true)
                            if (item.action === 'schedules') setShowSchedulesPage(true)
                            if (item.action === 'library') setShowLibraryPage(true)
                            if (item.action === 'parents') setShowParentsPage(true)
                            setMobileMenuOpen(false)
                          }}
                          className="w-full flex items-center gap-2 px-8 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors min-h-[40px]"
                        >
                          <span className="material-symbols-outlined text-base text-white/60">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <a
                      key={link.href}
                      href={link.isStudentLife ? undefined : link.href}
                      onClick={(e) => {
                        if (link.isStudentLife) {
                          e.preventDefault()
                          setShowStudentLife(true)
                        }
                        setActiveNavIndex(index)
                        setMobileMenuOpen(false)
                      }}
                      className="block px-4 py-3 text-sm font-medium hover:bg-white/10 transition-colors min-h-[44px] flex items-center border-b border-white/10"
                    >
                      {link.label}
                    </a>
                  )
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* ===== 4. NEWS TICKER ===== */}
      {settings?.showNewsTicker && news.length > 0 && (
        <section className="bg-m3-surface-container-high border-b border-m3-outline-variant overflow-hidden">
          <div className="max-w-[1280px] mx-auto flex items-center">
            <Badge className="bg-red-600 text-white shrink-0 rounded-none px-4 py-1.5 text-sm font-bold min-h-[38px] flex items-center gap-1.5">
              <span className="material-symbols-outlined filled text-lg">campaign</span>
              عاجل
            </Badge>
            <div className="overflow-hidden flex-1 mr-4">
              <div className="animate-news-ticker whitespace-nowrap py-2.5 text-sm font-bold">
                {[...news, ...news].map((item, i) => (
                  <span key={`${item.id}-${i}`} className="inline-block mx-8">
                    <span className="text-m3-primary ml-2 text-base">◆</span>
                    <span className="font-bold">{item.title}</span>
                    <span className="text-m3-on-surface-variant/30 mx-4">|</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
    {/* ===== END STICKY TOP SECTION ===== */}

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1">
        {/* ===== 5. MAIN CONTENT AREA (12-col grid) ===== */}
        <section className="max-w-[1280px] mx-auto px-4 py-8">
          <div className="grid grid-cols-12 gap-6">
            {/* Center Section: 10 columns */}
            <section className="col-span-12 lg:col-span-10 flex flex-col gap-6">
              {/* Row 1: 3-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-auto md:h-[400px]">
                {/* a) Image Slider */}
                {(settings?.showSlider ?? true) && (
                <div className={`rounded-lg overflow-hidden shadow-lg relative ${settings?.showLiveStream ? 'md:col-span-5' : 'md:col-span-9'}`}>
                  {loading ? (
                    <Skeleton className="w-full h-[300px] md:h-full" />
                  ) : activeSliders.length > 0 ? (
                    <Carousel
                      opts={{ direction: 'rtl', loop: true }}
                      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
                      setApi={setSliderApi}
                      className="w-full h-full"
                    >
                      <CarouselContent className="h-[300px] md:h-[400px]">
                        {activeSliders.map((item) => (
                          <CarouselItem key={item.id}>
                            <div className="relative h-[300px] md:h-[400px] overflow-hidden">
                              <img
                                src={item.imageUrl}
                                alt={item.title || 'سلایدر'}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                              <div className="absolute bottom-0 right-0 left-0 p-5">
                                {item.title && (
                                  <h2 className="text-lg md:text-xl font-bold text-white mb-1 leading-relaxed line-clamp-2">
                                    {item.title}
                                  </h2>
                                )}
                                {item.subtitle && (
                                  <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious className="right-3 left-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                      <CarouselNext className="left-3 right-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                    </Carousel>
                  ) : newsWithImage.length > 0 ? (
                    <Carousel
                      opts={{ direction: 'rtl', loop: true }}
                      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
                      setApi={setSliderApi}
                      className="w-full h-full"
                    >
                      <CarouselContent className="h-[300px] md:h-[400px]">
                        {newsWithImage.map((item, index) => (
                          <CarouselItem key={item.id}>
                            <div className="relative h-[300px] md:h-[400px] overflow-hidden">
                              <img
                                src={item.image || `https://picsum.photos/seed/school${index + 10}/800/400`}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                              <div className="absolute bottom-0 right-0 left-0 p-5">
                                <Badge className="mb-2 bg-m3-primary text-m3-on-primary text-xs">
                                  {item.category}
                                </Badge>
                                <h2 className="text-lg md:text-xl font-bold text-white mb-1 leading-relaxed line-clamp-2">
                                  {item.title}
                                </h2>
                                {item.excerpt && (
                                  <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">
                                    {item.excerpt}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious className="right-3 left-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                      <CarouselNext className="left-3 right-auto bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm w-9 h-9" />
                    </Carousel>
                  ) : (
                    <div className="h-full bg-gradient-to-br from-m3-primary to-m3-primary-container flex items-center justify-center">
                      <div className="text-center text-white px-4">
                        <span className="material-symbols-outlined text-5xl mb-3 opacity-50">school</span>
                        <h2 className="text-xl md:text-2xl font-bold mb-1">{settings?.heroTitle || school.name}</h2>
                        <p className="text-white/70">{settings?.heroSubtitle || 'نحو تعليم متميز'}</p>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* b) Headlines synced with slider */}
                <div className="md:col-span-3 bg-m3-surface-container-low rounded-lg shadow-md overflow-hidden flex flex-col h-[350px] md:h-full">
                  {(() => {
                    const headlineItems = activeSliders.length > 0
                      ? activeSliders.map(s => ({ id: s.id, title: s.title || '', subtitle: s.subtitle || '', category: 'سلایدر' }))
                      : newsWithImage.map(n => ({ id: n.id, title: n.title, subtitle: n.excerpt || '', category: n.category }))

                    return headlineItems.length > 0 ? (
                      <div className="flex flex-col h-full">
                        {/* Headline header */}
                        <div className="bg-m3-primary text-m3-on-primary px-4 py-2 flex items-center gap-2 shrink-0">
                          <span className="material-symbols-outlined text-lg">article</span>
                          <h3 className="font-bold text-sm">العناوين</h3>
                        </div>
                        {/* Headlines List - full height */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                          <div className="flex flex-col gap-1 p-2">
                            {headlineItems.map((item, i) => (
                              <div
                                key={item.id}
                                className={`w-full text-right px-3 py-2.5 rounded-md transition-all duration-300 cursor-pointer ${
                                  i === activeSliderIndex
                                    ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                                    : 'bg-m3-primary/10 text-m3-on-surface hover:bg-m3-primary/20'
                                }`}
                                onClick={() => {
                                  setActiveSliderIndex(i)
                                  sliderApi?.scrollTo(i)
                                }}
                              >
                                <h4 className="text-xs font-bold leading-relaxed line-clamp-2">{item.title}</h4>
                                {item.subtitle && i === activeSliderIndex && (
                                  <p className="text-[10px] mt-1 opacity-80 line-clamp-2">{item.subtitle}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-m3-on-surface-variant text-sm p-4">
                          <span className="material-symbols-outlined text-3xl mb-2 opacity-40 block">newspaper</span>
                          لا توجد عناوين
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* c) Live Stream */}
                {settings?.showLiveStream && (
                  <div className="md:col-span-4 rounded-lg overflow-hidden shadow-lg relative h-[250px] md:h-full bg-black">
                    {settings.liveStreamUrl ? (
                      <>
                        <img
                          src="https://picsum.photos/seed/livestream/600/400"
                          alt="بث مباشر"
                          className="w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <a
                            href={settings.liveStreamUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center mb-3 hover:bg-red-700 transition-colors shadow-lg"
                          >
                            <Play className="w-8 h-8 text-white mr-[-2px]" />
                          </a>
                          <Badge className="bg-red-600 text-white text-xs mb-2">LIVE STREAM</Badge>
                          <p className="text-white font-bold text-sm">بث مباشر من المسرح</p>
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/50 rounded-full px-2.5 py-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-white text-xs font-medium">1.2k</span>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-m3-primary/80 to-m3-primary-container/80">
                        <span className="material-symbols-outlined text-5xl text-white/40 mb-4">calendar_live</span>
                        <Badge className="bg-m3-primary text-m3-on-primary text-xs mb-3">LIVE STREAM</Badge>
                        <p className="text-white font-bold text-sm mb-2">بث مباشر</p>
                        <p className="text-white/60 text-xs text-center px-4">سيتم إضافة رابط البث المباشر قريباً</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </section>

            {/* Right Sidebar: 2 columns */}
            <aside className="col-span-12 lg:col-span-2">
              <div className="bg-m3-surface-container-lowest rounded-lg shadow-md overflow-hidden">
                <div className="bg-m3-primary text-m3-on-primary px-4 py-2.5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg filled">notification_important</span>
                  <h3 className="font-bold text-sm">تنبيهات هامة</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {alertNews.length > 0 ? (
                    alertNews.map((item) => (
                      <div key={item.id} className="p-3 border-b border-m3-outline-variant/30 hover:bg-m3-surface-container transition-colors cursor-pointer">
                        <div className="flex items-center gap-1.5 text-xs text-m3-on-surface-variant mb-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <h4 className="text-sm font-bold text-m3-on-surface line-clamp-2 leading-relaxed mb-1 hover:text-m3-primary transition-colors">
                          {item.title}
                        </h4>
                        {item.excerpt && (
                          <p className="text-xs text-m3-on-surface-variant line-clamp-2 leading-relaxed">
                            {item.excerpt}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-m3-on-surface-variant text-sm">
                      <span className="material-symbols-outlined text-3xl mb-2 opacity-40 block">notifications_off</span>
                      لا توجد تنبيهات حالياً
                    </div>
                  )}
                </div>
                {alertNews.length > 0 && (
                  <div className="p-3 border-t border-m3-outline-variant/30">
                    <Button variant="ghost" className="w-full text-m3-primary hover:text-m3-primary-container text-xs h-8">
                      عرض جميع التنبيهات
                    </Button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>

        {/* ===== 6. AD SPACE (FULL WIDTH BANNER) ===== */}
        <section className="py-4 bg-m3-surface-container">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="h-20 md:h-24 rounded-xl overflow-hidden relative shadow-md border border-m3-outline-variant/30 group cursor-pointer">
              <img
                src="https://picsum.photos/seed/middlebanner/1200/150"
                alt="إعلان"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-m3-primary/50 via-m3-primary/20 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-end pr-8">
                <div className="text-right">
                  <span className="text-white font-bold text-base md:text-lg drop-shadow-md">مساحة إعلانية متاحة</span>
                  <p className="text-white/70 text-xs mt-0.5">للإعلان هنا تواصل مع إدارة المدرسة</p>
                </div>
              </div>
              <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                AD
              </div>
            </div>
          </div>
        </section>

        {/* ===== 7. WELCOME SECTION ===== */}
        {(settings?.showAbout ?? true) && (
        <section id="welcome" className="py-12 md:py-16 bg-m3-surface-container-lowest">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                {settings?.aboutVideoUrl ? (
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    {(() => {
                      const ytMatch = settings.aboutVideoUrl!.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
                      if (ytMatch) {
                        return (
                          <div className="aspect-[4/3]">
                            <iframe
                              src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                              title="فيديو عن المدرسة"
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          </div>
                        )
                      }
                      return (
                        <div className="aspect-[4/3] bg-black">
                          <video
                            src={settings.aboutVideoUrl!}
                            controls
                            className="w-full h-full object-contain"
                            preload="metadata"
                          >
                            <track kind="captions" />
                          </video>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                    <img
                      src={settings?.aboutImage || 'https://picsum.photos/seed/schoolwelcome/600/450'}
                      alt="عن المدرسة"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="absolute -bottom-4 -left-4 bg-m3-secondary text-white px-6 py-3 rounded-xl shadow-lg hidden md:block">
                  <p className="font-bold text-lg">نحو التميز</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-4">
                  <Star className="w-3.5 h-3.5 ml-1" />
                  رسالة المدرسة
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface mb-4">
                  مرحباً بكم في {school.name}
                </h2>
                {school.description && (
                  <p className="text-m3-on-surface-variant leading-relaxed mb-4 text-base">
                    {school.description}
                  </p>
                )}
                {settings?.vision && (
                  <div className="bg-gradient-to-l from-m3-secondary/5 to-m3-secondary/10 rounded-xl p-5 border border-m3-secondary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-5 h-5 text-m3-secondary" />
                      <h3 className="font-bold text-m3-secondary">رؤيتنا</h3>
                    </div>
                    <p className="text-m3-on-surface-variant leading-relaxed text-sm">
                      {settings.vision}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>
        )}

        {/* ===== 8. NEWS SECTION ===== */}
        {(settings?.showNews ?? true) && (
        <section id="news" className="py-12 md:py-16 bg-m3-surface-container">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="text-center mb-10">
              <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-3">
                <TrendingUp className="w-3.5 h-3.5 ml-1" />
                آخر الأخبار
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">أحدث الأخبار والفعاليات</h2>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="w-full h-48" />
                    <CardContent className="pt-4">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : news.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.slice(0, 6).map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 h-full">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={item.image || `https://picsum.photos/seed/news${index + 20}/400/250`}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-m3-primary text-m3-on-primary text-xs">
                            {item.category}
                          </Badge>
                        </div>
                      </div>
                      <CardContent className="pt-4 pb-2">
                        <div className="flex items-center gap-2 text-xs text-m3-on-surface-variant mb-2">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <h3 className="font-bold text-m3-on-surface mb-2 line-clamp-2 group-hover:text-m3-primary transition-colors leading-relaxed">
                          {item.title}
                        </h3>
                        {item.excerpt && (
                          <p className="text-sm text-m3-on-surface-variant line-clamp-2 leading-relaxed">
                            {item.excerpt}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto text-m3-on-surface-variant/30 mb-3" />
                <p className="text-m3-on-surface-variant/50">لا توجد أخبار حالياً</p>
              </div>
            )}
          </div>
        </section>
        )}

        {/* ===== 9. ELECTRONIC SERVICES SECTION ===== */}
        {(settings?.showServices ?? true) && (
        <section id="services" className="py-12 md:py-16 bg-m3-surface-container-lowest">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="text-center mb-10">
              <Badge className="bg-m3-secondary/10 text-m3-secondary hover:bg-m3-secondary/20 mb-3">
                <Globe className="w-3.5 h-3.5 ml-1" />
                خدماتنا
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">الخدمات الإلكترونية</h2>
              <p className="text-m3-on-surface-variant text-sm mt-2 max-w-lg mx-auto">استفد من خدماتنا الإلكترونية المتنوعة بسهولة وسرعة</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: 'clipboard_list',
                  title: 'الاستعلام عن النتائج',
                  description: 'استعلم عن نتائجك الأكاديمية بسهولة',
                  color: 'from-emerald-500 to-emerald-600',
                  action: () => setShowResultsPage(true),
                },
                {
                  icon: 'calendar_month',
                  title: 'جداول الحصص',
                  description: 'عرض جداول الحصص اليومية والأسبوعية',
                  color: 'from-amber-500 to-amber-600',
                  action: () => setShowSchedulesPage(true),
                },
                {
                  icon: 'family_restroom',
                  title: 'بوابة أولياء الأمور',
                  description: 'متابعة أداء ابنكم الأكاديمي',
                  color: 'from-sky-500 to-sky-600',
                  action: () => setShowParentsPage(true),
                },
                {
                  icon: 'auto_stories',
                  title: 'المكتبة الرقمية',
                  description: 'تصفح الكتب والمراجع الرقمية',
                  color: 'from-purple-500 to-purple-600',
                  action: () => setShowLibraryPage(true),
                },
                {
                  icon: 'language',
                  title: 'التحول الرقمي',
                  description: 'خدمات التحول الرقمي للمدرسة',
                  color: 'from-teal-500 to-teal-600',
                  action: () => setShowSchedulesPage(true),
                },
                {
                  icon: 'forum',
                  title: 'التواصل مع الإدارة',
                  description: 'تواصل مع إدارة المدرسة مباشرة',
                  color: 'from-rose-500 to-rose-600',
                  action: () => {
                    const el = document.getElementById('contact')
                    el?.scrollIntoView({ behavior: 'smooth' })
                  },
                },
              ].map((service, index) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="overflow-hidden group hover:shadow-xl transition-all duration-300 h-full cursor-pointer"
                    onClick={service.action}
                  >
                    <div className={`h-2 bg-gradient-to-l ${service.color}`} />
                    <CardContent className="p-6">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-bl ${service.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                        <span className="material-symbols-outlined text-white text-2xl">{service.icon}</span>
                      </div>
                      <h3 className="font-bold text-m3-on-surface text-lg mb-2 group-hover:text-m3-primary transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-sm text-m3-on-surface-variant mb-4 leading-relaxed">
                        {service.description}
                      </p>
                      <span className="inline-flex items-center text-m3-primary text-sm font-medium group-hover:gap-2 transition-all gap-1">
                        المزيد
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* ===== 10. GALLERY SECTION ===== */}
        {(settings?.showGallery ?? true) && gallery.length > 0 && (
          <section id="gallery" className="py-12 md:py-16 bg-m3-surface-container">
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-10">
                <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-3">
                  <Camera className="w-3.5 h-3.5 ml-1" />
                  معرض الصور
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">معرض الصور</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gallery.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative aspect-square rounded-xl overflow-hidden shadow-md cursor-pointer"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title || 'صورة من المعرض'}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      {item.title && (
                        <p className="text-white text-sm font-medium">{item.title}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== 11. TEACHERS SECTION (SWIPER) ===== */}
        {(settings?.showTeachers ?? true) && teachers.length > 0 && (
          <section id="teachers" className="py-12 md:py-16 bg-m3-surface-container-lowest overflow-hidden">
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-10">
                <Badge className="bg-m3-secondary/10 text-m3-secondary hover:bg-m3-secondary/20 mb-3">
                  <Users className="w-3.5 h-3.5 ml-1" />
                  كادرنا التعليمي
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface mb-2">مدرسونا المميزون</h2>
                <p className="text-m3-on-surface-variant text-sm max-w-lg mx-auto">
                  اكتشف فريقنا من المعلمين المتميزين والمحترفين في مجال التعليم
                </p>
              </div>
              <Swiper
                modules={[Navigation, Pagination, SwiperAutoplay, EffectCreative]}
                spaceBetween={24}
                slidesPerView={1}
                navigation
                pagination={{ clickable: true }}
                autoplay={{ delay: 2500, disableOnInteraction: false, pauseOnMouseEnter: true }}
                loop={teachers.length > 3}
                dir="rtl"
                effect="creative"
                creativeEffect={{
                  prev: {
                    shadow: true,
                    translate: ['-20%', 0, -1],
                    opacity: 0.6,
                    scale: 0.9,
                  },
                  next: {
                    translate: ['100%', 0, 0],
                    opacity: 1,
                    scale: 1,
                  },
                }}
                breakpoints={{
                  640: { slidesPerView: 2, effect: 'slide' },
                  768: { slidesPerView: 3, effect: 'slide' },
                  1024: { slidesPerView: 4, effect: 'slide' },
                }}
                className="teachers-swiper pb-12"
              >
                {teachers.map((teacher, index) => (
                  <SwiperSlide key={teacher.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.08, duration: 0.5 }}
                      className="bg-white rounded-2xl shadow-md overflow-hidden group hover:shadow-xl transition-all duration-400 border border-gray-100"
                    >
                      {/* Teacher Image */}
                      <div className="relative aspect-[3/4] overflow-hidden">
                        {teacher.imageUrl ? (
                          <img
                            src={teacher.imageUrl}
                            alt={teacher.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-m3-primary via-m3-primary/90 to-m3-primary-container flex items-center justify-center">
                            <span className="text-6xl font-bold text-white/70 group-hover:scale-110 transition-transform duration-500">{teacher.name.charAt(0)}</span>
                          </div>
                        )}
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Role Badge */}
                        <div className={`absolute top-3 left-3 ${getSubjectColor(teacher.subject)} text-white text-xs px-3 py-1 rounded-full font-medium shadow-md`}>
                          {teacher.subject}
                        </div>

                        {/* Name overlay on hover */}
                        <div className="absolute bottom-0 right-0 left-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">
                          <h3 className="font-bold text-white text-lg drop-shadow-lg">{teacher.name}</h3>
                          <p className="text-white/80 text-sm">{teacher.subject}</p>
                        </div>
                      </div>
                      {/* Teacher Info */}
                      <div className="p-4 text-center group-hover:bg-m3-primary/5 transition-colors duration-300">
                        <h3 className="font-bold text-m3-on-surface text-base mb-0.5">{teacher.name}</h3>
                        <p className="text-sm text-m3-on-surface-variant mb-1.5">{teacher.subject}</p>
                        {teacher.email && (
                          <div className="flex items-center justify-center gap-1 text-xs text-m3-on-surface-variant">
                            <Mail className="w-3 h-3" />
                            <span dir="ltr" className="truncate">{teacher.email}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </section>
        )}

        {/* ===== 12. STATS BAR ===== */}
        {(settings?.showStats ?? true) && stats && (stats.students > 0 || stats.teachers > 0) && (
          <section className="bg-gradient-to-l from-m3-primary to-m3-primary-container">
            <div className="max-w-[1280px] mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: 'group', label: 'طلاب', value: stats.students },
                { icon: 'school', label: 'معلمون', value: stats.teachers },
                { icon: 'menu_book', label: 'فصول', value: stats.classes },
                { icon: 'military_tech', label: 'سنوات خبرة', value: stats.years },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center text-white"
                >
                  <span className="material-symbols-outlined text-4xl mb-2 text-white/80 block mx-auto">{stat.icon}</span>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-white/70 text-sm mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 13. CONTACT SECTION ===== */}
        {(settings?.showContact ?? true) && (
        <section id="contact" className="py-12 md:py-16 bg-m3-surface-container-lowest">
          <div className="max-w-[1280px] mx-auto px-4">
            <div className="text-center mb-10">
              <Badge className="bg-m3-primary/10 text-m3-primary hover:bg-m3-primary/20 mb-3">
                <Mail className="w-3.5 h-3.5 ml-1" />
                تواصل معنا
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-m3-on-surface">نحن هنا لمساعدتك</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Contact Info Card */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-6"
              >
                <Card className="border-0 shadow-md bg-gradient-to-bl from-m3-primary to-m3-primary-container text-white">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold mb-6">معلومات التواصل</h3>
                    <div className="space-y-4">
                      {school.address && (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white/70 text-sm">العنوان</p>
                            <p className="font-medium">{school.address}</p>
                          </div>
                        </div>
                      )}
                      {school.phone && (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white/70 text-sm">الهاتف</p>
                            <a href={`tel:${school.phone}`} className="font-medium hover:text-white/80 transition-colors" dir="ltr">
                              {school.phone}
                            </a>
                          </div>
                        </div>
                      )}
                      {school.email && (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white/70 text-sm">البريد الإلكتروني</p>
                            <a href={`mailto:${school.email}`} className="font-medium hover:text-white/80 transition-colors" dir="ltr">
                              {school.email}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Google Maps */}
                <Card className="border-0 shadow-md overflow-hidden">
                  <div className="bg-m3-primary text-m3-on-primary px-4 py-2.5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">location_on</span>
                    <h3 className="font-bold text-sm">موقعنا على الخريطة</h3>
                  </div>
                  <iframe
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(school.address)}&output=embed`}
                    width="100%"
                    height="250"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="موقع المدرسة على الخريطة"
                    className="w-full"
                  />
                </Card>
              </motion.div>

              {/* Contact Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Card className="border-0 shadow-md h-full">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-m3-on-surface mb-6">أرسل رسالة</h3>
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault()
                      }}
                    >
                      <div>
                        <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">الاسم</label>
                        <Input placeholder="اسمك الكامل" className="h-11" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">البريد الإلكتروني</label>
                        <Input type="email" placeholder="بريدك الإلكتروني" className="h-11" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">الموضوع</label>
                        <Input placeholder="موضوع الرسالة" className="h-11" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-m3-on-surface mb-1.5 block">الرسالة</label>
                        <Textarea placeholder="اكتب رسالتك هنا..." className="min-h-[100px]" />
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-11 bg-m3-primary hover:bg-m3-primary-container text-m3-on-primary min-h-[44px]"
                      >
                        <Send className="w-4 h-4 ml-2" />
                        إرسال الرسالة
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>
        )}

        {/* ===== 14. CUSTOM SECTIONS ===== */}
        <CustomSectionRenderer sections={customSections} />
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#2A374E] text-white mt-auto">
        {/* Egyptian Flag Strip */}
        <div className="flex h-1.5">
          <div className="flex-1 bg-red-600" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-black" />
        </div>

        <div className="max-w-[1280px] mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* School Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                {school.logoUrl ? (
                  <img src={school.logoUrl} alt={school.name} className="w-12 h-12 rounded-full object-cover border-2 border-red-500 shadow-lg" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-white text-2xl">account_balance</span>
                  </div>
                )}
                <h3 className="font-bold text-lg leading-tight">{school.name}</h3>
              </div>
              {school.description && (
                <p className="text-gray-300 text-sm leading-relaxed mb-4 line-clamp-3">{school.description}</p>
              )}
              <div className="flex gap-2.5">
                {school.facebookUrl && (
                  <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" aria-label="Facebook">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {settings?.youtubeUrl && (
                  <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" aria-label="YouTube">
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {school.email && (
                  <a href={`mailto:${school.email}`} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors" aria-label="Email">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                <a href="https://wa.me/200931234567" target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors" aria-label="WhatsApp">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-red-400">روابط سريعة</h3>
              <ul className="space-y-2">
                {navLinks.filter(link => !link.isServicesDropdown).map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.isStudentLife ? undefined : link.href}
                      onClick={(e) => {
                        if (link.isStudentLife) { e.preventDefault(); setShowStudentLife(true) }
                      }}
                      className="text-gray-300 hover:text-red-400 transition-colors text-sm flex items-center gap-2 min-h-[36px]"
                    >
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* E-Services */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-red-400">الخدمات الإلكترونية</h3>
              <ul className="space-y-2">
                {[
                  { label: 'نتائج الطلاب', action: 'results' },
                  { label: 'جداول الحصص', action: 'schedules' },
                  { label: 'المكتبة الرقمية', action: 'library' },
                  { label: 'أولياء الأمور', action: 'parents' },
                  { label: 'شكاوى ومقترحات', href: '#contact' },
                ].map((link) => (
                  <li key={link.label}>
                    {link.action ? (
                      <button
                        onClick={() => {
                          if (link.action === 'results') setShowResultsPage(true)
                          if (link.action === 'schedules') setShowSchedulesPage(true)
                          if (link.action === 'library') setShowLibraryPage(true)
                          if (link.action === 'parents') setShowParentsPage(true)
                        }}
                        className="text-gray-300 hover:text-red-400 transition-colors text-sm flex items-center gap-2 min-h-[36px]"
                      >
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                        {link.label}
                      </button>
                    ) : (
                      <a href={link.href} className="text-gray-300 hover:text-red-400 transition-colors text-sm flex items-center gap-2 min-h-[36px]">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info + Designer */}
            <div>
              <h3 className="font-bold text-lg mb-4 text-red-400">تواصل معنا</h3>
              <div className="space-y-3">
                {school.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <span className="text-gray-300 text-sm">{school.address}</span>
                  </div>
                )}
                {school.phone && (
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <a href={`tel:${school.phone}`} className="text-gray-300 hover:text-red-400 transition-colors text-sm" dir="ltr">{school.phone}</a>
                  </div>
                )}
                {school.email && (
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <a href={`mailto:${school.email}`} className="text-gray-300 hover:text-red-400 transition-colors text-sm" dir="ltr">{school.email}</a>
                  </div>
                )}
              </div>

              {/* Designer Section */}
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-red-500 shadow-lg shrink-0">
                    <img
                      src="https://res.cloudinary.com/dc7ysj5yq/image/upload/v1777145223/school-website/designer/zttkev3i4cace2yzko9n.png"
                      alt="محروس شعبان - المصمم والمطور"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">تصميم وتطوير</p>
                    <p className="text-white text-sm font-bold">محروس شعبان</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="bg-black/20">
          <div className="max-w-[1280px] mx-auto px-4 py-4">
            <p className="text-center text-gray-400 text-sm">
              © {new Date().getFullYear()} {school.name} - المرحلة الإعدادية. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>

      {/* ===== ADMIN LOGIN DIALOG ===== */}
      <AdminLogin open={showAdminLogin} onOpenChange={setShowAdminLogin} />

      {/* ===== SCROLL TO TOP ===== */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-m3-primary text-m3-on-primary shadow-lg flex items-center justify-center hover:bg-m3-primary-container transition-colors"
            aria-label="العودة للأعلى"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== ADMIN SHIELD BUTTON ===== */}
      <button
        onClick={() => setShowAdminLogin(true)}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-m3-on-secondary-fixed/80 text-white/30 hover:text-white flex items-center justify-center hover:bg-m3-on-secondary-fixed transition-all"
        aria-label="لوحة الإدارة"
      >
        <Shield className="w-4 h-4" />
      </button>
    </div>
  )
}
