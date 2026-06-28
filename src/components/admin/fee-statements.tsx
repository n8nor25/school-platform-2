'use client'

import React, { useState, useEffect } from 'react'
import {
  Search, Printer, AlertCircle, FileText, Loader2, User,
  Coins, CheckCircle2, XCircle, Calendar,
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
import { Separator } from '@/components/ui/separator'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

// ===== Types =====
interface Student {
  id: string
  studentNumber: string
  name: string
  classroom?: { id: string; name: string; gradeLevel: string } | null
}

interface StatementEntry {
  id: string
  fee: { id: string; name: string; feeType: string; totalAmount: number }
  originalAmount: number
  discountType: string | null
  discountValue: number | null
  discountReason: string | null
  discount: number
  totalAmount: number
  payments: Array<{
    id: string
    amount: number
    paymentDate: string
    receiptNumber: string | null
    paymentMethod: string
    installmentNo: number
    notes: string | null
  }>
  totalPaid: number
  remaining: number
  status: string
}

interface StatementData {
  student: { id: string; name: string; studentNumber: string; classroom: { name: string; gradeLevel: string } | null }
  statement: StatementEntry[]
  totals: { totalObligations: number; totalPaid: number; totalRemaining: number }
}

const formatCurrency = (n: number) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`
const formatDate = (d: string | Date) => {
  const date = new Date(d)
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const statusBadge = (status: string) => {
  if (status === 'مدفوع') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">مدفوع</Badge>
  if (status === 'جزئي') return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">جزئي</Badge>
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">غير مدفوع</Badge>
}

export function FeeStatements() {
  const { selectedSchoolId } = useAdminStore()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [search, setSearch] = useState('')
  const [statement, setStatement] = useState<StatementData | null>(null)
  const [loading, setLoading] = useState(false)

  // Load students
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/students?schoolId=${selectedSchoolId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data.students || []
          setStudents(list)
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching students:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load statement when student selected
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId || !selectedStudentId) {
        if (!cancelled) setStatement(null)
        return
      }
      if (!cancelled) setLoading(true)
      try {
        const res = await fetch(
          `/api/fee-reports?type=student-statement&studentId=${selectedStudentId}&schoolId=${selectedSchoolId}`
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setStatement(data)
        } else if (!cancelled) {
          toast.error('فشل تحميل كشف الحساب')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching statement:', err)
          toast.error('فشل تحميل كشف الحساب')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedStudentId])

  const handlePrint = () => {
    window.print()
  }

  const filteredStudents = students.filter((s) => {
    if (!search) return true
    return s.name.includes(search) || s.studentNumber.includes(search)
  })

  return (
    <div className="space-y-4" dir="rtl">
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-[#610000] flex items-center gap-2">
            <FileText className="w-5 h-5" />
            كشف حساب طالب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">بحث عن طالب</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="ابحث بالاسم أو الرقم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">اختر الطالب</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="min-h-[44px] w-full">
                  <SelectValue placeholder="اختر الطالب" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} - {s.studentNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {statement && (
            <Button
              onClick={handlePrint}
              variant="outline"
              className="min-h-[44px]"
            >
              <Printer className="w-4 h-4 ml-1" />
              طباعة الكشف
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Statement content */}
      {!selectedStudentId ? (
        <Card>
          <CardContent className="text-center text-gray-500 py-12">
            <User className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            اختر طالباً لعرض كشف حسابه
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : !statement ? (
        <Card>
          <CardContent className="text-center text-gray-500 py-12">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            لا توجد بيانات
          </CardContent>
        </Card>
      ) : (
        <Card className="print-area" id="statement-print">
          <CardContent className="space-y-4 p-6">
            {/* Header */}
            <div className="border-b pb-4 text-center">
              <h1 className="text-2xl font-bold text-[#610000]">كشف حساب الطالب</h1>
              <p className="text-sm text-gray-600 mt-1">
                تاريخ الإصدار: {formatDate(new Date())}
              </p>
            </div>

            {/* Student info */}
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-gray-500">اسم الطالب</div>
                <div className="font-bold">{statement.student.name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">رقم الطالب</div>
                <div className="font-bold">{statement.student.studentNumber}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">الصف</div>
                <div className="font-bold">{statement.student.classroom?.gradeLevel || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">الفصل</div>
                <div className="font-bold">{statement.student.classroom?.name || '-'}</div>
              </div>
            </div>

            {/* Statement entries */}
            {statement.statement.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                لا توجد رسوم مخصصة لهذا الطالب
              </div>
            ) : (
              <div className="space-y-4">
                {statement.statement.map((entry, idx) => (
                  <div key={entry.id} className="border rounded-lg overflow-hidden">
                    {/* Fee header */}
                    <div className="bg-[#610000] text-white p-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/20 text-white hover:bg-white/20">{idx + 1}</Badge>
                        <span className="font-bold">{entry.fee.name}</span>
                        <Badge variant="outline" className="border-white/30 text-white">
                          {entry.fee.feeType}
                        </Badge>
                      </div>
                      {statusBadge(entry.status)}
                    </div>

                    {/* Fee summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-gray-50 border-b text-sm">
                      <div>
                        <div className="text-xs text-gray-500">الإجمالي الأصلي</div>
                        <div className="font-medium">{formatCurrency(entry.originalAmount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">الخصم</div>
                        <div className="font-medium text-orange-700">
                          {entry.discount > 0 ? formatCurrency(entry.discount) : '-'}
                          {entry.discountType === 'نسبة' && entry.discountValue
                            ? ` (${entry.discountValue}%)`
                            : entry.discountType === 'إعفاء' ? ' (إعفاء)' : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">الإجمالي المستحق</div>
                        <div className="font-medium">{formatCurrency(entry.totalAmount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">المتبقي</div>
                        <div className={`font-bold ${entry.remaining > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {formatCurrency(entry.remaining)}
                        </div>
                      </div>
                    </div>

                    {/* Payments */}
                    {entry.payments.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 text-sm">
                        <XCircle className="w-4 h-4 inline ml-1" />
                        لا توجد دفعات مسجلة
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>التاريخ</TableHead>
                              <TableHead>رقم الإيصال</TableHead>
                              <TableHead>القسط</TableHead>
                              <TableHead>طريقة الدفع</TableHead>
                              <TableHead>المبلغ</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entry.payments.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell>{formatDate(p.paymentDate)}</TableCell>
                                <TableCell className="font-mono text-xs">{p.receiptNumber || '-'}</TableCell>
                                <TableCell>{p.installmentNo}</TableCell>
                                <TableCell>{p.paymentMethod}</TableCell>
                                <TableCell className="text-green-700 font-medium">
                                  {formatCurrency(p.amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Total paid for this fee */}
                    <div className="flex justify-between p-3 border-t bg-gray-50">
                      <span className="font-medium">إجمالي المدفوع لهذه الرسوم:</span>
                      <span className="font-bold text-green-700">{formatCurrency(entry.totalPaid)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-4">
              <h3 className="font-bold text-[#610000] mb-3 flex items-center gap-2">
                <Coins className="w-5 h-5" />
                ملخص الحساب
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">إجمالي الالتزامات</div>
                  <div className="text-xl font-bold text-[#610000]">
                    {formatCurrency(statement.totals.totalObligations)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">إجمالي المدفوع</div>
                  <div className="text-xl font-bold text-green-700">
                    {formatCurrency(statement.totals.totalPaid)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">إجمالي المتبقي</div>
                  <div className="text-xl font-bold text-red-700">
                    {formatCurrency(statement.totals.totalRemaining)}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="text-center text-xs text-gray-500 no-print">
              <Calendar className="w-3 h-3 inline ml-1" />
              تم إنشاء هذا الكشف بتاريخ {formatDate(new Date())}
            </div>
          </CardContent>
        </Card>
      )}

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
