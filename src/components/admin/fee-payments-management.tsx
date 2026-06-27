'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, Save, Trash2, RefreshCw, AlertCircle, Loader2, Printer,
  Receipt, CreditCard, Calendar, Wallet, CheckCircle2, XCircle, FileText,
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
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

// ===== Types =====
interface Student {
  id: string
  studentNumber: string
  name: string
  classroom?: { id: string; name: string; gradeLevel: string } | null
}

interface Fee {
  id: string
  name: string
  feeType: string
  totalAmount: number
  installments: number
  gradeLevel: string | null
}

interface Assignment {
  id: string
  totalAmount: number
  totalPaid: number
  remaining: number
  status: string
  student: { id: string; name: string; studentNumber: string }
  fee: { id: string; name: string; feeType: string; totalAmount: number; installments: number }
}

interface FeeInstallment {
  id: string
  installmentNo: number
  amount: number
  dueDate: string
  _count?: { payments: number }
}

interface Payment {
  id: string
  amount: number
  paymentDate: string
  paymentMethod: string
  receiptNumber: string | null
  installmentNo: number
  notes: string | null
  student: { id: string; name: string; studentNumber: string; classroom?: { name: string; gradeLevel: string } | null }
  fee: { id: string; name: string; feeType: string }
}

const PAYMENT_METHODS = ['نقدي', 'تحويل', 'بطاقة', 'شيك']

const formatCurrency = (n: number) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`
const formatDate = (d: string | Date) => {
  const date = new Date(d)
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const methodIcons: Record<string, React.ReactNode> = {
  'نقدي': <Wallet className="w-3.5 h-3.5" />,
  'تحويل': <CreditCard className="w-3.5 h-3.5" />,
  'بطاقة': <CreditCard className="w-3.5 h-3.5" />,
  'شيك': <FileText className="w-3.5 h-3.5" />,
}

export function FeePaymentsManagement() {
  const { selectedSchoolId } = useAdminStore()
  const [activeTab, setActiveTab] = useState('record')

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Common
  const [students, setStudents] = useState<Student[]>([])
  const [fees, setFees] = useState<Fee[]>([])

  // Record payment state
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentAssignments, setStudentAssignments] = useState<Assignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [installments, setInstallments] = useState<FeeInstallment[]>([])
  const [installmentsLoading, setInstallmentsLoading] = useState(false)
  const [selectedInstallmentId, setSelectedInstallmentId] = useState('')

  // Payment form
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('نقدي')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [installmentNo, setInstallmentNo] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Receipt preview
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // History state
  const [payments, setPayments] = useState<Payment[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFeeFilter, setHistoryFeeFilter] = useState('all')
  const [historyMethodFilter, setHistoryMethodFilter] = useState('all')
  const [historyFromDate, setHistoryFromDate] = useState('')
  const [historyToDate, setHistoryToDate] = useState('')

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  // Load fees
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/fees?schoolId=${selectedSchoolId}&active=true`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setFees((data.fees || []).map((f: Fee) => ({ ...f, totalAmount: Number(f.totalAmount) })))
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching fees:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load assignments for selected student
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId || !selectedStudentId) {
        if (!cancelled) setStudentAssignments([])
        return
      }
      if (!cancelled) setAssignmentsLoading(true)
      try {
        const res = await fetch(
          `/api/student-fees?schoolId=${selectedSchoolId}&studentId=${selectedStudentId}`
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setStudentAssignments(data.assignments || [])
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching assignments:', err)
      } finally {
        if (!cancelled) setAssignmentsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedStudentId])

  // Load installments for selected fee/assignment
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId || !selectedAssignmentId) {
        if (!cancelled) setInstallments([])
        return
      }
      const assignment = studentAssignments.find((a) => a.id === selectedAssignmentId)
      if (!assignment) return
      if (!cancelled) setInstallmentsLoading(true)
      try {
        const res = await fetch(
          `/api/fees/${assignment.fee.id}/installments?schoolId=${selectedSchoolId}`
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (!cancelled) setInstallments(data.installments || [])
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching installments:', err)
      } finally {
        if (!cancelled) setInstallmentsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedAssignmentId, studentAssignments])

  // Load payments (history)
  const loadPayments = useCallback(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setHistoryLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (historySearch) params.set('search', historySearch)
        if (historyFeeFilter !== 'all') params.set('feeId', historyFeeFilter)
        if (historyMethodFilter !== 'all') params.set('paymentMethod', historyMethodFilter)
        if (historyFromDate) params.set('fromDate', historyFromDate)
        if (historyToDate) params.set('toDate', historyToDate)

        const res = await fetch(`/api/fee-payments?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setPayments(data.payments || [])
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching payments:', err)
          toast.error('فشل تحميل المدفوعات')
        }
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, historySearch, historyFeeFilter, historyMethodFilter, historyFromDate, historyToDate])

  useEffect(() => {
    const cleanup = loadPayments()
    return cleanup
  }, [loadPayments])

  // Computed: selected assignment
  const selectedAssignment = studentAssignments.find((a) => a.id === selectedAssignmentId)
  const selectedInstallment = installments.find((i) => i.id === selectedInstallmentId)
  const selectedStudent = students.find((s) => s.id === selectedStudentId)

  // When assignment selected, prefill installmentNo and amount
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!cancelled && selectedAssignment) {
        setAmount(String(Math.max(0, selectedAssignment.remaining)))
        setInstallmentNo('1')
        setSelectedInstallmentId('')
      }
    }
    sync()
    return () => { cancelled = true }
  }, [selectedAssignmentId, selectedAssignment])

  // When installment selected, update amount and installmentNo
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      if (!cancelled && selectedInstallment) {
        setAmount(String(selectedInstallment.amount))
        setInstallmentNo(String(selectedInstallment.installmentNo))
      }
    }
    sync()
    return () => { cancelled = true }
  }, [selectedInstallmentId, selectedInstallment])

  // Handlers
  const handleSave = async () => {
    if (!selectedSchoolId) return
    if (!selectedStudentId || !selectedAssignment) {
      toast.error('يرجى اختيار الطالب والرسوم')
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/fee-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          feeId: selectedAssignment.fee.id,
          studentId: selectedStudentId,
          studentFeeId: selectedAssignment.id,
          installmentId: selectedInstallmentId || null,
          amount: Number(amount),
          paymentDate,
          paymentMethod,
          receiptNumber: receiptNumber || undefined,
          installmentNo: Number(installmentNo || 1),
          notes: notes || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success('تم تسجيل الدفعة بنجاح')
        setReceiptPayment(data.payment)
        setReceiptOpen(true)
        // Reset form
        setAmount('')
        setReceiptNumber('')
        setNotes('')
        setSelectedAssignmentId('')
        setSelectedInstallmentId('')
        setStep(1)
        // Reload assignments
        try {
          const ar = await fetch(`/api/student-fees?schoolId=${selectedSchoolId}&studentId=${selectedStudentId}`)
          if (ar.ok) {
            const ad = await ar.json()
            setStudentAssignments(ad.assignments || [])
          }
        } catch { /* ignore */ }
        loadPayments()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل تسجيل الدفعة')
      }
    } catch (err) {
      console.error('Error saving payment:', err)
      toast.error('فشل تسجيل الدفعة')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!selectedSchoolId || !deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/fee-payments/${deleteTarget.id}?schoolId=${selectedSchoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الدفعة')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        loadPayments()
      } else {
        toast.error('فشل الحذف')
      }
    } catch (err) {
      console.error('Error deleting payment:', err)
      toast.error('فشل الحذف')
    } finally {
      setDeleting(false)
    }
  }

  const printReceipt = () => {
    window.print()
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="record" className="min-h-[36px]">
            <Receipt className="w-4 h-4 ml-1" />
            تسجيل دفعة
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-[36px]">
            <FileText className="w-4 h-4 ml-1" />
            سجل المدفوعات
          </TabsTrigger>
        </TabsList>

        {/* ===== RECORD PAYMENT TAB ===== */}
        <TabsContent value="record">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                تسجيل دفعة جديدة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stepper */}
              <div className="flex items-center gap-2">
                <Button
                  variant={step >= 1 ? 'default' : 'outline'}
                  onClick={() => setStep(1)}
                  className={`min-h-[44px] ${step >= 1 ? 'bg-[#610000] hover:bg-[#7a0000]' : ''}`}
                >
                  1. اختيار الطالب
                </Button>
                <Separator className="flex-1" />
                <Button
                  variant={step >= 2 ? 'default' : 'outline'}
                  disabled={!selectedStudentId}
                  onClick={() => setStep(2)}
                  className={`min-h-[44px] ${step >= 2 ? 'bg-[#610000] hover:bg-[#7a0000]' : ''}`}
                >
                  2. اختيار الرسوم
                </Button>
                <Separator className="flex-1" />
                <Button
                  variant={step >= 3 ? 'default' : 'outline'}
                  disabled={!selectedAssignmentId}
                  onClick={() => setStep(3)}
                  className={`min-h-[44px] ${step >= 3 ? 'bg-[#610000] hover:bg-[#7a0000]' : ''}`}
                >
                  3. إدخال الدفعة
                </Button>
              </div>

              {/* Step 1 */}
              {step === 1 && (
                <div className="space-y-3">
                  <Label className="text-base">اختر الطالب *</Label>
                  <Select value={selectedStudentId} onValueChange={(v) => { setSelectedStudentId(v); setStep(2) }}>
                    <SelectTrigger className="min-h-[44px] w-full max-w-md">
                      <SelectValue placeholder="ابحث عن طالب..." />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} - {s.studentNumber} ({s.classroom?.gradeLevel || 'بدون صف'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedStudent && (
                    <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-3 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#610000]" />
                      <div>
                        <div className="font-medium">{selectedStudent.name}</div>
                        <div className="text-sm text-gray-600">
                          {selectedStudent.studentNumber} - {selectedStudent.classroom?.name || 'بدون فصل'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">رسوم الطالب</Label>
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="min-h-[36px]">
                      تغيير الطالب
                    </Button>
                  </div>
                  {assignmentsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : studentAssignments.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 border rounded-lg">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      لا توجد رسوم مخصصة لهذا الطالب
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {studentAssignments.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setSelectedAssignmentId(a.id)
                            setStep(3)
                          }}
                          className={`w-full text-right p-3 border rounded-lg transition-colors hover:border-[#610000] hover:bg-[#610000]/5 ${
                            selectedAssignmentId === a.id ? 'border-[#610000] bg-[#610000]/5' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{a.fee.name}</div>
                              <div className="text-sm text-gray-600">
                                الإجمالي: {formatCurrency(a.totalAmount)} | المدفوع: {formatCurrency(a.totalPaid)}
                              </div>
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-[#610000]">
                                {formatCurrency(a.remaining)}
                              </div>
                              <div className="text-xs text-gray-500">المتبقي</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && selectedAssignment && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">إدخال تفاصيل الدفعة</Label>
                    <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="min-h-[36px]">
                      تغيير الرسوم
                    </Button>
                  </div>

                  {/* Installments selection */}
                  {installmentsLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : installments.length > 0 ? (
                    <div>
                      <Label className="mb-2 block">اختر القسط (اختياري)</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <button
                          onClick={() => setSelectedInstallmentId('')}
                          className={`p-2 border rounded-lg text-sm transition-colors ${
                            selectedInstallmentId === '' ? 'border-[#610000] bg-[#610000]/5' : 'border-gray-200 hover:border-[#610000]'
                          }`}
                        >
                          <div className="font-medium">دون قسط محدد</div>
                          <div className="text-xs text-gray-500">المتبقي: {formatCurrency(selectedAssignment.remaining)}</div>
                        </button>
                        {installments.map((inst) => (
                          <button
                            key={inst.id}
                            onClick={() => setSelectedInstallmentId(inst.id)}
                            className={`p-2 border rounded-lg text-sm transition-colors ${
                              selectedInstallmentId === inst.id ? 'border-[#610000] bg-[#610000]/5' : 'border-gray-200 hover:border-[#610000]'
                            }`}
                          >
                            <div className="font-medium">قسط {inst.installmentNo}</div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(inst.amount)} - {formatDate(inst.dueDate)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Summary */}
                  <div className="bg-gray-50 border rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>الطالب:</span>
                      <span className="font-medium">{selectedStudent?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>الرسوم:</span>
                      <span className="font-medium">{selectedAssignment.fee.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>الإجمالي:</span>
                      <span className="font-medium">{formatCurrency(selectedAssignment.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>المدفوع سابقاً:</span>
                      <span className="font-medium text-green-700">{formatCurrency(selectedAssignment.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="font-bold">المتبقي:</span>
                      <span className="font-bold text-[#610000]">{formatCurrency(selectedAssignment.remaining)}</span>
                    </div>
                  </div>

                  {/* Payment form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1 block">المبلغ المدفوع *</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block">تاريخ الدفع</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block">طريقة الدفع</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block">رقم القسط</Label>
                      <Input
                        type="number"
                        min={1}
                        value={installmentNo}
                        onChange={(e) => setInstallmentNo(e.target.value)}
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-1 block">رقم الإيصال (يُترك فارغاً للتوليد التلقائي)</Label>
                      <Input
                        value={receiptNumber}
                        onChange={(e) => setReceiptNumber(e.target.value)}
                        placeholder="REC-2024-000001"
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="mb-1 block">ملاحظات</Label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="ملاحظات إضافية..."
                        className="min-h-[44px]"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px] w-full md:w-auto"
                  >
                    {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                    {saving ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== HISTORY TAB ===== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2 text-[#610000]">
                  <FileText className="w-5 h-5" />
                  سجل المدفوعات
                </span>
                <Button variant="outline" onClick={loadPayments} className="min-h-[44px]">
                  <RefreshCw className="w-4 h-4 ml-1" />
                  تحديث
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                <div className="lg:col-span-1">
                  <Label className="mb-1 block text-sm">بحث بالإيصال</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="رقم الإيصال..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pr-9 min-h-[44px]"
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-sm">الرسوم</Label>
                  <Select value={historyFeeFilter} onValueChange={setHistoryFeeFilter}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {fees.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-sm">طريقة الدفع</Label>
                  <Select value={historyMethodFilter} onValueChange={setHistoryMethodFilter}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-sm">من تاريخ</Label>
                  <Input
                    type="date"
                    value={historyFromDate}
                    onChange={(e) => setHistoryFromDate(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-sm">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={historyToDate}
                    onChange={(e) => setHistoryToDate(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>رقم الإيصال</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الطالب</TableHead>
                      <TableHead>الرسوم</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>طريقة الدفع</TableHead>
                      <TableHead>القسط</TableHead>
                      <TableHead>إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          لا توجد مدفوعات
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">
                            {p.receiptNumber || '-'}
                          </TableCell>
                          <TableCell>{formatDate(p.paymentDate)}</TableCell>
                          <TableCell className="font-medium">{p.student.name}</TableCell>
                          <TableCell>{p.fee.name}</TableCell>
                          <TableCell className="text-green-700 font-medium">
                            {formatCurrency(p.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {methodIcons[p.paymentMethod]}
                              {p.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell>{p.installmentNo}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeleteTarget(p)
                                setDeleteDialogOpen(true)
                              }}
                              className="min-h-[36px] min-w-[36px] p-0"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#610000] flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              إيصال استلام دفعة
            </DialogTitle>
            <DialogDescription>تم تسجيل الدفعة بنجاح</DialogDescription>
          </DialogHeader>
          {receiptPayment && (
            <div className="space-y-3 print-area" id="receipt-print">
              <div className="text-center border-b pb-3">
                <div className="text-lg font-bold text-[#610000]">إيصال دفع رسوم</div>
                <div className="text-sm text-gray-600">رقم: {receiptPayment.receiptNumber}</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>التاريخ:</span>
                  <span className="font-medium">{formatDate(receiptPayment.paymentDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>الطالب:</span>
                  <span className="font-medium">{receiptPayment.student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>الرسوم:</span>
                  <span className="font-medium">{receiptPayment.fee.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>القسط:</span>
                  <span className="font-medium">{receiptPayment.installmentNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>طريقة الدفع:</span>
                  <span className="font-medium">{receiptPayment.paymentMethod}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base">
                  <span className="font-bold">المبلغ المدفوع:</span>
                  <span className="font-bold text-[#610000]">{formatCurrency(receiptPayment.amount)}</span>
                </div>
                {receiptPayment.notes && (
                  <div className="text-xs text-gray-600 border-t pt-2">
                    ملاحظات: {receiptPayment.notes}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2 no-print">
            <Button
              onClick={printReceipt}
              variant="outline"
              className="min-h-[44px]"
            >
              <Printer className="w-4 h-4 ml-1" />
              طباعة
            </Button>
            <Button
              onClick={() => setReceiptOpen(false)}
              className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]"
            >
              تم
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الدفعة رقم "{deleteTarget?.receiptNumber}"؟
              بقيمة {deleteTarget && formatCurrency(deleteTarget.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button onClick={handleDeletePayment} disabled={deleting} variant="destructive" className="min-h-[44px]">
              {deleting ? 'جاري الحذف...' : 'حذف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; right: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
