'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Users, AlertCircle, X, Archive, ArchiveRestore } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { ImageUpload } from '@/components/ui/image-upload'

interface Teacher {
  id: string
  name: string
  subject: string
  email: string | null
  imageUrl: string | null
  sortOrder: number
  active: boolean
  archived: boolean
}

interface TeacherForm {
  name: string
  subject: string
  email: string
  imageUrl: string
}

const defaultForm: TeacherForm = { name: '', subject: '', email: '', imageUrl: '' }

export function TeachersManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<TeacherForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { selectedSchoolId } = useAdminStore()

  const fetchTeachers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/teachers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTeachers(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل المعلمين')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  const archivedCount = teachers.filter((t) => t.archived).length

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditId(teacher.id)
    setForm({
      name: teacher.name,
      subject: teacher.subject,
      email: teacher.email || '',
      imageUrl: teacher.imageUrl || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim()) {
      toast.error('يرجى إدخال اسم المعلم والمادة')
      return
    }
    setSaving(true)
    try {
      const body = {
        schoolId: selectedSchoolId,
        name: form.name,
        subject: form.subject,
        email: form.email || null,
        imageUrl: form.imageUrl || null,
      }

      const res = editId
        ? await fetch(`/api/teachers/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث بيانات المعلم' : 'تم إضافة المعلم بنجاح')
        setDialogOpen(false)
        fetchTeachers()
      } else {
        toast.error('فشل في حفظ البيانات')
      }
    } catch {
      toast.error('فشل في حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف المعلم بنجاح')
        fetchTeachers()
      } else {
        toast.error('فشل في حذف المعلم')
      }
    } catch {
      toast.error('فشل في حذف المعلم')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة المعلم')
        fetchTeachers()
      } else {
        toast.error('فشل في أرشفة المعلم')
      }
    } catch {
      toast.error('فشل في أرشفة المعلم')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة المعلم')
        fetchTeachers()
      } else {
        toast.error('فشل في استعادة المعلم')
      }
    } catch {
      toast.error('فشل في استعادة المعلم')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Users className="w-5 h-5 text-[#610000]" />
          إدارة المعلمين
        </h2>
        <div className="flex gap-2">
          <Button
            variant={showArchived ? 'default' : 'outline'}
            size="sm"
            className={`min-h-[44px] ${showArchived ? 'bg-[#610000] hover:bg-[#8B0000] text-white' : ''}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4 ml-1" /> : <Archive className="w-4 h-4 ml-1" />}
            {showArchived ? 'إخفاء المؤرشف' : 'المؤرشف'}
            {archivedCount > 0 && (
              <span className="mr-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{archivedCount}</span>
            )}
          </Button>
          <Button onClick={openAdd} className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]">
            <Plus className="w-4 h-4 ml-1" />
            إضافة معلم
          </Button>
        </div>
      </div>

      {/* Teachers Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">لا يوجد معلمون مسجلون</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((teacher) => (
            <Card
              key={teacher.id}
              className={`hover:shadow-lg transition-shadow ${teacher.archived ? 'opacity-60 grayscale-[30%]' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-[#009688]/20">
                    {teacher.imageUrl ? (
                      <img
                        src={teacher.imageUrl}
                        alt={teacher.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center text-white text-xl font-bold">
                        {teacher.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#1a1a2e] truncate">{teacher.name}</h3>
                      {teacher.archived && (
                        <span className="shrink-0 bg-gray-400 text-white text-xs px-1.5 py-0.5 rounded-full">مؤرشف</span>
                      )}
                    </div>
                    <p className="text-sm text-[#009688] font-medium">{teacher.subject}</p>
                    {teacher.email && (
                      <p className="text-xs text-gray-400 truncate mt-0.5" dir="ltr">{teacher.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 justify-end">
                  <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => openEdit(teacher)}>
                    <Edit className="w-3.5 h-3.5 ml-1" />
                    تعديل
                  </Button>
                  {teacher.archived ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 min-h-[44px]"
                      onClick={() => handleRestore(teacher.id)}
                    >
                      <ArchiveRestore className="w-3.5 h-3.5 ml-1" />
                      استعادة
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 min-h-[44px]"
                      onClick={() => handleArchive(teacher.id)}
                    >
                      <Archive className="w-3.5 h-3.5 ml-1" />
                      أرشفة
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[44px]"
                    onClick={() => { setDeleteTarget(teacher.id); setDeleteDialogOpen(true) }}
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-1" />
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل بيانات المعلم' : 'إضافة معلم جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات المعلم' : 'أدخل بيانات المعلم الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>اسم المعلم</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="اسم المعلم بالكامل"
              />
            </div>
            <div>
              <Label>المادة</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="المادة الدراسية"
              />
            </div>
            <div>
              <Label>البريد الإلكتروني (اختياري)</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="email@example.com"
                dir="ltr"
                type="email"
              />
            </div>
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              folder="teachers"
              label="صورة المعلم"
              placeholder="أدخل رابط الصورة أو ارفع من جهازك"
            />
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة المعلم'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا المعلم؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
