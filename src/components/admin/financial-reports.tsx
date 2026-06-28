'use client'

import React, { useState, useEffect } from 'react'
import {
  AlertCircle, Printer, RefreshCw, Loader2, TrendingUp, TrendingDown,
  Clock, DollarSign, BarChart3, GraduationCap, Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

// ===== Types =====
interface AcademicYear {
  id: string
  name: string
  isActive: boolean
}

interface CollectionSummary {
  summary: Array<{
    feeType: string
    expected: number
    collected: number
    outstanding: number
    collectionRate: number
  }>
  totals: {
    expected: number
    collected: number
    outstanding: number
    collectionRate: number
  }
}

interface OverdueReport {
  overdue: Array<{
    studentId: string
    studentName: string
    studentNumber: string
    gradeLevel: string | null
    feeId: string
    feeName: string
    feeType: string
    installmentId: string
    installmentNo: number
    dueDate: string
    amount: number
    paidAmount: number
    remaining: number
    daysOverdue: number
  }>
  totals: { totalAmount: number; totalPaid: number; totalRemaining: number }
  count: number
}

interface GradeSummary {
  summary: Array<{
    gradeLevel: string
    studentsCount: number
    expected: number
    collected: number
    outstanding: number
    collectionRate: number
  }>
  totals: {
    studentsCount: number
    expected: number
    collected: number
    outstanding: number
    collectionRate: number
  }
}

const formatCurrency = (n: number) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`
const formatDate = (d: string | Date) => {
  const date = new Date(d)
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const getOverdueSeverity = (days: number) => {
  if (days > 90) return { label: 'حرج', className: 'bg-red-100 text-red-700 border-red-300' }
  if (days > 30) return { label: 'مرتفع', className: 'bg-orange-100 text-orange-700 border-orange-300' }
  if (days > 7) return { label: 'متوسط', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
  return { label: 'منخفض', className: 'bg-blue-100 text-blue-700 border-blue-300' }
}

export function FinancialReports() {
  const { selectedSchoolId } = useAdminStore()
  const [activeTab, setActiveTab] = useState('collection')

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])

  // Collection summary
  const [collection, setCollection] = useState<CollectionSummary | null>(null)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [collectionYear, setCollectionYear] = useState('')
  const [collectionFromDate, setCollectionFromDate] = useState('')
  const [collectionToDate, setCollectionToDate] = useState('')

  // Overdue
  const [overdue, setOverdue] = useState<OverdueReport | null>(null)
  const [overdueLoading, setOverdueLoading] = useState(false)
  const [overdueYear, setOverdueYear] = useState('')

  // Grade summary
  const [grade, setGrade] = useState<GradeSummary | null>(null)
  const [gradeLoading, setGradeLoading] = useState(false)
  const [gradeYear, setGradeYear] = useState('')

  // Load academic years
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/academic-years?schoolId=${selectedSchoolId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const years = Array.isArray(data) ? data : data.academicYears || []
          setAcademicYears(years)
          const active = years.find((y: AcademicYear) => y.isActive)
          if (active) {
            setCollectionYear(active.id)
            setOverdueYear(active.id)
            setGradeYear(active.id)
          } else if (years.length > 0) {
            setCollectionYear(years[0].id)
            setOverdueYear(years[0].id)
            setGradeYear(years[0].id)
          }
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching academic years:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load collection summary
  useEffect(() => {
    if (!selectedSchoolId || !collectionYear) return
    let cancelled = false
    const load = async () => {
      setCollectionLoading(true)
      try {
        const params = new URLSearchParams({
          schoolId: selectedSchoolId,
          type: 'collection-summary',
          academicYearId: collectionYear,
        })
        if (collectionFromDate) params.set('fromDate', collectionFromDate)
        if (collectionToDate) params.set('toDate', collectionToDate)

        const res = await fetch(`/api/fee-reports?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setCollection(data)
        } else if (!cancelled) {
          toast.error('فشل تحميل ملخص التحصيل')
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching collection summary:', err)
      } finally {
        if (!cancelled) setCollectionLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, collectionYear, collectionFromDate, collectionToDate])

  // Load overdue
  useEffect(() => {
    if (!selectedSchoolId || !overdueYear) return
    let cancelled = false
    const load = async () => {
      setOverdueLoading(true)
      try {
        const res = await fetch(
          `/api/fee-reports?type=overdue&academicYearId=${overdueYear}&schoolId=${selectedSchoolId}`
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          setOverdue(data)
        } else if (!cancelled) {
          toast.error('فشل تحميل المتأخرات')
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching overdue:', err)
      } finally {
        if (!cancelled) setOverdueLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, overdueYear])

  // Load grade summary
  useEffect(() => {
    if (!selectedSchoolId || !gradeYear) return
    let cancelled = false
    const load = async () => {
      setGradeLoading(true)
      try {
        const res = await fetch(
          `/api/fee-reports?type=grade-summary&academicYearId=${gradeYear}&schoolId=${selectedSchoolId}`
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          setGrade(data)
        } else if (!cancelled) {
          toast.error('فشل تحميل ملخص الصفوف')
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching grade summary:', err)
      } finally {
        if (!cancelled) setGradeLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, gradeYear])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="collection" className="min-h-[36px]">
            <TrendingUp className="w-4 h-4 ml-1" />
            ملخص التحصيل
          </TabsTrigger>
          <TabsTrigger value="overdue" className="min-h-[36px]">
            <Clock className="w-4 h-4 ml-1" />
            المتأخرات
          </TabsTrigger>
          <TabsTrigger value="grade" className="min-h-[36px]">
            <GraduationCap className="w-4 h-4 ml-1" />
            ملخص بالصف
          </TabsTrigger>
        </TabsList>

        {/* ===== COLLECTION SUMMARY ===== */}
        <TabsContent value="collection">
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                ملخص التحصيل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1 block">السنة الدراسية</Label>
                  <Select value={collectionYear} onValueChange={setCollectionYear}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isActive && '(نشطة)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">من تاريخ</Label>
                  <Input
                    type="date"
                    value={collectionFromDate}
                    onChange={(e) => setCollectionFromDate(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={collectionToDate}
                    onChange={(e) => setCollectionToDate(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>
              <Button onClick={handlePrint} variant="outline" className="min-h-[44px]">
                <Printer className="w-4 h-4 ml-1" />
                طباعة
              </Button>
            </CardContent>
          </Card>

          {collectionLoading ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : !collection ? (
            <Card>
              <CardContent className="text-center text-gray-500 py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                لا توجد بيانات
              </CardContent>
            </Card>
          ) : (
            <Card className="print-area">
              <CardContent className="space-y-4 p-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-[#610000] mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs">المتوقع</span>
                    </div>
                    <div className="text-xl font-bold text-[#610000]">
                      {formatCurrency(collection.totals.expected)}
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-700 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">المحصّل</span>
                    </div>
                    <div className="text-xl font-bold text-green-700">
                      {formatCurrency(collection.totals.collected)}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-700 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs">المتأخر</span>
                    </div>
                    <div className="text-xl font-bold text-red-700">
                      {formatCurrency(collection.totals.outstanding)}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-xs">نسبة التحصيل</span>
                    </div>
                    <div className="text-xl font-bold text-blue-700">
                      {collection.totals.collectionRate}%
                    </div>
                  </div>
                </div>

                {/* Table by feeType */}
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نوع الرسوم</TableHead>
                        <TableHead>المتوقع</TableHead>
                        <TableHead>المحصّل</TableHead>
                        <TableHead>المتأخر</TableHead>
                        <TableHead>نسبة التحصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collection.summary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                            لا توجد بيانات
                          </TableCell>
                        </TableRow>
                      ) : (
                        collection.summary.map((s) => (
                          <TableRow key={s.feeType}>
                            <TableCell className="font-medium">
                              <Badge variant="outline">{s.feeType}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(s.expected)}</TableCell>
                            <TableCell className="text-green-700 font-medium">
                              {formatCurrency(s.collected)}
                            </TableCell>
                            <TableCell className="text-red-700 font-medium">
                              {formatCurrency(s.outstanding)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-[100px] bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-[#610000] h-full transition-all"
                                    style={{ width: `${Math.min(100, s.collectionRate)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium">{s.collectionRate}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== OVERDUE ===== */}
        <TabsContent value="overdue">
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <Clock className="w-5 h-5" />
                تقرير المتأخرات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">السنة الدراسية</Label>
                  <Select value={overdueYear} onValueChange={setOverdueYear}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isActive && '(نشطة)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handlePrint} variant="outline" className="min-h-[44px] w-full">
                    <Printer className="w-4 h-4 ml-1" />
                    طباعة
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {overdueLoading ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : !overdue ? (
            <Card>
              <CardContent className="text-center text-gray-500 py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                لا توجد بيانات
              </CardContent>
            </Card>
          ) : (
            <Card className="print-area">
              <CardContent className="space-y-4 p-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-700">عدد المتأخرات</div>
                    <div className="text-xl font-bold text-red-700">{overdue.count}</div>
                  </div>
                  <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-3">
                    <div className="text-xs text-[#610000]">إجمالي المبالغ</div>
                    <div className="text-xl font-bold text-[#610000]">{formatCurrency(overdue.totals.totalAmount)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700">المدفوع</div>
                    <div className="text-xl font-bold text-green-700">{formatCurrency(overdue.totals.totalPaid)}</div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-xs text-orange-700">المتبقي</div>
                    <div className="text-xl font-bold text-orange-700">{formatCurrency(overdue.totals.totalRemaining)}</div>
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead>الطالب</TableHead>
                        <TableHead>الصف</TableHead>
                        <TableHead>الرسوم</TableHead>
                        <TableHead>القسط</TableHead>
                        <TableHead>تاريخ الاستحقاق</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>المدفوع</TableHead>
                        <TableHead>المتبقي</TableHead>
                        <TableHead>أيام التأخير</TableHead>
                        <TableHead>الخطورة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdue.overdue.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-green-700 py-8">
                            <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                            لا توجد متأخرات
                          </TableCell>
                        </TableRow>
                      ) : (
                        overdue.overdue.map((o, idx) => {
                          const severity = getOverdueSeverity(o.daysOverdue)
                          return (
                            <TableRow key={`${o.studentId}-${o.installmentId}-${idx}`}>
                              <TableCell className="font-medium">{o.studentName}</TableCell>
                              <TableCell>{o.gradeLevel || '-'}</TableCell>
                              <TableCell>{o.feeName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">قسط {o.installmentNo}</Badge>
                              </TableCell>
                              <TableCell className="text-red-600">{formatDate(o.dueDate)}</TableCell>
                              <TableCell>{formatCurrency(o.amount)}</TableCell>
                              <TableCell className="text-green-700">{formatCurrency(o.paidAmount)}</TableCell>
                              <TableCell className="text-red-700 font-bold">{formatCurrency(o.remaining)}</TableCell>
                              <TableCell>
                                <span className="text-red-600 font-medium">{o.daysOverdue} يوم</span>
                              </TableCell>
                              <TableCell>
                                <Badge className={severity.className}>{severity.label}</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== GRADE SUMMARY ===== */}
        <TabsContent value="grade">
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                ملخص التحصيل بالصف
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block">السنة الدراسية</Label>
                  <Select value={gradeYear} onValueChange={setGradeYear}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name} {y.isActive && '(نشطة)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handlePrint} variant="outline" className="min-h-[44px] w-full">
                    <Printer className="w-4 h-4 ml-1" />
                    طباعة
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {gradeLoading ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : !grade ? (
            <Card>
              <CardContent className="text-center text-gray-500 py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                لا توجد بيانات
              </CardContent>
            </Card>
          ) : (
            <Card className="print-area">
              <CardContent className="space-y-4 p-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-3">
                    <div className="text-xs text-[#610000]">عدد الطلاب</div>
                    <div className="text-xl font-bold text-[#610000]">{grade.totals.studentsCount}</div>
                  </div>
                  <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-3">
                    <div className="text-xs text-[#610000]">إجمالي المتوقع</div>
                    <div className="text-xl font-bold text-[#610000]">{formatCurrency(grade.totals.expected)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700">المحصّل</div>
                    <div className="text-xl font-bold text-green-700">{formatCurrency(grade.totals.collected)}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs text-blue-700">نسبة التحصيل</div>
                    <div className="text-xl font-bold text-blue-700">{grade.totals.collectionRate}%</div>
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الصف</TableHead>
                        <TableHead>عدد الطلاب</TableHead>
                        <TableHead>المتوقع</TableHead>
                        <TableHead>المحصّل</TableHead>
                        <TableHead>المتأخر</TableHead>
                        <TableHead>نسبة التحصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grade.summary.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                            لا توجد بيانات
                          </TableCell>
                        </TableRow>
                      ) : (
                        grade.summary.map((s) => (
                          <TableRow key={s.gradeLevel}>
                            <TableCell className="font-medium">{s.gradeLevel}</TableCell>
                            <TableCell>{s.studentsCount}</TableCell>
                            <TableCell>{formatCurrency(s.expected)}</TableCell>
                            <TableCell className="text-green-700 font-medium">{formatCurrency(s.collected)}</TableCell>
                            <TableCell className="text-red-700 font-medium">{formatCurrency(s.outstanding)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 max-w-[100px] bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-[#610000] h-full transition-all"
                                    style={{ width: `${Math.min(100, s.collectionRate)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium">{s.collectionRate}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; right: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
