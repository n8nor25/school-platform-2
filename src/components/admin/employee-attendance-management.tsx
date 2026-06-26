'use client'

import React, { useState, useEffect } from 'react'
import {
  ClipboardCheck, Calendar, Search, Users, BarChart3,
  CheckCircle, XCircle, Clock, AlertTriangle, Save, ChevronLeft,
  ChevronRight, Eye, Trash2, RefreshCw, FileText, Briefcase,
  Stethoscope, Plane, UserX
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
interface Employee {
  id: string
  employeeNumber: string
  name: string
  jobTitle: string
  department: string | null
  phone: string | null
  salary: number
  imageUrl: string | null
}

interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  leaveType: string | null
  leaveDuration: string | null
  notes: string | null
  recordedBy: string | null
  createdAt: string
  employee: {
    id: string
    name: string
    employeeNumber: string
    jobTitle: string
    department: string | null
  }
}

interface AttendanceStats {
  total: number
  present: number
  absent: number
  late: number
  sickLeave: number
  officialLeave: number
  personalLeave: number
  presentRate: number
  absentRate: number
  leaveRate: number
}

interface EmployeeAttendanceEntry {
  employeeId: string
  status: string
  checkIn: string
  checkOut: string
  leaveType: string
  leaveDuration: string
  notes: string
}

// Status configuration with colors and icons
const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'حاضر': { label: 'حاضر', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300', icon: <CheckCircle className="w-4 h-4" /> },
  'غائب': { label: 'غائب', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: <XCircle className="w-4 h-4" /> },
  'متأخر': { label: 'متأخر', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300', icon: <Clock className="w-4 h-4" /> },
  'إجازة مرضية': { label: 'إجازة مرضية', color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-300', icon: <Stethoscope className="w-4 h-4" /> },
  'إجازة رسمية': { label: 'إجازة رسمية', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', icon: <Plane className="w-4 h-4" /> },
  'إجازة شخصية': { label: 'إجازة شخصية', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', icon: <UserX className="w-4 h-4" /> },
}

const leaveTypes = ['مرضية', 'رسمية', 'شخصية', 'أمومة', 'أخرى']
const departments = ['التعليم', 'الإدارة', 'الصيانة', 'الأمن', 'النقل', 'أخرى']

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function EmployeeAttendanceManagement() {
  const { selectedSchoolId } = useAdminStore()

  // ===== Common State =====
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('record')

  // ===== Record Attendance State =====
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [attendanceEntries, setAttendanceEntries] = useState<Record<string, EmployeeAttendanceEntry>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)

  // ===== History State =====
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([])
  const [historyStats, setHistoryStats] = useState<AttendanceStats | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [historyDepartment, setHistoryDepartment] = useState<string>('all')
  const [historyStatus, setHistoryStatus] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState('')

  // ===== Employee History Dialog =====
  const [employeeHistoryOpen, setEmployeeHistoryOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeHistoryRecords, setEmployeeHistoryRecords] = useState<AttendanceRecord[]>([])
  const [empHistoryMonth, setEmpHistoryMonth] = useState<number>(new Date().getMonth())
  const [empHistoryYear, setEmpHistoryYear] = useState<number>(new Date().getFullYear())
  const [empHistoryLoading, setEmpHistoryLoading] = useState(false)

  // ===== Delete Dialog =====
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ===== Effects =====
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/employees?schoolId=${selectedSchoolId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setEmployees(data)
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching employees:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  useEffect(() => {
    if (employees.length === 0) return
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      // Initialize entries for all visible employees
      const filtered = selectedDepartment === 'all'
        ? employees
        : employees.filter(e => e.department === selectedDepartment)

      const params = new URLSearchParams({ schoolId: selectedSchoolId, date: selectedDate })
      if (selectedDepartment !== 'all') params.set('department', selectedDepartment)

      const res = await fetch(`/api/employee-attendance?${params}`)
      if (res.ok && !cancelled) {
        const existingRecords: AttendanceRecord[] = await res.json()
        const entries: Record<string, EmployeeAttendanceEntry> = {}

        filtered.forEach(e => {
          entries[e.id] = {
            employeeId: e.id,
            status: 'حاضر',
            checkIn: '',
            checkOut: '',
            leaveType: '',
            leaveDuration: 'يوم كامل',
            notes: '',
          }
        })

        existingRecords.forEach(r => {
          if (entries[r.employeeId]) {
            entries[r.employeeId] = {
              employeeId: r.employeeId,
              status: r.status,
              checkIn: r.checkIn || '',
              checkOut: r.checkOut || '',
              leaveType: r.leaveType || '',
              leaveDuration: r.leaveDuration || 'يوم كامل',
              notes: r.notes || '',
            }
          }
        })

        setAttendanceEntries(entries)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedDate, selectedDepartment, selectedSchoolId, employees])

  useEffect(() => {
    if (activeTab !== 'history' || !selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setHistoryLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId, includeStats: 'true' })
        if (historyDate) params.set('date', historyDate)
        if (historyDepartment && historyDepartment !== 'all') params.set('department', historyDepartment)
        if (historyStatus && historyStatus !== 'all') params.set('status', historyStatus)

        const res = await fetch(`/api/employee-attendance?${params}`)
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
  }, [activeTab, selectedSchoolId, historyDate, historyDepartment, historyStatus])

  useEffect(() => {
    if (!employeeHistoryOpen || !selectedEmployee || !selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setEmpHistoryLoading(true)
      try {
        const startDate = `${empHistoryYear}-${String(empHistoryMonth + 1).padStart(2, '0')}-01`
        const endDate = new Date(empHistoryYear, empHistoryMonth + 1, 0).toISOString().split('T')[0]
        const params = new URLSearchParams({
          schoolId: selectedSchoolId,
          employeeId: selectedEmployee.id,
          dateFrom: startDate,
          dateTo: endDate,
        })
        const res = await fetch(`/api/employee-attendance?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setEmployeeHistoryRecords(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching employee history:', err)
      } finally {
        if (!cancelled) setEmpHistoryLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [employeeHistoryOpen, selectedEmployee, selectedSchoolId, empHistoryMonth, empHistoryYear])

  // ===== Handlers =====
  const handleSaveAttendance = async () => {
    if (!selectedSchoolId || Object.keys(attendanceEntries).length === 0) return
    setSavingAttendance(true)
    try {
      const records = Object.values(attendanceEntries).map(entry => ({
        employeeId: entry.employeeId,
        status: entry.status,
        checkIn: entry.checkIn || undefined,
        checkOut: entry.checkOut || undefined,
        leaveType: entry.leaveType || undefined,
        leaveDuration: entry.leaveDuration || undefined,
        notes: entry.notes || undefined,
      }))

      const res = await fetch('/api/employee-attendance/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: selectedSchoolId, date: selectedDate, records }),
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
    Object.keys(updated).forEach(empId => {
      updated[empId] = { ...updated[empId], status }
    })
    setAttendanceEntries(updated)
  }

  const handleDeleteRecord = async () => {
    if (!deleteTarget || !selectedSchoolId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/employee-attendance/${deleteTarget.id}?schoolId=${selectedSchoolId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('تم حذف سجل الحضور')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        // Refresh history
        setHistoryLoading(true)
        const params = new URLSearchParams({ schoolId: selectedSchoolId, includeStats: 'true' })
        if (historyDate) params.set('date', historyDate)
        if (historyDepartment !== 'all') params.set('department', historyDepartment)
        if (historyStatus !== 'all') params.set('status', historyStatus)
        const refreshRes = await fetch(`/api/employee-attendance?${params}`)
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setHistoryRecords(data.records || [])
          setHistoryStats(data.stats || null)
        }
        setHistoryLoading(false)
      } else {
        toast.error('خطأ في حذف السجل')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setDeleting(false)
    }
  }

  // Filtered employees for recording
  const visibleEmployees = selectedDepartment === 'all'
    ? employees
    : employees.filter(e => e.department === selectedDepartment)

  // Compute summary for current recording
  const recordingSummary = React.useMemo(() => {
    const entries = Object.values(attendanceEntries)
    return {
      total: entries.length,
      present: entries.filter(e => e.status === 'حاضر').length,
      absent: entries.filter(e => e.status === 'غائب').length,
      late: entries.filter(e => e.status === 'متأخر').length,
      sickLeave: entries.filter(e => e.status === 'إجازة مرضية').length,
      officialLeave: entries.filter(e => e.status === 'إجازة رسمية').length,
      personalLeave: entries.filter(e => e.status === 'إجازة شخصية').length,
    }
  }, [attendanceEntries])

  // Filter history by search
  const filteredHistoryRecords = React.useMemo(() => {
    if (!historySearch) return historyRecords
    const q = historySearch.toLowerCase()
    return historyRecords.filter(r =>
      r.employee.name.toLowerCase().includes(q) ||
      r.employee.employeeNumber.toLowerCase().includes(q)
    )
  }, [historyRecords, historySearch])

  // Calendar days for employee history
  const calendarDays = React.useMemo(() => {
    const year = empHistoryYear
    const month = empHistoryMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: { day: number; status: string | null; isCurrentMonth: boolean }[] = []

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, status: null, isCurrentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const record = employeeHistoryRecords.find(r => {
        const rDate = new Date(r.date)
        return rDate.getFullYear() === year && rDate.getMonth() === month && rDate.getDate() === d
      })
      days.push({ day: d, status: record?.status || null, isCurrentMonth: true })
    }
    return days
  }, [empHistoryYear, empHistoryMonth, employeeHistoryRecords])

  // ===== Render =====
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-[#610000]" />
            حضور وغياب الموظفين
          </h2>
          <p className="text-gray-500 text-sm mt-1">تسجيل ومتابعة حضور وغياب المعلمين والموظفين</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">القسم</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأقسام</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">التاريخ</Label>
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={() => {
                    // Trigger re-fetch by changing date briefly
                    setSelectedDate(d => d)
                  }}>
                    <RefreshCw className="w-4 h-4 ml-2" />
                    تحديث البيانات
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Action Buttons + Summary */}
          {Object.keys(attendanceEntries).length > 0 && (
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
                    <Button size="sm" variant="outline" onClick={() => handleMarkAll('إجازة رسمية')}
                      className="border-blue-300 text-blue-700 hover:bg-blue-50">
                      <Plane className="w-3.5 h-3.5 ml-1" />
                      الكل إجازة رسمية
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">حاضر: {recordingSummary.present}</Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">غائب: {recordingSummary.absent}</Badge>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">متأخر: {recordingSummary.late}</Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">مرضية: {recordingSummary.sickLeave}</Badge>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">رسمية: {recordingSummary.officialLeave}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee Attendance List */}
          {loading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-8 w-40" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : Object.keys(attendanceEntries).length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  قائمة الموظفين
                  <Badge variant="secondary" className="mr-2">{visibleEmployees.length} موظف</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-right p-3 text-sm font-medium text-gray-600 w-10">#</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">رقم الموظف</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الاسم</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الوظيفة</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">القسم</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">الحالة</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">الحضور</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">الانصراف</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map((emp, index) => {
                        const entry = attendanceEntries[emp.id]
                        if (!entry) return null
                        const isLeave = ['إجازة مرضية', 'إجازة رسمية', 'إجازة شخصية'].includes(entry.status)
                        return (
                          <tr key={emp.id} className="border-b hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="p-3 text-sm font-mono">{emp.employeeNumber}</td>
                            <td className="p-3 text-sm font-medium">{emp.name}</td>
                            <td className="p-3 text-sm text-gray-500">{emp.jobTitle}</td>
                            <td className="p-3 text-sm text-gray-500">{emp.department || '-'}</td>
                            <td className="p-3">
                              <Select
                                value={entry.status}
                                onValueChange={val => {
                                  setAttendanceEntries(prev => ({
                                    ...prev,
                                    [emp.id]: {
                                      ...prev[emp.id],
                                      status: val,
                                      // Clear times when absent or on leave
                                      checkIn: (val === 'غائب' || ['إجازة مرضية', 'إجازة رسمية', 'إجازة شخصية'].includes(val)) ? '' : prev[emp.id].checkIn,
                                      checkOut: (val === 'غائب' || ['إجازة مرضية', 'إجازة رسمية', 'إجازة شخصية'].includes(val)) ? '' : prev[emp.id].checkOut,
                                      leaveType: ['إجازة مرضية', 'إجازة رسمية', 'إجازة شخصية'].includes(val) ? val.replace('إجازة ', '') : '',
                                    }
                                  }))
                                }}
                              >
                                <SelectTrigger className="h-8 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(statusConfig).map(([status, cfg]) => (
                                    <SelectItem key={status} value={status}>
                                      <span className="flex items-center gap-1.5">
                                        {cfg.icon} {cfg.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Input
                                type="time"
                                value={entry.checkIn}
                                onChange={e => setAttendanceEntries(prev => ({
                                  ...prev,
                                  [emp.id]: { ...prev[emp.id], checkIn: e.target.value }
                                }))}
                                className="w-28 h-8 text-center text-sm mx-auto"
                                disabled={isLeave || entry.status === 'غائب'}
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="time"
                                value={entry.checkOut}
                                onChange={e => setAttendanceEntries(prev => ({
                                  ...prev,
                                  [emp.id]: { ...prev[emp.id], checkOut: e.target.value }
                                }))}
                                className="w-28 h-8 text-center text-sm mx-auto"
                                disabled={isLeave || entry.status === 'غائب'}
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                value={entry.notes}
                                onChange={e => setAttendanceEntries(prev => ({
                                  ...prev,
                                  [emp.id]: { ...prev[emp.id], notes: e.target.value }
                                }))}
                                placeholder="ملاحظة..."
                                className="h-8 text-sm w-28"
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
                  <Button onClick={handleSaveAttendance} disabled={savingAttendance}
                    className="bg-[#610000] hover:bg-[#7a0000] min-w-[160px]">
                    {savingAttendance ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
                    {savingAttendance ? 'جارٍ الحفظ...' : 'حفظ الحضور'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{employees.length === 0 ? 'لا يوجد موظفين مسجلين. أضف موظفين أولاً.' : 'اختر القسم لتسجيل الحضور'}</p>
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
                  <Input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">القسم</Label>
                  <Select value={historyDepartment} onValueChange={setHistoryDepartment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأقسام</SelectItem>
                      {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">الحالة</Label>
                  <Select value={historyStatus} onValueChange={setHistoryStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {Object.entries(statusConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">بحث</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                      placeholder="اسم أو رقم الموظف..." className="pr-9" />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => {
                    setHistoryLoading(true)
                    const params = new URLSearchParams({ schoolId: selectedSchoolId || '', includeStats: 'true' })
                    if (historyDate) params.set('date', historyDate)
                    if (historyDepartment !== 'all') params.set('department', historyDepartment)
                    if (historyStatus !== 'all') params.set('status', historyStatus)
                    fetch(`/api/employee-attendance?${params}`).then(r => r.json()).then(data => {
                      setHistoryRecords(data.records || [])
                      setHistoryStats(data.stats || null)
                      setHistoryLoading(false)
                    }).catch(() => setHistoryLoading(false))
                  }} variant="outline" className="w-full">
                    <Search className="w-4 h-4 ml-2" />
                    بحث
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          {historyStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">{historyStats.sickLeave}</div>
                  <div className="text-xs text-purple-600">مرضية</div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{historyStats.officialLeave}</div>
                  <div className="text-xs text-blue-600">رسمية</div>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">{historyStats.personalLeave}</div>
                  <div className="text-xs text-orange-600">شخصية</div>
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
                        <th className="text-right p-3 text-sm font-medium text-gray-600">رقم الموظف</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الاسم</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">الوظيفة</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">القسم</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">الحالة</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">حضور</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">انصراف</th>
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
                            <td className="p-3 text-sm font-mono">{record.employee.employeeNumber}</td>
                            <td className="p-3 text-sm font-medium">{record.employee.name}</td>
                            <td className="p-3 text-sm text-gray-500">{record.employee.jobTitle}</td>
                            <td className="p-3 text-sm text-gray-500">{record.employee.department || '-'}</td>
                            <td className="p-3 text-center">
                              <Badge className={`${config.bgColor} ${config.color} border`}>
                                {config.icon}
                                <span className="mr-1">{config.label}</span>
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-center text-gray-500">{record.checkIn || '-'}</td>
                            <td className="p-3 text-sm text-center text-gray-500">{record.checkOut || '-'}</td>
                            <td className="p-3 text-sm text-gray-500 max-w-[120px] truncate">{record.notes || '-'}</td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                  onClick={() => {
                                    const emp: Employee = {
                                      id: record.employee.id,
                                      name: record.employee.name,
                                      employeeNumber: record.employee.employeeNumber,
                                      jobTitle: record.employee.jobTitle,
                                      department: record.employee.department,
                                      phone: null, salary: 0, imageUrl: null,
                                    }
                                    setSelectedEmployee(emp)
                                    setEmployeeHistoryOpen(true)
                                    setEmpHistoryMonth(new Date().getMonth())
                                    setEmpHistoryYear(new Date().getFullYear())
                                  }}
                                  title="عرض سجل الموظف">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50"
                                  onClick={() => { setDeleteTarget(record); setDeleteDialogOpen(true) }}
                                  title="حذف">
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
                إحصائيات حضور الموظفين
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Period Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">القسم</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأقسام</SelectItem>
                      {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-1.5 block">الشهر</Label>
                  <Input type="month" value={`${selectedDate.slice(0, 7)}`}
                    onChange={e => setSelectedDate(e.target.value + '-01')} />
                </div>
                <div className="flex items-end">
                  <Button onClick={async () => {
                    if (!selectedSchoolId) return
                    setHistoryLoading(true)
                    try {
                      const d = new Date(selectedDate)
                      const startOfMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
                      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
                      const params = new URLSearchParams({
                        schoolId: selectedSchoolId,
                        dateFrom: startOfMonth,
                        dateTo: endOfMonth,
                        includeStats: 'true',
                      })
                      if (selectedDepartment !== 'all') params.set('department', selectedDepartment)
                      const res = await fetch(`/api/employee-attendance?${params}`)
                      if (res.ok) {
                        const data = await res.json()
                        setHistoryRecords(data.records || [])
                        setHistoryStats(data.stats || null)
                      }
                    } catch {
                      toast.error('خطأ في تحميل الإحصائيات')
                    } finally {
                      setHistoryLoading(false)
                    }
                  }} className="w-full bg-[#610000] hover:bg-[#7a0000]">
                    <BarChart3 className="w-4 h-4 ml-2" />
                    عرض الإحصائيات
                  </Button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-green-200">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                    <div className="text-3xl font-bold text-green-700">{historyStats?.present || 0}</div>
                    <div className="text-sm text-green-600 mt-1">إجمالي الحضور</div>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent className="p-6 text-center">
                    <XCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
                    <div className="text-3xl font-bold text-red-700">{historyStats?.absent || 0}</div>
                    <div className="text-sm text-red-600 mt-1">إجمالي الغياب</div>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200">
                  <CardContent className="p-6 text-center">
                    <Clock className="w-10 h-10 mx-auto mb-2 text-yellow-500" />
                    <div className="text-3xl font-bold text-yellow-700">{historyStats?.late || 0}</div>
                    <div className="text-sm text-yellow-600 mt-1">إجمالي التأخير</div>
                  </CardContent>
                </Card>
                <Card className="border-purple-200">
                  <CardContent className="p-6 text-center">
                    <Stethoscope className="w-10 h-10 mx-auto mb-2 text-purple-500" />
                    <div className="text-3xl font-bold text-purple-700">{historyStats?.sickLeave || 0}</div>
                    <div className="text-sm text-purple-600 mt-1">إجازة مرضية</div>
                  </CardContent>
                </Card>
                <Card className="border-blue-200">
                  <CardContent className="p-6 text-center">
                    <Plane className="w-10 h-10 mx-auto mb-2 text-blue-500" />
                    <div className="text-3xl font-bold text-blue-700">{historyStats?.officialLeave || 0}</div>
                    <div className="text-sm text-blue-600 mt-1">إجازة رسمية</div>
                  </CardContent>
                </Card>
                <Card className="border-orange-200">
                  <CardContent className="p-6 text-center">
                    <UserX className="w-10 h-10 mx-auto mb-2 text-orange-500" />
                    <div className="text-3xl font-bold text-orange-700">{historyStats?.personalLeave || 0}</div>
                    <div className="text-sm text-orange-600 mt-1">إجازة شخصية</div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bars */}
              {historyStats && historyStats.total > 0 && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <h3 className="font-semibold text-gray-700 mb-4">نسب الحضور والغياب والإجازات</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-700 font-medium">نسبة الحضور</span>
                          <span className="font-bold text-green-700">{historyStats.presentRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${historyStats.presentRate}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-red-700 font-medium">نسبة الغياب</span>
                          <span className="font-bold text-red-700">{historyStats.absentRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div className="bg-red-500 h-3 rounded-full transition-all duration-500" style={{ width: `${historyStats.absentRate}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-purple-700 font-medium">نسبة الإجازات</span>
                          <span className="font-bold text-purple-700">{historyStats.leaveRate}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div className="bg-purple-500 h-3 rounded-full transition-all duration-500" style={{ width: `${historyStats.leaveRate}%` }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!historyStats && (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>اختر القسم والفترة الزمنية لعرض الإحصائيات</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Employee History Dialog ===== */}
      <Dialog open={employeeHistoryOpen} onOpenChange={setEmployeeHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#610000]" />
              سجل حضور وغياب: {selectedEmployee?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee?.jobTitle} | {selectedEmployee?.department || 'بدون قسم'}
            </DialogDescription>
          </DialogHeader>

          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={() => {
              const m = empHistoryMonth === 0 ? 11 : empHistoryMonth - 1
              const y = empHistoryMonth === 0 ? empHistoryYear - 1 : empHistoryYear
              setEmpHistoryMonth(m)
              setEmpHistoryYear(y)
            }}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="text-center font-semibold text-[#1a1a2e]">
              {arabicMonths[empHistoryMonth]} {empHistoryYear}
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const m = empHistoryMonth === 11 ? 0 : empHistoryMonth + 1
              const y = empHistoryMonth === 11 ? empHistoryYear + 1 : empHistoryYear
              setEmpHistoryMonth(m)
              setEmpHistoryYear(y)
            }}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Calendar View */}
          <div className="mb-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cd, idx) => (
                <div key={idx} className={`aspect-square flex items-center justify-center rounded-md text-sm font-medium ${
                  !cd.isCurrentMonth ? '' :
                  cd.status === 'حاضر' ? 'bg-green-100 text-green-700 border border-green-300' :
                  cd.status === 'غائب' ? 'bg-red-100 text-red-700 border border-red-300' :
                  cd.status === 'متأخر' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
                  cd.status?.includes('إجازة') ? 'bg-purple-100 text-purple-700 border border-purple-300' :
                  'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  {cd.day > 0 ? cd.day : ''}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-100 border border-green-300" /><span className="text-gray-600">حاضر</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-100 border border-red-300" /><span className="text-gray-600">غائب</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /><span className="text-gray-600">متأخر</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-100 border border-purple-300" /><span className="text-gray-600">إجازة</span></div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-gray-50 border border-gray-200" /><span className="text-gray-600">لم يُسجل</span></div>
            </div>
          </div>

          {/* Detailed Records Table */}
          {empHistoryLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : employeeHistoryRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-2 font-medium text-gray-600">التاريخ</th>
                    <th className="text-center p-2 font-medium text-gray-600">الحالة</th>
                    <th className="text-center p-2 font-medium text-gray-600">حضور</th>
                    <th className="text-center p-2 font-medium text-gray-600">انصراف</th>
                    <th className="text-right p-2 font-medium text-gray-600">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeHistoryRecords.map(record => {
                    const config = statusConfig[record.status] || statusConfig['حاضر']
                    const dateObj = new Date(record.date)
                    return (
                      <tr key={record.id} className="border-b">
                        <td className="p-2">
                          <div className="font-medium">{dateObj.getDate()}/{dateObj.getMonth() + 1}</div>
                          <div className="text-xs text-gray-400">{weekDays[dateObj.getDay()]}</div>
                        </td>
                        <td className="p-2 text-center">
                          <Badge className={`${config.bgColor} ${config.color} border text-xs`}>{config.label}</Badge>
                        </td>
                        <td className="p-2 text-center text-gray-500">{record.checkIn || '-'}</td>
                        <td className="p-2 text-center text-gray-500">{record.checkOut || '-'}</td>
                        <td className="p-2 text-gray-500">{record.notes || '-'}</td>
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
              هل أنت متأكد من حذف سجل الحضور للموظف &quot;{deleteTarget?.employee.name}&quot; بتاريخ{' '}
              {deleteTarget ? new Date(deleteTarget.date).toLocaleDateString('ar-EG') : ''}؟
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDeleteRecord} disabled={deleting}>
              {deleting ? <RefreshCw className="w-4 h-4 ml-2 animate-spin" /> : <Trash2 className="w-4 h-4 ml-2" />}
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
