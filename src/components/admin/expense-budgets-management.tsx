'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Plus, Edit, Trash2, AlertCircle, Loader2, Wallet, Target,
  TrendingUp, TrendingDown, PiggyBank, Calendar,
} from 'lucide-react'
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
import {
  resolveSchool, formatCurrency, BUDGET_PERIODS, PERIOD_COLORS,
  getArabicMonth, getBudgetProgressColor, getRemainingColor,
  TEST_ACADEMIC_YEAR_ID,
} from '@/lib/expense-utils'

interface Category {
  id: string
  name: string
  color: string | null
}

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

interface Budget {
  id: string
  amount: number
  period: string
  fiscalMonth: number | null
  fiscalQuarter: number | null
  notes: string | null
  academicYearId: string
  categoryId: string
  category: { id: string; name: string; color: string | null; icon: string | null } | null
  academicYear: { id: string; name: string } | null
  // compare=true extras:
  actualAmount?: number
  remaining?: number
  percentUsed?: number
  expenseCount?: number
}

interface BudgetForm {
  academicYearId: string
  categoryId: string
  period: string
  fiscalMonth: string
  fiscalQuarter: string
  amount: string
  notes: string
}

const defaultForm: BudgetForm = {
  academicYearId: '',
  categoryId: '',
  period: 'سنوي',
  fiscalMonth: '',
  fiscalQuarter: '',
  amount: '',
  notes: '',
}

export function ExpenseBudgetsManagement() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState<BudgetForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [activeTab, setActiveTab] = useState('list')
  const [compareYearId, setCompareYearId] = useState<string>('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareData, setCompareData] = useState<Budget[]>([])

  // Load categories & academic years
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [catsRes, yearsRes] = await Promise.all([
          fetch(`/api/expense-categories?schoolId=${schoolId}`),
          fetch(`/api/academic-years?schoolId=${schoolId}`),
        ])
        if (!cancelled) {
          if (catsRes.ok) {
            const c = await catsRes.json()
            setCategories(Array.isArray(c.categories) ? c.categories : [])
          }
          if (yearsRes.ok) {
            const y = await yearsRes.json()
            const arr = Array.isArray(y) ? y : []
            setAcademicYears(arr)
            // Pick the active year, or first year, or the test fallback
            const active = arr.find((a: AcademicYear) => a.isActive) || arr[0]
            const fallback = active?.id || TEST_ACADEMIC_YEAR_ID
            setCompareYearId(fallback)
            setForm((prev) => ({ ...prev, academicYearId: fallback }))
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التصنيفات والسنوات')
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  // Fetch budgets list (no compare)
  const fetchBudgets = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/expense-budgets?schoolId=${schoolId}`)
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setBudgets(Array.isArray(data.budgets) ? data.budgets : [])
          } else {
            toast.error('فشل في تحميل الميزانيات')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الميزانيات')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  useEffect(() => fetchBudgets(), [fetchBudgets])

  // Fetch comparison data when year is selected
  const fetchCompare = useCallback(() => {
    let cancelled = false
    const load = async () => {
      if (!compareYearId) {
        if (!cancelled) setCompareData([])
        return
      }
      try {
        setCompareLoading(true)
        const res = await fetch(
          `/api/expense-budgets?schoolId=${schoolId}&academicYearId=${compareYearId}&compare=true`
        )
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setCompareData(Array.isArray(data.budgets) ? data.budgets : [])
          } else {
            toast.error('فشل في تحميل المقارنة')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل المقارنة')
      } finally {
        if (!cancelled) setCompareLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, compareYearId])

  useEffect(() => fetchCompare(), [fetchCompare])

  const openAdd = () => {
    setEditId(null)
    setForm({
      ...defaultForm,
      academicYearId: compareYearId || academicYears.find((y) => y.isActive)?.id || academicYears[0]?.id || '',
    })
    setDialogOpen(true)
  }

  const openEdit = (b: Budget) => {
    setEditId(b.id)
    setForm({
      academicYearId: b.academicYearId,
      categoryId: b.categoryId,
      period: b.period,
      fiscalMonth: b.fiscalMonth ? String(b.fiscalMonth) : '',
      fiscalQuarter: b.fiscalQuarter ? String(b.fiscalQuarter) : '',
      amount: String(b.amount),
      notes: b.notes || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.academicYearId || !form.categoryId || !form.period || !form.amount) {
      toast.error('السنة والتصنيف والفترة والمبلغ مطلوبة')
      return
    }
    if (form.period === 'شهري' && !form.fiscalMonth) {
      toast.error('الشهر مطلوب للفترة الشهرية')
      return
    }
    if (form.period === 'ربعي' && !form.fiscalQuarter) {
      toast.error('الربع مطلوب للفترة الربعية')
      return
    }
    const amt = Number(form.amount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('المبلغ غير صالح')
      return
    }
    setSaving(true)
    try {
      const body = {
        academicYearId: form.academicYearId,
        categoryId: form.categoryId,
        period: form.period,
        fiscalMonth: form.period === 'شهري' ? Number(form.fiscalMonth) : null,
        fiscalQuarter: form.period === 'ربعي' ? Number(form.fiscalQuarter) : null,
        amount: amt,
        notes: form.notes || null,
      }
      const url = editId
        ? `/api/expense-budgets/${editId}?schoolId=${schoolId}`
        : `/api/expense-budgets?schoolId=${schoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث الميزانية' : 'تم إضافة الميزانية')
        setDialogOpen(false)
        fetchBudgets()
        fetchCompare()
        if (!editId) {
          setForm(defaultForm)
          setActiveTab('list')
        }
      } else if (res.status === 409) {
        toast.error(data.error || 'الميزانية مُسجلة بالفعل لهذه الفترة')
      } else {
        toast.error(data.error || 'فشل في حفظ البيانات')
      }
    } catch {
      toast.error('فشل في حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/expense-budgets/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف الميزانية')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchBudgets()
        fetchCompare()
      } else {
        toast.error(data.error || 'فشل في حذف الميزانية')
      }
    } catch {
      toast.error('فشل في حذف الميزانية')
    } finally {
      setDeleting(false)
    }
  }

  // Comparison summary
  const totalBudgeted = compareData.reduce((s, b) => s + b.amount, 0)
  const totalActual = compareData.reduce((s, b) => s + (b.actualAmount || 0), 0)
  const totalRemaining = totalBudgeted - totalActual
  const overallPercent = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0

  // Chart data
  const chartData = compareData
    .filter((b) => b.category)
    .map((b) => ({
      name: b.category?.name || 'غير مصنف',
      الميزانية: b.amount,
      الفعلي: b.actualAmount || 0,
    }))
    .slice(0, 12)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-[#610000]" />
          ميزانيات المصروفات
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <PiggyBank className="w-4 h-4 ml-1" /> الميزانيات
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة ميزانية
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-white">
            <Target className="w-4 h-4 ml-1" /> المقارنة الفعلية
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={openAdd}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة ميزانية
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد ميزانيات مسجلة.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>التصنيف</TableHead>
                        <TableHead>الفترة</TableHead>
                        <TableHead>السنة الدراسية</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map((b) => (
                        <TableRow key={b.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {b.category && (
                                <span
                                  className="inline-block w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: b.category.color || '#610000' }}
                                />
                              )}
                              <span className="font-medium text-gray-800">
                                {b.category?.name || 'غير مصنف'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${
                                  PERIOD_COLORS[b.period] || 'bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                              >
                                {b.period}
                              </span>
                              {b.period === 'شهري' && b.fiscalMonth && (
                                <span className="text-xs text-gray-500">
                                  {getArabicMonth(b.fiscalMonth)}
                                </span>
                              )}
                              {b.period === 'ربعي' && b.fiscalQuarter && (
                                <span className="text-xs text-gray-500">
                                  الربع {b.fiscalQuarter}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {b.academicYear?.name || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-bold text-[#610000]">
                              {formatCurrency(b.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(b)}
                                className="h-9 w-9 text-[#610000] hover:bg-[#610000]/10"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(b)
                                  setDeleteOpen(true)
                                }}
                                className="h-9 w-9 text-red-600 hover:bg-red-50"
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

        {/* Add Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#610000]" />
                إضافة ميزانية جديدة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>السنة الدراسية <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.academicYearId}
                    onValueChange={(v) => setForm({ ...form, academicYearId: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر السنة الدراسية..." />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isActive && '(نشطة)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>التصنيف <span className="text-red-500">*</span></Label>
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
                  <Label>الفترة <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.period}
                    onValueChange={(v) => setForm({
                      ...form,
                      period: v,
                      fiscalMonth: '',
                      fiscalQuarter: '',
                    })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_PERIODS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {form.period === 'شهري' && (
                  <div className="space-y-1.5">
                    <Label>الشهر <span className="text-red-500">*</span></Label>
                    <Select
                      value={form.fiscalMonth}
                      onValueChange={(v) => setForm({ ...form, fiscalMonth: v })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="اختر الشهر..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {getArabicMonth(i + 1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.period === 'ربعي' && (
                  <div className="space-y-1.5">
                    <Label>الربع <span className="text-red-500">*</span></Label>
                      <Select
                        value={form.fiscalQuarter}
                        onValueChange={(v) => setForm({ ...form, fiscalQuarter: v })}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="اختر الربع..." />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4].map((q) => (
                            <SelectItem key={q} value={String(q)}>
                              الربع {q}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
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
                  حفظ الميزانية
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[280px]">
                  <Label>السنة الدراسية</Label>
                  <Select
                    value={compareYearId}
                    onValueChange={setCompareYearId}
                  >
                    <SelectTrigger className="h-11 mt-1.5">
                      <SelectValue placeholder="اختر السنة الدراسية..." />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isActive && '(نشطة)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#610000]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي الميزانيات</p>
                    <p className="text-lg font-bold text-gray-800 font-mono">
                      {formatCurrency(totalBudgeted)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي المصروف الفعلي</p>
                    <p className="text-lg font-bold text-red-600 font-mono">
                      {formatCurrency(totalActual)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    totalRemaining >= 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {totalRemaining >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">المتبقي</p>
                    <p className={`text-lg font-bold font-mono ${getRemainingColor(totalRemaining)}`}>
                      {formatCurrency(totalRemaining)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Target className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">نسبة الاستهلاك</p>
                    <p className="text-lg font-bold text-gray-800 font-mono">
                      {overallPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">مقارنة الميزانية بالفعلي حسب التصنيف</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ direction: 'rtl' }}
                    />
                    <Legend />
                    <Bar dataKey="الميزانية" fill="#610000" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="الفعلي" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparison Table */}
          {compareLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : compareData.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد ميزانيات لهذه السنة الدراسية.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">جدول المقارنة التفصيلي</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>التصنيف</TableHead>
                        <TableHead>الفترة</TableHead>
                        <TableHead>الميزانية</TableHead>
                        <TableHead>الفعلي</TableHead>
                        <TableHead>المتبقي</TableHead>
                        <TableHead>نسبة الاستهلاك</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compareData.map((b) => {
                        const percent = b.percentUsed || 0
                        return (
                          <TableRow key={b.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {b.category && (
                                  <span
                                    className="inline-block w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: b.category.color || '#610000' }}
                                  />
                                )}
                                <span className="font-medium text-gray-800">
                                  {b.category?.name || 'غير مصنف'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-gray-600">{b.period}</span>
                                {b.fiscalMonth && (
                                  <span className="text-xs text-gray-400">{getArabicMonth(b.fiscalMonth)}</span>
                                )}
                                {b.fiscalQuarter && (
                                  <span className="text-xs text-gray-400">الربع {b.fiscalQuarter}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-gray-700">
                                {formatCurrency(b.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-red-600">
                                {formatCurrency(b.actualAmount || 0)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`font-mono font-bold ${getRemainingColor(b.remaining || 0)}`}>
                                {formatCurrency(b.remaining || 0)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[140px]">
                                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${getBudgetProgressColor(percent)}`}
                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-xs text-gray-600 min-w-[40px]">
                                  {percent.toFixed(0)}%
                                </span>
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
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>السنة الدراسية <span className="text-red-500">*</span></Label>
                <Select
                  value={form.academicYearId}
                  onValueChange={(v) => setForm({ ...form, academicYearId: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>التصنيف <span className="text-red-500">*</span></Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الفترة <span className="text-red-500">*</span></Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => setForm({
                    ...form,
                    period: v,
                    fiscalMonth: '',
                    fiscalQuarter: '',
                  })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              {form.period === 'شهري' && (
                <div className="space-y-1.5">
                  <Label>الشهر <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.fiscalMonth}
                    onValueChange={(v) => setForm({ ...form, fiscalMonth: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر الشهر..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {getArabicMonth(i + 1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.period === 'ربعي' && (
                <div className="space-y-1.5">
                  <Label>الربع <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.fiscalQuarter}
                    onValueChange={(v) => setForm({ ...form, fiscalQuarter: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر الربع..." />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((q) => (
                        <SelectItem key={q} value={String(q)}>
                          الربع {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الميزانية؟
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
