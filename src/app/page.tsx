'use client'

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAdminStore } from '@/lib/admin-store'

// Lazy-loaded sub-pages - only compiled when visited
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
    <div className="w-10 h-10 border-4 border-[#610000] border-t-transparent rounded-full animate-spin" />
  </div>
)

const AdminLayout = dynamic(() => import('@/components/admin/admin-layout').then(m => ({ default: m.AdminLayout })), { loading: PageLoader })
const AdminLogin = dynamic(() => import('@/components/admin/admin-login').then(m => ({ default: m.AdminLogin })))
const StudentLifePage = dynamic(() => import('@/components/student-life-page'), { loading: PageLoader })
const ResultsPage = dynamic(() => import('@/components/results-page'), { loading: PageLoader })
const SchedulesPage = dynamic(() => import('@/components/schedules-page'), { loading: PageLoader })
const DigitalLibraryPage = dynamic(() => import('@/components/digital-library-page'), { loading: PageLoader })
const ParentsPortalPage = dynamic(() => import('@/components/parents-portal-page'), { loading: PageLoader })
const CustomSectionRenderer = dynamic(() => import('@/components/home/CustomSectionRenderer').then(m => ({ default: m.CustomSectionRenderer })))

// ===== Types =====
interface SchoolData {
  school: {
    id: string; name: string; subdomain: string; description: string
    logoUrl: string | null; primaryColor: string; secondaryColor: string
    address: string; phone: string; email: string; facebookUrl: string | null; mapEmbedUrl: string | null; isActive: boolean
  }
  settings: {
    heroTitle: string; heroSubtitle: string; bannerTitle: string | null; bannerImageUrl: string | null
    vision: string | null; aboutImage: string | null; aboutVideoUrl: string | null
    showNewsTicker: boolean; showHeroBanner: boolean; showLiveStream: boolean; liveStreamUrl: string | null
    facebookUrl: string | null; youtubeUrl: string | null
    showSlider: boolean; showAbout: boolean; showNews: boolean; showServices: boolean
    showGallery: boolean; showTeachers: boolean; showStats: boolean; showContact: boolean
    developerName: string; developerPhoto: string | null
  } | null
  stats: { students: number; teachers: number; classes: number; years: number } | null
}

interface NewsItem {
  id: string; title: string; excerpt: string | null; image: string | null
  category: string; active: boolean; createdAt: string
}

interface GalleryItem { id: string; title: string | null; imageUrl: string }
interface Teacher { id: string; name: string; subject: string; email: string | null; imageUrl: string | null }
interface SliderItem { id: string; imageUrl: string; title: string | null; subtitle: string | null; active: boolean }
interface CustomSectionItem { id: string; title: string; content: string; imageUrl: string | null; layout: string; active: boolean; sortOrder: number }

const defaultSchoolData: SchoolData = {
  school: {
    id: 'demo', name: 'المدرسة الإعدادية النموذجية', subdomain: 'demo',
    description: 'مدرسة رائدة في التعليم الإعدادي', logoUrl: null,
    primaryColor: '#610000', secondaryColor: '#009688',
    address: 'الشارع الرئيسي، المدينة', phone: '0123456789',
    email: 'info@school.edu', facebookUrl: null, mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d110502.76718827617!2d31.66512595!3d26.5593145!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x144f1f9b6c3e3fd5%3A0x8e5e3e0a1e0e2e0e!2sSohag%2C%20Egypt!5e0!3m2!1sar!2seg!4v1700000000000!5m2!1sar!2seg',
    isActive: true,
  },
  settings: {
    heroTitle: 'المدرسة الإعدادية النموذجية', heroSubtitle: 'نحو تعليم متميز ومستقبل مشرق',
    bannerTitle: 'مرحباً بكم', bannerImageUrl: null, vision: null,
    aboutImage: null, aboutVideoUrl: null, showNewsTicker: true,
    showHeroBanner: true, showLiveStream: false, liveStreamUrl: null,
    facebookUrl: null, youtubeUrl: null, showSlider: true, showAbout: true,
    showNews: true, showServices: true, showGallery: true, showTeachers: true,
    showStats: true, showContact: true, developerName: 'محروس شعبان', developerPhoto: null,
  },
  stats: { students: 0, teachers: 0, classes: 0, years: 0 },
}

const navLinks = [
  { label: 'الرئيسية', href: '#' },
  { label: 'من نحن', href: '#welcome' },
  { label: 'أحدث الأخبار', href: '#news' },
  { label: 'الخدمات الإلكترونية', href: '#services', isServices: true },
  { label: 'الحياة الطلابية', href: '#student-life', isStudentLife: true },
  { label: 'معرض الصور', href: '#gallery' },
  { label: 'اتصل بنا', href: '#contact' },
]

const serviceItems = [
  { label: 'نتائج الطلاب', icon: '📋', action: 'results' },
  { label: 'جداول الحصص', icon: '📅', action: 'schedules' },
  { label: 'المكتبة الرقمية', icon: '📚', action: 'library' },
  { label: 'أولياء الأمور', icon: '👨‍👩‍👧', action: 'parents' },
]

// ===== Main Component =====
export default function HomePageWrapper() {
  return (
    <Suspense fallback={<PageLoader />}>
      <HomePage />
    </Suspense>
  )
}

function HomePage() {
  const { isAdminMode, selectedSchoolId, setSelectedSchoolId, setSchools, _hasHydrated, setHasHydrated } = useAdminStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
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
  const [servicesOpen, setServicesOpen] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [showResultsPage, setShowResultsPage] = useState(false)
  const [showStudentLife, setShowStudentLife] = useState(false)
  const [showSchedulesPage, setShowSchedulesPage] = useState(false)
  const [showLibraryPage, setShowLibraryPage] = useState(false)
  const [showParentsPage, setShowParentsPage] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const logoClickCount = useRef(0)
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hydrated = _hasHydrated

  // Fallback: ensure hydration flag is set on the client (Zustand v5
  // onRehydrateStorage may not fire in all environments).
  useEffect(() => {
    if (!_hasHydrated) setHasHydrated(true)
  }, [_hasHydrated, setHasHydrated])

  // Resolve school from subdomain only (not from store's school list)
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    async function resolveSchool() {
      try {
        if (urlSubdomain) {
          // If subdomain is in URL, fetch by subdomain
          const res = await fetch(`/api/school/by-subdomain?subdomain=${urlSubdomain}`)
          if (res.ok && !cancelled) {
            const data = await res.json()
            if (data.school) {
              setSchoolData(data)
              setSelectedSchoolId(data.school.id)
              return
            }
          }
        }
        // No subdomain in URL — fetch first available school
        const schoolsRes = await fetch('/api/schools')
        if (schoolsRes.ok && !cancelled) {
          const schoolsList = await schoolsRes.json()
          if (Array.isArray(schoolsList) && schoolsList.length > 0) {
            setSchools(schoolsList)
            const firstSchool = schoolsList[0]
            // Fetch full data for the first school
            const res = await fetch(`/api/school?schoolId=${firstSchool.id}`)
            if (res.ok && !cancelled) {
              const data = await res.json()
              if (data.school) {
                setSchoolData(data)
                setSelectedSchoolId(data.school.id)
              }
            }
          }
        }
      } catch {
        // fallback to default data
      }
    }
    resolveSchool()
    return () => { cancelled = true }
  }, [hydrated, urlSubdomain, setSelectedSchoolId, setSchools])

  // Fetch content for selected school
  useEffect(() => {
    if (!hydrated || !selectedSchoolId) return
    let cancelled = false
    const sid = selectedSchoolId
    async function loadData() {
      setLoading(true)
      try {
        const [newsRes, galleryRes, teachersRes, slidersRes, csRes] = await Promise.allSettled([
          fetch(`/api/news?limit=10&schoolId=${sid}`),
          fetch(`/api/gallery?limit=8&schoolId=${sid}`),
          fetch(`/api/teachers?schoolId=${sid}`),
          fetch(`/api/sliders?schoolId=${sid}`),
          fetch(`/api/custom-sections?schoolId=${sid}`),
        ])
        if (cancelled) return
        if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
          const d = await newsRes.value.json()
          if (Array.isArray(d) && !cancelled) setNews(d)
        }
        if (galleryRes.status === 'fulfilled' && galleryRes.value.ok) {
          const d = await galleryRes.value.json()
          if (Array.isArray(d) && !cancelled) setGallery(d)
        }
        if (teachersRes.status === 'fulfilled' && teachersRes.value.ok) {
          const d = await teachersRes.value.json()
          if (Array.isArray(d) && !cancelled) setTeachers(d)
        }
        if (slidersRes.status === 'fulfilled' && slidersRes.value.ok) {
          const d = await slidersRes.value.json()
          if (Array.isArray(d) && !cancelled) setSliders(d)
        }
        if (csRes.status === 'fulfilled' && csRes.value.ok) {
          const d = await csRes.value.json()
          if (Array.isArray(d) && !cancelled) setCustomSections(d)
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [selectedSchoolId, hydrated])

  // Auto-rotate slider
  const activeSliders = sliders.filter(s => s.active)
  const newsWithImage = news.filter(n => n.image).slice(0, 5)
  const slideItems = activeSliders.length > 0 ? activeSliders : newsWithImage
  useEffect(() => {
    if (slideItems.length <= 1) return
    const timer = setInterval(() => setCurrentSlide(i => (i + 1) % slideItems.length), 5000)
    return () => clearInterval(timer)
  }, [slideItems.length])

  // Scroll to top
  useEffect(() => {
    const h = () => setShowScrollTop(window.scrollY > 500)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current)
    logoClickTimer.current = setTimeout(() => { logoClickCount.current = 0 }, 3000)
    if (logoClickCount.current >= 5) { logoClickCount.current = 0; setShowAdminLogin(true) }
  }, [])

  const handleServiceAction = (action: string) => {
    setServicesOpen(false); setMobileMenuOpen(false)
    if (action === 'results') setShowResultsPage(true)
    if (action === 'schedules') setShowSchedulesPage(true)
    if (action === 'library') setShowLibraryPage(true)
    if (action === 'parents') setShowParentsPage(true)
  }

  const school = schoolData?.school || defaultSchoolData.school
  const settings = schoolData?.settings || defaultSchoolData.settings
  const stats = schoolData?.stats || defaultSchoolData.stats
  const alertNews = news.filter(n => n.category === 'تنبيه')

  // Build ticker text for seamless scrolling
  const tickerText = news.map(item => item.title).join('     ◆     ')

  // Sub-page rendering
  if (isAdminMode) return <AdminLayout />
  if (showStudentLife) return <StudentLifePage onBack={() => setShowStudentLife(false)} />
  if (showResultsPage) return <ResultsPage onBack={() => setShowResultsPage(false)} schoolId={selectedSchoolId} />
  if (showSchedulesPage) return <SchedulesPage onBack={() => setShowSchedulesPage(false)} schoolId={selectedSchoolId} />
  if (showLibraryPage) return <DigitalLibraryPage onBack={() => setShowLibraryPage(false)} schoolId={selectedSchoolId} />
  if (showParentsPage) return <ParentsPortalPage onBack={() => setShowParentsPage(false)} schoolId={selectedSchoolId} />

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#610000] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">

      {/* ===== STICKY TOP ===== */}
      <div className="sticky top-0 z-50 shadow-lg">
        {/* Top Bar - Contact info only, NO school switcher for visitors */}
        <div style={{ backgroundColor: school.primaryColor }} className="text-white text-xs">
          <div className="max-w-[1280px] mx-auto px-4 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {school.phone && <a href={`tel:${school.phone}`} className="hover:opacity-80 flex items-center gap-1">📞 {school.phone}</a>}
              {school.email && <a href={`mailto:${school.email}`} className="hover:opacity-80 flex items-center gap-1">✉️ {school.email}</a>}
            </div>
            <div className="flex items-center gap-2">
              {school.facebookUrl && (
                <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">📘</a>
              )}
              {settings?.youtubeUrl && (
                <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">📺</a>
              )}
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-[1280px] mx-auto px-4 py-2 flex items-center gap-3">
            <div onClick={handleLogoClick} className="cursor-pointer shrink-0" title="اضغط 5 مرات للإدارة">
              {school.logoUrl ? (
                <img src={school.logoUrl} alt={school.name} className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: school.primaryColor }} />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl" style={{ backgroundColor: school.primaryColor }}>🏫</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-xl font-bold truncate" style={{ color: school.primaryColor }}>{school.name}</h1>
              {settings?.heroSubtitle && <p className="text-xs text-gray-500 truncate">{settings.heroSubtitle}</p>}
            </div>
            <button className="lg:hidden p-2 text-2xl text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>

        {/* Navigation */}
        <nav style={{ backgroundColor: '#1a2332' }} className="text-white shadow-lg">
          <div className="max-w-[1280px] mx-auto px-4">
            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center h-11">
              {navLinks.map((link) => (
                link.isServices ? (
                  <div key={link.href} className="relative" onMouseEnter={() => setServicesOpen(true)} onMouseLeave={() => setServicesOpen(false)}>
                    <button className="px-5 h-full text-sm font-medium hover:bg-white/10 flex items-center gap-1 transition-colors">
                      {link.label} ▾
                    </button>
                    {servicesOpen && (
                      <div className="absolute top-full right-0 bg-white rounded-lg shadow-xl border min-w-[220px] z-50 overflow-hidden">
                        {serviceItems.map(item => (
                          <button key={item.action} onClick={() => handleServiceAction(item.action)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span className="text-lg">{item.icon}</span> {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <a key={link.href} href={link.isStudentLife ? undefined : link.href}
                    onClick={link.isStudentLife ? (e) => { e.preventDefault(); setShowStudentLife(true) } : undefined}
                    className="px-5 h-full text-sm font-medium hover:bg-white/10 flex items-center transition-colors">
                    {link.label}
                  </a>
                )
              ))}
            </div>
            {/* Mobile Nav */}
            {mobileMenuOpen && (
              <div className="lg:hidden py-2 border-t border-white/10">
                {navLinks.map((link) => (
                  link.isServices ? (
                    <div key={link.href}>
                      <div className="px-4 py-2 text-sm font-medium text-white/70">{link.label}</div>
                      {serviceItems.map(item => (
                        <button key={item.action} onClick={() => handleServiceAction(item.action)}
                          className="w-full flex items-center gap-2 px-8 py-2 text-sm text-white/80 hover:bg-white/10">
                          <span>{item.icon}</span> {item.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <a key={link.href} href={link.isStudentLife ? undefined : link.href}
                      onClick={link.isStudentLife ? (e) => { e.preventDefault(); setShowStudentLife(true); setMobileMenuOpen(false) } : () => setMobileMenuOpen(false)}
                      className="block px-4 py-2 text-sm hover:bg-white/10">{link.label}</a>
                  )
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* News Ticker - Seamless scrolling */}
        {settings?.showNewsTicker && news.length > 0 && (
          <div className="bg-gray-100 border-b overflow-hidden">
            <div className="flex items-center">
              <span className="bg-red-600 text-white px-4 py-2 text-xs font-bold shrink-0 flex items-center gap-1 z-10">
                🔴 عاجل
              </span>
              <div className="overflow-hidden flex-1 relative">
                <div className="animate-news-ticker-scroll whitespace-nowrap py-2">
                  {/* Duplicate content for seamless loop */}
                  <span className="inline-block text-sm mx-4">
                    {tickerText}
                  </span>
                  <span className="inline-block text-sm mx-4">
                    {tickerText}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1">
        {/* Hero Slider */}
        {(settings?.showSlider ?? true) && (
          <section className="max-w-[1280px] mx-auto px-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 rounded-lg overflow-hidden shadow-lg relative h-[300px] md:h-[400px] bg-gray-200">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">جاري التحميل...</div>
                ) : slideItems.length > 0 ? (
                  <>
                    <img
                      src={'imageUrl' in slideItems[currentSlide] ? (slideItems[currentSlide] as SliderItem).imageUrl : (slideItems[currentSlide] as NewsItem).image || ''}
                      alt={'title' in slideItems[currentSlide] ? slideItems[currentSlide].title || '' : ''}
                      className="w-full h-full object-cover transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 right-0 left-0 p-5">
                      <h2 className="text-lg md:text-xl font-bold text-white mb-1">{slideItems[currentSlide].title}</h2>
                      {'subtitle' in slideItems[currentSlide] && (slideItems[currentSlide] as SliderItem).subtitle && (
                        <p className="text-white/70 text-sm">{(slideItems[currentSlide] as SliderItem).subtitle}</p>
                      )}
                    </div>
                    {slideItems.length > 1 && (
                      <div className="absolute bottom-4 left-4 flex gap-1.5">
                        {slideItems.map((_, i) => (
                          <button key={i} onClick={() => setCurrentSlide(i)}
                            className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentSlide ? 'bg-white' : 'bg-white/50'}`} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white relative overflow-hidden" style={{ backgroundColor: school.primaryColor }}>
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-white/20" />
                      <div className="absolute bottom-10 left-10 w-60 h-60 rounded-full bg-white/10" />
                    </div>
                    <div className="text-center px-4 relative z-10">
                      <h2 className="text-2xl md:text-4xl font-bold mb-2">{settings?.heroTitle || school.name}</h2>
                      <p className="text-white/80 text-lg">{settings?.heroSubtitle || 'نحو تعليم متميز'}</p>
                      <button className="mt-4 px-6 py-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors">
                        اكتشف المزيد
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Headlines - side by side with Alerts */}
              <div className="md:col-span-3 bg-white rounded-lg shadow-md overflow-hidden h-[300px] md:h-[400px] flex flex-col">
                <div className="px-3 py-2.5 text-white font-bold text-sm flex items-center gap-1" style={{ backgroundColor: school.primaryColor }}>
                  📰 العناوين
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {slideItems.length > 0 ? slideItems.map((item, i) => (
                    <button key={item.id} onClick={() => setCurrentSlide(i)}
                      className={`w-full text-right px-3 py-2 rounded-md mb-1 transition-colors text-xs ${
                        i === currentSlide ? 'text-white shadow-sm' : 'hover:bg-gray-100'
                      }`} style={i === currentSlide ? { backgroundColor: school.primaryColor } : {}}>
                      <div className="font-bold line-clamp-2">{item.title}</div>
                    </button>
                  )) : <p className="text-gray-400 text-center py-8 text-sm">لا توجد عناوين</p>}
                </div>
              </div>
              {/* Alerts - side by side with Headlines */}
              {alertNews.length > 0 && (
                <div className="md:col-span-2 bg-white rounded-lg shadow-md overflow-hidden h-[300px] md:h-[400px] flex flex-col">
                  <div className="px-3 py-2.5 text-white font-bold text-sm flex items-center gap-1" style={{ backgroundColor: '#d32f2f' }}>
                    ⚠️ تنبيهات
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {alertNews.map(item => (
                      <div key={item.id} className="p-2.5 border-b hover:bg-gray-50">
                        <div className="text-[10px] text-gray-400 mb-0.5">{new Date(item.createdAt).toLocaleDateString('ar-EG')}</div>
                        <div className="text-xs font-bold">{item.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Welcome / About Section */}
        {(settings?.showAbout ?? true) && (
          <section id="welcome" className="py-12 bg-white">
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl bg-gray-200">
                  {settings?.aboutVideoUrl ? (
                    <iframe src={settings.aboutVideoUrl.replace('watch?v=', 'embed/')} className="w-full h-full" allowFullScreen />
                  ) : (
                    <img src={settings?.aboutImage || 'https://picsum.photos/seed/schoolwelcome/600/450'} alt="عن المدرسة" className="w-full h-full object-cover" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: school.primaryColor }}>
                    مرحباً بكم في {school.name}
                  </h2>
                  {school.description && <p className="text-gray-600 leading-relaxed mb-4">{school.description}</p>}
                  {settings?.vision && (
                    <div className="rounded-xl p-5 border" style={{ borderColor: school.secondaryColor + '40', backgroundColor: school.secondaryColor + '10' }}>
                      <h3 className="font-bold mb-2" style={{ color: school.secondaryColor }}>👁️ رؤيتنا</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{settings.vision}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* News Section - Card Grid */}
        {(settings?.showNews ?? true) && (
          <section id="news" className="py-12" style={{ backgroundColor: '#f0f0f0' }}>
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: school.primaryColor }}>أحدث الأخبار</h2>
                <div className="w-20 h-1 mx-auto mt-3 rounded-full" style={{ backgroundColor: school.primaryColor }} />
              </div>
              {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1,2,3].map(i => <div key={i} className="bg-white rounded-lg shadow-md h-64 animate-pulse" />)}
                </div>
              ) : news.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {news.slice(0, 6).map((item, index) => (
                    <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow group">
                      <div className="h-48 overflow-hidden relative">
                        <img src={item.image || `https://picsum.photos/seed/news${index + 20}/400/250`} alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <span className="absolute top-3 right-3 px-2 py-1 rounded text-xs text-white font-medium" style={{ backgroundColor: school.primaryColor }}>
                          {item.category}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                          <span>🕐</span> {new Date(item.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1 line-clamp-2">{item.title}</h3>
                        {item.excerpt && <p className="text-sm text-gray-500 line-clamp-2">{item.excerpt}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-12">لا توجد أخبار حالياً</p>
              )}
            </div>
          </section>
        )}

        {/* Services Section - Colored Cards matching screenshot */}
        {(settings?.showServices ?? true) && (
          <section id="services" className="py-12 bg-white">
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: school.primaryColor }}>الخدمات الإلكترونية</h2>
                <p className="text-gray-500 text-sm mt-2">استفد من خدماتنا الإلكترونية المتنوعة</p>
                <div className="w-20 h-1 mx-auto mt-3 rounded-full" style={{ backgroundColor: school.primaryColor }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { icon: '📋', title: 'الاستعلام عن النتائج', desc: 'استعلم عن نتائجك الأكاديمية بسهولة وسرعة', action: 'results', color: '#2196F3' },
                  { icon: '📅', title: 'جداول الحصص', desc: 'عرض جداول الحصص والمواعيد الدراسية', action: 'schedules', color: '#FF9800' },
                  { icon: '👨‍👩‍👧', title: 'بوابة أولياء الأمور', desc: 'متابعة أداء ابنكم الأكاديمي والسلوكي', action: 'parents', color: '#4CAF50' },
                  { icon: '📚', title: 'المكتبة الرقمية', desc: 'تصفح الكتب والمراجع الإلكترونية', action: 'library', color: '#9C27B0' },
                  { icon: '💻', title: 'التحول الرقمي', desc: 'خدمات التحول الرقمي المتقدمة', action: 'schedules', color: '#00BCD4' },
                  { icon: '💬', title: 'التواصل مع الإدارة', desc: 'تواصل مباشرة مع إدارة المدرسة', href: '#contact', color: '#E91E63' },
                ].map(service => (
                  <div key={service.title}
                    onClick={() => service.action ? handleServiceAction(service.action) : document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                    className="rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer p-6 group text-white relative overflow-hidden"
                    style={{ backgroundColor: service.color }}>
                    {/* Decorative circle */}
                    <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full bg-white/10" />
                    <div className="relative z-10">
                      <div className="text-3xl mb-3">{service.icon}</div>
                      <h3 className="font-bold text-lg mb-2">{service.title}</h3>
                      <p className="text-white/80 text-sm">{service.desc}</p>
                      <div className="mt-3 text-sm font-medium text-white/90 hover:text-white flex items-center gap-1">
                        أعرف أكثر ←
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Gallery Section */}
        {(settings?.showGallery ?? true) && gallery.length > 0 && (
          <section id="gallery" className="py-12" style={{ backgroundColor: '#f0f0f0' }}>
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: school.primaryColor }}>📸 معرض الصور</h2>
                <div className="w-20 h-1 mx-auto mt-3 rounded-full" style={{ backgroundColor: school.primaryColor }} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gallery.map(item => (
                  <div key={item.id} className="aspect-square rounded-xl overflow-hidden shadow-md group cursor-pointer">
                    <img src={item.imageUrl} alt={item.title || 'صورة'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Teachers Section */}
        {(settings?.showTeachers ?? true) && teachers.length > 0 && (
          <section id="teachers" className="py-12 bg-white">
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: school.primaryColor }}>👨‍🏫 فريق التدريس</h2>
                <div className="w-20 h-1 mx-auto mt-3 rounded-full" style={{ backgroundColor: school.primaryColor }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="bg-white rounded-xl shadow-md overflow-hidden group hover:shadow-lg transition-shadow">
                    <div className="aspect-[3/4] overflow-hidden">
                      {teacher.imageUrl ? (
                        <img src={teacher.imageUrl} alt={teacher.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white/50" style={{ backgroundColor: school.primaryColor }}>
                          {teacher.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <h3 className="font-bold">{teacher.name}</h3>
                      <p className="text-sm text-gray-500">{teacher.subject}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Stats Section - in school primary color */}
        {(settings?.showStats ?? true) && stats && (stats.students > 0 || stats.teachers > 0) && (
          <section style={{ backgroundColor: school.primaryColor }} className="py-10">
            <div className="max-w-[1280px] mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: '👨‍🎓', label: 'طلاب', value: stats.students },
                { icon: '👨‍🏫', label: 'معلمون', value: stats.teachers },
                { icon: '📖', label: 'فصول', value: stats.classes },
                { icon: '🏆', label: 'سنوات خبرة', value: stats.years },
              ].map(stat => (
                <div key={stat.label} className="text-center text-white p-4">
                  <div className="text-4xl mb-2">{stat.icon}</div>
                  <div className="text-4xl font-bold mb-1">{stat.value}</div>
                  <div className="text-white/70 text-sm font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact Section */}
        {(settings?.showContact ?? true) && (
          <section id="contact" className="py-12 bg-white">
            <div className="max-w-[1280px] mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: school.primaryColor }}>📞 تواصل معنا</h2>
                <div className="w-20 h-1 mx-auto mt-3 rounded-full" style={{ backgroundColor: school.primaryColor }} />
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                {/* Contact Form */}
                <div className="bg-white border rounded-xl shadow-md p-6">
                  <h3 className="text-xl font-bold mb-4" style={{ color: school.primaryColor }}>اتصل بنا</h3>
                  <form onSubmit={e => e.preventDefault()} className="space-y-3">
                    <input placeholder="الاسم" className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#610000] focus:border-transparent outline-none" />
                    <input type="email" placeholder="البريد الإلكتروني" className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#610000] focus:border-transparent outline-none" />
                    <input type="tel" placeholder="الجوال" className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#610000] focus:border-transparent outline-none" />
                    <textarea placeholder="اكتب رسالتك هنا..." className="w-full border rounded-lg px-4 py-2.5 text-sm min-h-[100px] focus:ring-2 focus:ring-[#610000] focus:border-transparent outline-none" />
                    <button type="submit" className="w-full py-2.5 rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: school.primaryColor }}>
                      إرسال الرسالة
                    </button>
                  </form>
                </div>
                {/* Contact Info + Map */}
                <div className="flex flex-col gap-6">
                  {/* Contact Info Card */}
                  <div className="rounded-xl p-6 text-white" style={{ backgroundColor: school.primaryColor }}>
                    <h3 className="text-xl font-bold mb-6">بيانات الاتصال</h3>
                    <div className="space-y-4">
                      {school.address && <div className="flex items-start gap-3"><span className="text-xl">📍</span><div><div className="text-white/70 text-sm">الموقع</div><div className="font-medium">{school.address}</div></div></div>}
                      {school.phone && <div className="flex items-start gap-3"><span className="text-xl">📞</span><div><div className="text-white/70 text-sm">الهاتف</div><a href={`tel:${school.phone}`} className="font-medium hover:text-white/80" dir="ltr">{school.phone}</a></div></div>}
                      {school.email && <div className="flex items-start gap-3"><span className="text-xl">✉️</span><div><div className="text-white/70 text-sm">البريد الإلكتروني</div><a href={`mailto:${school.email}`} className="font-medium hover:text-white/80" dir="ltr">{school.email}</a></div></div>}
                    </div>
                    {/* Social links */}
                    <div className="mt-6 pt-4 border-t border-white/20">
                      <div className="flex gap-3">
                        {school.facebookUrl && <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">📘</a>}
                        {settings?.youtubeUrl && <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">📺</a>}
                      </div>
                    </div>
                  </div>
                  {/* Google Map */}
                  <div className="rounded-xl overflow-hidden shadow-md border">
                    <div className="px-4 py-2.5 text-white font-bold text-sm flex items-center gap-2" style={{ backgroundColor: school.primaryColor }}>
                      📍 خريطة الموقع
                    </div>
                    <div className="relative" style={{ height: '250px' }}>
                      {school.mapEmbedUrl ? (
                        <iframe
                          src={school.mapEmbedUrl}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="خريطة الموقع"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <span className="text-4xl block mb-2">🗺️</span>
                            <p className="text-sm">لم يتم تحديد موقع على الخريطة</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Custom Sections */}
        <CustomSectionRenderer sections={customSections} />
      </main>

      {/* Footer - Approved Design */}
      <footer className="text-white mt-auto">
        {/* Colored bar at top */}
        <div className="flex h-1.5">
          <div className="flex-1" style={{ backgroundColor: school.primaryColor }} />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-gray-800" />
        </div>
        {/* Main footer content */}
        <div style={{ backgroundColor: '#1a2332' }}>
          <div className="max-w-[1280px] mx-auto px-4 py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Column 1: Contact Info */}
              <div>
                <h3 className="font-bold text-lg mb-4" style={{ color: school.primaryColor }}>تواصل معنا</h3>
                <div className="space-y-3 text-sm">
                  {school.address && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">📍</span>
                      <span className="text-gray-300">{school.address}</span>
                    </div>
                  )}
                  {school.phone && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">📞</span>
                      <a href={`tel:${school.phone}`} className="text-gray-300 hover:text-white transition-colors" dir="ltr">{school.phone}</a>
                    </div>
                  )}
                  {school.email && (
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">✉️</span>
                      <a href={`mailto:${school.email}`} className="text-gray-300 hover:text-white transition-colors" dir="ltr">{school.email}</a>
                    </div>
                  )}
                </div>
              </div>
              {/* Column 2: Academic Links */}
              <div>
                <h3 className="font-bold text-lg mb-4" style={{ color: school.primaryColor }}>الروابط الأكاديمية</h3>
                <ul className="space-y-2">
                  {serviceItems.map(item => (
                    <li key={item.action}>
                      <button onClick={() => handleServiceAction(item.action)} className="text-gray-300 hover:text-white text-sm transition-colors flex items-center gap-2">
                        <span className="text-xs">◆</span> {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Column 3: School Links */}
              <div>
                <h3 className="font-bold text-lg mb-4" style={{ color: school.primaryColor }}>روابط المدرسة</h3>
                <ul className="space-y-2">
                  {navLinks.filter(l => !l.isServices).map(link => (
                    <li key={link.href}>
                      <a href={link.href} className="text-gray-300 hover:text-white text-sm transition-colors flex items-center gap-2">
                        <span className="text-xs">◆</span> {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Column 4: School Logo & Name (changes with school) */}
              <div className="flex flex-col items-center sm:items-start">
                <div className="mb-3">
                  {school.logoUrl ? (
                    <img src={school.logoUrl} alt={school.name} className="w-16 h-16 rounded-full object-cover border-3" style={{ borderColor: school.primaryColor }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: school.primaryColor }}>🏫</div>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-2 text-center sm:text-right">{school.name}</h3>
                {school.description && <p className="text-gray-400 text-xs line-clamp-3 text-center sm:text-right">{school.description}</p>}
                {/* Social icons */}
                <div className="flex gap-2 mt-3">
                  {school.facebookUrl && (
                    <a href={school.facebookUrl} target="_blank" rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors" style={{ backgroundColor: school.primaryColor }}>
                      📘
                    </a>
                  )}
                  {settings?.youtubeUrl && (
                    <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors" style={{ backgroundColor: school.primaryColor }}>
                      📺
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Bottom bar - Developer credit */}
          <div className="border-t border-white/10">
            <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center justify-center gap-3 text-gray-400 text-xs">
              <span>تصميم وتطوير</span>
              {settings?.developerPhoto ? (
                <img src={settings.developerPhoto} alt={settings?.developerName || 'المطور'} className="w-7 h-7 rounded-full object-cover border border-white/20" />
              ) : (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white" style={{ backgroundColor: school.primaryColor }}>👨‍💻</div>
              )}
              <span className="font-bold text-white">{settings?.developerName || 'محروس شعبان'}</span>
              <span>© {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to Top */}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 w-12 h-12 rounded-full shadow-lg text-white hover:opacity-90 transition-opacity z-40 flex items-center justify-center text-xl"
          style={{ backgroundColor: school.primaryColor }}>
          ↑
        </button>
      )}

      {/* Admin Login Modal */}
      <AdminLogin open={showAdminLogin} onOpenChange={setShowAdminLogin} />
    </div>
  )
}
