'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar, Plus, Edit, Trash2, Search, Eye, Users, MapPin,
  Clock, Sparkles, Loader2, Star, Image as ImageIcon, AlertCircle,
  ChevronRight, ChevronLeft, PartyPopper, Trophy, Bus, Mic,
  Dumbbell, BookOpen, Activity, CheckCircle, CalendarDays,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { resolveSchool, formatDate, formatLongDate, formatCurrency } from '@/lib/expense-utils'

interface EventItem {
  id: string
  schoolId: string
  title: string
  description: string
  type: string
  status: string
  startDate: string
  endDate: string | null
  location: string
  coverImageUrl: string | null
  organizerId: string
  organizerName: string
  targetAudience: string
  targetIds: string | string[] | null
  maxAttendees: number | null
  isPublic: boolean
  program: string | null
  requirements: string | null
  budget: number | null
  aiGenerated: boolean
  viewCount: number
  createdAt: string
  updatedAt: string
  _count?: { registrations?: number; gallery?: number; feedback?: number }
  registrations?: Array<{
    id: string
    registrantName: string
    registrantType: string
    status: string
    attendedAt: string | null
    notes: string | null
    registeredAt: string
  }>
  gallery?: Array<{ id: string; imageUrl: string; caption: string | null }>
  feedback?: Array<{
    id: string
    reviewerName: string
    rating: number
    comment: string | null
    createdAt: string
  }>
}

interface ProgramItem {
  time: string
  title: string
  description: string
}

interface EventForm {
  title: string
  description: string
  type: string
  status: string
  startDate: string
  endDate: string
  location: string
  organizerName: string
  targetAudience: string
  targetIds: string
  maxAttendees: string
  budget: string
  isPublic: boolean
  requirements: string
  coverImageUrl: string
  program: ProgramItem[]
}

const defaultForm: EventForm = {
  title: '',
  description: '',
  type: 'نشاط',
  status: 'مجدولة',
  startDate: '',
  endDate: '',
  location: '',
  organizerName: '',
  targetAudience: 'الكل',
  targetIds: '',
  maxAttendees: '',
  budget: '',
  isPublic: true,
  requirements: '',
  coverImageUrl: '',
  program: [],
}

const EVENT_TYPES = [
  'حفل', 'رحلة', 'مسابقة', 'ندوة', 'اجتماع',
  'رياضي', 'ثقافي', 'ديني', 'نشاط',
]

const EVENT_STATUSES = ['مجدولة', 'جارية', 'منتهية', 'ملغاة']

const TARGET_AUDIENCES = ['الكل', 'صف', 'مرحلة', 'موظفين', 'أولياء أمور', 'معلمين']

const TYPE_COLORS: Record<string, string> = {
  'حفل': 'bg-amber-100 text-amber-700 border-amber-200',
  'رحلة': 'bg-green-100 text-green-700 border-green-200',
  'مسابقة': 'bg-purple-100 text-purple-700 border-purple-200',
  'ندوة': 'bg-blue-100 text-blue-700 border-blue-200',
  'اجتماع': 'bg-gray-100 text-gray-700 border-gray-200',
  'رياضي': 'bg-orange-100 text-orange-700 border-orange-200',
  'ثقافي': 'bg-pink-100 text-pink-700 border-pink-200',
  'ديني': 'bg-teal-100 text-teal-700 border-teal-200',
  'نشاط': 'bg-sky-100 text-sky-700 border-sky-200',
}

const STATUS_COLORS: Record<string, string> = {
  'مجدولة': 'bg-blue-100 text-blue-700 border-blue-200',
  'جارية': 'bg-green-100 text-green-700 border-green-200',
  'منتهية': 'bg-gray-100 text-gray-700 border-gray-200',
  'ملغاة': 'bg-red-100 text-red-700 border-red-200',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'حفل': <PartyPopper className="w-3.5 h-3.5" />,
  'رحلة': <Bus className="w-3.5 h-3.5" />,
  'مسابقة': <Trophy className="w-3.5 h-3.5" />,
  'ندوة': <Mic className="w-3.5 h-3.5" />,
  'اجتماع': <Users className="w-3.5 h-3.5" />,
  'رياضي': <Dumbbell className="w-3.5 h-3.5" />,
  'ثقافي': <BookOpen className="w-3.5 h-3.5" />,
  'ديني': <Activity className="w-3.5 h-3.5" />,
  'نشاط': <CalendarDays className="w-3.5 h-3.5" />,
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const ARABIC_DAYS_SHORT = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function parseTargetIds(raw: string | string[] | null): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string')
    }
    return []
  } catch {
    return []
  }
}

function parseProgram(raw: string | null | undefined): ProgramItem[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          return {
            time: typeof o.time === 'string' ? o.time : '',
            title: typeof o.title === 'string' ? o.title : '',
            description: typeof o.description === 'string' ? o.description : '',
          }
        }
        return { time: '', title: '', description: '' }
      })
    }
    return []
  } catch {
    return []
  }
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: unknown }).error
    if (typeof err === 'string') return err
  }
  return fallback
}

function toDatetimeLocalValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export function EventsManagement() {
  const { adminUser, selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const organizer = {
    id: adminUser?.id || 'admin',
    name: adminUser?.username || 'مدير النظام',
  }

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [activeTab, setActiveTab] = useState('list')

  const [form, setForm] = useState<EventForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [viewTarget, setViewTarget] = useState<EventItem | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // AI generation state
  const [genLoading, setGenLoading] = useState<string | null>(null)
  const [invitationOpen, setInvitationOpen] = useState(false)
  const [invitationText, setInvitationText] = useState('')

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const fetchEvents = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (search.trim()) params.set('search', search.trim())
        if (typeFilter !== 'all') params.set('type', typeFilter)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        const res = await fetch(`/api/events?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data: unknown = await res.json()
            const list = (
              data && typeof data === 'object' && 'events' in data
                ? (data as { events?: unknown }).events
                : data
            )
            setEvents(Array.isArray(list) ? (list as EventItem[]) : [])
          } else {
            toast.error('فشل في تحميل الفعاليات')
            setEvents([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل الفعاليات')
          setEvents([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, search, typeFilter, statusFilter])

  useEffect(() => fetchEvents(), [fetchEvents])

  // ===== Stats =====
  const stats = useMemo(() => {
    const now = new Date()
    return {
      total: events.length,
      upcoming: events.filter((e) => e.status === 'مجدولة' && new Date(e.startDate) > now).length,
      ongoing: events.filter((e) => e.status === 'جارية').length,
      completed: events.filter((e) => e.status === 'منتهية').length,
    }
  }, [events])

  const typeBadge = (t: string) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
        TYPE_COLORS[t] || TYPE_COLORS['نشاط']
      }`}
    >
      {TYPE_ICONS[t] || <Calendar className="w-3.5 h-3.5" />}
      {t}
    </span>
  )

  const statusBadge = (s: string) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        STATUS_COLORS[s] || STATUS_COLORS['مجدولة']
      }`}
    >
      {s}
    </span>
  )

  // ===== AI Generation Handlers =====
  const callGenerate = async (field: 'description' | 'program' | 'invitation' | 'requirements') => {
    if (!form.title.trim()) {
      toast.error('الرجاء إدخال عنوان الفعالية أولًا')
      return
    }
    setGenLoading(field)
    try {
      const res = await fetch('/api/events/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          startDate: form.startDate,
          location: form.location,
          field,
        }),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(extractErrorMessage(data, 'فشل توليد المحتوى'))
        return
      }
      const content =
        data && typeof data === 'object' && 'content' in data
          ? (data as { content?: unknown }).content
          : data
      if (field === 'description' || field === 'requirements') {
        const text = typeof content === 'string' ? content : ''
        setForm((prev) => ({ ...prev, [field]: text }))
        toast.success('تم توليد المحتوى بنجاح')
      } else if (field === 'program') {
        let arr: ProgramItem[] = []
        if (Array.isArray(content)) {
          arr = content.map((item) => {
            if (item && typeof item === 'object') {
              const o = item as Record<string, unknown>
              return {
                time: typeof o.time === 'string' ? o.time : '',
                title: typeof o.title === 'string' ? o.title : '',
                description: typeof o.description === 'string' ? o.description : '',
              }
            }
            return { time: '', title: '', description: '' }
          })
        } else if (typeof content === 'string') {
          arr = parseProgram(content)
        }
        setForm((prev) => ({ ...prev, program: arr }))
        toast.success(`تم توليد البرنامج (${arr.length} بنود)`)
      } else if (field === 'invitation') {
        const text = typeof content === 'string' ? content : ''
        setInvitationText(text)
        setInvitationOpen(true)
        toast.success('تم توليد نص الدعوة')
      }
    } catch {
      toast.error('فشل توليد المحتوى')
    } finally {
      setGenLoading(null)
    }
  }

  const generatePoster = async () => {
    if (!form.title.trim()) {
      toast.error('الرجاء إدخال عنوان الفعالية أولًا')
      return
    }
    setGenLoading('poster')
    try {
      const res = await fetch('/api/events/generate-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          description: form.description,
        }),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(extractErrorMessage(data, 'فشل توليد البوستر'))
        return
      }
      const url =
        data && typeof data === 'object' && 'imageUrl' in data
          ? (data as { imageUrl?: unknown }).imageUrl
          : data && typeof data === 'object' && 'url' in data
            ? (data as { url?: unknown }).url
            : undefined
      if (typeof url === 'string' && url) {
        setForm((prev) => ({ ...prev, coverImageUrl: url }))
        toast.success('تم توليد البوستر بنجاح')
      } else {
        toast.error('استجابة البوستر غير صالحة')
      }
    } catch {
      toast.error('فشل توليد البوستر')
    } finally {
      setGenLoading(null)
    }
  }

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(invitationText)
      toast.success('تم نسخ نص الدعوة')
    } catch {
      toast.error('تعذّر النسخ')
    }
  }

  // ===== Program editing =====
  const addProgramRow = () => {
    setForm((prev) => ({
      ...prev,
      program: [...prev.program, { time: '', title: '', description: '' }],
    }))
  }
  const updateProgramRow = (i: number, patch: Partial<ProgramItem>) => {
    setForm((prev) => ({
      ...prev,
      program: prev.program.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    }))
  }
  const removeProgramRow = (i: number) => {
    setForm((prev) => ({ ...prev, program: prev.program.filter((_, idx) => idx !== i) }))
  }

  // ===== Form open/edit =====
  const openEdit = (e: EventItem) => {
    setEditId(e.id)
    setForm({
      title: e.title,
      description: e.description || '',
      type: e.type || 'نشاط',
      status: e.status || 'مجدولة',
      startDate: toDatetimeLocalValue(e.startDate),
      endDate: toDatetimeLocalValue(e.endDate),
      location: e.location || '',
      organizerName: e.organizerName || '',
      targetAudience: e.targetAudience || 'الكل',
      targetIds: parseTargetIds(e.targetIds).join(', '),
      maxAttendees: e.maxAttendees != null ? String(e.maxAttendees) : '',
      budget: e.budget != null ? String(e.budget) : '',
      isPublic: !!e.isPublic,
      requirements: e.requirements || '',
      coverImageUrl: e.coverImageUrl || '',
      program: parseProgram(e.program),
    })
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const buildBody = () => {
    const targetIdsArray = form.targetIds
      ? form.targetIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const body: Record<string, unknown> = {
      schoolId,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      status: form.status,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : new Date().toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      location: form.location.trim(),
      organizerId: organizer.id,
      organizerName: form.organizerName.trim() || organizer.name,
      targetAudience: form.targetAudience,
      targetIds: JSON.stringify(targetIdsArray),
      maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
      budget: form.budget ? Number(form.budget) : null,
      isPublic: form.isPublic,
      requirements: form.requirements.trim() || null,
      coverImageUrl: form.coverImageUrl.trim() || null,
      program: form.program.length > 0 ? JSON.stringify(form.program) : null,
    }
    return body
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('العنوان مطلوب')
      return
    }
    if (!form.startDate) {
      toast.error('تاريخ البدء مطلوب')
      return
    }
    setSaving(true)
    try {
      const url = editId ? `/api/events/${editId}?schoolId=${schoolId}` : '/api/events'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(editId ? 'تم تحديث الفعالية' : 'تم إنشاء الفعالية بنجاح')
        setDialogOpen(false)
        setEditId(null)
        setForm(defaultForm)
        fetchEvents()
        if (!editId) setActiveTab('list')
      } else {
        toast.error(extractErrorMessage(data, 'فشل في حفظ الفعالية'))
      }
    } catch {
      toast.error('فشل في حفظ الفعالية')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/events/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الفعالية')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchEvents()
      } else {
        const data: unknown = await res.json().catch(() => ({}))
        toast.error(extractErrorMessage(data, 'فشل في حذف الفعالية'))
      }
    } catch {
      toast.error('فشل في حذف الفعالية')
    } finally {
      setDeleting(false)
    }
  }

  // ===== Calendar =====
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const e of events) {
      const d = new Date(e.startDate)
      if (isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const arr = map.get(key) || []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [events])

  const calendarCells = useMemo(() => {
    const year = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startWeekday = firstDay.getDay() // 0=Sun
    const cells: Array<{ day: number | null; key: string }> = []
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, key: `pad-${i}` })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, key: `d-${d}` })
    }
    return cells
  }, [calMonth])

  const prevMonth = () => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCalMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // ===== Render =====
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#610000]" />
          إدارة الفعاليات والأنشطة
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Calendar className="w-4 h-4 ml-1" /> قائمة الفعاليات
          </TabsTrigger>
          <TabsTrigger value="new" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> فعالية جديدة
          </TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-white">
            <Eye className="w-4 h-4 ml-1" /> تفاصيل الفعالية
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-white">
            <CalendarDays className="w-4 h-4 ml-1" /> التقويم
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> إجمالي الفعاليات
                </p>
                <p className="text-xl font-bold text-[#610000] font-mono mt-1">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> القادمة
                </p>
                <p className="text-xl font-bold text-blue-600 font-mono mt-1">{stats.upcoming}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> الجارية
                </p>
                <p className="text-xl font-bold text-green-600 font-mono mt-1">{stats.ongoing}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> المنتهية
                </p>
                <p className="text-xl font-bold text-gray-500 font-mono mt-1">{stats.completed}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث في العنوان أو الموقع..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {EVENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={openCreate}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  <Plus className="w-4 h-4 ml-1" /> فعالية جديدة
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد فعاليات.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>العنوان</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead>تاريخ البدء</TableHead>
                        <TableHead>الموقع</TableHead>
                        <TableHead className="text-center">التسجيلات</TableHead>
                        <TableHead>المنظم</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((e) => (
                        <TableRow
                          key={e.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setViewTarget(e)
                            setViewOpen(true)
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {e.coverImageUrl ? (
                                <img
                                  src={e.coverImageUrl}
                                  alt={e.title}
                                  className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <span className="font-medium text-gray-800">{e.title}</span>
                            </div>
                          </TableCell>
                          <TableCell>{typeBadge(e.type)}</TableCell>
                          <TableCell className="text-center">{statusBadge(e.status)}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-gray-600">
                              {formatDate(e.startDate)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              {e.location || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 font-mono text-sm text-gray-700">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              {e._count?.registrations ?? e.registrations?.length ?? 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {e.organizerName || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div
                              className="flex items-center justify-center gap-1"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(e)}
                                className="h-9 w-9 text-[#610000] hover:bg-[#610000]/10"
                                title="تعديل"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(e)
                                  setDeleteOpen(true)
                                }}
                                className="h-9 w-9 text-red-600 hover:bg-red-50"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* New / Compose Tab */}
        <TabsContent value="new">
          <EventFormView
            form={form}
            setForm={setForm}
            genLoading={genLoading}
            callGenerate={callGenerate}
            generatePoster={generatePoster}
            addProgramRow={addProgramRow}
            updateProgramRow={updateProgramRow}
            removeProgramRow={removeProgramRow}
            organizerName={organizer.name}
            onSave={handleSave}
            saving={saving}
            onCancel={() => {
              setForm(defaultForm)
              setActiveTab('list')
            }}
            editMode={false}
          />
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#610000]" />
                تفاصيل الفعالية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  اختر فعالية من قائمة الفعاليات لعرض التفاصيل.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-2">اختر فعالية:</p>
                  <Select
                    value={viewTarget?.id || ''}
                    onValueChange={(v) => {
                      const e = events.find((x) => x.id === v)
                      if (e) {
                        setViewTarget(e)
                        setViewOpen(true)
                      }
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر فعالية لعرض التفاصيل" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title} — {formatDate(e.startDate)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#610000]" />
                  {ARABIC_MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={prevMonth} title="الشهر السابق">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextMonth} title="الشهر التالي">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {ARABIC_DAYS_SHORT.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-gray-500 py-2"
                  >
                    {d}
                  </div>
                ))}
                {calendarCells.map((cell) => {
                  if (cell.day == null) {
                    return <div key={cell.key} className="min-h-[80px] rounded-md bg-gray-50/50" />
                  }
                  const key = `${calMonth.getFullYear()}-${calMonth.getMonth()}-${cell.day}`
                  const dayEvents = eventsByDay.get(key) || []
                  return (
                    <div
                      key={cell.key}
                      className="min-h-[80px] rounded-md border border-gray-100 p-1 hover:bg-gray-50"
                    >
                      <div className="text-xs text-gray-600 font-mono mb-1">{cell.day}</div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${
                              TYPE_COLORS[e.type] || TYPE_COLORS['نشاط']
                            }`}
                            title={e.title}
                            onClick={() => {
                              setViewTarget(e)
                              setViewOpen(true)
                            }}
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-500 px-1">
                            +{dayEvents.length - 3} أخرى
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Separator className="my-4" />
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => (
                  <div
                    key={t}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                      TYPE_COLORS[t] || TYPE_COLORS['نشاط']
                    }`}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#610000]" />
              {editId ? 'تعديل الفعالية' : 'إنشاء فعالية جديدة'}
            </DialogTitle>
          </DialogHeader>
          <EventFormView
            form={form}
            setForm={setForm}
            genLoading={genLoading}
            callGenerate={callGenerate}
            generatePoster={generatePoster}
            addProgramRow={addProgramRow}
            updateProgramRow={updateProgramRow}
            removeProgramRow={removeProgramRow}
            organizerName={organizer.name}
            onSave={handleSave}
            saving={saving}
            onCancel={() => {
              setDialogOpen(false)
              setEditId(null)
              setForm(defaultForm)
            }}
            editMode={!!editId}
          />
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#610000]" />
              {viewTarget?.title}
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              {viewTarget.coverImageUrl && (
                <img
                  src={viewTarget.coverImageUrl}
                  alt={viewTarget.title}
                  className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {typeBadge(viewTarget.type)}
                {statusBadge(viewTarget.status)}
                {viewTarget.aiGenerated && (
                  <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50">
                    <Sparkles className="w-3 h-3 ml-1" /> محتوى AI
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> تاريخ البدء
                  </p>
                  <p className="font-medium text-gray-800">{formatLongDate(viewTarget.startDate)}</p>
                </div>
                {viewTarget.endDate && (
                  <div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> تاريخ الانتهاء
                    </p>
                    <p className="font-medium text-gray-800">{formatLongDate(viewTarget.endDate)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> الموقع
                  </p>
                  <p className="font-medium text-gray-800">{viewTarget.location || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Users className="w-3 h-3" /> المنظم
                  </p>
                  <p className="font-medium text-gray-800">{viewTarget.organizerName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">الجمهور المستهدف</p>
                  <p className="font-medium text-gray-800">{viewTarget.targetAudience}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">عدد التسجيلات</p>
                  <p className="font-medium text-gray-800 font-mono">
                    {viewTarget._count?.registrations ?? viewTarget.registrations?.length ?? 0}
                    {viewTarget.maxAttendees ? ` / ${viewTarget.maxAttendees}` : ''}
                  </p>
                </div>
                {viewTarget.budget != null && (
                  <div>
                    <p className="text-xs text-gray-400">الميزانية</p>
                    <p className="font-medium text-gray-800 font-mono">
                      {formatCurrency(viewTarget.budget)}
                    </p>
                  </div>
                )}
              </div>

              {viewTarget.description && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">الوصف</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {viewTarget.description}
                  </div>
                </div>
              )}

              {viewTarget.requirements && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">المتطلبات</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                    {viewTarget.requirements}
                  </div>
                </div>
              )}

              {parseProgram(viewTarget.program).length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">البرنامج</p>
                  <div className="space-y-2">
                    {parseProgram(viewTarget.program).map((p, i) => (
                      <div key={i} className="flex gap-3 items-start border border-gray-200 rounded-lg p-2">
                        <div className="text-xs font-mono text-[#610000] bg-[#610000]/10 px-2 py-1 rounded shrink-0">
                          {p.time || '—'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{p.title}</p>
                          {p.description && (
                            <p className="text-xs text-gray-600 mt-0.5">{p.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewTarget.gallery && viewTarget.gallery.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">المعرض</p>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {viewTarget.gallery.map((g) => (
                      <img
                        key={g.id}
                        src={g.imageUrl}
                        alt={g.caption || ''}
                        className="w-full h-24 object-cover rounded-md border border-gray-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              {viewTarget.feedback && viewTarget.feedback.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">التقييمات</p>
                  <div className="space-y-2">
                    {viewTarget.feedback.map((f) => (
                      <div key={f.id} className="border border-gray-200 rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{f.reviewerName || 'مجهول'}</p>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < f.rating ? 'text-amber-400 fill-current' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {f.comment && (
                          <p className="text-xs text-gray-600 mt-1">{f.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)} className="min-h-[44px]">
              إغلاق
            </Button>
            {viewTarget && (
              <Button
                onClick={() => {
                  setViewOpen(false)
                  openEdit(viewTarget)
                  setActiveTab('list')
                }}
                className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
              >
                <Edit className="w-4 h-4 ml-1" /> تعديل
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation Dialog */}
      <Dialog open={invitationOpen} onOpenChange={setInvitationOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              نص الدعوة المُوَلَّد
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={invitationText}
            onChange={(e) => setInvitationText(e.target.value)}
            rows={10}
            className="text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={copyInvitation} className="min-h-[44px]">
              نسخ النص
            </Button>
            <Button
              onClick={() => setInvitationOpen(false)}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الفعالية «{deleteTarget?.title}»؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white min-h-[44px]"
            >
              {deleting && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===== Sub-component: Event Form =====
interface EventFormViewProps {
  form: EventForm
  setForm: React.Dispatch<React.SetStateAction<EventForm>>
  genLoading: string | null
  callGenerate: (field: 'description' | 'program' | 'invitation' | 'requirements') => void
  generatePoster: () => void
  addProgramRow: () => void
  updateProgramRow: (i: number, patch: Partial<ProgramItem>) => void
  removeProgramRow: (i: number) => void
  organizerName: string
  onSave: () => void
  saving: boolean
  onCancel: () => void
  editMode: boolean
}

function EventFormView({
  form, setForm, genLoading, callGenerate, generatePoster,
  addProgramRow, updateProgramRow, removeProgramRow,
  organizerName, onSave, saving, onCancel, editMode,
}: EventFormViewProps) {
  return (
    <div className="space-y-4">
      {/* Title + AI */}
      <div className="space-y-1.5">
        <Label>
          عنوان الفعالية <span className="text-red-500">*</span>
        </Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="عنوان الفعالية"
          className="h-11"
        />
      </div>

      {/* Type + Status + Audience */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>النوع</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الحالة</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الجمهور المستهدف</Label>
          <Select
            value={form.targetAudience}
            onValueChange={(v) => setForm({ ...form, targetAudience: v })}
          >
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARGET_AUDIENCES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>
            تاريخ ووقت البدء <span className="text-red-500">*</span>
          </Label>
          <Input
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="h-11"
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ ووقت الانتهاء</Label>
          <Input
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="h-11"
            dir="ltr"
          />
        </div>
      </div>

      {/* Location + Organizer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>الموقع</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="قاعة المدرسة / الموقع الخارجي"
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>اسم المنظم</Label>
          <Input
            value={form.organizerName}
            onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
            placeholder={organizerName}
            className="h-11"
          />
        </div>
      </div>

      {form.targetAudience !== 'الكل' && (
        <div className="space-y-1.5">
          <Label>المعرفات المستهدفة (مفصولة بفواصل)</Label>
          <Input
            value={form.targetIds}
            onChange={(e) => setForm({ ...form, targetIds: e.target.value })}
            placeholder="class-1, class-2"
            className="h-11"
            dir="ltr"
          />
          <p className="text-xs text-gray-400">
            أدخل معرفات «{form.targetAudience}» مفصولة بفواصل.
          </p>
        </div>
      )}

      {/* Numeric + Switch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>الحد الأقصى للحضور</Label>
          <Input
            type="number"
            value={form.maxAttendees}
            onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
            placeholder="غير محدد"
            className="h-11"
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label>الميزانية (ج.م)</Label>
          <Input
            type="number"
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            placeholder="0"
            className="h-11"
            dir="ltr"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 h-11 mt-5">
          <p className="text-sm font-medium text-gray-800">فعالية عامة</p>
          <Switch
            checked={form.isPublic}
            onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
          />
        </div>
      </div>

      {/* Description + AI */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>الوصف</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => callGenerate('description')}
            disabled={genLoading === 'description'}
            className="text-purple-700 border-purple-200 hover:bg-purple-50 h-8"
          >
            {genLoading === 'description' ? (
              <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 ml-1" />
            )}
            توليد الوصف
          </Button>
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="وصف الفعالية..."
          rows={4}
        />
      </div>

      {/* Requirements + AI */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>المتطلبات</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => callGenerate('requirements')}
            disabled={genLoading === 'requirements'}
            className="text-purple-700 border-purple-200 hover:bg-purple-50 h-8"
          >
            {genLoading === 'requirements' ? (
              <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 ml-1" />
            )}
            توليد المتطلبات
          </Button>
        </div>
        <Textarea
          value={form.requirements}
          onChange={(e) => setForm({ ...form, requirements: e.target.value })}
          placeholder="متطلبات الفعالية (معدات، تجهيزات...)"
          rows={3}
        />
      </div>

      {/* Program + AI */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>البرنامج الزمني</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => callGenerate('program')}
              disabled={genLoading === 'program'}
              className="text-purple-700 border-purple-200 hover:bg-purple-50 h-8"
            >
              {genLoading === 'program' ? (
                <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 ml-1" />
              )}
              توليد البرنامج
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addProgramRow}
              className="h-8"
            >
              <Plus className="w-3.5 h-3.5 ml-1" />
              صف
            </Button>
          </div>
        </div>
        {form.program.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            لا توجد بنود في البرنامج. استخدم زر «توليد البرنامج» أو أضف صفًا يدويًا.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[120px]">الوقت</TableHead>
                  <TableHead className="w-[180px]">العنوان</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead className="w-[60px] text-center">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.program.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={row.time}
                        onChange={(e) => updateProgramRow(i, { time: e.target.value })}
                        placeholder="09:00"
                        className="h-9"
                        dir="ltr"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.title}
                        onChange={(e) => updateProgramRow(i, { title: e.target.value })}
                        placeholder="عنوان البند"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.description}
                        onChange={(e) => updateProgramRow(i, { description: e.target.value })}
                        placeholder="وصف مختصر"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeProgramRow(i)}
                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Invitation AI Button */}
      <div className="space-y-1.5">
        <Label>نص الدعوة</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => callGenerate('invitation')}
          disabled={genLoading === 'invitation'}
          className="text-purple-700 border-purple-200 hover:bg-purple-50 h-9"
        >
          {genLoading === 'invitation' ? (
            <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 ml-1" />
          )}
          توليد نص الدعوة
        </Button>
        <p className="text-xs text-gray-400">
          يفتح نافذة منبثقة بنص الدعوة الجاهز مع إمكانية النسخ.
        </p>
      </div>

      {/* Cover Image + Poster AI */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>رابط البوستر / صورة الغلاف</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={generatePoster}
            disabled={genLoading === 'poster'}
            className="text-purple-700 border-purple-200 hover:bg-purple-50 h-8"
          >
            {genLoading === 'poster' ? (
              <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 ml-1" />
            )}
            توليد البوستر
          </Button>
        </div>
        <Input
          value={form.coverImageUrl}
          onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
          placeholder="https://example.com/poster.png"
          className="h-11"
          dir="ltr"
        />
        {genLoading === 'poster' && (
          <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-md p-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            جاري توليد البوستر... قد يستغرق 20-30 ثانية.
          </div>
        )}
        {form.coverImageUrl && (
          <img
            src={form.coverImageUrl}
            alt="معاينة البوستر"
            className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
          />
        )}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
        <p className="text-gray-500 mb-1">سيتم الحفظ باسم المنظم:</p>
        <p className="font-medium text-gray-800">{form.organizerName || organizerName}</p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="min-h-[44px]">
          إلغاء
        </Button>
        <Button
          onClick={onSave}
          disabled={saving}
          className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4 ml-1" />
          )}
          {editMode ? 'حفظ التعديلات' : 'إنشاء الفعالية'}
        </Button>
      </div>
    </div>
  )
}
