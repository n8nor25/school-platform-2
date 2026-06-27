'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Search, Receipt, AlertCircle, Loader2,
  Printer, CheckCircle2, XCircle, Eye, Wallet, Banknote, FileText,
  CreditCard, Calendar, BarChart3, TrendingUp, CheckCheck, Clock,
  Building,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
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
import {
  resolveSchool, formatCurrency, formatDate, getStatusColor,
  PAYMENT_METHOD_ICONS, PAYMENT_METHODS, EXPENSE_STATUSES,
} from '@/lib/expense-utils'

interface Expense {
  id: string
  title: string
  amount: number
  expenseDate: string
  paymentMethod: string
  recipient: string | null
  reference: string | null
  checkNumber: string | null
  bankName: string | null
  checkDate: string | null
  notes: string | null
  status: string
  createdBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  category: { id: string; name: string; color: string | null; icon: string | null } | null
  vendor: { id: string; name: string; type: string | null } | null
  approvals?: Array<{
    id: string
    action: string
    approverName: string
    notes: string | null
    approvedAt: string
  }>
}

interface Category {
  id: string
  name: string
  color: string | null
}

interface Vendor {
  id: string
  name: string
  type: string | null
}

interface ExpenseForm {
  title: string
  amount: string
  expenseDate: string
  categoryId: string
  vendorId: string
  paymentMethod: string
  recipient: string
  reference: string
  checkNumber: string
  bankName: string
  checkDate: string
  notes: string
  status: string
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const defaultForm: ExpenseForm = {
  title: '',
  amount: '',
  expenseDate: todayStr(),
  categoryId: '',
  vendorId: '',
  paymentMethod: 'نقدي',
  recipient: '',
  reference: '',
  checkNumber: '',
  bankName: '',
  checkDate: '',
  notes: '',
  status: 'مدفوع',
}

export function ExpensesManagement() {
  const { selectedSchoolId, adminUser } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  // Lists
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [listLoading, setListLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [vendorId, setVendorId] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Form
  const [form, setForm] = useState<ExpenseForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // View dialog
  const [viewExpense, setViewExpense] = useState<Expense | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Approval dialog
  const [approvalTarget, setApprovalTarget] = useState<Expense | null>(null)
  const [approvalAction, setApprovalAction] = useState<'اعتماد' | 'رفض' | 'طلب تعديل'>('اعتماد')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [approverName, setApproverName] = useState('')
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approving, setApproving] = useState(false)

  // Stats
  const [stats, setStats] = useState<{
    summary?: { total: number; count: number; byCategory: Array<{ category: { name: string; color: string | null }; amount: number; count: number }>; byPaymentMethod: Array<{ paymentMethod: string; amount: number; count: number }>; byStatus: Array<{ status: string; amount: number; count: number }> }
    monthly?: Array<{ month: number; total: number; count: number }>
    vendors?: Array<{ vendor: { id: string; name: string }; totalAmount: number; count: number }>
  }>({})
  const [statsLoading, setStatsLoading] = useState(false)

  const [activeTab, setActiveTab] = useState('list')

  // Load categories & vendors once
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [catsRes, vensRes] = await Promise.all([
          fetch(`/api/expense-categories?schoolId=${schoolId}`),
          fetch(`/api/expense-vendors?schoolId=${schoolId}`),
        ])
        if (!cancelled) {
          if (catsRes.ok) {
            const c = await catsRes.json()
            setCategories(Array.isArray(c.categories) ? c.categories : [])
          }
          if (vensRes.ok) {
            const v = await vensRes.json()
            setVendors(Array.isArray(v.vendors) ? v.vendors : [])
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التصنيفات والموردين')
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  // Load expenses
  const fetchExpenses = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setListLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (search.trim()) params.set('search', search.trim())
        if (categoryId !== 'all') params.set('categoryId', categoryId)
        if (vendorId !== 'all') params.set('vendorId', vendorId)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (paymentMethodFilter !== 'all') params.set('paymentMethod', paymentMethodFilter)
        if (fromDate) params.set('fromDate', fromDate)
        if (toDate) params.set('toDate', toDate)
        const res = await fetch(`/api/expenses?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
          } else {
            toast.error('فشل في تحميل المصروفات')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل المصروفات')
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, search, categoryId, vendorId, statusFilter, paymentMethodFilter, fromDate, toDate])

  useEffect(() => fetchExpenses(), [fetchExpenses])

  // Load stats when on stats tab
  const fetchStats = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setStatsLoading(true)
        const now = new Date()
        const yearStart = `${now.getFullYear()}-01-01`
        const yearEnd = `${now.getFullYear()}-12-31`
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const monthEnd = todayStr()

        const [summaryRes, monthlyRes, vendorsRes] = await Promise.all([
          fetch(`/api/expense-reports?type=summary&schoolId=${schoolId}&fromDate=${yearStart}&toDate=${yearEnd}`),
          fetch(`/api/expense-reports?type=monthly&schoolId=${schoolId}&year=${now.getFullYear()}`),
          fetch(`/api/expense-reports?type=vendor-summary&schoolId=${schoolId}&fromDate=${yearStart}&toDate=${yearEnd}`),
        ])
        if (!cancelled) {
          const summaryData = summaryRes.ok ? await summaryRes.json() : null
          const monthlyData = monthlyRes.ok ? await monthlyRes.json() : null
          const vendorsData = vendorsRes.ok ? await vendorsRes.json() : null
          setStats({
            summary: summaryData?.summary,
            monthly: monthlyData?.monthly,
            vendors: vendorsData?.vendors,
          })
          // Save month summary separately
          if (summaryData?.summary) {
            const monthSummaryRes = await fetch(`/api/expense-reports?type=summary&schoolId=${schoolId}&fromDate=${monthStart}&toDate=${monthEnd}`)
            if (monthSummaryRes.ok) {
              const ms = await monthSummaryRes.json()
              if (!cancelled) setStats((prev) => ({ ...prev, monthSummary: ms.summary }))
            }
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الإحصائيات')
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  useEffect(() => {
    if (activeTab === 'stats') fetchStats()
  }, [activeTab, fetchStats])

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (e: Expense) => {
    setEditId(e.id)
    setForm({
      title: e.title,
      amount: String(e.amount),
      expenseDate: new Date(e.expenseDate).toISOString().slice(0, 10),
      categoryId: e.category?.id || '',
      vendorId: e.vendor?.id || '',
      paymentMethod: e.paymentMethod || 'نقدي',
      recipient: e.recipient || '',
      reference: e.reference || '',
      checkNumber: e.checkNumber || '',
      bankName: e.bankName || '',
      checkDate: e.checkDate ? new Date(e.checkDate).toISOString().slice(0, 10) : '',
      notes: e.notes || '',
      status: e.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount || !form.expenseDate) {
      toast.error('العنوان والمبلغ والتاريخ مطلوبة')
      return
    }
    const amt = Number(form.amount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('المبلغ غير صالح')
      return
    }
    if (form.paymentMethod === 'شيك' && !form.checkNumber.trim()) {
      toast.error('رقم الشيك مطلوب لطريقة الدفع بالشيك')
      return
    }
    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        amount: amt,
        expenseDate: form.expenseDate,
        categoryId: form.categoryId || null,
        vendorId: form.vendorId || null,
        paymentMethod: form.paymentMethod,
        recipient: form.recipient || null,
        reference: form.reference || null,
        checkNumber: form.paymentMethod === 'شيك' ? form.checkNumber || null : null,
        bankName: form.paymentMethod === 'شيك' ? form.bankName || null : null,
        checkDate: form.paymentMethod === 'شيك' && form.checkDate ? form.checkDate : null,
        notes: form.notes || null,
        status: form.status,
        createdBy: adminUser?.username || null,
      }
      const url = editId
        ? `/api/expenses/${editId}?schoolId=${schoolId}`
        : `/api/expenses?schoolId=${schoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث المصروف' : 'تم تسجيل المصروف بنجاح')
        setDialogOpen(false)
        if (!editId) {
          setForm(defaultForm)
          setActiveTab('list')
        }
        fetchExpenses()
      } else {
        toast.error(data.error || 'فشل في حفظ المصروف')
      }
    } catch {
      toast.error('فشل في حفظ المصروف')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/expenses/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف المصروف')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchExpenses()
      } else {
        toast.error(data.error || 'فشل في حذف المصروف')
      }
    } catch {
      toast.error('فشل في حذف المصروف')
    } finally {
      setDeleting(false)
    }
  }

  const openApproval = (e: Expense, action: 'اعتماد' | 'رفض' | 'طلب تعديل') => {
    setApprovalTarget(e)
    setApprovalAction(action)
    setApprovalNotes('')
    setApproverName(adminUser?.username || '')
    setApprovalOpen(true)
  }

  const handleApprove = async () => {
    if (!approvalTarget) return
    if (!approverName.trim()) {
      toast.error('اسم المعتمد مطلوب')
      return
    }
    setApproving(true)
    try {
      const res = await fetch(
        `/api/expenses/${approvalTarget.id}/approve?schoolId=${schoolId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: approvalAction,
            notes: approvalNotes || null,
            approverName: approverName.trim(),
            approverId: adminUser?.id || null,
            approverRole: adminUser?.role || null,
          }),
        }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success(`تم ${approvalAction} المصروف`)
        setApprovalOpen(false)
        fetchExpenses()
      } else {
        toast.error(data.error || 'فشل في تسجيل الاعتماد')
      }
    } catch {
      toast.error('فشل في تسجيل الاعتماد')
    } finally {
      setApproving(false)
    }
  }

  const printExpense = (e: Expense) => {
    setViewExpense(e)
    setViewOpen(true)
    setTimeout(() => window.print(), 300)
  }

  // Summary chips
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const totalCount = expenses.length
  const paidCount = expenses.filter((e) => e.status === 'مدفوع').length
  const pendingCount = expenses.filter((e) => e.status === 'معلق' || e.status === 'مسودة').length

  // Approvals list: معلق or مسودة
  const approvalsList = expenses.filter(
    (e) => e.status === 'معلق' || e.status === 'مسودة'
  )

  // Stats charts data
  const monthSummary = (stats as { monthSummary?: { total: number; count: number } }).monthSummary
  const totalThisMonth = monthSummary?.total || 0
  const totalThisYear = stats.summary?.total || 0
  const countThisMonth = monthSummary?.count || 0
  const totalThisYearCount = stats.summary?.count || 0
  const avgPerDay = totalThisYearCount > 0
    ? Math.round(totalThisYear / 365)
    : 0

  // Last 6 months bar chart
  const last6Months = (stats.monthly || []).slice(-6).map((m) => ({
    name: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][m.month - 1] || `ش${m.month}`,
    المبلغ: m.total,
  }))

  // Pie chart by category
  const pieData = (stats.summary?.byCategory || [])
    .filter((c) => c.amount > 0)
    .slice(0, 8)
    .map((c) => ({
      name: c.category.name,
      value: c.amount,
      color: c.category.color || '#610000',
    }))

  // Top 5 vendors
  const topVendors = (stats.vendors || []).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Receipt className="w-5 h-5 text-[#610000]" />
          إدارة المصروفات والنفقات
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Receipt className="w-4 h-4 ml-1" /> القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> تسجيل مصروف
          </TabsTrigger>
          <TabsTrigger value="approvals" className="data-[state=active]:bg-white">
            <CheckCheck className="w-4 h-4 ml-1" /> الاعتمادات
            {approvalsList.length > 0 && (
              <Badge className="bg-[#610000] text-white ml-1 text-xs">
                {approvalsList.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 ml-1" /> إحصائيات
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="relative flex-1 min-w-[200px]">
                  <Label className="text-xs">بحث</Label>
                  <Search className="absolute right-3 top-[60%] -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="العنوان أو المستلم أو المرجع..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">التصنيف</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل التصنيفات</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">المورد</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الموردين</SelectItem>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[120px]">
                  <Label className="text-xs">الحالة</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {EXPENSE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[120px]">
                  <Label className="text-xs">طريقة الدفع</Label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[150px]">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="min-w-[150px]">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setCategoryId('all')
                    setVendorId('all')
                    setStatusFilter('all')
                    setPaymentMethodFilter('all')
                    setFromDate('')
                    setToDate('')
                  }}
                  className="min-h-[44px]"
                >
                  إعادة تعيين
                </Button>
                <Button
                  onClick={openAdd}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px] mr-auto"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  تسجيل مصروف
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">إجمالي المبلغ</p>
                <p className="text-lg font-bold text-[#610000] font-mono">
                  {formatCurrency(totalAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">عدد المصروفات</p>
                <p className="text-lg font-bold text-gray-800 font-mono">{totalCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">المدفوعة</p>
                <p className="text-lg font-bold text-sky-600 font-mono">{paidCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">المعلقة</p>
                <p className="text-lg font-bold text-amber-600 font-mono">{pendingCount}</p>
              </CardContent>
            </Card>
          </div>

          {listLoading && expenses.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد مصروفات مسجلة بهذه الفلاتر.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>التاريخ</TableHead>
                        <TableHead>العنوان</TableHead>
                        <TableHead>المورد/المستلم</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead>المرجع</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((e) => {
                        const sc = getStatusColor(e.status)
                        return (
                          <TableRow key={e.id} className="hover:bg-gray-50">
                            <TableCell>
                              <span className="font-mono text-sm text-gray-700" dir="ltr">
                                {formatDate(e.expenseDate)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800">{e.title}</span>
                                {e.category && (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: `${e.category.color || '#610000'}15`,
                                      color: e.category.color || '#610000',
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: e.category.color || '#610000' }}
                                    />
                                    {e.category.name}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {e.vendor ? (
                                <span className="text-sm text-gray-700 inline-flex items-center gap-1">
                                  <Building className="w-3 h-3 text-gray-400" />
                                  {e.vendor.name}
                                </span>
                              ) : e.recipient ? (
                                <span className="text-sm text-gray-700">{e.recipient}</span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-[#610000]">
                                {formatCurrency(e.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                                {PAYMENT_METHOD_ICONS[e.paymentMethod]}
                                {e.paymentMethod}
                              </span>
                            </TableCell>
                            <TableCell>
                              {e.reference ? (
                                <span className="font-mono text-xs text-gray-600" dir="ltr">
                                  {e.reference}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {e.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setViewExpense(e)
                                    setViewOpen(true)
                                  }}
                                  className="h-9 w-9 text-sky-600 hover:bg-sky-50"
                                  title="عرض"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => printExpense(e)}
                                  className="h-9 w-9 text-gray-600 hover:bg-gray-100"
                                  title="طباعة"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
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
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Add Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#610000]" />
                تسجيل مصروف جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>عنوان المصروف <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="مثال: فاتورة كهرباء - أكتوبر"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>المبلغ <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>التاريخ <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>التصنيف</Label>
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => setForm({ ...form, categoryId: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر التصنيف..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>المورد</Label>
                  <Select
                    value={form.vendorId}
                    onValueChange={(v) => setForm({ ...form, vendorId: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="بدون مورد..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>طريقة الدفع</Label>
                  <Select
                    value={form.paymentMethod}
                    onValueChange={(v) => setForm({ ...form, paymentMethod: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>الحالة</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>المستلم</Label>
                  <Input
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                    placeholder="اسم المستلم"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>المرجع</Label>
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="رقم الفاتورة أو المرجع"
                    className="h-11"
                    dir="ltr"
                  />
                </div>

                {/* Check fields (only when paymentMethod = شيك) */}
                {form.paymentMethod === 'شيك' && (
                  <>
                    <div className="space-y-1.5">
                      <Label>رقم الشيك <span className="text-red-500">*</span></Label>
                      <Input
                        value={form.checkNumber}
                        onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                        placeholder="000000"
                        className="h-11"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>البنك</Label>
                      <Input
                        value={form.bankName}
                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                        placeholder="اسم البنك"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>تاريخ الشيك</Label>
                      <Input
                        type="date"
                        value={form.checkDate}
                        onChange={(e) => setForm({ ...form, checkDate: e.target.value })}
                        className="h-11"
                        dir="ltr"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="ملاحظات إضافية"
                />
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
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 ml-1" />
                  )}
                  حفظ المصروف
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">
                المصروفات بانتظار الاعتماد ({approvalsList.length})
              </p>
            </CardContent>
          </Card>

          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : approvalsList.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد مصروفات بانتظار الاعتماد.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {approvalsList.map((e) => {
                const sc = getStatusColor(e.status)
                return (
                  <Card key={e.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-800">{e.title}</span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {e.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="font-mono" dir="ltr">
                              {formatDate(e.expenseDate)}
                            </span>
                            {e.category && (
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: e.category.color || '#610000' }}
                                />
                                {e.category.name}
                              </span>
                            )}
                            {e.vendor && (
                              <span className="inline-flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {e.vendor.name}
                              </span>
                            )}
                            {e.createdBy && (
                              <span>طلب بواسطة: {e.createdBy}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-end">
                            <p className="text-xs text-gray-400">المبلغ</p>
                            <p className="font-mono font-bold text-[#610000]">
                              {formatCurrency(e.amount)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              onClick={() => openApproval(e, 'اعتماد')}
                              className="bg-green-600 hover:bg-green-700 text-white min-h-[36px]"
                            >
                              <CheckCircle2 className="w-4 h-4 ml-1" />
                              اعتماد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openApproval(e, 'رفض')}
                              className="text-red-600 border-red-200 hover:bg-red-50 min-h-[36px]"
                            >
                              <XCircle className="w-4 h-4 ml-1" />
                              رفض
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openApproval(e, 'طلب تعديل')}
                            className="text-amber-600 hover:bg-amber-50 min-h-[36px]"
                          >
                            <Edit className="w-4 h-4 ml-1" />
                            تعديل
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#610000]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي هذا الشهر</p>
                        <p className="text-lg font-bold text-[#610000] font-mono">
                          {formatCurrency(totalThisMonth)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي هذا العام</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {formatCurrency(totalThisYear)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">عدد مصروفات الشهر</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {countThisMonth}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">متوسط يومي (تقريبي)</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {formatCurrency(avgPerDay)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">آخر 6 أشهر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {last6Months.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        لا توجد بيانات
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={last6Months}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(v: number) => formatCurrency(v)}
                            contentStyle={{ direction: 'rtl' }}
                          />
                          <Bar dataKey="المبلغ" fill="#610000" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">المصروفات حسب التصنيف</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        لا توجد بيانات
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={(entry) => `${entry.name}: ${formatCurrency(entry.value as number)}`}
                            labelLine={false}
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Top 5 vendors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#610000]" />
                    أعلى 5 موردين إنفاقًا
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topVendors.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">لا توجد بيانات</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-center">#</TableHead>
                          <TableHead>المورد</TableHead>
                          <TableHead className="text-center">عدد المصروفات</TableHead>
                          <TableHead>إجمالي الإنفاق</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topVendors.map((v, i) => (
                          <TableRow key={v.vendor.id} className="hover:bg-gray-50">
                            <TableCell className="text-center font-mono text-gray-600">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-gray-800">{v.vendor.name}</span>
                            </TableCell>
                            <TableCell className="text-center font-mono">{v.count}</TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-[#610000]">
                                {formatCurrency(v.totalAmount)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>عنوان المصروف <span className="text-red-500">*</span></Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>المبلغ <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>التاريخ <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>التصنيف</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر التصنيف..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المورد</Label>
                <Select value={form.vendorId} onValueChange={(v) => setForm({ ...form, vendorId: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="بدون مورد..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المستلم</Label>
                <Input
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>المرجع</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
            </div>

            {form.paymentMethod === 'شيك' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-amber-50 rounded-lg">
                <div className="space-y-1.5">
                  <Label>رقم الشيك <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.checkNumber}
                    onChange={(e) => setForm({ ...form, checkNumber: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>البنك</Label>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ الشيك</Label>
                  <Input
                    type="date"
                    value={form.checkDate}
                    onChange={(e) => setForm({ ...form, checkDate: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {saving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'اعتماد' && 'اعتماد المصروف'}
              {approvalAction === 'رفض' && 'رفض المصروف'}
              {approvalAction === 'طلب تعديل' && 'طلب تعديل المصروف'}
            </DialogTitle>
            {approvalTarget && (
              <DialogDescription>
                المصروف: {approvalTarget.title} — {formatCurrency(approvalTarget.amount)}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم المعتمد <span className="text-red-500">*</span></Label>
              <Input
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
                placeholder="ملاحظات الاعتماد..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approving}
              className={`text-white min-h-[44px] ${
                approvalAction === 'اعتماد'
                  ? 'bg-green-600 hover:bg-green-700'
                  : approvalAction === 'رفض'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {approving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل المصروف</DialogTitle>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-4">
              <div className="bg-[#610000]/5 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-800">{viewExpense.title}</h3>
                  {(() => {
                    const sc = getStatusColor(viewExpense.status)
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {viewExpense.status}
                      </span>
                    )
                  })()}
                </div>
                <p className="text-2xl font-bold text-[#610000] font-mono">
                  {formatCurrency(viewExpense.amount)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">التاريخ</p>
                  <p className="font-mono" dir="ltr">{formatDate(viewExpense.expenseDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">طريقة الدفع</p>
                  <p className="inline-flex items-center gap-1.5">
                    {PAYMENT_METHOD_ICONS[viewExpense.paymentMethod]}
                    {viewExpense.paymentMethod}
                  </p>
                </div>
                {viewExpense.category && (
                  <div>
                    <p className="text-xs text-gray-400">التصنيف</p>
                    <p className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: viewExpense.category.color || '#610000' }}
                      />
                      {viewExpense.category.name}
                    </p>
                  </div>
                )}
                {viewExpense.vendor && (
                  <div>
                    <p className="text-xs text-gray-400">المورد</p>
                    <p>{viewExpense.vendor.name}</p>
                  </div>
                )}
                {viewExpense.recipient && (
                  <div>
                    <p className="text-xs text-gray-400">المستلم</p>
                    <p>{viewExpense.recipient}</p>
                  </div>
                )}
                {viewExpense.reference && (
                  <div>
                    <p className="text-xs text-gray-400">المرجع</p>
                    <p className="font-mono" dir="ltr">{viewExpense.reference}</p>
                  </div>
                )}
                {viewExpense.checkNumber && (
                  <div>
                    <p className="text-xs text-gray-400">رقم الشيك</p>
                    <p className="font-mono" dir="ltr">{viewExpense.checkNumber}</p>
                  </div>
                )}
                {viewExpense.bankName && (
                  <div>
                    <p className="text-xs text-gray-400">البنك</p>
                    <p>{viewExpense.bankName}</p>
                  </div>
                )}
                {viewExpense.approvedBy && (
                  <div>
                    <p className="text-xs text-gray-400">المعتمد بواسطة</p>
                    <p>{viewExpense.approvedBy}</p>
                  </div>
                )}
              </div>
              {viewExpense.notes && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                  <p className="text-sm bg-gray-50 rounded p-3">{viewExpense.notes}</p>
                </div>
              )}
              {viewExpense.approvals && viewExpense.approvals.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">سجل الاعتمادات</p>
                  <div className="space-y-2">
                    {viewExpense.approvals.map((a) => (
                      <div key={a.id} className="text-sm bg-gray-50 rounded p-2 flex justify-between">
                        <span className="font-medium">{a.action}</span>
                        <span className="text-gray-500">{a.approverName}</span>
                        <span className="font-mono text-xs text-gray-400" dir="ltr">
                          {formatDate(a.approvedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="min-h-[44px]"
                >
                  <Printer className="w-4 h-4 ml-1" />
                  طباعة
                </Button>
                <Button
                  onClick={() => setViewOpen(false)}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المصروف «{deleteTarget?.title}»؟
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
