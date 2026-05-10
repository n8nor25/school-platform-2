'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Calendar, AlertCircle, Filter, Archive, ArchiveRestore, Eye, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { FileUpload } from '@/components/ui/file-upload'

interface Schedule {
  id: string
  title: string
  category: string
  grade: string | null
  section: string | null
  teacherName: string | null
  filePath: string
  fileName: string
  type: string
  active: boolean
  archived: boolean
  createdAt: string
}

interface ScheduleForm {
  title: string
  category: string
  grade: string
  section: string
  teacherName: string
  filePath: string
  fileName: string
  type: string
}

const defaultForm: ScheduleForm = {
  title: '',
  category: 'class',
  grade: '',
  section: '',
  teacherName: '',
  filePath: '',
  fileName: '',
  type: 'حالي',
}

const categoryLabels: Record<string, string> = {
  class: 'جدول فصل',
  teacher: 'جدول معلم',
  daily: 'جدول يومي',
}

const categoryColors: Record<string, string> = {
  class: 'bg-blue-100 text-blue-700',
  teacher: 'bg-purple-100 text-purple-700',
  daily: 'bg-green-100 text-green-700',
}

export function SchedulesManagement() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<ScheduleForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { selectedSchoolId } = useAdminStore()

  const fetchSchedules = useCallback(async () => {
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId || '' })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/schedules?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSchedules(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل الجداول')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة الجدول بنجاح')
        fetchSchedules()
      } else {
        toast.error('فشل في أرشفة الجدول')
      }
    } catch {
      toast.error('فشل في أرشفة الجدول')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة الجدول بنجاح')
        fetchSchedules()
      } else {
        toast.error('فشل في استعادة الجدول')
      }
    } catch {
      toast.error('فشل في استعادة الجدول')
    }
  }

  const handleAdd = async () => {
    if (!form.title.trim()) {
      toast.error('يرجى إدخال عنوان الجدول')
      return
    }
    if (!form.filePath.trim()) {
      toast.error('يرجى رفع ملف أو إدخال رابط الملف')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          title: form.title,
          category: form.category,
          grade: form.grade || null,
          section: form.section || null,
          teacherName: form.teacherName || null,
          filePath: form.filePath,
          fileName: form.fileName || form.title,
          type: form.type,
        }),
      })

      if (res.ok) {
        toast.success('تم إضافة الجدول بنجاح')
        setForm(defaultForm)
        fetchSchedules()
      } else {
        toast.error('فشل في إضافة الجدول')
      }
    } catch {
      toast.error('فشل في إضافة الجدول')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الجدول بنجاح')
        fetchSchedules()
      } else {
        toast.error('فشل في حذف الجدول')
      }
    } catch {
      toast.error('فشل في حذف الجدول')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const openFileUrl = (filePath: string) => {
    if (filePath && filePath !== '#') {
      window.open(filePath, '_blank', 'noopener,noreferrer')
    }
  }

  const filteredSchedules = filterCategory === 'all'
    ? schedules
    : schedules.filter((s) => s.category === filterCategory)

  return (
    <div className="space-y-6">
      {/* Add Schedule Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-5 h-5 text-[#610000]" />
            إضافة جدول جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">عنوان الجدول</label>
              <Input
                placeholder="مثال: جدول الصف الأول"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">التصنيف</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">جدول فصل</SelectItem>
                  <SelectItem value="teacher">جدول معلم</SelectItem>
                  <SelectItem value="daily">جدول يومي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">الصف (اختياري)</label>
              <Input
                placeholder="الصف الأول"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">الشعبة (اختياري)</label>
              <Input
                placeholder="أ"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم المعلم (اختياري)</label>
              <Input
                placeholder="اسم المعلم"
                value={form.teacherName}
                onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FileUpload
                value={form.filePath}
                onChange={(url) => setForm({ ...form, filePath: url })}
                fileName={form.fileName}
                onFileNameChange={(name) => setForm({ ...form, fileName: name })}
                folder="schedules"
                label="ملف الجدول"
                placeholder="أدخل رابط الملف أو ارفع من جهازك"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">النوع</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="حالي">حالي</SelectItem>
                  <SelectItem value="أرشيف">أرشيف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleAdd}
            disabled={saving}
            className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
          >
            <Plus className="w-4 h-4 ml-1" />
            {saving ? 'جاري الإضافة...' : 'إضافة الجدول'}
          </Button>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-5 h-5 text-gray-400" />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-11 w-48">
            <SelectValue placeholder="تصفية حسب النوع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="class">جدول فصل</SelectItem>
            <SelectItem value="teacher">جدول معلم</SelectItem>
            <SelectItem value="daily">جدول يومي</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          className="min-h-[44px] gap-1"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? <Eye className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          {showArchived ? 'إخفاء المؤرشف' : 'المؤرشف'}
          {schedules.filter(s => s.archived).length > 0 && (
            <Badge variant="secondary" className="mr-1 px-1.5 py-0 text-xs">
              {schedules.filter(s => s.archived).length}
            </Badge>
          )}
        </Button>
        <span className="text-sm text-gray-400">({filteredSchedules.length} جدول)</span>
      </div>

      {/* Schedules List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">لا توجد جداول</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredSchedules.map((schedule) => (
                <div key={schedule.id} className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${schedule.archived ? 'opacity-50' : ''}`}>
                  <div className="w-10 h-10 rounded-lg bg-[#610000]/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-[#610000]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#1a1a2e] truncate">{schedule.title}</h3>
                      <Badge className={`text-xs shrink-0 ${categoryColors[schedule.category] || ''}`}>
                        {categoryLabels[schedule.category] || schedule.category}
                      </Badge>
                      <Badge variant={schedule.type === 'حالي' ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {schedule.type}
                      </Badge>
                      {schedule.archived && (
                        <Badge className="text-xs shrink-0 bg-amber-100 text-amber-700">مؤرشف</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {schedule.fileName && <span className="truncate max-w-[200px]">{schedule.fileName}</span>}
                      {schedule.grade && <span>الصف: {schedule.grade}</span>}
                      {schedule.section && <span>الشعبة: {schedule.section}</span>}
                      {schedule.teacherName && <span>المعلم: {schedule.teacherName}</span>}
                      <span>{new Date(schedule.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {/* View/Download button */}
                    {schedule.filePath && schedule.filePath !== '#' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[36px] px-2 text-[#610000] hover:text-[#8B0000] hover:bg-[#610000]/5"
                        onClick={() => openFileUrl(schedule.filePath)}
                        title="عرض/تحميل الملف"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    {schedule.archived ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] gap-1 border-green-300 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-400"
                        onClick={() => handleRestore(schedule.id)}
                      >
                        <ArchiveRestore className="w-4 h-4" />
                        استعادة
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2"
                        onClick={() => handleArchive(schedule.id)}
                      >
                        <Archive className="w-4 h-4" />
                        أرشفة
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[44px] shrink-0 px-2"
                      onClick={() => { setDeleteTarget(schedule.id); setDeleteDialogOpen(true) }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا الجدول؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="min-h-[44px]"
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
