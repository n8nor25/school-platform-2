'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Megaphone, Pin, Eye, Edit, Trash2, Plus, Search, Loader2,
  AlertCircle, Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { resolveSchool, formatDate, formatLongDate } from '@/lib/expense-utils'

interface Announcement {
  id: string
  title: string
  content: string
  targetType: string
  targetIds: string | string[] | null
  authorId: string
  authorName: string
  imageUrl: string | null
  isPinned: boolean
  isPublished: boolean
  publishedAt: string | null
  expiresAt: string | null
  viewCount: number
  createdAt: string
}

interface AnnouncementForm {
  title: string
  content: string
  targetType: string
  targetIds: string
  imageUrl: string
  isPinned: boolean
  isPublished: boolean
  expiresAt: string
}

const defaultForm: AnnouncementForm = {
  title: '',
  content: '',
  targetType: 'الكل',
  targetIds: '',
  imageUrl: '',
  isPinned: false,
  isPublished: true,
  expiresAt: '',
}

const TARGET_TYPES = ['الكل', 'صف', 'مرحلة', 'موظفين', 'أولياء أمور', 'معلمين']

const TARGET_TYPE_COLORS: Record<string, string> = {
  'الكل': 'bg-gray-100 text-gray-700 border-gray-200',
  'صف': 'bg-sky-100 text-sky-700 border-sky-200',
  'مرحلة': 'bg-purple-100 text-purple-700 border-purple-200',
  'موظفين': 'bg-amber-100 text-amber-700 border-amber-200',
  'أولياء أمور': 'bg-green-100 text-green-700 border-green-200',
  'معلمين': 'bg-[#610000]/10 text-[#610000] border-[#610000]/20',
}

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

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: unknown }).error
    if (typeof err === 'string') return err
  }
  return fallback
}

export function AnnouncementsManagement() {
  const { adminUser, selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const author = {
    id: adminUser?.id || 'admin',
    name: adminUser?.username || 'مدير النظام',
  }

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [targetTypeFilter, setTargetTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [activeTab, setActiveTab] = useState('list')

  const [form, setForm] = useState<AnnouncementForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [viewTarget, setViewTarget] = useState<Announcement | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchAnnouncements = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (search.trim()) params.set('search', search.trim())
        if (targetTypeFilter !== 'all') params.set('targetType', targetTypeFilter)
        if (statusFilter === 'published') params.set('isPublished', 'true')
        if (statusFilter === 'draft') params.set('isPublished', 'false')
        const res = await fetch(`/api/announcements?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data: unknown = await res.json()
            const list = (
              data && typeof data === 'object' && 'announcements' in data
                ? (data as { announcements?: unknown }).announcements
                : data
            )
            setAnnouncements(
              Array.isArray(list) ? (list as Announcement[]) : []
            )
          } else {
            toast.error('فشل في تحميل الإعلانات')
            setAnnouncements([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل الإعلانات')
          setAnnouncements([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, search, targetTypeFilter, statusFilter])

  useEffect(() => fetchAnnouncements(), [fetchAnnouncements])

  const openEdit = (a: Announcement) => {
    setEditId(a.id)
    setForm({
      title: a.title,
      content: a.content,
      targetType: a.targetType || 'الكل',
      targetIds: parseTargetIds(a.targetIds).join(', '),
      imageUrl: a.imageUrl || '',
      isPinned: a.isPinned,
      isPublished: a.isPublished,
      expiresAt: a.expiresAt ? a.expiresAt.split('T')[0] : '',
    })
    setDialogOpen(true)
  }

  const buildBody = () => {
    const targetIdsArray = form.targetIds
      ? form.targetIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    return {
      schoolId,
      title: form.title.trim(),
      content: form.content.trim(),
      targetType: form.targetType,
      targetIds: targetIdsArray,
      authorId: author.id,
      authorName: author.name,
      imageUrl: form.imageUrl.trim() || null,
      isPinned: form.isPinned,
      isPublished: form.isPublished,
      expiresAt: form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : null,
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('العنوان مطلوب')
      return
    }
    if (!form.content.trim()) {
      toast.error('المحتوى مطلوب')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('تم إنشاء الإعلان بنجاح')
        setForm(defaultForm)
        fetchAnnouncements()
        setActiveTab('list')
      } else {
        toast.error(extractErrorMessage(data, 'فشل في حفظ الإعلان'))
      }
    } catch {
      toast.error('فشل في حفظ الإعلان')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editId) return
    if (!form.title.trim()) {
      toast.error('العنوان مطلوب')
      return
    }
    if (!form.content.trim()) {
      toast.error('المحتوى مطلوب')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(
        `/api/announcements/${editId}?schoolId=${schoolId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody()),
        }
      )
      const data: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('تم تحديث الإعلان')
        setDialogOpen(false)
        setEditId(null)
        fetchAnnouncements()
      } else {
        toast.error(extractErrorMessage(data, 'فشل في تحديث الإعلان'))
      }
    } catch {
      toast.error('فشل في تحديث الإعلان')
    } finally {
      setSaving(false)
    }
  }

  const togglePin = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !a.isPinned, schoolId }),
      })
      if (res.ok) {
        toast.success(!a.isPinned ? 'تم تثبيت الإعلان' : 'تم إلغاء التثبيت')
        fetchAnnouncements()
      } else {
        toast.error('فشل في تحديث الإعلان')
      }
    } catch {
      toast.error('فشل في تحديث الإعلان')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/announcements/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الإعلان')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchAnnouncements()
      } else {
        const data: unknown = await res.json().catch(() => ({}))
        toast.error(extractErrorMessage(data, 'فشل في حذف الإعلان'))
      }
    } catch {
      toast.error('فشل في حذف الإعلان')
    } finally {
      setDeleting(false)
    }
  }

  // Stats computed client-side from loaded list
  const stats = useMemo(
    () => ({
      total: announcements.length,
      published: announcements.filter((a) => a.isPublished).length,
      pinned: announcements.filter((a) => a.isPinned).length,
      drafts: announcements.filter((a) => !a.isPublished).length,
      totalViews: announcements.reduce((s, a) => s + (a.viewCount || 0), 0),
      byTargetType: TARGET_TYPES.map((t) => ({
        type: t,
        count: announcements.filter((a) => a.targetType === t).length,
      })).filter((x) => x.count > 0),
    }),
    [announcements]
  )

  const targetTypeBadge = (t: string) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
        TARGET_TYPE_COLORS[t] || TARGET_TYPE_COLORS['الكل']
      }`}
    >
      {t}
    </span>
  )

  const truncate = (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + '…' : s

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#610000]" />
          إدارة الإعلانات
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Megaphone className="w-4 h-4 ml-1" /> الإعلانات
          </TabsTrigger>
          <TabsTrigger value="new" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إعلان جديد
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white">
            <Eye className="w-4 h-4 ml-1" /> الإحصائيات
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Megaphone className="w-3 h-3" /> إجمالي الإعلانات
                </p>
                <p className="text-xl font-bold text-[#610000] font-mono mt-1">
                  {stats.total}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> المنشورة
                </p>
                <p className="text-xl font-bold text-green-600 font-mono mt-1">
                  {stats.published}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Pin className="w-3 h-3" /> المثبتة
                </p>
                <p className="text-xl font-bold text-amber-600 font-mono mt-1">
                  {stats.pinned}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Edit className="w-3 h-3" /> المسودات
                </p>
                <p className="text-xl font-bold text-gray-500 font-mono mt-1">
                  {stats.drafts}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث في العنوان أو المحتوى..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <Select
                  value={targetTypeFilter}
                  onValueChange={setTargetTypeFilter}
                >
                  <SelectTrigger className="w-[180px] h-11">
                    <SelectValue placeholder="الجمهور المستهدف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الجماهير</SelectItem>
                    {TARGET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="published">منشور</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    setForm(defaultForm)
                    setActiveTab('new')
                  }}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إعلان جديد
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد إعلانات.</p>
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
                        <TableHead>الجمهور المستهدف</TableHead>
                        <TableHead>المنشئ</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">المشاهدات</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {announcements.map((a) => (
                        <TableRow
                          key={a.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setViewTarget(a)
                            setViewOpen(true)
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {a.isPinned && (
                                <Pin className="w-4 h-4 text-amber-500 fill-current shrink-0" />
                              )}
                              <span className="font-medium text-gray-800">
                                {a.title}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{targetTypeBadge(a.targetType)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {a.authorName || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {a.isPublished ? (
                              <Badge
                                variant="outline"
                                className="text-green-700 border-green-200 bg-green-50"
                              >
                                منشور
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-gray-600 border-gray-200 bg-gray-50"
                              >
                                مسودة
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 font-mono text-sm text-gray-700">
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                              {a.viewCount || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-gray-600">
                              {formatDate(a.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div
                              className="flex items-center justify-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(a)}
                                className="h-9 w-9 text-[#610000] hover:bg-[#610000]/10"
                                title="تعديل"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => togglePin(a)}
                                className={`h-9 w-9 ${
                                  a.isPinned
                                    ? 'text-amber-500 hover:bg-amber-50'
                                    : 'text-gray-400 hover:bg-gray-100'
                                }`}
                                title={a.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                              >
                                <Pin
                                  className={`w-4 h-4 ${
                                    a.isPinned ? 'fill-current' : ''
                                  }`}
                                />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(a)
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

        {/* New Announcement Tab */}
        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#610000]" />
                إعلان جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  العنوان <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="عنوان الإعلان"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  المحتوى <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm({ ...form, content: e.target.value })
                  }
                  placeholder="محتوى الإعلان"
                  rows={6}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>الجمهور المستهدف</Label>
                  <Select
                    value={form.targetType}
                    onValueChange={(v) =>
                      setForm({ ...form, targetType: v })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ الانتهاء</Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) =>
                      setForm({ ...form, expiresAt: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>
              {form.targetType !== 'الكل' && (
                <div className="space-y-1.5">
                  <Label>المعرفات المستهدفة (مفصولة بفواصل)</Label>
                  <Input
                    value={form.targetIds}
                    onChange={(e) =>
                      setForm({ ...form, targetIds: e.target.value })
                    }
                    placeholder="مثال: class-1, class-2, stage-1"
                    className="h-11"
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-400">
                    أدخل المعرفات الخاصة بـ«{form.targetType}» مفصولة بفواصل.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>رابط الصورة</Label>
                <Input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      تثبيت الإعلان
                    </p>
                    <p className="text-xs text-gray-500">يظهر في أعلى القائمة</p>
                  </div>
                  <Switch
                    checked={form.isPinned}
                    onCheckedChange={(v) =>
                      setForm({ ...form, isPinned: v })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      النشر فورًا
                    </p>
                    <p className="text-xs text-gray-500">
                      إذا لم يفعّل، يُحفظ كمسودة
                    </p>
                  </div>
                  <Switch
                    checked={form.isPublished}
                    onCheckedChange={(v) =>
                      setForm({ ...form, isPublished: v })
                    }
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                <p className="text-gray-500 mb-1">سيتم النشر باسم:</p>
                <p className="font-medium text-gray-800">{author.name}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm(defaultForm)
                    setActiveTab('list')
                  }}
                  className="min-h-[44px]"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={saving}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <Megaphone className="w-4 h-4 ml-1" />
                  )}
                  نشر الإعلان
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Megaphone className="w-3 h-3" /> إجمالي الإعلانات
                </p>
                <p className="text-xl font-bold text-[#610000] font-mono mt-1">
                  {stats.total}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> المنشورة
                </p>
                <p className="text-xl font-bold text-green-600 font-mono mt-1">
                  {stats.published}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Pin className="w-3 h-3" /> المثبتة
                </p>
                <p className="text-xl font-bold text-amber-600 font-mono mt-1">
                  {stats.pinned}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> إجمالي المشاهدات
                </p>
                <p className="text-xl font-bold text-sky-600 font-mono mt-1">
                  {stats.totalViews}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#610000]" />
                توزيع الإعلانات حسب الجمهور المستهدف
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.byTargetType.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  لا توجد بيانات لعرضها.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stats.byTargetType.map(({ type, count }) => (
                    <div
                      key={type}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        TARGET_TYPE_COLORS[type] || TARGET_TYPE_COLORS['الكل']
                      }`}
                    >
                      <span className="text-sm font-medium">{type}</span>
                      <span className="text-sm font-bold font-mono">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الإعلان</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                العنوان <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                المحتوى <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>الجمهور المستهدف</Label>
                <Select
                  value={form.targetType}
                  onValueChange={(v) => setForm({ ...form, targetType: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الانتهاء</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm({ ...form, expiresAt: e.target.value })
                  }
                  className="h-11"
                />
              </div>
            </div>
            {form.targetType !== 'الكل' && (
              <div className="space-y-1.5">
                <Label>المعرفات المستهدفة (مفصولة بفواصل)</Label>
                <Input
                  value={form.targetIds}
                  onChange={(e) =>
                    setForm({ ...form, targetIds: e.target.value })
                  }
                  className="h-11"
                  dir="ltr"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>رابط الصورة</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="h-11"
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-800">
                  تثبيت الإعلان
                </p>
                <Switch
                  checked={form.isPinned}
                  onCheckedChange={(v) => setForm({ ...form, isPinned: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-800">منشور</p>
                <Switch
                  checked={form.isPublished}
                  onCheckedChange={(v) =>
                    setForm({ ...form, isPublished: v })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewTarget?.isPinned && (
                <Pin className="w-4 h-4 text-amber-500 fill-current" />
              )}
              <Megaphone className="w-4 h-4 text-[#610000]" />
              {viewTarget?.title}
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">المنشئ</p>
                  <p className="font-medium text-gray-800">
                    {viewTarget.authorName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">الجمهور المستهدف</p>
                  <div className="mt-0.5">
                    {targetTypeBadge(viewTarget.targetType)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">التاريخ</p>
                  <p className="font-medium text-gray-800">
                    {formatLongDate(viewTarget.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">المشاهدات</p>
                  <p className="font-medium text-gray-800 font-mono">
                    {viewTarget.viewCount || 0}
                  </p>
                </div>
                {viewTarget.expiresAt && (
                  <div>
                    <p className="text-xs text-gray-400">ينتهي في</p>
                    <p className="font-medium text-gray-800">
                      {formatLongDate(viewTarget.expiresAt)}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">المحتوى</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {viewTarget.content}
                </div>
              </div>
              {viewTarget.imageUrl && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">الصورة</p>
                  <img
                    src={viewTarget.imageUrl}
                    alt={viewTarget.title}
                    className="max-h-64 w-auto rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewOpen(false)}
              className="min-h-[44px]"
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
              هل أنت متأكد من حذف الإعلان «{deleteTarget?.title}»؟
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
