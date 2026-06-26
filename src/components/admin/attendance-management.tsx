'use client'

import React, { useState, useEffect } from 'react'
import {
  ClipboardCheck, Calendar, Search, Filter, Users, BarChart3,
  CheckCircle, XCircle, Clock, AlertTriangle, Save, ChevronLeft,
  ChevronRight, Eye, Trash2, RefreshCw, FileText
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

// ===== Types =====
interface Classroom {
  id: string
  name: string
  gradeLevel: string
  section: string
  capacity: number
  academicYearId: string
  academicYear?: { name: string }
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
  gender: string
  classroom?: { name: string; gradeLevel: string } | null
  classroomId: string | null
}

interface AttendanceRecord {
  id: string
  studentId: string
  classroomId: string | null
  academicYearId: string | null
  date: string
  status: string
  arrivalTime: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
  student: {
    id: string
    name: string
    studentNumber: string
    classroom: { name: string; gradeLevel: string } | null
  }
  classroom: { name: string; gradeLevel: string } | null
  academicYear: { name: string } | null
}

interface AttendanceStats {
  total: number
  present: number
  absent: number
  late: number
  excused: number
  presentRate: number
  absentRate: number
}

interface StudentAttendanceEntry {
  studentId: string
  status: string
  arrivalTime: string
  notes: string
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'حاضر': { label: 'حاضر', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300', icon: <CheckCircle className="w-4 h-4" /> },
  'غائب': { label: 'غائب', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: <XCircle className="w-4 h-4" /> },
  'متأخر': { label: 'متأخر', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300', icon: <Clock className="w-4 h-4" /> },
  'غائب بعذر': { label: 'غائب بعذر', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', icon: <AlertTriangle className="w-4 h-4" /> },
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function AttendanceManagement() {
  const { selectedSchoolId } = useAdminStore()

  // ===== Common State =====
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('record')

  // ===== Record Attendance State =====
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
  const [selectedClassroom, setSelectedClassroom] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<Student[]>([])
  const [attendanceEntries, setAttendanceEntries] = useState<Record<string, StudentAttendanceEntry>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)

  // ===== History State =====
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([])
  const [historyStats, setHistoryStats] = useState<AttendanceStats | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyClassroom, setHistoryClassroom] = useState<string>('all')
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [historyStatus, setHistoryStatus] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState('')

  // ===== Student History Dialog =====
  const [studentHistoryOpen, setStudentHistoryOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentHistoryRecords, setStudentHistoryRecords] = useState<AttendanceRecord[]>([])
  const [studentHistoryMonth, setStudentHistoryMonth] = useState<number>(new Date().getMonth())
  const [studentHistoryYear, setStudentHistoryYear] = useState<number>(new Date().getFullYear())
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false)

  // ===== Delete Dialog =====
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ===== Data Fetching (non-effect helpers) =====
  const loadStudentsForClass = async (classroomId: string) => {
    if (!selectedSchoolId || !classroomId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/students?schoolId=${selectedSchoolId}&classroomId=${classroomId}&includeArchived=false`)
      if (res.ok) {
        const data: Student[] = await res.json()
        setStudents(data)
        // Check if attendance already exists for this date
        const dateRes = await fetch(`/api/attendance?schoolId=${selectedSchoolId}&classroomId=${classroomId}&date=${selectedDate}`)
        if (dateRes.ok) {
          const existingRecords: AttendanceRecord[] = await dateRes.json()
          const entries: Record<string, StudentAttendanceEntry> = {}
          data.forEach(s => {
            entries[s.id] = { studentId: s.id, status: 'حاضر', arrivalTime: '', notes: '' }
          })
          existingRecords.forEach(r => {
            if (entries[r.studentId]) {
              entries[r.studentId] = {
                studentId: r.studentId,
                status: r.status,
                arrivalTime: r.arrivalTime || '',
                notes: r.notes || '',
              }
            }
          })
          setAttendanceEntries(entries)
        } else {
          const entries: Record<string, StudentAttendanceEntry> = {}
          data.forEach(s => {
            entries[s.id] = { studentId: s.id, status: 'حاضر', arrivalTime: '', notes: '' }
          })
          setAttendanceEntries(entries)
        }
      }
    } catch (err) {
      console.error('Error fetching students:', err)
      toast.error('خطأ في تحميل بيانات الطلاب')
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    if (!selectedSchoolId) return
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId, includeStats: 'true' })
      if (historyDate) params.set('date', historyDate)
      if (historyClassroom && historyClassroom !== 'all') params.set('classroomId', historyClassroom)
      if (historyStatus && historyStatus !== 'all') params.set('status', historyStatus)

      const res = await fetch(`/api/attendance?${params}`)
      if (res.ok) {
        const data = await res.json()
        setHistoryRecords(data.records || [])
        setHistoryStats(data.stats || null)
      }
    } catch (err) {
      console.error('Error fetching history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadStudentHistory = async (studentId: string, month?: number, year?: number) => {
    if (!selectedSchoolId) return
    setStudentHistoryLoading(true)
    try {
      const m = month ?? studentHistoryMonth
      const y = year ?? studentHistoryYear
      const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const endDate = new Date(y, m + 1, 0).toISOString().split('T')[0]

      const params = new URLSearchParams({
        schoolId: selectedSchoolId,
        studentId,
        dateFrom: startDate,
        dateTo: endDate,
      })
      const res = await fetch(`/api/attendance?${params}`)
      if (res.ok) {
        const data = await res.json()
        setStudentHistoryRecords(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching student history:', err)
    } finally {
      setStudentHistoryLoading(false)
    }
  }

  // ===== Effects =====
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/academic-years?schoolId=${selectedSchoolId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setAcademicYears(data)
          const activeYear = data.find((y: AcademicYear) => y.isActive)
          if (activeYear) setSelectedAcademicYear(activeYear.id)
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching academic years:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  useEffect(() => {
    if (!selectedSchoolId || !selectedAcademicYear) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/classrooms?schoolId=${selectedSchoolId}&academicYearId=${selectedAcademicYear}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setClassrooms(data)
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching classrooms:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedAcademicYear])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!selectedClassroom) {
      setStudents([])
      setAttendanceEntries({})
      return
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/students?schoolId=${selectedSchoolId}&classroomId=${selectedClassroom}&includeArchived=false`)
        if (res.ok && !cancelled) {
          const data: Student[] = await res.json()
          setStudents(data)
          // Check if attendance already exists for this date
          const dateRes = await fetch(`/api/attendance?schoolId=${selectedSchoolId}&classroomId=${selectedClassroom}&date=${selectedDate}`)
          if (dateRes.ok && !cancelled) {
            const existingRecords: AttendanceRecord[] = await dateRes.json()
            const entries: Record<string, StudentAttendanceEntry> = {}
            data.forEach(s => {
              entries[s.id] = { studentId: s.id, status: 'حاضر', arrivalTime: '', notes: '' }
            })
            existingRecords.forEach(r => {
              if (entries[r.studentId]) {
                entries[r.studentId] = {
                  studentId: r.studentId,
                  status: r.status,
                  arrivalTime: r.arrivalTime || '',
                  notes: r.notes || '',
                }
              }
            })
            setAttendanceEntries(entries)
          } else if (!cancelled) {
            const entries: Record<string, StudentAttendanceEntry> = {}
            data.forEach(s => {
              entries[s.id] = { studentId: s.id, status: 'حاضر', arrivalTime: '', notes: '' }
            })
            setAttendanceEntries(entries)
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching students:', err)
          toast.error('خطأ في تحميل بيانات الطلاب')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedClassroom, selectedDate, selectedSchoolId])

  useEffect(() => {
    if (activeTab !== 'history' || !selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setHistoryLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId, includeStats: 'true' })
        if (historyDate) params.set('date', historyDate)
        if (historyClassroom && historyClassroom !== 'all') params.set('classroomId', historyClassroom)
        if (historyStatus && historyStatus !== 'all') params.set('status', historyStatus)

        const res = await fetch(`/api/attendance?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setHistoryRecords(data.records || [])
          setHistoryStats(data.stats || null)
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching history:', err)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeTab, selectedSchoolId, historyDate, historyClassroom, historyStatus])

  // Effect: fetch student history when dialog opens or month/year changes
  useEffect(() => {
    if (!studentHistoryOpen || !selectedStudent || !selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setStudentHistoryLoading(true)
      try {
        const startDate = `${studentHistoryYear}-${String(studentHistoryMonth + 1).padStart(2, '0')}-01`
        const endDate = new Date(studentHistoryYear, studentHistoryMonth + 1, 0).toISOString().split('T')[0]
        const params = new URLSearchParams({
          schoolId: selectedSchoolId,
          studentId: selectedStudent.id,
          dateFrom: startDate,
          dateTo: endDate,
        })
        const res = await fetch(`/api/attendance?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setStudentHistoryRecords(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching student history:', err)
      } finally {
        if (!cancelled) setStudentHistoryLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [studentHistoryOpen, selectedStudent, selectedSchoolId, studentHistoryMonth, studentHistoryYear])

  // ===== Handlers =====
  const handleSaveAttendance = async () => {
    if (!selectedSchoolId || !selectedClassroom || students.length === 0) return
    setSavingAttendance(true)
    try {
      const records = Object.values(attendanceEntries).map(entry => ({
        studentId: entry.studentId,
        status: entry.status,
        arrivalTime: entry.arrivalTime || undefined,
        notes: entry.notes || undefined,
        classroomId: selectedClassroom,
      }))

      const res = await fetch('/api/attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          date: selectedDate,
          academicYearId: selectedAcademicYear || undefined,
          records,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'تم حفظ الحضور بنجاح')
      } else {
        toast.error('خطأ في حفظ الحضور')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSavingAttendance(false)
    }
  }

  const handleMarkAll = (status: string) => {
    const updated = { ...attendanceEntries }
    Object.keys(updated).forEach(studentId => {
      updated[studentId] = { ...updated[studentId], status }
    })
    setAttendanceEntries(updated)
  }

  const handleDeleteRecord = async () => {
    if (!deleteTarget || !selectedSchoolId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/attendance/${deleteTarget.id}?schoolId=${selectedSchoolId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('تم حذف سجل الحضور')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        loadHistory()
      } else {
        toast.error('خطأ في حذف السجل')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setDeleting(false)
    }
  }

  const openStudentHistory = (student: Student) => {
    setSelectedStudent(student)
    setStudentHistoryOpen(true)
    setStudentHistoryMonth(new Date().getMonth())
    setStudentHistoryYear(new Date().getFullYear())
  }

  // Compute summary for current recording
  const recordingSummary = React.useMemo(() => {
    const entries = Object.values(attendanceEntries)
    return {
      total: entries.length,
      present: entries.filter(e => e.status === 'حاضر').length,
      absent: entries.filter(e => e.status === 'غائب').length,
      late: entries.filter(e => e.status === 'متأخر').length,
      excused: entries.filter(e => e.status === 'غائب بعذر').length,
    }
  }, [attendanceEntries])

  // Filter history records by search
  const filteredHistoryRecords = React.useMemo(() => {
    if (!historySearch) return historyRecords
    const q = historySearch.toLowerCase()
    return historyRecords.filter(r =>
      r.student.name.toLowerCase().includes(q) ||
      r.student.studentNumber.toLowerCase().includes(q)
    )
  }, [historyRecords, historySearch])

  // Generate calendar days for student history view
  const calendarDays = React.useMemo(() => {
    const year = studentHistoryYear
    const month = studentHistoryMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: { day: number; status: string | null; isCurrentMonth: boolean }[] = []

    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, status: null, isCurrentMonth: false })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const record = studentHistoryRecords.find(r => {
        const rDate = new Date(r.date)
        return rDate.getFullYear() === year && rDate.getMonth() === month && rDate.getDate() === d
      })
      days.push({ day: d, status: record?.status || null, isCurrentMonth: true })
    }

    return days
  }, [studentHistoryYear, studentHistoryMonth, studentHistoryRecords])

  // ===== Render =====
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-[#610000]" />
            إدارة الحضور والغياب
          </h2>
          <p className="text-gray-500 text-sm mt-1">تسجيل ومتابعة حضور وغياب الطلاب</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record" className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            تسجيل الحضور
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            سجل الحضور
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            إحصائيات
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Record Attendance ===== */}
        <TabsContent value="record" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">السنة الدراسية</Label>
                  <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر السنة الدراسية" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map(y => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isActive ? '(نشطة)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">الفصل الدراسي</Label>
                  <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفصل" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.gradeLevel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">التاريخ</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      if (selectedClassroom) loadStudentsForClass(selectedClassroom)
                    }}
                    variant="outline"
                    className="w-full"
                    disabled={!selectedClassroom}
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    تحديث البيانات
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Buttons */}
          {students.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">تحديد سريع:</span>
                    <Button size="sm" variant="outline" onClick={() => handleMarkAll('حاضر')}
                      className="border-green-300 text-green-700 hover:bg-green-50">
                      <CheckCircle className="w-3.5 h-3.5 ml-1" />
                      الكل حاضر
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleMarkAll('غائب')}
                      className="border-red-300 text-red-700 hover:bg-red-50">
                      <XCircle className="w-3.5 h-3.5 ml-1" />
                      الكل غائب
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleMarkAll('متأخر')}
                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">
                      <Clock className="w-3.5 h-3.5 ml-1" />
                      الكل متأخر
                    </Button>
                  </div>
                  {/* Summary */}
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      حاضر: {recordingSummary.present}
                    </Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      غائب: {recordingSummary.absent}
                    </Badge>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      متأخر: {recordingSummary.late}
                    </Badge>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      بعذر: {recordingSummary.excused}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Attendance List */}
          {loading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : students.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  قائمة الطلاب - {classrooms.find(c => c.id === selectedClassroom)?.name || ''}
                  <Badge variant="secondary" className="mr-2">{students.length} طالب</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-right p-3 text-sm font-medium text-gray-600 w-10">#</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">رقم الطالب</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الاسم</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الجنس</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">الحالة</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">وقت الحضور</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                        const entry = attendanceEntries[student.id]
                        if (!entry) return null
                        const config = statusConfig[entry.status]
                        return (
                          <tr key={student.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="p-3 text-sm font-mono">{student.studentNumber}</td>
                            <td className="p-3 text-sm font-medium">{student.name}</td>
                            <td className="p-3 text-sm text-gray-500">{student.gender}</td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                {Object.entries(statusConfig).map(([status, cfg]) => (
                                  <button
                                    key={status}
                                    onClick={() => setAttendanceEntries(prev => ({
                                      ...prev,
                                      [student.id]: { ...prev[student.id], status }
                                    }))}
                                    className={`p-1.5 rounded-md transition-all text-xs flex items-center gap-1 ${
                                      entry.status === status
                                        ? `${cfg.bgColor} ${cfg.color} border font-medium shadow-sm`
                                        : 'text-gray-400 hover:bg-gray-100 border border-transparent'
                                    }`}
                                    title={cfg.label}
                                  >
                                    {cfg.icon}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="p-3">
                              <Input
                                type="time"
                                value={entry.arrivalTime}
                                onChange={e => setAttendanceEntries(prev => ({
                                  ...prev,
                                  [student.id]: { ...prev[student.id], arrivalTime: e.target.value }
                                }))}
                                className="w-28 h-8 text-center text-sm mx-auto"
                                disabled={entry.status === 'غائب'}
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                value={entry.notes}
                                onChange={e => setAttendanceEntries(prev => ({
                                  ...prev,
                                  [student.id]: { ...prev[student.id], notes: e.target.value }
                                }))}
                                placeholder="ملاحظة..."
                                className="h-8 text-sm"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Save Button */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                  <Button
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="bg-[#610000] hover:bg-[#7a0000] min-w-[160px]"
                  >
                    {savingAttendance ? (
                      <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 ml-2" />
                    )}
                    {savingAttendance ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selectedClassroom ? (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>لا يوجد طلاب في هذا الفصل</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>اختر الفصل الدراسي لتسجيل الحضور</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Tab 2: Attendance History ===== */}
        <TabsContent value="history" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">التاريخ</Label>
                  <Input
                    type="date"
                    value={historyDate}
                    onChange={e => setHistoryDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">الفصل</Label>
                  <Select value={historyClassroom} onValueChange={setHistoryClassroom}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفصول</SelectItem>
                      {classrooms.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">الحالة</Label>
                  <Select value={historyStatus} onValueChange={setHistoryStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="حاضر">حاضر</SelectItem>
                      <SelectItem value="غائب">غائب</SelectItem>
                      <SelectItem value="متأخر">متأخر</SelectItem>
                      <SelectItem value="غائب بعذر">غائب بعذر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">بحث</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      placeholder="اسم أو رقم الطالب..."
                      className="pr-9"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={loadHistory} variant="outline" className="w-full">
                    <Search className="w-4 h-4 ml-2" />
                    بحث
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          {historyStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{historyStats.present}</div>
                  <div className="text-xs text-green-600">حاضر ({historyStats.presentRate}%)</div>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{historyStats.absent}</div>
                  <div className="text-xs text-red-600">غائب ({historyStats.absentRate}%)</div>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{historyStats.late}</div>
                  <div className="text-xs text-yellow-600">متأخر</div>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">{historyStats.excused}</div>
                  <div className="text-xs text-orange-600">غائب بعذر</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Records Table */}
          {historyLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : filteredHistoryRecords.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b">
                        <th className="text-right p-3 text-sm font-medium text-gray-600 w-10">#</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">رقم الطالب</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الاسم</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الفصل</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">الحالة</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">وقت الحضور</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">ملاحظات</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryRecords.map((record, index) => {
                        const config = statusConfig[record.status] || statusConfig['حاضر']
                        return (
                          <tr key={record.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="p-3 text-sm font-mono">{record.student.studentNumber}</td>
                            <td className="p-3 text-sm font-medium">{record.student.name}</td>
                            <td className="p-3 text-sm text-gray-500">
                              {record.classroom?.name || record.student.classroom?.name || '-'}
                            </td>
                            <td className="p-3 text-center">
                              <Badge className={`${config.bgColor} ${config.color} border`}>
                                {config.icon}
                                <span className="mr-1">{config.label}</span>
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-center text-gray-500">
                              {record.arrivalTime || '-'}
                            </td>
                            <td className="p-3 text-sm text-gray-500 max-w-[150px] truncate">
                              {record.notes || '-'}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                  onClick={() => {
                                    const student: Student = {
                                      id: record.student.id,
                                      name: record.student.name,
                                      studentNumber: record.student.studentNumber,
                                      gender: '',
                                      classroom: record.student.classroom,
                                      classroomId: record.classroomId,
                                    }
                                    openStudentHistory(student)
                                  }}
                                  title="عرض سجل الطالب"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    setDeleteTarget(record)
                                    setDeleteDialogOpen(true)
                                  }}
                                  title="حذف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>لا توجد سجلات حضور للفلاتر المحددة</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Tab 3: Statistics ===== */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                إحصائيات الحضور والغياب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Period Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">الفصل</Label>
                  <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفصل" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">من تاريخ</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={async () => {
                      if (!selectedSchoolId || !selectedClassroom) return
                      setLoading(true)
                      try {
                        // Get current month range
                        const d = new Date(selectedDate)
                        const startOfMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
                        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]

                        const params = new URLSearchParams({
                          schoolId: selectedSchoolId,
                          classroomId: selectedClassroom,
                          dateFrom: startOfMonth,
                          dateTo: endOfMonth,
                          includeStats: 'true',
                        })
                        const res = await fetch(`/api/attendance?${params}`)
                        if (res.ok) {
                          const data = await res.json()
                          setHistoryRecords(data.records || [])
                          setHistoryStats(data.stats || null)
                        }
                      } catch {
                        toast.error('خطأ في تحميل الإحصائيات')
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className="w-full bg-[#610000] hover:bg-[#7a0000]"
                    disabled={!selectedClassroom}
                  >
                    <BarChart3 className="w-4 h-4 ml-2" />
                    عرض الإحصائيات
                  </Button>
                </div>
              </div>

              {/* Quick Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-green-200">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                    <div className="text-3xl font-bold text-green-700">
                      {historyStats?.present || 0}
                    </div>
                    <div className="text-sm text-green-600 mt-1">إجمالي الحضور</div>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent className="p-6 text-center">
                    <XCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
                    <div className="text-3xl font-bold text-red-700">
                      {historyStats?.absent || 0}
                    </div>
                    <div className="text-sm text-red-600 mt-1">إجمالي الغياب</div>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200">
                  <CardContent className="p-6 text-center">
                    <Clock className="w-10 h-10 mx-auto mb-2 text-yellow-500" />
                    <div className="text-3xl font-bold text-yellow-700">
                      {historyStats?.late || 0}
                    </div>
                    <div className="text-sm text-yellow-600 mt-1">إجمالي التأخير</div>
                  </CardContent>
                </Card>
                <Card className="border-orange-200">
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-orange-500" />
                    <div className="text-3xl font-bold text-orange-700">
                      {historyStats?.excused || 0}
                    </div>
                    <div className="text-sm text-orange-600 mt-1">غياب بعذر</div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bars */}
              {historyStats && historyStats.total > 0 && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-semibold text-gray-700 mb-4">نسب الحضور والغياب</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-700 font-medium">نسبة الحضور</span>
                          <span className="font-bold text-green-700">{historyStats.presentRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${historyStats.presentRate}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-red-700 font-medium">نسبة الغياب</span>
                          <span className="font-bold text-red-700">{historyStats.absentRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-red-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${historyStats.absentRate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!historyStats && (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>اختر الفصل والفترة الزمنية لعرض الإحصائيات</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Student History Dialog ===== */}
      <Dialog open={studentHistoryOpen} onOpenChange={setStudentHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#610000]" />
              سجل حضور وغياب: {selectedStudent?.name}
            </DialogTitle>
            <DialogDescription>
              رقم الطالب: {selectedStudent?.studentNumber} | الفصل: {selectedStudent?.classroom?.name || '-'}
            </DialogDescription>
          </DialogHeader>

          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newMonth = studentHistoryMonth === 0 ? 11 : studentHistoryMonth - 1
                const newYear = studentHistoryMonth === 0 ? studentHistoryYear - 1 : studentHistoryYear
                setStudentHistoryMonth(newMonth)
                setStudentHistoryYear(newYear)
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center font-semibold text-[#1a1a2e]">
              {arabicMonths[studentHistoryMonth]} {studentHistoryYear}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newMonth = studentHistoryMonth === 11 ? 0 : studentHistoryMonth + 1
                const newYear = studentHistoryMonth === 11 ? studentHistoryYear + 1 : studentHistoryYear
                setStudentHistoryMonth(newMonth)
                setStudentHistoryYear(newYear)
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar View */}
          <div className="mb-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cd, idx) => (
                <div
                  key={idx}
                  className={`aspect-square flex items-center justify-center rounded-md text-sm font-medium ${
                    !cd.isCurrentMonth
                      ? ''
                      : cd.status === 'حاضر'
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : cd.status === 'غائب'
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : cd.status === 'متأخر'
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                            : cd.status === 'غائب بعذر'
                              ? 'bg-orange-100 text-orange-700 border border-orange-300'
                              : 'bg-gray-50 text-gray-500 border border-gray-200'
                  }`}
                >
                  {cd.day > 0 ? cd.day : ''}
                </div>
              ))}
            </div>

            {/* Calendar Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                <span className="text-gray-600">حاضر</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                <span className="text-gray-600">غائب</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
                <span className="text-gray-600">متأخر</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-100 border border-orange-300" />
                <span className="text-gray-600">غائب بعذر</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-50 border border-gray-200" />
                <span className="text-gray-600">لم يُسجل</span>
              </div>
            </div>
          </div>

          {/* Detailed Records Table */}
          {studentHistoryLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : studentHistoryRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-2 font-medium text-gray-600">التاريخ</th>
                    <th className="text-center p-2 font-medium text-gray-600">الحالة</th>
                    <th className="text-center p-2 font-medium text-gray-600">وقت الحضور</th>
                    <th className="text-right p-2 font-medium text-gray-600">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {studentHistoryRecords.map(record => {
                    const config = statusConfig[record.status] || statusConfig['حاضر']
                    const dateObj = new Date(record.date)
                    const dayName = weekDays[dateObj.getDay()]
                    return (
                      <tr key={record.id} className="border-b">
                        <td className="p-2">
                          <div className="font-medium">{dateObj.getDate()}/{dateObj.getMonth() + 1}</div>
                          <div className="text-xs text-gray-400">{dayName}</div>
                        </td>
                        <td className="p-2 text-center">
                          <Badge className={`${config.bgColor} ${config.color} border text-xs`}>
                            {config.label}
                          </Badge>
                        </td>
                        <td className="p-2 text-center text-gray-500">
                          {record.arrivalTime || '-'}
                        </td>
                        <td className="p-2 text-gray-500">
                          {record.notes || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>لا توجد سجلات لهذا الشهر</p>
            </div>
          )}

          {/* Fetch Button */}
          <Button
            onClick={() => {
              if (selectedStudent) loadStudentHistory(selectedStudent.id)
            }}
            variant="outline"
            className="w-full"
            disabled={studentHistoryLoading}
          >
            {studentHistoryLoading ? (
              <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 ml-2" />
            )}
            تحديث السجل
          </Button>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف سجل الحضور للطالب &quot;{deleteTarget?.student.name}&quot; بتاريخ{' '}
              {deleteTarget ? new Date(deleteTarget.date).toLocaleDateString('ar-EG') : ''}؟
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRecord}
              disabled={deleting}
            >
              {deleting ? (
                <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 ml-2" />
              )}
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
