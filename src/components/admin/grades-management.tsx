'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, GraduationCap, AlertCircle, X, Archive, ArchiveRestore, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface Grade {
  id: string
  name: string
  subjects: string // JSON string
  archived: boolean
  createdAt: string
}

interface GradeForm {
  name: string
  subjects: string
}

export function GradesManagement() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<GradeForm>({ name: '', subjects: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<GradeForm>({ name: '', subjects: '' })
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { selectedSchoolId } = useAdminStore()

  const fetchGrades = useCallback(async () => {
    if (!selectedSchoolId) return
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/grades?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setGrades(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل الصفوف')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchGrades()
  }, [fetchGrades])

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/grades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة الصف بنجاح')
        fetchGrades()
      } else {
        toast.error('فشل في أرشفة الصف')
      }
    } catch {
      toast.error('فشل في أرشفة الصف')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/grades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة الصف بنجاح')
        fetchGrades()
      } else {
        toast.error('فشل في استعادة الصف')
      }
    } catch {
      toast.error('فشل في استعادة الصف')
    }
  }

  const parseSubjects = (subjectsStr: string): string[] => {
    try {
      const parsed = JSON.parse(subjectsStr)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('يرجى إدخال اسم الصف')
      return
    }
    setSaving(true)
    try {
      const subjectsArray = form.subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, subjects: subjectsArray, schoolId: selectedSchoolId }),
      })

      if (res.ok) {
        toast.success('تم إضافة الصف بنجاح')
        setForm({ name: '', subjects: '' })
        fetchGrades()
      } else {
        toast.error('فشل في إضافة الصف')
      }
    } catch {
      toast.error('فشل في إضافة الصف')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (grade: Grade) => {
    const subjects = parseSubjects(grade.subjects)
    setEditId(grade.id)
    setEditForm({ name: grade.name, subjects: subjects.join('، ') })
    setEditDialogOpen(true)
  }

  const handleUpdate = async () => {
    if (!editId || !editForm.name.trim()) return
    setSaving(true)
    try {
      const subjectsArray = editForm.subjects
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch(`/api/grades/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, subjects: subjectsArray }),
      })

      if (res.ok) {
        toast.success('تم تحديث الصف بنجاح')
        setEditDialogOpen(false)
        fetchGrades()
      } else {
        toast.error('فشل في تحديث الصف')
      }
    } catch {
      toast.error('فشل في تحديث الصف')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/grades/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الصف بنجاح')
        fetchGrades()
      } else {
        toast.error('فشل في حذف الصف')
      }
    } catch {
      toast.error('فشل في حذف الصف')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Grade Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-5 h-5 text-[#610000]" />
            إضافة صف جديد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم الصف</label>
              <Input
                placeholder="مثال: الصف الأول الإعدادي"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">المواد (مفصولة بفواصل)</label>
              <Input
                placeholder="عربي، انجليزي، رياضيات"
                value={form.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                className="h-11"
              />
            </div>
          </div>
          <Button
            onClick={handleAdd}
            disabled={saving}
            className="mt-4 bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
          >
            <Plus className="w-4 h-4 ml-1" />
            إضافة
          </Button>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="w-5 h-5 text-[#610000]" />
              الصفوف الدراسية
            </CardTitle>
            <Button
              variant={showArchived ? "default" : "outline"}
              size="sm"
              className="min-h-[44px] gap-1"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <Eye className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {showArchived ? 'إخفاء المؤرشف' : 'المؤرشف'}
              {grades.filter(g => g.archived).length > 0 && (
                <Badge variant="secondary" className="mr-1 px-1.5 py-0 text-xs">
                  {grades.filter(g => g.archived).length}
                </Badge>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : grades.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">لا توجد صفوف دراسية</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grades.map((grade) => {
                const subjects = parseSubjects(grade.subjects)
                return (
                  <div
                    key={grade.id}
                    className={`flex items-start justify-between gap-3 p-4 rounded-lg border hover:bg-gray-50 transition-colors ${grade.archived ? 'opacity-50' : ''}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-[#1a1a2e]">{grade.name}</h3>
                        {grade.archived && (
                          <Badge className="text-xs bg-amber-100 text-amber-700">مؤرشف</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {subjects.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                        {subjects.length === 0 && (
                          <span className="text-xs text-gray-400">لا توجد مواد</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {grade.archived ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[36px] px-1"
                          onClick={() => handleRestore(grade.id)}
                          title="استعادة"
                        >
                          <ArchiveRestore className="w-4 h-4 text-green-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[36px] px-1"
                          onClick={() => handleArchive(grade.id)}
                          title="أرشفة"
                        >
                          <Archive className="w-4 h-4 text-amber-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => handleEdit(grade)}
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => { setDeleteTarget(grade.id); setDeleteDialogOpen(true) }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الصف</DialogTitle>
            <DialogDescription>تعديل بيانات الصف والمواد الدراسية</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">اسم الصف</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">المواد (مفصولة بفواصل)</label>
              <Textarea
                value={editForm.subjects}
                onChange={(e) => setEditForm({ ...editForm, subjects: e.target.value })}
                className="min-h-[100px]"
                placeholder="عربي، انجليزي، رياضيات"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="min-h-[44px]">
                <X className="w-4 h-4 ml-1" />
                إلغاء
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={saving}
                className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
              >
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا الصف؟ سيتم حذف جميع البيانات المرتبطة به.</DialogDescription>
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
