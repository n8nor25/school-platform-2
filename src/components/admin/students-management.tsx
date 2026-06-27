'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Users, AlertCircle, X, Archive, ArchiveRestore,
  Search, Filter, Download, UserPlus, Phone, MapPin, Calendar,
  GraduationCap, ChevronDown, Eye
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

// ===== Types =====
interface Classroom {
  id: string
  name: string
  gradeLevel: string
  section: string
  capacity: number
  _count?: { students: number }
}

interface AcademicYear {
  id: string
  name: string
  isActive: boolean
}

interface Student {
  id: string
  studentNumber: string
  name: string
  nationalId: string | null
  dateOfBirth: string | null
  gender: string
  address: string | null
  phone: string | null
  parentName: string | null
  parentPhone: string | null
  parentNationalId: string | null
  enrollDate: string
  status: string
  previousSchool: string | null
  notes: string | null
  archived: boolean
  classroomId: string | null
  classroom?: { name: string; gradeLevel: string } | null
}

interface StudentForm {
  studentNumber: string
  name: string
  nationalId: string
  dateOfBirth: string
  gender: string
  address: string
  phone: string
  parentName: string
  parentPhone: string
  parentNationalId: string
  enrollDate: string
  status: string
  previousSchool: string
  notes: string
  classroomId: string
}

const defaultForm: StudentForm = {
  studentNumber: '',
  name: '',
  nationalId: '',
  dateOfBirth: '',
  gender: 'ذكر',
  address: '',
  phone: '',
  parentName: '',
  parentPhone: '',
  parentNationalId: '',
  enrollDate: new Date().toISOString().split('T')[0],
  status: 'نشط',
  previousSchool: '',
  notes: '',
  classroomId: '',
}

const statusColors: Record<string, string> = {
  'نشط': 'bg-green-100 text-green-700',
  'منقول': 'bg-blue-100 text-blue-700',
  'منسحب': 'bg-red-100 text-red-700',
  'متخرج': 'bg-purple-100 text-purple-700',
}

export function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<StudentForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewStudent, setViewStudent] = useState<Student | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClassroom, setFilterClassroom] = useState<string>('all')
  const { selectedSchoolId } = useAdminStore()

  // Fetch academic years
  const fetchAcademicYears = useCallback(async () => {
    try {
      const res = await fetch(`/api/academic-years?schoolId=${selectedSchoolId}`)
      if (res.ok) {
        const data = await res.json()
        setAcademicYears(Array.isArray(data) ? data : [])
        // Auto-select the active academic year
        const active = data.find((y: AcademicYear) => y.isActive)
        if (active) setSelectedAcademicYearId(active.id)
      }
    } catch { /* ignore */ }
  }, [selectedSchoolId])

  // Fetch classrooms
  const fetchClassrooms = useCallback(async () => {
    if (!selectedAcademicYearId) return
    try {
      const res = await fetch(`/api/classrooms?schoolId=${selectedSchoolId}&academicYearId=${selectedAcademicYearId}`)
      if (res.ok) {
        const data = await res.json()
        setClassrooms(Array.isArray(data) ? data : [])
      }
    } catch { /* ignore */ }
  }, [selectedSchoolId, selectedAcademicYearId])

  // Fetch students
  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) params.set('includeArchived', 'true')
      if (searchQuery) params.set('search', searchQuery)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterClassroom !== 'all') params.set('classroomId', filterClassroom)
      const res = await fetch(`/api/students?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStudents(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل بيانات الطلاب')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived, searchQuery, filterStatus, filterClassroom])

  useEffect(() => { fetchAcademicYears() }, [fetchAcademicYears])
  useEffect(() => { fetchClassrooms() }, [fetchClassrooms])
  useEffect(() => { fetchStudents() }, [fetchStudents])

  const archivedCount = students.filter(s => s.archived).length

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditId(student.id)
    setForm({
      studentNumber: student.studentNumber,
      name: student.name,
      nationalId: student.nationalId || '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      gender: student.gender,
      address: student.address || '',
      phone: student.phone || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      parentNationalId: student.parentNationalId || '',
      enrollDate: student.enrollDate ? student.enrollDate.split('T')[0] : '',
      status: student.status,
      previousSchool: student.previousSchool || '',
      notes: student.notes || '',
      classroomId: student.classroomId || '',
    })
    setDialogOpen(true)
  }

  const openView = (student: Student) => {
    setViewStudent(student)
    setViewDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.studentNumber.trim()) {
      toast.error('يرجى إدخال اسم الطالب ورقم القيد')
      return
    }
    setSaving(true)
    try {
      const body = {
        schoolId: selectedSchoolId,
        ...form,
        classroomId: form.classroomId || null,
        nationalId: form.nationalId || null,
        dateOfBirth: form.dateOfBirth || null,
        enrollDate: form.enrollDate || new Date().toISOString().split('T')[0],
        address: form.address || null,
        phone: form.phone || null,
        parentName: form.parentName || null,
        parentPhone: form.parentPhone || null,
        parentNationalId: form.parentNationalId || null,
        previousSchool: form.previousSchool || null,
        notes: form.notes || null,
      }

      const res = editId
        ? await fetch(`/api/students/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث بيانات الطالب' : 'تم إضافة الطالب بنجاح')
        setDialogOpen(false)
        fetchStudents()
      } else {
        const errData = await res.json().catch(() => ({}))
        if (errData.error?.includes('already exists')) {
          toast.error('رقم القيد موجود مسبقاً في هذه المدرسة')
        } else {
          toast.error('فشل في حفظ البيانات')
        }
      }
    } catch {
      toast.error('فشل في حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الطالب بنجاح')
        fetchStudents()
      } else {
        toast.error('فشل في حذف الطالب')
      }
    } catch {
      toast.error('فشل في حذف الطالب')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleArchive = async (id: string, archive: boolean) => {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: archive }),
      })
      if (res.ok) {
        toast.success(archive ? 'تم أرشفة الطالب' : 'تم استعادة الطالب')
        fetchStudents()
      } else {
        toast.error('فشل في العملية')
      }
    } catch {
      toast.error('فشل في العملية')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Users className="w-5 h-5 text-[#610000]" />
          إدارة الطلاب
          <Badge variant="secondary" className="mr-2">{students.length} طالب</Badge>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showArchived ? 'default' : 'outline'}
            size="sm"
            className={`min-h-[44px] ${showArchived ? 'bg-[#610000] hover:bg-[#8B0000] text-white' : ''}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4 ml-1" /> : <Archive className="w-4 h-4 ml-1" />}
            المؤرشف
            {archivedCount > 0 && (
              <span className="mr-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{archivedCount}</span>
            )}
          </Button>
          <Button onClick={openAdd} className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]">
            <UserPlus className="w-4 h-4 ml-1" />
            إضافة طالب
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-10"
              />
            </div>
            {/* Academic Year */}
            <Select value={selectedAcademicYearId} onValueChange={setSelectedAcademicYearId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="السنة الدراسية" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.name} {y.isActive && '⭐'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Classroom Filter */}
            <Select value={filterClassroom} onValueChange={setFilterClassroom}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="الفصل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفصول</SelectItem>
                {classrooms.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="نشط">نشط</SelectItem>
                <SelectItem value="منقول">منقول</SelectItem>
                <SelectItem value="منسحب">منسحب</SelectItem>
                <SelectItem value="متخرج">متخرج</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-lg">لا يوجد طلاب مسجلون</p>
            <p className="text-gray-300 text-sm mt-1">اضغط على &quot;إضافة طالب&quot; لبدء تسجيل الطلاب</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-3 font-semibold text-gray-600">رقم القيد</th>
                    <th className="text-right p-3 font-semibold text-gray-600">الاسم</th>
                    <th className="text-right p-3 font-semibold text-gray-600 hidden md:table-cell">الفصل</th>
                    <th className="text-right p-3 font-semibold text-gray-600 hidden sm:table-cell">الجنس</th>
                    <th className="text-right p-3 font-semibold text-gray-600 hidden lg:table-cell">هاتف ولي الأمر</th>
                    <th className="text-right p-3 font-semibold text-gray-600">الحالة</th>
                    <th className="text-center p-3 font-semibold text-gray-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className={`border-b hover:bg-gray-50 transition-colors ${student.archived ? 'opacity-50' : ''}`}
                    >
                      <td className="p-3 font-mono text-[#610000] font-bold">{student.studentNumber}</td>
                      <td className="p-3">
                        <div>
                          <span className="font-medium text-[#1a1a2e]">{student.name}</span>
                          {student.archived && (
                            <span className="mr-2 text-xs bg-gray-300 text-gray-600 px-1.5 py-0.5 rounded-full">مؤرشف</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {student.classroom ? (
                          <Badge variant="outline" className="text-xs">{student.classroom.name}</Badge>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell">{student.gender}</td>
                      <td className="p-3 hidden lg:table-cell" dir="ltr">{student.parentPhone || '—'}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[student.status] || 'bg-gray-100 text-gray-600'}`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(student)}>
                            <Eye className="w-4 h-4 text-gray-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(student)}>
                            <Edit className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleArchive(student.id, !student.archived)}
                          >
                            {student.archived
                              ? <ArchiveRestore className="w-4 h-4 text-green-500" />
                              : <Archive className="w-4 h-4 text-orange-500" />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setDeleteTarget(student.id); setDeleteDialogOpen(true) }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات الطالب المسجل' : 'أدخل بيانات الطالب الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>رقم القيد *</Label>
                <Input
                  value={form.studentNumber}
                  onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="مثال: 2024001"
                />
              </div>
              <div>
                <Label>اسم الطالب *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="الاسم بالكامل"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>الرقم القومي</Label>
                <Input
                  value={form.nationalId}
                  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="الرقم القومي"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>تاريخ الميلاد</Label>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>الجنس</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ذكر">ذكر</SelectItem>
                    <SelectItem value="أنثى">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>الفصل</Label>
                <Select value={form.classroomId} onValueChange={(v) => setForm({ ...form, classroomId: v })}>
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue placeholder="اختر الفصل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">بدون فصل</SelectItem>
                    {classrooms.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.gradeLevel})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نشط">نشط</SelectItem>
                    <SelectItem value="منقول">منقول</SelectItem>
                    <SelectItem value="منسحب">منسحب</SelectItem>
                    <SelectItem value="متخرج">متخرج</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>العنوان</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="عنوان السكن"
                />
              </div>
              <div>
                <Label>هاتف الطالب</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="رقم الهاتف"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-[#1a1a2e] mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#009688]" />
                بيانات ولي الأمر
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>اسم ولي الأمر</Label>
                  <Input
                    value={form.parentName}
                    onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                    className="h-11 mt-1.5"
                    placeholder="اسم الأب / ولي الأمر"
                  />
                </div>
                <div>
                  <Label>هاتف ولي الأمر</Label>
                  <Input
                    value={form.parentPhone}
                    onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                    className="h-11 mt-1.5"
                    placeholder="رقم الهاتف"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>الرقم القومي لولي الأمر</Label>
                  <Input
                    value={form.parentNationalId}
                    onChange={(e) => setForm({ ...form, parentNationalId: e.target.value })}
                    className="h-11 mt-1.5"
                    placeholder="الرقم القومي"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>المدرسة السابقة</Label>
                  <Input
                    value={form.previousSchool}
                    onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
                    className="h-11 mt-1.5"
                    placeholder="اسم المدرسة السابقة"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5"
                placeholder="أي ملاحظات إضافية..."
                rows={2}
              />
            </div>
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
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة الطالب'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Student Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#610000]" />
              بيانات الطالب
            </DialogTitle>
          </DialogHeader>
          {viewStudent && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {viewStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1a1a2e]">{viewStudent.name}</h3>
                  <p className="text-[#610000] font-mono">رقم القيد: {viewStudent.studentNumber}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[viewStudent.status] || 'bg-gray-100 text-gray-600'}`}>
                    {viewStudent.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">الجنس</span>
                  <span className="font-medium">{viewStudent.gender}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">تاريخ الميلاد</span>
                  <span className="font-medium">{viewStudent.dateOfBirth ? new Date(viewStudent.dateOfBirth).toLocaleDateString('ar-EG') : '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">الرقم القومي</span>
                  <span className="font-medium" dir="ltr">{viewStudent.nationalId || '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">الفصل</span>
                  <span className="font-medium">{viewStudent.classroom?.name || '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">العنوان</span>
                  <span className="font-medium">{viewStudent.address || '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">هاتف الطالب</span>
                  <span className="font-medium" dir="ltr">{viewStudent.phone || '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">ولي الأمر</span>
                  <span className="font-medium">{viewStudent.parentName || '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">هاتف ولي الأمر</span>
                  <span className="font-medium" dir="ltr">{viewStudent.parentPhone || '—'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">تاريخ القيد</span>
                  <span className="font-medium">{new Date(viewStudent.enrollDate).toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-xs mb-1">المدرسة السابقة</span>
                  <span className="font-medium">{viewStudent.previousSchool || '—'}</span>
                </div>
              </div>
              {viewStudent.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <span className="text-amber-600 block text-xs mb-1">ملاحظات</span>
                  <span className="text-amber-800">{viewStudent.notes}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
