'use client'

/**
 * ============================================================
 *  مركز التحميل — صفحة عامة لتحميل النماذج والمستندات
 * ============================================================
 *  • تعرض الملفات مجمّعة حسب التصنيف (5 تصنيفات)
 *  • تبويبات shadcn + بحث فوري + بطاقات ملفات
 *  • يستخدم النمط المعماري للقائمة: mountedRef + AbortController
 *  • زر التحميل <a download> يفتح /api/downloads/[id]/file
 * ============================================================
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  ArrowRight, Download, Search, RefreshCw, GraduationCap, Users,
  Wallet, Briefcase, FileText, FileSpreadsheet, FileImage, FileArchive,
  Calendar, AlertCircle, FolderOpen, FileQuestion,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DOWNLOAD_CATEGORIES,
  formatFileSize,
  getFileTypeIcon,
} from '@/lib/downloads'

interface DownloadsPageProps {
  onBack: () => void
  schoolId: string
}

interface DownloadFile {
  id: string
  schoolId: string
  category: string
  title: string
  description: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  uploadedById: string | null
  uploadedByName: string
  isActive: boolean
  downloadsCount: number
  createdAt: string
  updatedAt: string
}

// خريطة أيقونات التصنيفات (Lucide)
const CATEGORY_ICONS: Record<string, typeof FileText> = {
  STUDENT_AFFAIRS: GraduationCap,
  STAFF_AFFAIRS: Users,
  FINANCIAL: Wallet,
  ADMINISTRATIVE: Briefcase,
  GENERAL: FileText,
}

// خريطة ألوان أيقونة نوع الملف (Tailwind classes)
const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-50 text-red-600',
  word: 'bg-blue-50 text-blue-600',
  excel: 'bg-green-50 text-green-600',
  powerpoint: 'bg-orange-50 text-orange-600',
  image: 'bg-purple-50 text-purple-600',
  archive: 'bg-slate-100 text-slate-600',
  text: 'bg-gray-50 text-gray-600',
  file: 'bg-gray-50 text-gray-500',
}

// مكوّن أيقونة نوع الملف
function FileTypeIconView({
  type,
  className,
}: {
  type: ReturnType<typeof getFileTypeIcon>
  className?: string
}) {
  switch (type) {
    case 'image':
      return <FileImage className={className} />
    case 'archive':
      return <FileArchive className={className} />
    case 'excel':
      return <FileSpreadsheet className={className} />
    default:
      return <FileText className={className} />
  }
}

// تنسيق التاريخ بطريقة عربية نسبية
function formatArabicDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days < 0) return formatYMD(d)
    if (days === 0) return 'اليوم'
    if (days === 1) return 'أمس'
    if (days < 7) return `منذ ${days} ${days === 2 ? 'يومين' : 'أيام'}`
    if (days < 14) return 'منذ أسبوع'
    if (days < 30) {
      const w = Math.floor(days / 7)
      return `منذ ${w} ${w === 2 ? 'أسبوعين' : 'أسابيع'}`
    }
    if (days < 60) return 'منذ شهر'
    if (days < 365) {
      const m = Math.floor(days / 30)
      return `منذ ${m} ${m === 2 ? 'شهرين' : 'أشهر'}`
    }
    return formatYMD(d)
  } catch {
    return dateStr
  }
}

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DownloadsPage({ onBack, schoolId }: DownloadsPageProps) {
  const [activeCategory, setActiveCategory] = useState<string>('STUDENT_AFFAIRS')
  const [files, setFiles] = useState<DownloadFile[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [countLoading, setCountLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const mountedRef = useRef(true)

  // ===== Fetch files for active category (per spec pattern) =====
  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    setLoading(true)
    fetch(
      `/api/downloads?schoolId=${encodeURIComponent(schoolId)}&category=${activeCategory}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        if (mountedRef.current) {
          setFiles(data.files || [])
          setError(null)
        }
      })
      .catch((e) => {
        if (mountedRef.current && e?.name !== 'AbortError') {
          setError('فشل تحميل الملفات')
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [schoolId, activeCategory, refreshKey])

  // ===== Fetch total counts (once on mount + on refresh) =====
  // Drives the hero stat + per-tab count badges
  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    setCountLoading(true)
    fetch(`/api/downloads?schoolId=${encodeURIComponent(schoolId)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (mountedRef.current) {
          const all: DownloadFile[] = data.files || []
          setTotalCount(all.length)
          const counts: Record<string, number> = {}
          for (const c of DOWNLOAD_CATEGORIES) {
            counts[c.value] = all.filter((f) => f.category === c.value).length
          }
          setCategoryCounts(counts)
        }
      })
      .catch(() => {
        // silent failure — counts are decorative
      })
      .finally(() => {
        if (mountedRef.current) setCountLoading(false)
      })
    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [schoolId, refreshKey])

  // Filter files client-side by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files
    const q = searchQuery.trim().toLowerCase()
    return files.filter(
      (f) =>
        (f.title || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.fileName || '').toLowerCase().includes(q)
    )
  }, [files, searchQuery])

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
    toast.success('تم تحديث القائمة')
  }

  const handleTabChange = (value: string) => {
    // Show loading immediately to avoid a brief flash of stale data
    setLoading(true)
    setSearchQuery('')
    setActiveCategory(value)
  }

  const handleDownloadClick = (file: DownloadFile) => {
    toast.success(`جاري تحميل: ${file.title}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      {/* ===== Header (sticky) ===== */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Back button — right side in RTL */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#610000] transition-colors shrink-0"
            aria-label="العودة للموقع"
          >
            <ArrowRight className="w-4 h-4" />
            <span>الموقع</span>
          </button>

          {/* Centered title */}
          <div className="flex items-center gap-2.5 min-w-0 justify-center">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#610000] to-[#8a0000] flex items-center justify-center shadow-md shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 text-center">
              <h1 className="text-base md:text-lg font-bold text-[#610000] truncate leading-tight">
                مركز التحميل
              </h1>
              <p className="text-[11px] md:text-xs text-gray-500 truncate hidden sm:block">
                نماذج واستمارات وملفات لشئون الطلاب والعاملين
              </p>
            </div>
          </div>

          {/* Refresh button — left side */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="shrink-0 border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-[#610000] hover:border-[#610000]/30"
            aria-label="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 py-6">
        {/* ===== Hero / Intro Section ===== */}
        <section className="mb-6 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-[#610000] via-[#7a0000] to-[#8a0000] text-white">
          <div className="relative px-6 py-7 md:py-8">
            {/* Decorative circles */}
            <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-10 -right-4 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold">
                  تحميل النماذج والمستندات
                </h2>
              </div>
              <p className="text-white/85 text-sm md:text-base leading-relaxed max-w-2xl mb-4">
                تجد هنا جميع النماذج والاستمارات والتعاميم الإدارية جاهزة للتحميل.
                اختر التصنيف المناسب ثم اضغط على زر التحميل.
              </p>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-1.5 text-sm font-medium">
                <FileText className="w-4 h-4" />
                <span>عدد الملفات المتاحة:</span>
                {countLoading ? (
                  <span className="inline-block w-6 h-4 bg-white/30 rounded animate-pulse" />
                ) : (
                  <span className="font-bold text-white">{totalCount}</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== Tabs (5 categories) ===== */}
        <Tabs
          value={activeCategory}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <TabsList className="bg-white border border-gray-200 h-auto p-1.5 gap-1 inline-flex flex-nowrap rounded-xl">
              {DOWNLOAD_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.value] || FileText
                const isActive = activeCategory === cat.value
                const count = isActive ? files.length : categoryCounts[cat.value] || 0
                return (
                  <TabsTrigger
                    key={cat.value}
                    value={cat.value}
                    className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-[#610000] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all whitespace-nowrap"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{cat.label}</span>
                    <Badge
                      className={`text-[10px] font-bold px-1.5 py-0 h-5 min-w-5 justify-center border-0 ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </Badge>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          {/* Render one content per category — only the active one mounts */}
          {DOWNLOAD_CATEGORIES.map((cat) => (
            <TabsContent
              key={cat.value}
              value={cat.value}
              className="mt-6 focus-visible:outline-none"
            >
              {activeCategory === cat.value && (
                <DownloadsTabContent
                  cat={cat}
                  loading={loading}
                  error={error}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filteredFiles={filteredFiles}
                  schoolId={schoolId}
                  onDownloadClick={handleDownloadClick}
                  onRetry={handleRefresh}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* ===== Footer (sticks to bottom) ===== */}
      <footer className="mt-auto bg-[#1a2332] text-white/70 text-center text-xs py-3">
        نظام مركز التحميل • ملفات شئون الطلاب والعاملين
      </footer>
    </div>
  )
}

// ============================================================
//  Tab Content (search + grid + states)
// ============================================================
interface TabContentProps {
  cat: (typeof DOWNLOAD_CATEGORIES)[number]
  loading: boolean
  error: string | null
  searchQuery: string
  setSearchQuery: (q: string) => void
  filteredFiles: DownloadFile[]
  schoolId: string
  onDownloadClick: (file: DownloadFile) => void
  onRetry: () => void
}

function DownloadsTabContent({
  cat,
  loading,
  error,
  searchQuery,
  setSearchQuery,
  filteredFiles,
  schoolId,
  onDownloadClick,
  onRetry,
}: TabContentProps) {
  return (
    <div>
      {/* Search bar */}
      <div className="mb-5">
        <div className="relative max-w-xl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`ابحث في ${cat.label}...`}
            className="h-11 pr-10 pl-4 text-right text-sm bg-white border-gray-200 rounded-xl shadow-sm focus-visible:ring-[#610000]/30 focus-visible:border-[#610000]"
          />
        </div>
      </div>

      {/* Loading state — 6 skeleton cards */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="border border-gray-200 shadow-sm rounded-xl overflow-hidden py-0 gap-0"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <Skeleton className="w-16 h-5 rounded-full" />
                </div>
                <Skeleton className="w-3/4 h-4 rounded" />
                <Skeleton className="w-full h-3 rounded" />
                <Skeleton className="w-5/6 h-3 rounded" />
                <div className="pt-1 space-y-2">
                  <Skeleton className="w-2/3 h-3 rounded" />
                  <Skeleton className="w-1/3 h-3 rounded" />
                </div>
                <Skeleton className="w-full h-10 rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-red-700 mb-2">خطأ في التحميل</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <Button
            onClick={onRetry}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredFiles.length === 0 && (
        <div className="text-center py-16 px-4">
          <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gray-100 flex items-center justify-center">
            {searchQuery.trim() ? (
              <FileQuestion className="w-12 h-12 text-gray-400" />
            ) : (
              <FolderOpen className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">
            {searchQuery.trim()
              ? 'لا توجد نتائج مطابقة'
              : 'لا توجد ملفات في هذا التصنيف حالياً'}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchQuery.trim()
              ? 'جرّب تعديل كلمات البحث أو تصفّح تصنيفاً آخر'
              : 'يمكنك العودة لاحقاً أو تجربة تصنيف آخر من التبويبات أعلاه'}
          </p>
          {searchQuery.trim() && (
            <Button
              onClick={() => setSearchQuery('')}
              variant="outline"
              className="mt-4 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              مسح البحث
            </Button>
          )}
        </div>
      )}

      {/* Files grid */}
      {!loading && !error && filteredFiles.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                schoolId={schoolId}
                onDownloadClick={onDownloadClick}
              />
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">
            عرض {filteredFiles.length} ملف
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================
//  File Card
// ============================================================
interface FileCardProps {
  file: DownloadFile
  schoolId: string
  onDownloadClick: (file: DownloadFile) => void
}

function FileCard({ file, schoolId, onDownloadClick }: FileCardProps) {
  const fileType = getFileTypeIcon(file.fileName)
  const iconColorClass = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS.file
  const catInfo = DOWNLOAD_CATEGORIES.find((c) => c.value === file.category)
  const catColor = catInfo?.color || '#610000'
  const downloadHref = `/api/downloads/${file.id}/file?schoolId=${encodeURIComponent(schoolId)}`

  return (
    <Card className="group border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#0891b2]/30 transition-all duration-300 rounded-xl overflow-hidden py-0 gap-0">
      <CardContent className="p-5 space-y-3">
        {/* Top row: file type icon + category badge */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconColorClass}`}
          >
            <FileTypeIconView type={fileType} className="w-6 h-6" />
          </div>
          {catInfo && (
            <span
              className="inline-flex items-center text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap"
              style={{
                backgroundColor: `${catColor}15`,
                color: catColor,
                borderColor: `${catColor}30`,
              }}
            >
              {catInfo.label}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-gray-900 line-clamp-2 group-hover:text-[#0891b2] transition-colors leading-snug min-h-[2.6rem]">
          {file.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {file.description?.trim() ? file.description : '—'}
        </p>

        {/* Metadata row */}
        <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
          <span className="truncate max-w-[8rem]" title={file.fileName}>
            {file.fileName}
          </span>
          <span className="text-gray-300">•</span>
          <span className="whitespace-nowrap">{formatFileSize(file.fileSize)}</span>
          <span className="text-gray-300">•</span>
          <span className="whitespace-nowrap inline-flex items-center gap-1">
            <Download className="w-3 h-3" />
            {file.downloadsCount || 0} تحميل
          </span>
        </div>

        {/* Date */}
        <div className="text-xs text-gray-400 inline-flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          <span>{formatArabicDate(file.createdAt)}</span>
        </div>

        {/* Download button — anchor with download attribute */}
        <a
          href={downloadHref}
          download
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onDownloadClick(file)}
          className="block w-full text-center bg-[#610000] hover:bg-[#7a0000] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors shadow-sm hover:shadow-md"
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" />
            تحميل الملف
          </span>
        </a>
      </CardContent>
    </Card>
  )
}
