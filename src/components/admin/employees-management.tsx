'use client'

import React, { useState, useEffect } from 'react'
import {
  Plus, Edit, Trash2, Users, AlertCircle, X, Search,
  Phone, MapPin, Calendar, Eye, Briefcase, DollarSign,
  Building2, GraduationCap, Banknote, FileText, UserCheck,
  Clock, UserMinus, BarChart3, CreditCard, Hash
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
interface Employee {
  id: string
  schoolId: string
  employeeNumber: string
  name: string
  nationalId: string | null
  jobTitle: string
  department: string | null
  qualification: string | null
  specialization: string | null
  hireDate: string | null
  phone: string | null
  email: string | null
  address: string | null
  salary: number
  allowances: number
  deductions: number
  contractType: string
  status: string
  bankName: string | null
  bankAccount: string | null
  imageUrl: string | null
  notes: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

interface EmployeeForm {
  employeeNumber: string
  name: string
  nationalId: string
  jobTitle: string
  department: string
  qualification: string
  specialization: string
  hireDate: string
  phone: string
  email: string
  address: string
  salary: string
  allowances: string
  deductions: string
  contractType: string
  status: string
  bankName: string
  bankAccount: string
  notes: string
}

const defaultForm: EmployeeForm = {
  employeeNumber: '',
  name: '',
  nationalId: '',
  jobTitle: '',
  department: '',
  qualification: '',
  specialization: '',
  hireDate: '',
  phone: '',
  email: '',
  address: '',
  salary: '0',
  allowances: '0',
  deductions: '0',
  contractType: 'دائم',
  status: 'نشط',
  bankName: '',
  bankAccount: '',
  notes: '',
}

const statusColors: Record<string, string> = {
  'نشط': 'bg-green-100 text-green-700 border-green-200',
  'إجازة': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'مستقيل': 'bg-red-100 text-red-700 border-red-200',
}

const contractTypeColors: Record<string, string> = {
  'دائم': 'bg-blue-100 text-blue-700 border-blue-200',
  'مؤقت': 'bg-orange-100 text-orange-700 border-orange-200',
  'جزء وقت': 'bg-purple-100 text-purple-700 border-purple-200',
}

const DEPARTMENTS = [
  'التعليم',
  'الإدارة',
  'الشئون المالية',
  'الأمن والحراسة',
  'الصيانة',
  'النقل',
  'أخرى',
]

type TabKey = 'list' | 'add' | 'stats'

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'list', label: 'القائمة', icon: <Users className="w-4 h-4" /> },
  { key: 'add', label: 'إضافة موظف', icon: <Plus className="w-4 h-4" /> },
  { key: 'stats', label: 'الإحصائيات', icon: <BarChart3 className="w-4 h-4" /> },
]

export function EmployeesManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('list')
  const [form, setForm] = useState<EmployeeForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const { selectedSchoolId } = useAdminStore()

  // Fetch employees with cancelled flag pattern
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (searchQuery) params.set('search', searchQuery)
        if (filterDepartment !== 'all') params.set('department', filterDepartment)
        if (filterStatus !== 'all') params.set('status', filterStatus)
        const res = await fetch(`/api/employees?${params.toString()}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setEmployees(Array.isArray(data) ? data : [])
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل بيانات الموظفين')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    if (selectedSchoolId) {
      load()
    }
    return () => { cancelled = true }
  }, [selectedSchoolId, searchQuery, filterDepartment, filterStatus])

  // Auto-generate employee number for add form
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedSchoolId) return
      try {
        const res = await fetch(`/api/employees?schoolId=${selectedSchoolId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const count = Array.isArray(data) ? data.length : 0
          const nextNum = (count + 1).toString().padStart(4, '0')
          const year = new Date().getFullYear()
          setForm(prev => ({ ...prev, employeeNumber: `EMP-${year}-${nextNum}` }))
        }
      } catch {
        // silent fail - user can manually enter number
      }
    }
    if (activeTab === 'add' && !editId) {
      load()
    }
    return () => { cancelled = true }
  }, [selectedSchoolId, activeTab])

  const openEdit = (employee: Employee) => {
    setEditId(employee.id)
    setForm({
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      nationalId: employee.nationalId || '',
      jobTitle: employee.jobTitle,
      department: employee.department || '',
      qualification: employee.qualification || '',
      specialization: employee.specialization || '',
      hireDate: employee.hireDate ? employee.hireDate.split('T')[0] : '',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      salary: employee.salary.toString(),
      allowances: employee.allowances.toString(),
      deductions: employee.deductions.toString(),
      contractType: employee.contractType,
      status: employee.status,
      bankName: employee.bankName || '',
      bankAccount: employee.bankAccount || '',
      notes: employee.notes || '',
    })
    setDialogOpen(true)
  }

  const openView = (employee: Employee) => {
    setViewEmployee(employee)
    setViewDialogOpen(true)
  }

  const refreshEmployees = async () => {
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (searchQuery) params.set('search', searchQuery)
      if (filterDepartment !== 'all') params.set('department', filterDepartment)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`/api/employees?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحديث البيانات')
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.employeeNumber.trim() || !form.jobTitle.trim()) {
      toast.error('يرجى إدخال اسم الموظف ورقم الموظف والمسمى الوظيفي')
      return
    }
    setSaving(true)
    try {
      const body = {
        schoolId: selectedSchoolId,
        employeeNumber: form.employeeNumber,
        name: form.name,
        nationalId: form.nationalId || null,
        jobTitle: form.jobTitle,
        department: form.department || null,
        qualification: form.qualification || null,
        specialization: form.specialization || null,
        hireDate: form.hireDate || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        salary: parseFloat(form.salary) || 0,
        allowances: parseFloat(form.allowances) || 0,
        deductions: parseFloat(form.deductions) || 0,
        contractType: form.contractType,
        status: form.status,
        bankName: form.bankName || null,
        bankAccount: form.bankAccount || null,
        notes: form.notes || null,
      }

      const res = editId
        ? await fetch(`/api/employees/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث بيانات الموظف' : 'تم إضافة الموظف بنجاح')
        setDialogOpen(false)
        setEditId(null)
        setForm(defaultForm)
        refreshEmployees()
        if (!editId) {
          setActiveTab('list')
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (errData.error?.includes('already exists')) {
          toast.error('رقم الموظف موجود مسبقاً في هذه المدرسة')
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

  const handleAddForm = async () => {
    if (!form.name.trim() || !form.employeeNumber.trim() || !form.jobTitle.trim()) {
      toast.error('يرجى إدخال اسم الموظف ورقم الموظف والمسمى الوظيفي')
      return
    }
    setSaving(true)
    try {
      const body = {
        schoolId: selectedSchoolId,
        employeeNumber: form.employeeNumber,
        name: form.name,
        nationalId: form.nationalId || null,
        jobTitle: form.jobTitle,
        department: form.department || null,
        qualification: form.qualification || null,
        specialization: form.specialization || null,
        hireDate: form.hireDate || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        salary: parseFloat(form.salary) || 0,
        allowances: parseFloat(form.allowances) || 0,
        deductions: parseFloat(form.deductions) || 0,
        contractType: form.contractType,
        status: form.status,
        bankName: form.bankName || null,
        bankAccount: form.bankAccount || null,
        notes: form.notes || null,
      }

      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success('تم إضافة الموظف بنجاح')
        setForm(defaultForm)
        refreshEmployees()
        setActiveTab('list')
      } else {
        const errData = await res.json().catch(() => ({}))
        if (errData.error?.includes('already exists')) {
          toast.error('رقم الموظف موجود مسبقاً في هذه المدرسة')
        } else {
          toast.error('فشل في إضافة الموظف')
        }
      }
    } catch {
      toast.error('فشل في إضافة الموظف')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/employees/${id}?schoolId=${selectedSchoolId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الموظف بنجاح')
        refreshEmployees()
      } else {
        toast.error('فشل في حذف الموظف')
      }
    } catch {
      toast.error('فشل في حذف الموظف')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  // ===== Statistics calculations =====
  const totalEmployees = employees.length
  const activeEmployees = employees.filter(e => e.status === 'نشط').length
  const onLeaveEmployees = employees.filter(e => e.status === 'إجازة').length
  const resignedEmployees = employees.filter(e => e.status === 'مستقيل').length

  const departmentBreakdown = employees.reduce<Record<string, number>>((acc, e) => {
    const dept = e.department || 'غير محدد'
    acc[dept] = (acc[dept] || 0) + 1
    return acc
  }, {})

  const contractTypeBreakdown = employees.reduce<Record<string, number>>((acc, e) => {
    acc[e.contractType] = (acc[e.contractType] || 0) + 1
    return acc
  }, {})

  const totalSalaries = employees.reduce((sum, e) => sum + e.salary, 0)
  const totalAllowances = employees.reduce((sum, e) => sum + e.allowances, 0)
  const totalDeductions = employees.reduce((sum, e) => sum + e.deductions, 0)

  // ===== Form Section Component =====
  const renderFormFields = (isDialog: boolean = false) => (
    <div className="space-y-6">
      {/* البيانات الأساسية */}
      <Card className={isDialog ? 'border-0 shadow-none' : ''}>
        <CardHeader className={isDialog ? 'px-0 pt-0 pb-2' : 'pb-2'}>
          <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#610000]" />
            البيانات الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className={isDialog ? 'px-0 pb-0' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>رقم الموظف *</Label>
              <Input
                value={form.employeeNumber}
                onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="مثال: EMP-2025-0001"
                dir="ltr"
              />
            </div>
            <div>
              <Label>اسم الموظف *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="الاسم بالكامل"
              />
            </div>
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
              <Label>المسمى الوظيفي *</Label>
              <Input
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="مثال: معلم، إداري، محاسب"
              />
            </div>
            <div>
              <Label>القسم</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger className="h-11 mt-1.5">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون قسم</SelectItem>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المؤهل</Label>
              <Input
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="مثال: بكالوريوس تربية"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>التخصص</Label>
              <Input
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="مثال: لغة عربية، رياضيات"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* بيانات الاتصال */}
      <Card className={isDialog ? 'border-0 shadow-none' : ''}>
        <CardHeader className={isDialog ? 'px-0 pt-0 pb-2' : 'pb-2'}>
          <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#009688]" />
            بيانات الاتصال
          </CardTitle>
        </CardHeader>
        <CardContent className={isDialog ? 'px-0 pb-0' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>الهاتف</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="رقم الهاتف"
                dir="ltr"
              />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="example@email.com"
                dir="ltr"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>العنوان</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="عنوان السكن"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* البيانات المالية */}
      <Card className={isDialog ? 'border-0 shadow-none' : ''}>
        <CardHeader className={isDialog ? 'px-0 pt-0 pb-2' : 'pb-2'}>
          <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            البيانات المالية
          </CardTitle>
        </CardHeader>
        <CardContent className={isDialog ? 'px-0 pb-0' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>الراتب الأساسي</Label>
              <Input
                type="number"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div>
              <Label>البدلات</Label>
              <Input
                type="number"
                value={form.allowances}
                onChange={(e) => setForm({ ...form, allowances: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div>
              <Label>الخصومات</Label>
              <Input
                type="number"
                value={form.deductions}
                onChange={(e) => setForm({ ...form, deductions: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="0"
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <Label>نوع العقد</Label>
              <Select value={form.contractType} onValueChange={(v) => setForm({ ...form, contractType: v })}>
                <SelectTrigger className="h-11 mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="دائم">دائم</SelectItem>
                  <SelectItem value="مؤقت">مؤقت</SelectItem>
                  <SelectItem value="جزء وقت">جزء وقت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>البنك</Label>
              <Input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="اسم البنك"
              />
            </div>
            <div>
              <Label>رقم الحساب البنكي</Label>
              <Input
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                className="h-11 mt-1.5"
                placeholder="رقم الحساب"
                dir="ltr"
              />
            </div>
          </div>
          {/* Net salary preview */}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-700 font-medium">صافي الراتب المتوقع:</span>
              <span className="text-green-800 font-bold text-lg">
                {((parseFloat(form.salary) || 0) + (parseFloat(form.allowances) || 0) - (parseFloat(form.deductions) || 0)).toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* أخرى */}
      <Card className={isDialog ? 'border-0 shadow-none' : ''}>
        <CardHeader className={isDialog ? 'px-0 pt-0 pb-2' : 'pb-2'}>
          <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            أخرى
          </CardTitle>
        </CardHeader>
        <CardContent className={isDialog ? 'px-0 pb-0' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>تاريخ التعيين</Label>
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-11 mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نشط">نشط</SelectItem>
                  <SelectItem value="إجازة">إجازة</SelectItem>
                  <SelectItem value="مستقيل">مستقيل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label>ملاحظات</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1.5"
              placeholder="أي ملاحظات إضافية..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-[#610000]" />
          إدارة الموظفين
          <Badge variant="secondary" className="mr-2">{employees.length} موظف</Badge>
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key)
              if (tab.key === 'add') {
                setEditId(null)
                setForm(defaultForm)
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium transition-all min-h-[44px] flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-white text-[#610000] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: القائمة */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث بالاسم أو رقم الموظف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 h-10"
                  />
                </div>
                {/* Department Filter */}
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Status Filter */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="نشط">نشط</SelectItem>
                    <SelectItem value="إجازة">إجازة</SelectItem>
                    <SelectItem value="مستقيل">مستقيل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Employee Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-lg">لا يوجد موظفون مسجلون</p>
                <p className="text-gray-300 text-sm mt-1">اضغط على &quot;إضافة موظف&quot; لبدء تسجيل الموظفين</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className="hover:shadow-md transition-shadow border-r-4"
                  style={{ borderRightColor: employee.status === 'نشط' ? '#16a34a' : employee.status === 'إجازة' ? '#ca8a04' : '#dc2626' }}
                >
                  <CardContent className="p-4">
                    {/* Employee Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center text-white text-lg font-bold shrink-0">
                        {employee.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#1a1a2e] truncate">{employee.name}</h3>
                        <p className="text-[#610000] font-mono text-xs">{employee.employeeNumber}</p>
                      </div>
                      <Badge className={`text-xs ${statusColors[employee.status] || 'bg-gray-100 text-gray-600'}`} variant="outline">
                        {employee.status}
                      </Badge>
                    </div>

                    {/* Employee Details */}
                    <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{employee.jobTitle}</span>
                      </div>
                      {employee.department && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{employee.department}</span>
                        </div>
                      )}
                      {employee.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span dir="ltr" className="truncate">{employee.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Contract Type Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={`text-xs ${contractTypeColors[employee.contractType] || 'bg-gray-100 text-gray-600'}`} variant="outline">
                        {employee.contractType}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 border-t pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 flex-1 min-h-[44px] text-xs"
                        onClick={() => openView(employee)}
                      >
                        <Eye className="w-3.5 h-3.5 ml-1" />
                        عرض
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 flex-1 min-h-[44px] text-xs text-blue-600"
                        onClick={() => openEdit(employee)}
                      >
                        <Edit className="w-3.5 h-3.5 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 flex-1 min-h-[44px] text-xs text-red-600"
                        onClick={() => { setDeleteTarget(employee.id); setDeleteDialogOpen(true) }}
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
        </div>
      )}

      {/* Tab: إضافة موظف */}
      {activeTab === 'add' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#610000] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1a1a2e]">إضافة موظف جديد</h3>
                  <p className="text-sm text-gray-500">أدخل بيانات الموظف الجديد</p>
                </div>
              </div>
              {renderFormFields(false)}
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => { setActiveTab('list'); setForm(defaultForm) }}
                  className="min-h-[44px]"
                >
                  <X className="w-4 h-4 ml-1" />
                  إلغاء
                </Button>
                <Button
                  onClick={handleAddForm}
                  disabled={saving}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {saving ? 'جاري الحفظ...' : 'إضافة الموظف'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: الإحصائيات */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-r-4 border-r-[#610000]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">إجمالي الموظفين</p>
                    <p className="text-2xl font-bold text-[#1a1a2e]">{totalEmployees}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#610000]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#610000]" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">نشط</p>
                    <p className="text-2xl font-bold text-green-700">{activeEmployees}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-yellow-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">إجازة</p>
                    <p className="text-2xl font-bold text-yellow-700">{onLeaveEmployees}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">مستقيل</p>
                    <p className="text-2xl font-bold text-red-700">{resignedEmployees}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <UserMinus className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department & Contract Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Department */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#610000]" />
                  حسب القسم
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(departmentBreakdown).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(departmentBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([dept, count]) => (
                        <div key={dept} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-700">{dept}</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 rounded-full bg-[#610000]"
                              style={{ width: `${Math.max(20, (count / totalEmployees) * 100)}px` }}
                            />
                            <Badge variant="secondary" className="text-xs">{count}</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Contract Type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#610000]" />
                  حسب نوع العقد
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(contractTypeBreakdown).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(contractTypeBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${contractTypeColors[type] || 'bg-gray-100 text-gray-600'}`} variant="outline">
                              {type}
                            </Badge>
                          </div>
                          <Badge variant="secondary" className="text-xs">{count}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financial Overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-[#1a1a2e] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#610000]" />
                نظرة مالية عامة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <Banknote className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-xs text-blue-600 mb-1">إجمالي الرواتب الأساسية</p>
                  <p className="text-lg font-bold text-blue-800">{totalSalaries.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                  <Plus className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-xs text-green-600 mb-1">إجمالي البدلات</p>
                  <p className="text-lg font-bold text-green-800">{totalAllowances.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                  <UserMinus className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-xs text-red-600 mb-1">إجمالي الخصومات</p>
                  <p className="text-lg font-bold text-red-800">{totalDeductions.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="p-4 bg-[#610000]/5 border border-[#610000]/20 rounded-xl text-center">
                  <DollarSign className="w-6 h-6 text-[#610000] mx-auto mb-2" />
                  <p className="text-xs text-[#610000] mb-1">صافي الرواتب</p>
                  <p className="text-lg font-bold text-[#610000]">{(totalSalaries + totalAllowances - totalDeductions).toLocaleString('ar-EG')} ج.م</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
            <DialogDescription>
              تعديل بيانات الموظف المسجل
            </DialogDescription>
          </DialogHeader>
          {renderFormFields(true)}
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
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Employee Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#610000]" />
              بيانات الموظف
            </DialogTitle>
          </DialogHeader>
          {viewEmployee && (
            <div className="space-y-4 mt-2">
              {/* Header */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {viewEmployee.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#1a1a2e]">{viewEmployee.name}</h3>
                  <p className="text-[#610000] font-mono text-sm">رقم الموظف: {viewEmployee.employeeNumber}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className={`text-xs ${statusColors[viewEmployee.status] || 'bg-gray-100 text-gray-600'}`} variant="outline">
                      {viewEmployee.status}
                    </Badge>
                    <Badge className={`text-xs ${contractTypeColors[viewEmployee.contractType] || 'bg-gray-100 text-gray-600'}`} variant="outline">
                      {viewEmployee.contractType}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* البيانات الأساسية */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-[#1a1a2e] flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-[#610000]" />
                    البيانات الأساسية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">المسمى الوظيفي</span>
                      <span className="font-medium">{viewEmployee.jobTitle}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">القسم</span>
                      <span className="font-medium">{viewEmployee.department || '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">الرقم القومي</span>
                      <span className="font-medium" dir="ltr">{viewEmployee.nationalId || '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">تاريخ التعيين</span>
                      <span className="font-medium">{viewEmployee.hireDate ? new Date(viewEmployee.hireDate).toLocaleDateString('ar-EG') : '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">المؤهل</span>
                      <span className="font-medium">{viewEmployee.qualification || '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">التخصص</span>
                      <span className="font-medium">{viewEmployee.specialization || '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* بيانات الاتصال */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-[#1a1a2e] flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#009688]" />
                    بيانات الاتصال
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">الهاتف</span>
                      <span className="font-medium" dir="ltr">{viewEmployee.phone || '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">البريد الإلكتروني</span>
                      <span className="font-medium" dir="ltr">{viewEmployee.email || '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                      <span className="text-gray-400 block text-xs mb-1">العنوان</span>
                      <span className="font-medium">{viewEmployee.address || '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* البيانات المالية */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-[#1a1a2e] flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                    البيانات المالية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-400 block text-xs mb-1">الراتب الأساسي</span>
                      <span className="font-bold text-blue-800">{viewEmployee.salary.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <span className="text-green-400 block text-xs mb-1">البدلات</span>
                      <span className="font-bold text-green-800">{viewEmployee.allowances.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <span className="text-red-400 block text-xs mb-1">الخصومات</span>
                      <span className="font-bold text-red-800">{viewEmployee.deductions.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="p-3 bg-[#610000]/5 border border-[#610000]/20 rounded-lg">
                      <span className="text-[#610000] block text-xs mb-1">صافي الراتب</span>
                      <span className="font-bold text-[#610000]">{(viewEmployee.salary + viewEmployee.allowances - viewEmployee.deductions).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">البنك</span>
                      <span className="font-medium">{viewEmployee.bankName || '—'}</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-400 block text-xs mb-1">رقم الحساب البنكي</span>
                      <span className="font-medium" dir="ltr">{viewEmployee.bankAccount || '—'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {viewEmployee.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <span className="text-amber-600 block text-xs mb-1">ملاحظات</span>
                  <span className="text-amber-800">{viewEmployee.notes}</span>
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
            <DialogDescription>هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
