'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, BellRing, X, Check, AlertTriangle, Newspaper,
  ChevronDown, Inbox, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

// ===== Types =====
interface NewsItem {
  id: string
  title: string
  excerpt: string | null
  content: string | null
  image: string | null
  category: string
  active: boolean
  createdAt: string
}

interface NotificationBellProps {
  schoolId?: string
  /** Optional filter by category (e.g. "تنبيه" for alerts only). If unset, shows all. */
  categoryFilter?: string
  /** Visual variant — header (on dark nav) or floating (on white background) */
  variant?: 'header' | 'floating'
  /** localStorage key prefix for persisting seen IDs */
  storageKey?: string
  /** Optional className for the wrapper */
  className?: string
}

// ===== Category metadata =====
type CatMeta = { icon: string; color: string; bg: string; label: string }
const CATEGORY_META: Record<string, CatMeta> = {
  'تنبيه': { icon: '⚠️', color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'تنبيه' },
  'فعاليات': { icon: '🎉', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', label: 'فعالية' },
  'أخبار': { icon: '📰', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'خبر' },
  'إعلان': { icon: '📢', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'إعلان' },
  'عام': { icon: 'ℹ️', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'عام' },
}

function getCategoryMeta(category: string): CatMeta {
  return CATEGORY_META[category] || {
    icon: '📄',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    label: category || 'عام',
  }
}

// ===== Helpers =====
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const diff = Math.max(0, Date.now() - date.getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `قبل ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `قبل ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 7) return `قبل ${days} يوم`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `قبل ${weeks} أسبوع`
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })
}

function isRecent(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
}

// ===== Component =====
export function NotificationBell({
  schoolId,
  categoryFilter,
  variant = 'header',
  storageKey = 'notif-seen',
  className = '',
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'alerts'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const hasInitialLoadRef = useRef(false)

  // Load seen IDs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const arr = JSON.parse(raw) as string[]
        const set = new Set(arr)
        // Defer to avoid synchronous setState in effect (cascading renders)
        setTimeout(() => setSeenIds(set), 0)
        prevIdsRef.current = set
      }
    } catch {
      // ignore
    }
  }, [storageKey])

  const persistSeen = useCallback(
    (ids: Set<string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(ids)))
      } catch {
        // ignore
      }
    },
    [storageKey],
  )

  // Fetch news (the working source — Announcement/Message tables don't exist in DB)
  const fetchNews = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/news?schoolId=${schoolId}&limit=20`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      const arr: NewsItem[] = Array.isArray(data) ? data : (data.news || [])
      const filtered = categoryFilter
        ? arr.filter((n) => n.category === categoryFilter)
        : arr
      setItems(filtered)
      setError(null)

      // Detect brand-new items after the initial load (for toast)
      if (hasInitialLoadRef.current && !open) {
        const newOnes = filtered.filter(
          (n) => !prevIdsRef.current.has(n.id) && isRecent(n.createdAt),
        )
        if (newOnes.length > 0) {
          const meta = getCategoryMeta(newOnes[0].category)
          const title =
            newOnes.length === 1
              ? newOnes[0].title
              : `${newOnes.length} إشعارات جديدة`
          const desc =
            newOnes.length === 1
              ? newOnes[0].excerpt || 'اضغط الجرس لعرض التفاصيل'
              : 'اضغط الجرس لعرض كل الإشعارات'
          toast(`${meta.icon} ${title}`, {
            description: desc,
            duration: 6000,
          })
        }
      }
      prevIdsRef.current = new Set(filtered.map((n) => n.id))
      hasInitialLoadRef.current = true
    } catch {
      setError('تعذر جلب الإشعارات')
    } finally {
      setLoading(false)
    }
  }, [schoolId, categoryFilter, open])

  // Initial fetch + 60s polling
  useEffect(() => {
    // Defer initial fetch to avoid synchronous setState in effect
    const t = setTimeout(() => fetchNews(), 0)
    const interval = setInterval(fetchNews, 60000)
    return () => {
      clearTimeout(t)
      clearInterval(interval)
    }
  }, [fetchNews])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Mark all as read when opening
  useEffect(() => {
    if (!open || items.length === 0) return
    const newSeen = new Set(seenIds)
    items.forEach((n) => newSeen.add(n.id))
    // Defer to avoid synchronous setState in effect (cascading renders)
    setTimeout(() => setSeenIds(newSeen), 0)
    persistSeen(newSeen)
  }, [open, items, seenIds, persistSeen])

  const unreadCount = items.filter(
    (n) => !seenIds.has(n.id) && isRecent(n.createdAt),
  ).length
  const alerts = items.filter((n) => n.category === 'تنبيه')
  const alertsUnread = alerts.filter(
    (n) => !seenIds.has(n.id) && isRecent(n.createdAt),
  ).length
  const displayItems = activeTab === 'alerts' ? alerts : items

  const isHeader = variant === 'header'
  const btnClass = isHeader
    ? 'relative p-2 rounded-lg hover:bg-white/15 text-white transition-all min-h-[40px] min-w-[40px] flex items-center justify-center'
    : 'relative p-2.5 rounded-full bg-white shadow-md hover:shadow-lg text-gray-700 hover:text-[#610000] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center'

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="الإشعارات"
        aria-expanded={open}
        className={btnClass}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse"
            aria-label={`${unreadCount} إشعارات غير مقروءة`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="مركز الإشعارات"
          className="absolute left-0 mt-2 w-[min(92vw,380px)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Header */}
          <div className="bg-gradient-to-l from-[#610000] to-[#8B0000] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <h3 className="font-bold text-sm">مركز الإشعارات</h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'all' | 'alerts')}
            className="w-full"
          >
            <TabsList className="w-full rounded-none bg-gray-50 grid grid-cols-2 h-auto p-0">
              <TabsTrigger
                value="all"
                className="py-2.5 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#610000] data-[state=active]:bg-white"
              >
                <Newspaper className="w-3.5 h-3.5" />
                الكل ({items.length})
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full px-1.5 text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="alerts"
                className="py-2.5 text-xs gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#610000] data-[state=active]:bg-white"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                التنبيهات ({alerts.length})
                {alertsUnread > 0 && (
                  <span className="bg-red-500 text-white rounded-full px-1.5 text-[10px] font-bold">
                    {alertsUnread}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="m-0">
              <ScrollArea className="h-[min(60vh,400px)]">
                {loading && items.length === 0 ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="p-6 text-center text-sm text-gray-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>{error}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={fetchNews}
                    >
                      <RefreshCw className="w-3.5 h-3.5 ml-1" />
                      إعادة المحاولة
                    </Button>
                  </div>
                ) : displayItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Inbox className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">
                      {activeTab === 'alerts'
                        ? 'لا توجد تنبيهات حالياً'
                        : 'لا توجد إشعارات'}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {displayItems.map((item) => {
                      const meta = getCategoryMeta(item.category)
                      const isUnread =
                        !seenIds.has(item.id) && isRecent(item.createdAt)
                      const expanded = expandedId === item.id
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : item.id)}
                            className={`w-full text-right p-3 hover:bg-gray-50 transition-colors flex gap-2.5 ${
                              isUnread ? 'bg-red-50/40' : ''
                            }`}
                          >
                            <div
                              className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base border ${meta.bg}`}
                            >
                              {meta.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}
                                >
                                  {meta.label}
                                </span>
                                {isUnread && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                )}
                                <span className="text-[10px] text-gray-400 mr-auto">
                                  {timeAgo(item.createdAt)}
                                </span>
                              </div>
                              <p
                                className={`text-xs line-clamp-2 ${
                                  isUnread
                                    ? 'font-bold text-gray-900'
                                    : 'font-semibold text-gray-800'
                                }`}
                              >
                                {item.title}
                              </p>
                              {item.excerpt && !expanded && (
                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                                  {item.excerpt}
                                </p>
                              )}
                              {expanded && (
                                <div className="mt-1.5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                  {item.excerpt && (
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      {item.excerpt}
                                    </p>
                                  )}
                                  {item.content && (
                                    <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                                      {item.content}
                                    </p>
                                  )}
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt=""
                                      className="w-full h-32 object-cover rounded-md mt-1.5"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                            {expanded && (
                              <ChevronDown className="w-4 h-4 text-gray-400 rotate-180 shrink-0" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between bg-gray-50">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 gap-1.5 text-gray-600 hover:text-gray-800"
                onClick={() => {
                  const newSeen = new Set(items.map((n) => n.id))
                  setSeenIds(newSeen)
                  persistSeen(newSeen)
                  toast.success('تم تعليم الكل كمقروء')
                }}
              >
                <Check className="w-3.5 h-3.5" />
                تعليم الكل كمقروء
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-[#610000] hover:text-[#8B0000]"
                onClick={fetchNews}
              >
                <RefreshCw className="w-3.5 h-3.5 ml-1" />
                تحديث
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
