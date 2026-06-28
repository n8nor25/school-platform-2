'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import {
  BarChart3, Calendar, Printer, Loader2, AlertCircle, TrendingUp,
  TrendingDown, Wallet, Receipt, FileText, Building, Target, Coins,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import {
  resolveSchool, formatCurrency, formatDate, getBudgetProgressColor,
  getRemainingColor, TEST_ACADEMIC_YEAR_ID,
} from '@/lib/expense-utils'

interface AcademicYear {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

interface SummaryData {
  total: number
  count: number
  byCategory: Array<{
    category: { id: string; name: string; color: string | null }
    amount: number
    count: number
  }>
  byPaymentMethod: Array<{
    paymentMethod: string
    amount: number
    count: number
  }>
  byStatus: Array<{
    status: string
    amount: number
    count: number
  }>
}

interface MonthlyData {
  monthly: Array<{ month: number; total: number; count: number }>
}

interface CategoryBreakdown {
  categories: Array<{
    id: string
    name: string
    color: string | null
    parentId: string | null
    parentName: string | null
    totalAmount: number
    count: number
    percentage: number
  }>
  totalAmount: number
}

interface VendorSummary {
  vendors: Array<{
    vendor: { id: string; name: string; type: string | null }
    totalAmount: number
    count: number
  }>
}

interface BudgetVsActual {
  items: Array<{
    id: string
    amount: number
    period: string
    fiscalMonth: number | null
    fiscalQuarter: number | null
    actualAmount: number
    remaining: number
    percentUsed: number
    expenseCount: number
    category: { id: string; name: string; color: string | null } | null
  }>
}

interface CashFlow {
  cashFlow: {
    income: { fees: number; transport: number; total: number }
    expenses: {
      total: number
      byCategory: Array<{
        category: { id: string; name: string; color: string | null }
        amount: number
      }>
    }
    net: number
    feePaymentCount: number
    transportPaymentCount: number
    expenseCount: number
  }
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const todayStr = () => new Date().toISOString().slice(0, 10)
const yearStartStr = () => `${new Date().getFullYear()}-01-01`
const yearEndStr = () => `${new Date().getFullYear()}-12-31`

export function ExpenseReports() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [activeTab, setActiveTab] = useState('summary')
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])

  // Summary filters & data
  const [summaryFrom, setSummaryFrom] = useState(yearStartStr())
  const [summaryTo, setSummaryTo] = useState(yearEndStr())
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Monthly
  const [monthlyYear, setMonthlyYear] = useState(String(new Date().getFullYear()))
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null)
  const [monthlyLoading, setMonthlyLoading] = useState(false)

  // Category breakdown
  const [catFrom, setCatFrom] = useState(yearStartStr())
  const [catTo, setCatTo] = useState(yearEndStr())
  const [catData, setCatData] = useState<CategoryBreakdown | null>(null)
  const [catLoading, setCatLoading] = useState(false)

  // Vendor summary
  const [venFrom, setVenFrom] = useState(yearStartStr())
  const [venTo, setVenTo] = useState(yearEndStr())
  const [venData, setVenData] = useState<VendorSummary | null>(null)
  const [venLoading, setVenLoading] = useState(false)

  // Budget vs actual
  const [budgetYearId, setBudgetYearId] = useState('')
  const [budgetData, setBudgetData] = useState<BudgetVsActual | null>(null)
  const [budgetLoading, setBudgetLoading] = useState(false)

  // Cash flow
  const [cashFrom, setCashFrom] = useState(yearStartStr())
  const [cashTo, setCashTo] = useState(yearEndStr())
  const [cashData, setCashData] = useState<CashFlow | null>(null)
  const [cashLoading, setCashLoading] = useState(false)

  // Load academic years once
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/academic-years?schoolId=${schoolId}`)
        if (!cancelled && res.ok) {
          const arr = await res.json()
          const years = Array.isArray(arr) ? arr : []
          setAcademicYears(years)
          const active = years.find((y: AcademicYear) => y.isActive) || years[0]
          setBudgetYearId(active?.id || TEST_ACADEMIC_YEAR_ID)
        }
      } catch {
        // silent
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  // ===== Summary =====
  const fetchSummary = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setSummaryLoading(true)
        const params = new URLSearchParams({
          schoolId,
          type: 'summary',
        })
        if (summaryFrom) params.set('fromDate', summaryFrom)
        if (summaryTo) params.set('toDate', summaryTo)
        const res = await fetch(`/api/expense-reports?${params.toString()}`)
        if (!cancelled && res.ok) {
          const data = await res.json()
          setSummaryData(data.summary || null)
        } else if (!cancelled) {
          toast.error('فشل في تحميل ملخص المصروفات')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل ملخص المصروفات')
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, summaryFrom, summaryTo])

  useEffect(() => {
    if (activeTab === 'summary') fetchSummary()
  }, [activeTab, fetchSummary])

  // ===== Monthly =====
  const fetchMonthly = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setMonthlyLoading(true)
        const res = await fetch(
          `/api/expense-reports?type=monthly&schoolId=${schoolId}&year=${monthlyYear}`
        )
        if (!cancelled && res.ok) {
          const data = await res.json()
          setMonthlyData(data)
        } else if (!cancelled) {
          toast.error('فشل في تحميل التقرير الشهري')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التقرير الشهري')
      } finally {
        if (!cancelled) setMonthlyLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, monthlyYear])

  useEffect(() => {
    if (activeTab === 'monthly') fetchMonthly()
  }, [activeTab, fetchMonthly])

  // ===== Category =====
  const fetchCategory = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setCatLoading(true)
        const params = new URLSearchParams({
          schoolId,
          type: 'category-breakdown',
        })
        if (catFrom) params.set('fromDate', catFrom)
        if (catTo) params.set('toDate', catTo)
        const res = await fetch(`/api/expense-reports?${params.toString()}`)
        if (!cancelled && res.ok) {
          setCatData(await res.json())
        } else if (!cancelled) {
          toast.error('فشل في تحميل التقرير')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التقرير')
      } finally {
        if (!cancelled) setCatLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, catFrom, catTo])

  useEffect(() => {
    if (activeTab === 'category') fetchCategory()
  }, [activeTab, fetchCategory])

  // ===== Vendor =====
  const fetchVendor = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setVenLoading(true)
        const params = new URLSearchParams({
          schoolId,
          type: 'vendor-summary',
        })
        if (venFrom) params.set('fromDate', venFrom)
        if (venTo) params.set('toDate', venTo)
        const res = await fetch(`/api/expense-reports?${params.toString()}`)
        if (!cancelled && res.ok) {
          setVenData(await res.json())
        } else if (!cancelled) {
          toast.error('فشل في تحميل التقرير')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التقرير')
      } finally {
        if (!cancelled) setVenLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, venFrom, venTo])

  useEffect(() => {
    if (activeTab === 'vendor') fetchVendor()
  }, [activeTab, fetchVendor])

  // ===== Budget vs actual =====
  const fetchBudget = useCallback(() => {
    let cancelled = false
    const load = async () => {
      if (!budgetYearId) return
      try {
        setBudgetLoading(true)
        const res = await fetch(
          `/api/expense-reports?type=budget-vs-actual&schoolId=${schoolId}&academicYearId=${budgetYearId}`
        )
        if (!cancelled && res.ok) {
          setBudgetData(await res.json())
        } else if (!cancelled) {
          toast.error('فشل في تحميل التقرير')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التقرير')
      } finally {
        if (!cancelled) setBudgetLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, budgetYearId])

  useEffect(() => {
    if (activeTab === 'budget') fetchBudget()
  }, [activeTab, fetchBudget])

  // ===== Cash Flow =====
  const fetchCash = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setCashLoading(true)
        const params = new URLSearchParams({
          schoolId,
          type: 'cash-flow',
        })
        if (cashFrom) params.set('fromDate', cashFrom)
        if (cashTo) params.set('toDate', cashTo)
        const res = await fetch(`/api/expense-reports?${params.toString()}`)
        if (!cancelled && res.ok) {
          setCashData(await res.json())
        } else if (!cancelled) {
          toast.error('فشل في تحميل التقرير')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التقرير')
      } finally {
        if (!cancelled) setCashLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, cashFrom, cashTo])

  useEffect(() => {
    if (activeTab === 'cashflow') fetchCash()
  }, [activeTab, fetchCash])

  const handlePrint = () => window.print()

  // === Charts data ===
  // Summary: pie by category, bar by payment method
  const summaryPieData = (summaryData?.byCategory || [])
    .filter((c) => c.amount > 0)
    .slice(0, 8)
    .map((c) => ({
      name: c.category.name,
      value: c.amount,
      color: c.category.color || '#610000',
    }))

  const summaryMethodData = (summaryData?.byPaymentMethod || []).map((p) => ({
    name: p.paymentMethod,
    المبلغ: p.amount,
    العدد: p.count,
  }))

  // Monthly line chart
  const monthlyChartData = (monthlyData?.monthly || []).map((m) => ({
    name: ARABIC_MONTHS[m.month - 1] || `شهر ${m.month}`,
    المبلغ: m.total,
    العدد: m.count,
  }))

  // Category bar chart (top 10)
  const catChartData = (catData?.categories || [])
    .filter((c) => c.totalAmount > 0)
    .slice(0, 10)
    .map((c) => ({
      name: c.name,
      المبلغ: c.totalAmount,
      color: c.color || '#610000',
    }))

  // Vendor bar chart (top 10)
  const venChartData = (venData?.vendors || [])
    .slice(0, 10)
    .map((v) => ({
      name: v.vendor.name,
      المبلغ: v.totalAmount,
      العدد: v.count,
    }))

  // Budget chart
  const budgetChartData = (budgetData?.items || [])
    .filter((b) => b.category)
    .slice(0, 12)
    .map((b) => ({
      name: b.category?.name || 'غير مصنف',
      الميزانية: b.amount,
      الفعلي: b.actualAmount,
    }))

  // Budget totals
  const budgetTotal = (budgetData?.items || []).reduce((s, b) => s + b.amount, 0)
  const actualTotal = (budgetData?.items || []).reduce((s, b) => s + b.actualAmount, 0)
  const remainingTotal = budgetTotal - actualTotal
  const overallPercent = budgetTotal > 0 ? (actualTotal / budgetTotal) * 100 : 0

  // Year options (current year -5 to +1)
  const yearOptions: number[] = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear - 5; y <= currentYear + 1; y++) yearOptions.push(y)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3 print:hidden">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#610000]" />
          تقارير المصروفات
        </h2>
        <Button
          onClick={handlePrint}
          variant="outline"
          className="min-h-[44px]"
        >
          <Printer className="w-4 h-4 ml-1" />
          طباعة التقرير
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 print:hidden">
          <TabsTrigger value="summary" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 ml-1" /> ملخص عام
          </TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-white">
            <Calendar className="w-4 h-4 ml-1" /> شهري
          </TabsTrigger>
          <TabsTrigger value="category" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 ml-1" /> حسب التصنيف
          </TabsTrigger>
          <TabsTrigger value="vendor" className="data-[state=active]:bg-white">
            <Building className="w-4 h-4 ml-1" /> حسب المورد
          </TabsTrigger>
          <TabsTrigger value="budget" className="data-[state=active]:bg-white">
            <Target className="w-4 h-4 ml-1" /> ميزانية مقابل فعلي
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="data-[state=active]:bg-white">
            <Coins className="w-4 h-4 ml-1" /> التدفق النقدي
          </TabsTrigger>
        </TabsList>

        {/* ===== Summary Tab ===== */}
        <TabsContent value="summary" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[160px]">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={summaryFrom}
                    onChange={(e) => setSummaryFrom(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={summaryTo}
                    onChange={(e) => setSummaryTo(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={fetchSummary}
                  disabled={summaryLoading}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {summaryLoading ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 ml-1" />
                  )}
                  تحديث
                </Button>
              </div>
            </CardContent>
          </Card>

          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : summaryData ? (
            <>
              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-[#610000]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي المصروفات</p>
                        <p className="text-lg font-bold text-[#610000] font-mono">
                          {formatCurrency(summaryData.total)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">عدد المصروفات</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {summaryData.count}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">متوسط المصروف</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {formatCurrency(summaryData.count > 0 ? summaryData.total / summaryData.count : 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">أكبر مصروف</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {formatCurrency(
                            Math.max(0, ...(summaryData.byCategory.map((c) => c.amount)))
                          )}
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
                    <CardTitle className="text-base">التوزيع حسب التصنيف</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summaryPieData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        لا توجد بيانات
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={summaryPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={(entry) => `${entry.name}: ${formatCurrency(entry.value as number)}`}
                            labelLine={false}
                          >
                            {summaryPieData.map((entry, i) => (
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

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">حسب طريقة الدفع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summaryMethodData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-gray-400">
                        لا توجد بيانات
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={summaryMethodData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ direction: 'rtl' }} />
                          <Bar dataKey="المبلغ" fill="#610000" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                لا توجد بيانات
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Monthly Tab ===== */}
        <TabsContent value="monthly" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[160px]">
                  <Label className="text-xs">السنة</Label>
                  <Select value={monthlyYear} onValueChange={setMonthlyYear}>
                    <SelectTrigger className="h-11 mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={fetchMonthly}
                  disabled={monthlyLoading}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {monthlyLoading ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 ml-1" />
                  )}
                  تحديث
                </Button>
              </div>
            </CardContent>
          </Card>

          {monthlyLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : monthlyData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">المصروفات الشهرية - {monthlyYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ direction: 'rtl' }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="المبلغ"
                        stroke="#610000"
                        strokeWidth={3}
                        dot={{ fill: '#610000', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">جدول الأشهر</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>الشهر</TableHead>
                        <TableHead className="text-center">عدد المصروفات</TableHead>
                        <TableHead>الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.monthly.map((m) => (
                        <TableRow key={m.month} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{ARABIC_MONTHS[m.month - 1]}</TableCell>
                          <TableCell className="text-center font-mono">{m.count}</TableCell>
                          <TableCell>
                            <span className="font-mono font-bold text-[#610000]">
                              {formatCurrency(m.total)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                لا توجد بيانات
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Category Tab ===== */}
        <TabsContent value="category" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[160px]">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={catFrom}
                    onChange={(e) => setCatFrom(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={catTo}
                    onChange={(e) => setCatTo(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={fetchCategory}
                  disabled={catLoading}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {catLoading ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 ml-1" />
                  )}
                  تحديث
                </Button>
              </div>
            </CardContent>
          </Card>

          {catLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : catData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    أعلى 10 تصنيفات إنفاقًا
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {catChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      لا توجد بيانات
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={catChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ direction: 'rtl' }} />
                        <Bar dataKey="المبلغ" fill="#610000" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">جدول التصنيفات</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>التصنيف</TableHead>
                          <TableHead>الأب</TableHead>
                          <TableHead className="text-center">عدد المصروفات</TableHead>
                          <TableHead>الإجمالي</TableHead>
                          <TableHead className="text-center">النسبة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catData.categories.filter((c) => c.totalAmount > 0).map((c) => (
                          <TableRow key={c.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: c.color || '#610000' }}
                                />
                                <span className="font-medium">{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {c.parentName || '—'}
                            </TableCell>
                            <TableCell className="text-center font-mono">{c.count}</TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-[#610000]">
                                {formatCurrency(c.totalAmount)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-mono text-sm text-gray-600">
                                {c.percentage.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                لا توجد بيانات
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Vendor Tab ===== */}
        <TabsContent value="vendor" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[160px]">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={venFrom}
                    onChange={(e) => setVenFrom(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={venTo}
                    onChange={(e) => setVenTo(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={fetchVendor}
                  disabled={venLoading}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {venLoading ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 ml-1" />
                  )}
                  تحديث
                </Button>
              </div>
            </CardContent>
          </Card>

          {venLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : venData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">أعلى 10 موردين إنفاقًا</CardTitle>
                </CardHeader>
                <CardContent>
                  {venChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      لا توجد بيانات
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={venChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ direction: 'rtl' }} />
                        <Bar dataKey="المبلغ" fill="#610000" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">جدول الموردين</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-center">#</TableHead>
                          <TableHead>المورد</TableHead>
                          <TableHead>النوع</TableHead>
                          <TableHead className="text-center">عدد المصروفات</TableHead>
                          <TableHead>الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {venData.vendors.map((v, i) => (
                          <TableRow key={v.vendor.id} className="hover:bg-gray-50">
                            <TableCell className="text-center font-mono text-gray-600">{i + 1}</TableCell>
                            <TableCell className="font-medium">{v.vendor.name}</TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-500">{v.vendor.type || '—'}</span>
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
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                لا توجد بيانات
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Budget vs Actual Tab ===== */}
        <TabsContent value="budget" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[280px]">
                  <Label className="text-xs">السنة الدراسية</Label>
                  <Select value={budgetYearId} onValueChange={setBudgetYearId}>
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
                <Button
                  onClick={fetchBudget}
                  disabled={budgetLoading}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {budgetLoading ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 ml-1" />
                  )}
                  تحديث
                </Button>
              </div>
            </CardContent>
          </Card>

          {budgetLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : budgetData && budgetData.items.length > 0 ? (
            <>
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
                        <p className="text-lg font-bold font-mono">{formatCurrency(budgetTotal)}</p>
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
                        <p className="text-xs text-gray-500">الفعلي</p>
                        <p className="text-lg font-bold text-red-600 font-mono">
                          {formatCurrency(actualTotal)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        remainingTotal >= 0 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {remainingTotal >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">المتبقي</p>
                        <p className={`text-lg font-bold font-mono ${getRemainingColor(remainingTotal)}`}>
                          {formatCurrency(remainingTotal)}
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
                        <p className="text-lg font-bold font-mono">
                          {overallPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">مقارنة الميزانية بالفعلي</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={budgetChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ direction: 'rtl' }} />
                      <Legend />
                      <Bar dataKey="الميزانية" fill="#610000" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="الفعلي" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed Table */}
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
                        {budgetData.items.map((b) => {
                          const percent = b.percentUsed || 0
                          return (
                            <TableRow key={b.id} className="hover:bg-gray-50">
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {b.category && (
                                    <span
                                      className="inline-block w-3 h-3 rounded-full"
                                      style={{ backgroundColor: b.category.color || '#610000' }}
                                    />
                                  )}
                                  <span className="font-medium">{b.category?.name || 'غير مصنف'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">{b.period}</TableCell>
                              <TableCell className="font-mono font-bold">{formatCurrency(b.amount)}</TableCell>
                              <TableCell className="font-mono text-red-600">{formatCurrency(b.actualAmount)}</TableCell>
                              <TableCell className={`font-mono font-bold ${getRemainingColor(b.remaining)}`}>
                                {formatCurrency(b.remaining)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 min-w-[140px]">
                                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getBudgetProgressColor(percent)}`}
                                      style={{ width: `${Math.min(percent, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-xs min-w-[40px]">
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
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                لا توجد ميزانيات لهذه السنة الدراسية.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Cash Flow Tab ===== */}
        <TabsContent value="cashflow" className="space-y-4">
          <Card className="print:hidden">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="min-w-[160px]">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={cashFrom}
                    onChange={(e) => setCashFrom(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <div className="min-w-[160px]">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={cashTo}
                    onChange={(e) => setCashTo(e.target.value)}
                    className="h-11 mt-1.5"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={fetchCash}
                  disabled={cashLoading}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {cashLoading ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 ml-1" />
                  )}
                  تحديث
                </Button>
              </div>
            </CardContent>
          </Card>

          {cashLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : cashData ? (
            <>
              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي الدخل (الرسوم + النقل)</p>
                        <p className="text-lg font-bold text-green-600 font-mono">
                          {formatCurrency(cashData.cashFlow.income.total)}
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
                        <p className="text-xs text-gray-500">إجمالي المصروفات</p>
                        <p className="text-lg font-bold text-red-600 font-mono">
                          {formatCurrency(cashData.cashFlow.expenses.total)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        cashData.cashFlow.net >= 0 ? 'bg-[#610000]/10' : 'bg-red-100'
                      }`}>
                        <Coins className={`w-5 h-5 ${
                          cashData.cashFlow.net >= 0 ? 'text-[#610000]' : 'text-red-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">صافي التدفق النقدي</p>
                        <p className={`text-lg font-bold font-mono ${
                          cashData.cashFlow.net >= 0 ? 'text-[#610000]' : 'text-red-600'
                        }`}>
                          {formatCurrency(cashData.cashFlow.net)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">الرسوم المحصلة</p>
                        <p className="text-lg font-bold text-gray-800 font-mono">
                          {formatCurrency(cashData.cashFlow.income.fees)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Income breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">مصادر الدخل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium">الرسوم الدراسية</span>
                      <span className="font-mono font-bold text-green-700">
                        {formatCurrency(cashData.cashFlow.income.fees)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-sky-50 rounded-lg">
                      <span className="text-sm font-medium">رسوم النقل</span>
                      <span className="font-mono font-bold text-sky-700">
                        {formatCurrency(cashData.cashFlow.income.transport)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-[#610000]/5 rounded-lg border-t border-gray-100 pt-3">
                      <span className="text-sm font-bold">الإجمالي</span>
                      <span className="font-mono font-bold text-[#610000]">
                        {formatCurrency(cashData.cashFlow.income.total)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">المصروفات حسب التصنيف</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cashData.cashFlow.expenses.byCategory.length === 0 ? (
                      <div className="p-6 text-center text-gray-400">لا توجد بيانات</div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {cashData.cashFlow.expenses.byCategory.map((c, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center p-2 bg-gray-50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{ backgroundColor: c.category.color || '#610000' }}
                              />
                              <span className="text-sm">{c.category.name}</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-red-600">
                              {formatCurrency(c.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                لا توجد بيانات
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
