'use client'

import React, { useState, useEffect } from 'react'
import {
  DollarSign, Calendar, Search, Users, BarChart3,
  CheckCircle, XCircle, Clock, AlertTriangle, Save,
  Eye, Trash2, RefreshCw, FileText, Briefcase,
  Edit3, CreditCard, Wallet, TrendingUp, ArrowUpDown,
  Plus, Minus, Banknote, Receipt, Calculator
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
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
  allowances: number
  deductions: number
  status: string
}

interface SalaryEmployee {
  id: string
  name: string
  employeeNumber: string
  jobTitle: string
  department: string | null
}

interface SalaryRecord {
  id: string
  schoolId: string
  employeeId: string
  month: number
  year: number
  basicSalary: number
  allowances: number
  overtime: number
  bonus: number
  deductions: number
  advancePayment: number
  insurance: number
  taxes: number
  netSalary: number
  paymentDate: string | null
  paymentMethod: string
  status: string
  notes: string | null
  createdAt: string
  employee: SalaryEmployee
}

interface SalaryStats {
  total: number
  totalNetSalary: number
  totalBasicSalary: number
  totalAllowances: number
  totalOvertime: number
  totalBonus: number
  totalDeductions: number
  totalAdvancePayment: number
  totalInsurance: number
  totalTaxes: number
  paidCount: number
  pendingCount: number
  cancelledCount: number
}

interface PrepareEntry {
  employeeId: string
  employeeNumber: string
  name: string
  jobTitle: string
  department: string | null
  basicSalary: number
  allowances: number
  deductions: number
  overtime: number
  bonus: number
  advancePayment: number
  insurance: number
  taxes: number
  netSalary: number
  existing: boolean
}

// ===== Constants =====
const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const paymentMethods = ['تحويل', 'نقدي', 'شيك']
const salaryStatuses = ['معلق', 'مدفوع', 'ملغي']
const departments = ['التعليم', 'الإدارة', 'الصيانة', 'الأمن', 'النقل', 'أخرى']

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  'معلق': { label: 'معلق', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300', icon: <Clock className="w-3.5 h-3.5" /> },
  'مدفوع': { label: 'مدفوع', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  'ملغي': { label: 'ملغي', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: <XCircle className="w-3.5 h-3.5" /> },
}

function calculateNetSalary(entry: {
  basicSalary: number; allowances: number; overtime: number; bonus: number;
  deductions: number; advancePayment: number; insurance: number; taxes: number;
}): number {
  return entry.basicSalary + entry.allowances + entry.overtime + entry.bonus
    - entry.deductions - entry.advancePayment - entry.insurance - entry.taxes
}

function formatCurrency(value: number): string {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getCurrentMonth(): number {
  return new Date().getMonth() + 1
}

function getCurrentYear(): number {
  return new Date().getFullYear()
}

// Generate year options (current year and 5 years back)
function getYearOptions(): number[] {
  const current = getCurrentYear()
  return Array.from({ length: 6 }, (_, i) => current - i)
}

// ===== Main Component =====
export function SalariesManagement() {
  const { selectedSchoolId } = useAdminStore()

  // ===== Common State =====
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('records')

  // ===== Salary Records State =====
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([])
  const [salaryStats, setSalaryStats] = useState<SalaryStats | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [filterMonth, setFilterMonth] = useState<string>(String(getCurrentMonth()))
  const [filterYear, setFilterYear] = useState<string>(String(getCurrentYear()))
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')

  // ===== Edit Dialog State =====
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SalaryRecord | null>(null)
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  // ===== Delete Dialog State =====
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SalaryRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ===== Mark as Paid Dialog =====
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false)
  const [markPaidTarget, setMarkPaidTarget] = useState<SalaryRecord | null>(null)
  const [markingPaid, setMarkingPaid] = useState(false)

  // ===== Prepare Salaries State =====
  const [prepareMonth, setPrepareMonth] = useState<string>(String(getCurrentMonth()))
  const [prepareYear, setPrepareYear] = useState<string>(String(getCurrentYear()))
  const [prepareEntries, setPrepareEntries] = useState<PrepareEntry[]>([])
  const [prepareLoading, setPrepareLoading] = useState(false)
  const [prepareSaving, setPrepareSaving] = useState(false)
  const [prepareLoaded, setPrepareLoaded] = useState(false)

  // ===== Statistics State =====
  const [statsData, setStatsData] = useState<SalaryStats | null>(null)
  const [statsMonth, setStatsMonth] = useState<string>(String(getCurrentMonth()))
  const [statsYear, setStatsYear] = useState<string>(String(getCurrentYear()))
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsRecords, setStatsRecords] = useState<SalaryRecord[]>([])

  // ===== Load Employees =====
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    async function load() {
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

  // ===== Load Salary Records =====
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    async function load() {
      setRecordsLoading(true)
      try {
        const params = new URLSearchParams({
          schoolId: selectedSchoolId,
          includeStats: 'true',
        })
        if (filterMonth && filterMonth !== 'all') params.set('month', filterMonth)
        if (filterYear && filterYear !== 'all') params.set('year', filterYear)
        if (filterEmployee && filterEmployee !== 'all') params.set('employeeId', filterEmployee)
        if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus)
        if (filterDepartment && filterDepartment !== 'all') params.set('department', filterDepartment)

        const res = await fetch(`/api/salaries?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSalaryRecords(data.records || data)
          setSalaryStats(data.stats || null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching salaries:', err)
          toast.error('خطأ في تحميل بيانات الرواتب')
        }
      } finally {
        if (!cancelled) setRecordsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, filterMonth, filterYear, filterEmployee, filterStatus, filterDepartment])

  // ===== Load Statistics =====
  useEffect(() => {
    if (!selectedSchoolId || activeTab !== 'statistics') return
    let cancelled = false
    async function load() {
      setStatsLoading(true)
      try {
        const params = new URLSearchParams({
          schoolId: selectedSchoolId,
          includeStats: 'true',
        })
        if (statsMonth && statsMonth !== 'all') params.set('month', statsMonth)
        if (statsYear && statsYear !== 'all') params.set('year', statsYear)

        const res = await fetch(`/api/salaries?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setStatsData(data.stats || null)
          setStatsRecords(data.records || data)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching stats:', err)
          toast.error('خطأ في تحميل الإحصائيات')
        }
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, activeTab, statsMonth, statsYear])

  // ===== Handlers =====
  async function handleLoadPrepareData() {
    if (!selectedSchoolId) return
    setPrepareLoading(true)
    setPrepareLoaded(false)
    try {
      const month = parseInt(prepareMonth)
      const year = parseInt(prepareYear)

      // Get active employees
      const empRes = await fetch(`/api/employees?schoolId=${selectedSchoolId}&status=نشط`)
      if (!empRes.ok) throw new Error('Failed to fetch employees')
      const activeEmployees: Employee[] = await empRes.json()

      // Get existing salary records for the month
      const salRes = await fetch(`/api/salaries?schoolId=${selectedSchoolId}&month=${month}&year=${year}`)
      if (!salRes.ok) throw new Error('Failed to fetch existing salaries')
      const existingSalaries: SalaryRecord[] = await salRes.json()

      const existingMap = new Map(existingSalaries.map(s => [s.employeeId, s]))

      const entries: PrepareEntry[] = activeEmployees.map(emp => {
        const existing = existingMap.get(emp.id)
        return {
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          name: emp.name,
          jobTitle: emp.jobTitle,
          department: emp.department,
          basicSalary: emp.salary,
          allowances: emp.allowances,
          deductions: emp.deductions,
          overtime: 0,
          bonus: 0,
          advancePayment: 0,
          insurance: 0,
          taxes: 0,
          netSalary: calculateNetSalary({
            basicSalary: emp.salary,
            allowances: emp.allowances,
            overtime: 0,
            bonus: 0,
            deductions: emp.deductions,
            advancePayment: 0,
            insurance: 0,
            taxes: 0,
          }),
          existing: !!existing,
        }
      })

      setPrepareEntries(entries)
      setPrepareLoaded(true)

      const existingCount = entries.filter(e => e.existing).length
      if (existingCount > 0) {
        toast.warning(`يوجد ${existingCount} سجل رواتب مسبق لهذا الشهر`)
      }
    } catch (err) {
      console.error('Error loading prepare data:', err)
      toast.error('خطأ في تحميل بيانات الموظفين')
    } finally {
      setPrepareLoading(false)
    }
  }

  async function handleSaveAllPrepare() {
    if (!selectedSchoolId) return
    const newEntries = prepareEntries.filter(e => !e.existing)
    if (newEntries.length === 0) {
      toast.info('لا توجد سجلات جديدة للحفظ')
      return
    }
    setPrepareSaving(true)
    try {
      const month = parseInt(prepareMonth)
      const year = parseInt(prepareYear)
      let successCount = 0
      let errorCount = 0

      for (const entry of newEntries) {
        try {
          const res = await fetch('/api/salaries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schoolId: selectedSchoolId,
              employeeId: entry.employeeId,
              month,
              year,
              basicSalary: entry.basicSalary,
              allowances: entry.allowances,
              overtime: entry.overtime,
              bonus: entry.bonus,
              deductions: entry.deductions,
              advancePayment: entry.advancePayment,
              insurance: entry.insurance,
              taxes: entry.taxes,
              netSalary: entry.netSalary,
            }),
          })
          if (res.ok) {
            successCount++
          } else {
            errorCount++
          }
        } catch {
          errorCount++
        }
      }

      if (successCount > 0) {
        toast.success(`تم حفظ ${successCount} سجل رواتب بنجاح`)
      }
      if (errorCount > 0) {
        toast.error(`فشل حفظ ${errorCount} سجل`)
      }

      // Refresh the prepare entries
      await handleLoadPrepareData()
    } finally {
      setPrepareSaving(false)
    }
  }

  function updatePrepareEntry(index: number, field: string, value: number) {
    setPrepareEntries(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      updated[index].netSalary = calculateNetSalary(updated[index])
      return updated
    })
  }

  function openEditDialog(record: SalaryRecord) {
    setEditTarget(record)
    setEditForm({
      basicSalary: record.basicSalary,
      allowances: record.allowances,
      overtime: record.overtime,
      bonus: record.bonus,
      deductions: record.deductions,
      advancePayment: record.advancePayment,
      insurance: record.insurance,
      taxes: record.taxes,
      paymentMethod: record.paymentMethod,
      status: record.status,
      notes: record.notes || '',
    })
    setEditDialogOpen(true)
  }

  async function handleSaveEdit() {
    if (!editTarget || !selectedSchoolId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/salaries/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          ...editForm,
        }),
      })
      if (res.ok) {
        toast.success('تم تحديث سجل الراتب بنجاح')
        setEditDialogOpen(false)
        // Refresh records
        setFilterMonth(filterMonth) // trigger re-fetch
      } else {
        const data = await res.json()
        toast.error(data.error || 'خطأ في تحديث سجل الراتب')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !selectedSchoolId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/salaries/${deleteTarget.id}?schoolId=${selectedSchoolId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('تم حذف سجل الراتب بنجاح')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        // Force re-fetch by toggling a filter
        setSalaryRecords(prev => prev.filter(r => r.id !== deleteTarget.id))
      } else {
        toast.error('خطأ في حذف سجل الراتب')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setDeleting(false)
    }
  }

  async function handleMarkAsPaid() {
    if (!markPaidTarget || !selectedSchoolId) return
    setMarkingPaid(true)
    try {
      const res = await fetch(`/api/salaries/${markPaidTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          status: 'مدفوع',
          paymentDate: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        toast.success('تم تسجيل الدفع بنجاح')
        setMarkPaidDialogOpen(false)
        setMarkPaidTarget(null)
        // Update local record
        setSalaryRecords(prev =>
          prev.map(r =>
            r.id === markPaidTarget.id
              ? { ...r, status: 'مدفوع', paymentDate: new Date().toISOString() }
              : r
          )
        )
      } else {
        toast.error('خطأ في تسجيل الدفع')
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setMarkingPaid(false)
    }
  }

  // ===== Computed Values =====
  const departmentList = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[]
  const allDepartments = [...new Set([...departments, ...departmentList])]

  // Compute department salary breakdown for statistics
  const departmentBreakdown = statsRecords.reduce<Record<string, { count: number; totalNet: number; totalBasic: number }>>((acc, record) => {
    const dept = record.employee.department || 'غير محدد'
    if (!acc[dept]) {
      acc[dept] = { count: 0, totalNet: 0, totalBasic: 0 }
    }
    acc[dept].count++
    acc[dept].totalNet += record.netSalary
    acc[dept].totalBasic += record.basicSalary
    return acc
  }, {})

  // Top employees by salary
  const topEmployees = [...statsRecords]
    .filter(r => r.status !== 'ملغي')
    .sort((a, b) => b.netSalary - a.netSalary)
    .slice(0, 5)

  // ===== Render Helpers =====
  function renderStatCard(
    title: string,
    value: string,
    icon: React.ReactNode,
    colorClass: string,
    subtitle?: string
  ) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 truncate">{title}</p>
              <p className="text-lg font-bold truncate">{value}</p>
              {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ===== Loading Skeleton =====
  if (loading && employees.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-4" dir="rtl">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#610000] rounded-lg flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">إدارة الرواتب</h1>
          <p className="text-sm text-gray-500">إعداد وصرف ومتابعة رواتب الموظفين</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="records" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-4 h-4" />
            سجل الرواتب
          </TabsTrigger>
          <TabsTrigger value="prepare" className="gap-1.5 text-xs sm:text-sm">
            <Calculator className="w-4 h-4" />
            إعداد الرواتب
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4" />
            الإحصائيات
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: سجل الرواتب ===== */}
        <TabsContent value="records" className="space-y-4 mt-4">
          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Month Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">الشهر</Label>
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {arabicMonths.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Year Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">السنة</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {getYearOptions().map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Employee Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">الموظف</Label>
                  <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">الحالة</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {salaryStatuses.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">القسم</Label>
                  <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {allDepartments.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Refresh Button */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">&nbsp;</Label>
                  <Button
                    variant="outline"
                    className="h-10 w-full gap-1.5"
                    onClick={() => setFilterMonth(filterMonth)}
                    disabled={recordsLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${recordsLoading ? 'animate-spin' : ''}`} />
                    تحديث
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          {salaryStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {renderStatCard(
                'إجمالي السجلات',
                String(salaryStats.total),
                <FileText className="w-5 h-5 text-white" />,
                'bg-[#610000]',
                `${salaryStats.paidCount} مدفوع / ${salaryStats.pendingCount} معلق`
              )}
              {renderStatCard(
                'إجمالي الرواتب الصافية',
                formatCurrency(salaryStats.totalNetSalary),
                <Banknote className="w-5 h-5 text-white" />,
                'bg-green-700',
                `أساسي: ${formatCurrency(salaryStats.totalBasicSalary)}`
              )}
              {renderStatCard(
                'إجمالي البدلات والمكافآت',
                formatCurrency(salaryStats.totalAllowances + salaryStats.totalOvertime + salaryStats.totalBonus),
                <TrendingUp className="w-5 h-5 text-white" />,
                'bg-teal-700',
                `بدلات: ${formatCurrency(salaryStats.totalAllowances)}`
              )}
              {renderStatCard(
                'إجمالي الخصومات',
                formatCurrency(salaryStats.totalDeductions + salaryStats.totalAdvancePayment + salaryStats.totalInsurance + salaryStats.totalTaxes),
                <Minus className="w-5 h-5 text-white" />,
                'bg-red-700',
                `خصومات: ${formatCurrency(salaryStats.totalDeductions)}`
              )}
            </div>
          )}

          {/* Salary Records */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                سجلات الرواتب
                {salaryRecords.length > 0 && (
                  <Badge variant="secondary" className="mr-auto">{salaryRecords.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recordsLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : salaryRecords.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">لا توجد سجلات رواتب</p>
                  <p className="text-sm">قم بإعداد الرواتب من تبويب &quot;إعداد الرواتب&quot;</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-right p-3 font-medium text-gray-600">الموظف</th>
                          <th className="text-right p-3 font-medium text-gray-600">القسم</th>
                          <th className="text-right p-3 font-medium text-gray-600">الشهر/السنة</th>
                          <th className="text-right p-3 font-medium text-gray-600">الأساسي</th>
                          <th className="text-right p-3 font-medium text-gray-600">البدلات</th>
                          <th className="text-right p-3 font-medium text-gray-600">إضافي</th>
                          <th className="text-right p-3 font-medium text-gray-600">مكافأة</th>
                          <th className="text-right p-3 font-medium text-gray-600">الخصومات</th>
                          <th className="text-right p-3 font-medium text-gray-600">السلف</th>
                          <th className="text-right p-3 font-medium text-gray-600">التأمين</th>
                          <th className="text-right p-3 font-medium text-gray-600">الضرائب</th>
                          <th className="text-right p-3 font-medium text-gray-600 font-bold">الصافي</th>
                          <th className="text-right p-3 font-medium text-gray-600">الحالة</th>
                          <th className="text-right p-3 font-medium text-gray-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {salaryRecords.map(record => {
                          const sConfig = statusConfig[record.status] || statusConfig['معلق']
                          return (
                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-3">
                                <div>
                                  <p className="font-medium text-gray-900">{record.employee.name}</p>
                                  <p className="text-xs text-gray-500">{record.employee.jobTitle}</p>
                                </div>
                              </td>
                              <td className="p-3 text-gray-600">{record.employee.department || '-'}</td>
                              <td className="p-3 text-gray-600">{arabicMonths[record.month - 1]} {record.year}</td>
                              <td className="p-3 text-green-700 font-medium">{formatCurrency(record.basicSalary)}</td>
                              <td className="p-3 text-green-700">{formatCurrency(record.allowances)}</td>
                              <td className="p-3 text-green-700">{formatCurrency(record.overtime)}</td>
                              <td className="p-3 text-green-700">{formatCurrency(record.bonus)}</td>
                              <td className="p-3 text-red-600">{formatCurrency(record.deductions)}</td>
                              <td className="p-3 text-red-600">{formatCurrency(record.advancePayment)}</td>
                              <td className="p-3 text-red-600">{formatCurrency(record.insurance)}</td>
                              <td className="p-3 text-red-600">{formatCurrency(record.taxes)}</td>
                              <td className="p-3 font-bold text-[#610000]">{formatCurrency(record.netSalary)}</td>
                              <td className="p-3">
                                <Badge variant="outline" className={`${sConfig.color} ${sConfig.bgColor} gap-1 text-xs`}>
                                  {sConfig.icon}
                                  {sConfig.label}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => openEditDialog(record)}
                                    title="تعديل"
                                  >
                                    <Edit3 className="w-4 h-4 text-blue-600" />
                                  </Button>
                                  {record.status === 'معلق' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => {
                                        setMarkPaidTarget(record)
                                        setMarkPaidDialogOpen(true)
                                      }}
                                      title="تسجيل الدفع"
                                    >
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setDeleteTarget(record)
                                      setDeleteDialogOpen(true)
                                    }}
                                    title="حذف"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3 p-3">
                    {salaryRecords.map(record => {
                      const sConfig = statusConfig[record.status] || statusConfig['معلق']
                      return (
                        <Card key={record.id} className="border shadow-sm">
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-bold text-gray-900">{record.employee.name}</p>
                                <p className="text-xs text-gray-500">{record.employee.jobTitle} {record.employee.department ? `• ${record.employee.department}` : ''}</p>
                              </div>
                              <Badge variant="outline" className={`${sConfig.color} ${sConfig.bgColor} gap-1 text-xs`}>
                                {sConfig.icon}
                                {sConfig.label}
                              </Badge>
                            </div>

                            {/* Period */}
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Calendar className="w-3.5 h-3.5" />
                              {arabicMonths[record.month - 1]} {record.year}
                              {record.paymentDate && (
                                <span className="text-xs text-gray-400">
                                  • دفع: {new Date(record.paymentDate).toLocaleDateString('ar-EG')}
                                </span>
                              )}
                            </div>

                            <Separator />

                            {/* Financial Details */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">الأساسي:</span>
                                <span className="text-green-700 font-medium">{formatCurrency(record.basicSalary)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">البدلات:</span>
                                <span className="text-green-700">{formatCurrency(record.allowances)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">إضافي:</span>
                                <span className="text-green-700">{formatCurrency(record.overtime)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">مكافأة:</span>
                                <span className="text-green-700">{formatCurrency(record.bonus)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">الخصومات:</span>
                                <span className="text-red-600">{formatCurrency(record.deductions)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">السلف:</span>
                                <span className="text-red-600">{formatCurrency(record.advancePayment)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">التأمين:</span>
                                <span className="text-red-600">{formatCurrency(record.insurance)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">الضرائب:</span>
                                <span className="text-red-600">{formatCurrency(record.taxes)}</span>
                              </div>
                            </div>

                            <Separator />

                            {/* Net Salary & Actions */}
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm text-gray-500">الصافي: </span>
                                <span className="text-lg font-bold text-[#610000]">{formatCurrency(record.netSalary)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-9 gap-1"
                                  onClick={() => openEditDialog(record)}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  تعديل
                                </Button>
                                {record.status === 'معلق' && (
                                  <Button
                                    size="sm"
                                    className="h-9 gap-1 bg-green-700 hover:bg-green-800"
                                    onClick={() => {
                                      setMarkPaidTarget(record)
                                      setMarkPaidDialogOpen(true)
                                    }}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    دفع
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 text-red-500 hover:text-red-700"
                                  onClick={() => {
                                    setDeleteTarget(record)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Tab 2: إعداد الرواتب ===== */}
        <TabsContent value="prepare" className="space-y-4 mt-4">
          {/* Period Selection */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium">الشهر</Label>
                  <Select value={prepareMonth} onValueChange={setPrepareMonth}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {arabicMonths.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium">السنة</Label>
                  <Select value={prepareYear} onValueChange={setPrepareYear}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getYearOptions().map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="h-10 gap-1.5 bg-[#610000] hover:bg-[#4a0000] min-w-[180px]"
                  onClick={handleLoadPrepareData}
                  disabled={prepareLoading}
                >
                  {prepareLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  تحميل بيانات الموظفين
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Prepare Table */}
          {!prepareLoaded ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">إعداد رواتب شهر</p>
                <p className="text-sm">اختر الشهر والسنة ثم اضغط &quot;تحميل بيانات الموظفين&quot;</p>
              </CardContent>
            </Card>
          ) : prepareEntries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">لا يوجد موظفين نشطين</p>
                <p className="text-sm">أضف موظفين نشطين أولاً</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  عدد الموظفين: <span className="font-bold">{prepareEntries.length}</span>
                  {' | '}
                  سجلات جديدة: <span className="font-bold text-green-700">{prepareEntries.filter(e => !e.existing).length}</span>
                  {prepareEntries.some(e => e.existing) && (
                    <>
                      {' | '}
                      <span className="text-yellow-700">موجود مسبقاً: {prepareEntries.filter(e => e.existing).length}</span>
                    </>
                  )}
                </p>
                <Button
                  className="gap-1.5 bg-[#610000] hover:bg-[#4a0000]"
                  onClick={handleSaveAllPrepare}
                  disabled={prepareSaving || prepareEntries.filter(e => !e.existing).length === 0}
                >
                  {prepareSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  حفظ الكل
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  {/* Desktop Table */}
                  <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-right p-2.5 font-medium text-gray-600">الموظف</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">القسم</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">الأساسي</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">البدلات</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">الخصومات</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">إضافي</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">مكافأة</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">السلف</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">التأمين</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">الضرائب</th>
                          <th className="text-right p-2.5 font-medium text-gray-600 font-bold">الصافي</th>
                          <th className="text-right p-2.5 font-medium text-gray-600">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {prepareEntries.map((entry, idx) => (
                          <tr
                            key={entry.employeeId}
                            className={`hover:bg-gray-50 transition-colors ${entry.existing ? 'bg-yellow-50' : ''}`}
                          >
                            <td className="p-2.5">
                              <div>
                                <p className="font-medium text-gray-900">{entry.name}</p>
                                <p className="text-xs text-gray-500">{entry.jobTitle}</p>
                              </div>
                            </td>
                            <td className="p-2.5 text-gray-600">{entry.department || '-'}</td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.basicSalary}
                                onChange={e => updatePrepareEntry(idx, 'basicSalary', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-24"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.allowances}
                                onChange={e => updatePrepareEntry(idx, 'allowances', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-24"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.deductions}
                                onChange={e => updatePrepareEntry(idx, 'deductions', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-24"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.overtime}
                                onChange={e => updatePrepareEntry(idx, 'overtime', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-20"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.bonus}
                                onChange={e => updatePrepareEntry(idx, 'bonus', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-20"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.advancePayment}
                                onChange={e => updatePrepareEntry(idx, 'advancePayment', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-20"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.insurance}
                                onChange={e => updatePrepareEntry(idx, 'insurance', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-20"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5">
                              <Input
                                type="number"
                                value={entry.taxes}
                                onChange={e => updatePrepareEntry(idx, 'taxes', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm w-20"
                                disabled={entry.existing}
                              />
                            </td>
                            <td className="p-2.5 font-bold text-[#610000]">{formatCurrency(entry.netSalary)}</td>
                            <td className="p-2.5">
                              {entry.existing ? (
                                <Badge variant="outline" className="text-yellow-700 bg-yellow-100 border-yellow-300 text-xs">
                                  موجود
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-700 bg-green-100 border-green-300 text-xs">
                                  جديد
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2">
                        <tr className="font-bold">
                          <td className="p-2.5" colSpan={2}>الإجمالي</td>
                          <td className="p-2.5 text-green-700">{formatCurrency(prepareEntries.reduce((s, e) => s + e.basicSalary, 0))}</td>
                          <td className="p-2.5 text-green-700">{formatCurrency(prepareEntries.reduce((s, e) => s + e.allowances, 0))}</td>
                          <td className="p-2.5 text-red-600">{formatCurrency(prepareEntries.reduce((s, e) => s + e.deductions, 0))}</td>
                          <td className="p-2.5 text-green-700">{formatCurrency(prepareEntries.reduce((s, e) => s + e.overtime, 0))}</td>
                          <td className="p-2.5 text-green-700">{formatCurrency(prepareEntries.reduce((s, e) => s + e.bonus, 0))}</td>
                          <td className="p-2.5 text-red-600">{formatCurrency(prepareEntries.reduce((s, e) => s + e.advancePayment, 0))}</td>
                          <td className="p-2.5 text-red-600">{formatCurrency(prepareEntries.reduce((s, e) => s + e.insurance, 0))}</td>
                          <td className="p-2.5 text-red-600">{formatCurrency(prepareEntries.reduce((s, e) => s + e.taxes, 0))}</td>
                          <td className="p-2.5 text-[#610000]">{formatCurrency(prepareEntries.reduce((s, e) => s + e.netSalary, 0))}</td>
                          <td className="p-2.5"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="xl:hidden space-y-3 p-3">
                    {prepareEntries.map((entry, idx) => (
                      <Card
                        key={entry.employeeId}
                        className={`border shadow-sm ${entry.existing ? 'bg-yellow-50 border-yellow-200' : ''}`}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-gray-900">{entry.name}</p>
                              <p className="text-xs text-gray-500">{entry.jobTitle} {entry.department ? `• ${entry.department}` : ''}</p>
                            </div>
                            {entry.existing ? (
                              <Badge variant="outline" className="text-yellow-700 bg-yellow-100 border-yellow-300 text-xs">موجود</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-700 bg-green-100 border-green-300 text-xs">جديد</Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">الراتب الأساسي</Label>
                              <Input
                                type="number"
                                value={entry.basicSalary}
                                onChange={e => updatePrepareEntry(idx, 'basicSalary', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">البدلات</Label>
                              <Input
                                type="number"
                                value={entry.allowances}
                                onChange={e => updatePrepareEntry(idx, 'allowances', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">الخصومات</Label>
                              <Input
                                type="number"
                                value={entry.deductions}
                                onChange={e => updatePrepareEntry(idx, 'deductions', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">ساعات إضافية</Label>
                              <Input
                                type="number"
                                value={entry.overtime}
                                onChange={e => updatePrepareEntry(idx, 'overtime', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">مكافأة</Label>
                              <Input
                                type="number"
                                value={entry.bonus}
                                onChange={e => updatePrepareEntry(idx, 'bonus', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">السلف</Label>
                              <Input
                                type="number"
                                value={entry.advancePayment}
                                onChange={e => updatePrepareEntry(idx, 'advancePayment', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">التأمينات</Label>
                              <Input
                                type="number"
                                value={entry.insurance}
                                onChange={e => updatePrepareEntry(idx, 'insurance', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">الضرائب</Label>
                              <Input
                                type="number"
                                value={entry.taxes}
                                onChange={e => updatePrepareEntry(idx, 'taxes', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm"
                                disabled={entry.existing}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-gray-500">صافي الراتب:</span>
                            <span className="text-lg font-bold text-[#610000]">{formatCurrency(entry.netSalary)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Totals */}
                    <Card className="bg-gray-50 border-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-700">إجمالي الرواتب الصافية:</span>
                          <span className="text-xl font-bold text-[#610000]">
                            {formatCurrency(prepareEntries.reduce((s, e) => s + e.netSalary, 0))}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ===== Tab 3: الإحصائيات ===== */}
        <TabsContent value="statistics" className="space-y-4 mt-4">
          {/* Period Selection */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium">الشهر</Label>
                  <Select value={statsMonth} onValueChange={setStatsMonth}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {arabicMonths.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium">السنة</Label>
                  <Select value={statsYear} onValueChange={setStatsYear}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {getYearOptions().map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : statsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {renderStatCard(
                  'إجمالي الرواتب',
                  formatCurrency(statsData.totalNetSalary),
                  <Banknote className="w-5 h-5 text-white" />,
                  'bg-[#610000]',
                  `${statsData.total} سجل`
                )}
                {renderStatCard(
                  'المدفوع',
                  formatCurrency(statsData.totalNetSalary * (statsData.paidCount / Math.max(statsData.total, 1))),
                  <CheckCircle className="w-5 h-5 text-white" />,
                  'bg-green-700',
                  `${statsData.paidCount} سجل`
                )}
                {renderStatCard(
                  'المعلق',
                  formatCurrency(statsData.totalNetSalary * (statsData.pendingCount / Math.max(statsData.total, 1))),
                  <Clock className="w-5 h-5 text-white" />,
                  'bg-yellow-600',
                  `${statsData.pendingCount} سجل`
                )}
                {renderStatCard(
                  'الملغي',
                  formatCurrency(statsData.totalNetSalary * (statsData.cancelledCount / Math.max(statsData.total, 1))),
                  <XCircle className="w-5 h-5 text-white" />,
                  'bg-red-700',
                  `${statsData.cancelledCount} سجل`
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Income Breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-700" />
                      تفصيل الدخل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">الراتب الأساسي</span>
                      <span className="font-medium text-green-700">{formatCurrency(statsData.totalBasicSalary)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">البدلات</span>
                      <span className="font-medium text-green-700">{formatCurrency(statsData.totalAllowances)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">ساعات إضافية</span>
                      <span className="font-medium text-green-700">{formatCurrency(statsData.totalOvertime)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">المكافآت</span>
                      <span className="font-medium text-green-700">{formatCurrency(statsData.totalBonus)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-gray-900">إجمالي الدخل</span>
                      <span className="font-bold text-green-700">
                        {formatCurrency(statsData.totalBasicSalary + statsData.totalAllowances + statsData.totalOvertime + statsData.totalBonus)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Deductions Breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Minus className="w-4 h-4 text-red-600" />
                      تفصيل الخصومات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">الخصومات</span>
                      <span className="font-medium text-red-600">{formatCurrency(statsData.totalDeductions)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">السلف</span>
                      <span className="font-medium text-red-600">{formatCurrency(statsData.totalAdvancePayment)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">التأمينات</span>
                      <span className="font-medium text-red-600">{formatCurrency(statsData.totalInsurance)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">الضرائب</span>
                      <span className="font-medium text-red-600">{formatCurrency(statsData.totalTaxes)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-gray-900">إجمالي الخصومات</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(statsData.totalDeductions + statsData.totalAdvancePayment + statsData.totalInsurance + statsData.totalTaxes)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Department Breakdown & Top Employees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department Breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#610000]" />
                      الرواتب حسب القسم
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(departmentBreakdown).length === 0 ? (
                      <p className="text-center text-gray-400 py-4">لا توجد بيانات</p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {Object.entries(departmentBreakdown)
                          .sort(([, a], [, b]) => b.totalNet - a.totalNet)
                          .map(([dept, data]) => {
                            const maxNet = Math.max(...Object.values(departmentBreakdown).map(d => d.totalNet))
                            const percentage = maxNet > 0 ? (data.totalNet / maxNet) * 100 : 0
                            return (
                              <div key={dept} className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">{dept}</span>
                                  <div className="text-left">
                                    <span className="text-sm font-bold text-[#610000]">{formatCurrency(data.totalNet)}</span>
                                    <span className="text-xs text-gray-400 mr-2">({data.count} موظف)</span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-[#610000] h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Employees */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-[#610000]" />
                      أعلى الرواتب
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topEmployees.length === 0 ? (
                      <p className="text-center text-gray-400 py-4">لا توجد بيانات</p>
                    ) : (
                      <div className="space-y-3">
                        {topEmployees.map((record, idx) => (
                          <div key={record.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                              idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-500' : 'bg-gray-300'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{record.employee.name}</p>
                              <p className="text-xs text-gray-500">{record.employee.jobTitle}</p>
                            </div>
                            <span className="font-bold text-[#610000] text-sm">{formatCurrency(record.netSalary)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Methods Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#610000]" />
                    طرق الدفع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsRecords.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">لا توجد بيانات</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {paymentMethods.map(method => {
                        const methodRecords = statsRecords.filter(r => r.paymentMethod === method)
                        const methodTotal = methodRecords.reduce((s, r) => s + r.netSalary, 0)
                        const percentage = statsRecords.length > 0 ? (methodRecords.length / statsRecords.length) * 100 : 0
                        return (
                          <Card key={method} className="border">
                            <CardContent className="p-4 text-center">
                              <p className="text-sm font-medium text-gray-700 mb-1">{method}</p>
                              <p className="text-lg font-bold text-[#610000]">{methodRecords.length}</p>
                              <p className="text-xs text-gray-500">{formatCurrency(methodTotal)}</p>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div
                                  className="bg-[#610000] h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-400 mt-1">{percentage.toFixed(0)}%</p>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">لا توجد إحصائيات</p>
                <p className="text-sm">اختر الفترة لعرض الإحصائيات</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Edit Dialog ===== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              تعديل سجل الراتب
            </DialogTitle>
            <DialogDescription>
              {editTarget && `${editTarget.employee.name} - ${arabicMonths[editTarget.month - 1]} ${editTarget.year}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Financial Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">الراتب الأساسي</Label>
                <Input
                  type="number"
                  value={editForm.basicSalary as number}
                  onChange={e => setEditForm(prev => ({ ...prev, basicSalary: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">البدلات</Label>
                <Input
                  type="number"
                  value={editForm.allowances as number}
                  onChange={e => setEditForm(prev => ({ ...prev, allowances: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">ساعات إضافية</Label>
                <Input
                  type="number"
                  value={editForm.overtime as number}
                  onChange={e => setEditForm(prev => ({ ...prev, overtime: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">المكافآت</Label>
                <Input
                  type="number"
                  value={editForm.bonus as number}
                  onChange={e => setEditForm(prev => ({ ...prev, bonus: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">الخصومات</Label>
                <Input
                  type="number"
                  value={editForm.deductions as number}
                  onChange={e => setEditForm(prev => ({ ...prev, deductions: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">السلف</Label>
                <Input
                  type="number"
                  value={editForm.advancePayment as number}
                  onChange={e => setEditForm(prev => ({ ...prev, advancePayment: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">التأمينات</Label>
                <Input
                  type="number"
                  value={editForm.insurance as number}
                  onChange={e => setEditForm(prev => ({ ...prev, insurance: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">الضرائب</Label>
                <Input
                  type="number"
                  value={editForm.taxes as number}
                  onChange={e => setEditForm(prev => ({ ...prev, taxes: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
            </div>

            {/* Net Salary (auto-calculated) */}
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <span className="font-medium text-gray-700">صافي الراتب (تلقائي)</span>
              <span className="text-xl font-bold text-[#610000]">
                {formatCurrency(calculateNetSalary(editForm as Record<string, number>))}
              </span>
            </div>

            {/* Payment & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">طريقة الدفع</Label>
                <Select
                  value={editForm.paymentMethod as string}
                  onValueChange={v => setEditForm(prev => ({ ...prev, paymentMethod: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">الحالة</Label>
                <Select
                  value={editForm.status as string}
                  onValueChange={v => setEditForm(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salaryStatuses.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm">ملاحظات</Label>
              <Textarea
                value={editForm.notes as string}
                onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
              className="min-h-[44px]"
            >
              إلغاء
            </Button>
            <Button
              className="bg-[#610000] hover:bg-[#4a0000] min-h-[44px] gap-1.5"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف سجل الراتب الخاص بـ {deleteTarget?.employee.name}؟
              <br />
              لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="min-h-[44px]"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="min-h-[44px] gap-1.5"
            >
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Mark as Paid Dialog ===== */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              تأكيد الدفع
            </DialogTitle>
            <DialogDescription>
              هل تريد تسجيل الدفع لسجل الراتب الخاص بـ {markPaidTarget?.employee.name}؟
              <br />
              سيتم تحديث الحالة إلى &quot;مدفوع&quot; وتسجيل تاريخ الدفع.
            </DialogDescription>
          </DialogHeader>
          {markPaidTarget && (
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">صافي الراتب</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(markPaidTarget.netSalary)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {arabicMonths[markPaidTarget.month - 1]} {markPaidTarget.year}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setMarkPaidDialogOpen(false)}
              disabled={markingPaid}
              className="min-h-[44px]"
            >
              إلغاء
            </Button>
            <Button
              className="bg-green-700 hover:bg-green-800 min-h-[44px] gap-1.5"
              onClick={handleMarkAsPaid}
              disabled={markingPaid}
            >
              {markingPaid ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
