'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, Filter, Save, Trash2, RefreshCw, AlertCircle, UserPlus,
  Users, Tag, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
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
  discountType: string | null
  discountValue: number | null
  discountReason: string | null
  totalPaid: number
  remaining: number
  paymentsCount: number
  status: string
  student: { id: string; name: string; studentNumber: string; classroom: { name: string; gradeLevel: string } | null }
  fee: { id: string; name: string; feeType: string; totalAmount: number; installments: number }
}

const DISCOUNT_TYPES = [
  { value: 'بدون', label: 'بدون خصم' },
  { value: 'نسبة', label: 'نسبة مئوية %' },
  { value: 'ثابت', label: 'مبلغ ثابت' },
  { value: 'إعفاء', label: 'إعفاء كامل' },
]

const formatCurrency = (n: number) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`

const statusBadge = (status: string) => {
  if (status === 'مدفوع') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">مدفوع</Badge>
  if (status === 'جزئي') return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">جزئي</Badge>
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">غير مدفوع</Badge>
}

export function FeeAssignments() {
  const { selectedSchoolId } = useAdminStore()

  const [activeTab, setActiveTab] = useState('list')

  // Common data
  const [fees, setFees] = useState<Fee[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [gradeLevels, setGradeLevels] = useState<string[]>([])

  // List state
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [feeFilter, setFeeFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')

  // Single assign form
  const [singleStudentId, setSingleStudentId] = useState('')
  const [singleFeeId, setSingleFeeId] = useState('')
  const [discountType, setDiscountType] = useState('بدون')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [savingSingle, setSavingSingle] = useState(false)

  // Bulk assign
  const [bulkFeeId, setBulkFeeId] = useState('')
  const [bulkGrade, setBulkGrade] = useState('all')
  const [bulkStudents, setBulkStudents] = useState<Student[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [bulkDiscountType, setBulkDiscountType] = useState('بدون')
  const [bulkDiscountValue, setBulkDiscountValue] = useState('')
  const [bulkDiscountReason, setBulkDiscountReason] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ created: number; skipped: number } | null>(null)

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Edit discount
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Assignment | null>(null)
  const [editDiscountType, setEditDiscountType] = useState('بدون')
  const [editDiscountValue, setEditDiscountValue] = useState('')
  const [editDiscountReason, setEditDiscountReason] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Load fees
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/fees?schoolId=${selectedSchoolId}&active=true`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const feeList: Fee[] = (data.fees || []).map((f: Fee) => ({
            ...f,
            totalAmount: Number(f.totalAmount),
          }))
          setFees(feeList)
          const grades = Array.from(new Set(feeList.map((f) => f.gradeLevel).filter((g): g is string => !!g)))
          setGradeLevels((prev) => Array.from(new Set([...prev, ...grades])))
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching fees:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load students (all)
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
          const grades = Array.from(new Set(
            list
              .map((s: Student) => s.classroom?.gradeLevel)
              .filter((g: string | undefined): g is string => !!g)
          ))
          setGradeLevels((prev) => Array.from(new Set([...prev, ...grades])))
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching students:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load assignments
  const loadAssignments = useCallback(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search) params.set('search', search)
        if (feeFilter !== 'all') params.set('feeId', feeFilter)
        if (gradeFilter !== 'all') params.set('gradeLevel', gradeFilter)

        const res = await fetch(`/api/student-fees?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setAssignments(data.assignments || [])
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching assignments:', err)
          toast.error('فشل تحميل التخصيصات')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, search, feeFilter, gradeFilter])

  useEffect(() => {
    const cleanup = loadAssignments()
    return cleanup
  }, [loadAssignments])

  // Load bulk students when grade changes
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (bulkGrade !== 'all') params.set('gradeLevel', bulkGrade)
        const res = await fetch(`/api/students?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const list = Array.isArray(data) ? data : data.students || []
          setBulkStudents(list)
          setSelectedStudentIds(new Set())
        }
      } catch (err) {
        if (!cancelled) console.error('Error fetching bulk students:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, bulkGrade])

  // Compute single assignment total
  const computeTotal = (feeTotal: number, dType: string, dValue: string): number => {
    const v = Number(dValue || 0)
    if (dType === 'إعفاء') return 0
    if (dType === 'نسبة') return Math.max(0, feeTotal - (feeTotal * v) / 100)
    if (dType === 'ثابت') return Math.max(0, feeTotal - v)
    return feeTotal
  }

  const selectedSingleFee = fees.find((f) => f.id === singleFeeId)
  const computedSingleTotal = selectedSingleFee
    ? computeTotal(selectedSingleFee.totalAmount, discountType, discountValue)
    : 0

  // Handlers
  const handleSaveSingle = async () => {
    if (!selectedSchoolId) return
    if (!singleStudentId || !singleFeeId) {
      toast.error('يرجى اختيار الطالب والرسم')
      return
    }
    setSavingSingle(true)
    try {
      const res = await fetch(`/api/student-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          studentId: singleStudentId,
          feeId: singleFeeId,
          discountType: discountType === 'بدون' ? null : discountType,
          discountValue: discountValue || null,
          discountReason: discountReason || null,
        }),
      })

      if (res.ok) {
        toast.success('تم تخصيص الرسوم للطالب')
        setSingleStudentId('')
        setDiscountType('بدون')
        setDiscountValue('')
        setDiscountReason('')
        loadAssignments()
      } else if (res.status === 409) {
        toast.error('الرسوم مخصصة بالفعل لهذا الطالب')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل التخصيص')
      }
    } catch (err) {
      console.error('Error assigning fee:', err)
      toast.error('فشل التخصيص')
    } finally {
      setSavingSingle(false)
    }
  }

  const handleSaveBulk = async () => {
    if (!selectedSchoolId) return
    if (!bulkFeeId) {
      toast.error('يرجى اختيار الرسوم')
      return
    }
    if (selectedStudentIds.size === 0) {
      toast.error('يرجى اختيار طالب واحد على الأقل')
      return
    }
    setBulkSaving(true)
    setBulkProgress({ created: 0, skipped: 0 })
    try {
      const res = await fetch(`/api/student-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          studentIds: Array.from(selectedStudentIds),
          feeId: bulkFeeId,
          discountType: bulkDiscountType === 'بدون' ? null : bulkDiscountType,
          discountValue: bulkDiscountValue || null,
          discountReason: bulkDiscountReason || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setBulkProgress({ created: data.created || 0, skipped: data.skipped || 0 })
        toast.success(`تم تخصيص الرسوم لـ ${data.created} طالب (تم تخطي ${data.skipped})`)
        setSelectedStudentIds(new Set())
        loadAssignments()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل التخصيص')
      }
    } catch (err) {
      console.error('Error bulk assigning:', err)
      toast.error('فشل التخصيص')
    } finally {
      setBulkSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSchoolId || !deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/student-fees/${deleteTarget.id}?schoolId=${selectedSchoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف التخصيص')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        loadAssignments()
      } else if (res.status === 409) {
        toast.error('لا يمكن حذف التخصيص لوجود دفعات مرتبطة')
      } else {
        toast.error('فشل الحذف')
      }
    } catch (err) {
      console.error('Error deleting assignment:', err)
      toast.error('فشل الحذف')
    } finally {
      setDeleting(false)
    }
  }

  const openEdit = (a: Assignment) => {
    setEditTarget(a)
    setEditDiscountType(a.discountType || 'بدون')
    setEditDiscountValue(a.discountValue ? String(a.discountValue) : '')
    setEditDiscountReason(a.discountReason || '')
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedSchoolId || !editTarget) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/student-fees/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          discountType: editDiscountType === 'بدون' ? null : editDiscountType,
          discountValue: editDiscountValue || null,
          discountReason: editDiscountReason || null,
        }),
      })
      if (res.ok) {
        toast.success('تم تحديث الخصم')
        setEditOpen(false)
        loadAssignments()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل التحديث')
      }
    } catch (err) {
      console.error('Error updating discount:', err)
      toast.error('فشل التحديث')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === bulkStudents.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(bulkStudents.map((s) => s.id)))
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="list" className="min-h-[36px]">
            <Users className="w-4 h-4 ml-1" />
            التخصيصات
          </TabsTrigger>
          <TabsTrigger value="single" className="min-h-[36px]">
            <UserPlus className="w-4 h-4 ml-1" />
            تخصيص فردي
          </TabsTrigger>
          <TabsTrigger value="bulk" className="min-h-[36px]">
            <Users className="w-4 h-4 ml-1" />
            تخصيص جماعي
          </TabsTrigger>
        </TabsList>

        {/* ===== LIST TAB ===== */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2 text-[#610000]">
                  <Users className="w-5 h-5" />
                  تخصيصات الرسوم
                </span>
                <Button variant="outline" onClick={loadAssignments} className="min-h-[44px]">
                  <RefreshCw className="w-4 h-4 ml-1" />
                  تحديث
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="mb-1 block text-sm">بحث</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="ابحث باسم الطالب أو رقمه..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-9 min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="min-w-[200px]">
                  <Label className="mb-1 block text-sm">الرسوم</Label>
                  <Select value={feeFilter} onValueChange={setFeeFilter}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الرسوم</SelectItem>
                      {fees.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <Label className="mb-1 block text-sm">الصف</Label>
                  <Select value={gradeFilter} onValueChange={setGradeFilter}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>الطالب</TableHead>
                      <TableHead>رقم</TableHead>
                      <TableHead>الصف</TableHead>
                      <TableHead>الرسوم</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>الخصم</TableHead>
                      <TableHead>المدفوع</TableHead>
                      <TableHead>المتبقي</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 10 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          لا توجد تخصيصات
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignments.map((a) => {
                        const discount = a.fee.totalAmount - a.totalAmount
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.student.name}</TableCell>
                            <TableCell>{a.student.studentNumber}</TableCell>
                            <TableCell>{a.student.classroom?.gradeLevel || '-'}</TableCell>
                            <TableCell>{a.fee.name}</TableCell>
                            <TableCell>{formatCurrency(a.totalAmount)}</TableCell>
                            <TableCell>
                              {discount > 0 ? (
                                <Badge variant="outline" className="text-orange-700 border-orange-300">
                                  {a.discountType === 'نسبة'
                                    ? `${a.discountValue}%`
                                    : formatCurrency(discount)}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-green-700 font-medium">
                              {formatCurrency(a.totalPaid)}
                            </TableCell>
                            <TableCell className={a.remaining > 0 ? 'text-red-700 font-medium' : 'text-green-700'}>
                              {formatCurrency(a.remaining)}
                            </TableCell>
                            <TableCell>{statusBadge(a.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEdit(a)}
                                  className="min-h-[36px] min-w-[36px] p-0"
                                >
                                  <Tag className="w-4 h-4 text-[#610000]" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setDeleteTarget(a)
                                    setDeleteDialogOpen(true)
                                  }}
                                  className="min-h-[36px] min-w-[36px] p-0"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
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
        </TabsContent>

        {/* ===== SINGLE TAB ===== */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                تخصيص فردي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">الطالب *</Label>
                  <Select value={singleStudentId} onValueChange={setSingleStudentId}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="ابحث واختر الطالب" /></SelectTrigger>
                    <SelectContent>
                      {students
                        .filter((s) => !search || s.name.includes(search) || s.studentNumber.includes(search))
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} - {s.studentNumber} ({s.classroom?.gradeLevel || 'بدون صف'})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">الرسوم *</Label>
                  <Select value={singleFeeId} onValueChange={setSingleFeeId}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="اختر الرسوم" /></SelectTrigger>
                    <SelectContent>
                      {fees.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({formatCurrency(f.totalAmount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">نوع الخصم</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">قيمة الخصم</Label>
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'نسبة' ? '%' : 'ج.م'}
                    disabled={discountType === 'بدون' || discountType === 'إعفاء'}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block">سبب الخصم</Label>
                  <Input
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="سبب الخصم (اختياري)"
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {selectedSingleFee && (
                <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>الإجمالي الأصلي:</span>
                    <span className="font-medium">{formatCurrency(selectedSingleFee.totalAmount)}</span>
                  </div>
                  {discountType !== 'بدون' && (
                    <div className="flex items-center justify-between text-sm">
                      <span>الخصم:</span>
                      <span className="font-medium text-orange-700">
                        {discountType === 'إعفاء'
                          ? formatCurrency(selectedSingleFee.totalAmount)
                          : discountType === 'نسبة'
                            ? `${discountValue || 0}% (${formatCurrency((selectedSingleFee.totalAmount * Number(discountValue || 0)) / 100)})`
                            : formatCurrency(Number(discountValue || 0))}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base border-t pt-2">
                    <span className="font-bold">الإجمالي بعد الخصم:</span>
                    <span className="font-bold text-[#610000]">{formatCurrency(computedSingleTotal)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSaveSingle}
                disabled={savingSingle}
                className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]"
              >
                {savingSingle ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                {savingSingle ? 'جاري الحفظ...' : 'تخصيص'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== BULK TAB ===== */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <Users className="w-5 h-5" />
                تخصيص جماعي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">الرسوم *</Label>
                  <Select value={bulkFeeId} onValueChange={setBulkFeeId}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="اختر الرسوم" /></SelectTrigger>
                    <SelectContent>
                      {fees.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} ({formatCurrency(f.totalAmount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">الصف</Label>
                  <Select value={bulkGrade} onValueChange={setBulkGrade}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الصفوف</SelectItem>
                      {gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">نوع الخصم</Label>
                  <Select value={bulkDiscountType} onValueChange={setBulkDiscountType}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">قيمة الخصم</Label>
                  <Input
                    type="number"
                    value={bulkDiscountValue}
                    onChange={(e) => setBulkDiscountValue(e.target.value)}
                    placeholder={bulkDiscountType === 'نسبة' ? '%' : 'ج.م'}
                    disabled={bulkDiscountType === 'بدون' || bulkDiscountType === 'إعفاء'}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block">سبب الخصم</Label>
                  <Input
                    value={bulkDiscountReason}
                    onChange={(e) => setBulkDiscountReason(e.target.value)}
                    placeholder="سبب الخصم (اختياري)"
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {/* Progress info */}
              {bulkProgress && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div className="text-sm">
                    <span className="font-bold text-green-700">{bulkProgress.created}</span> تم إنشاؤه،
                    <span className="font-bold text-yellow-700 mr-2"> {bulkProgress.skipped}</span> تم تخطيه
                  </div>
                </div>
              )}

              {/* Students list */}
              <div className="border rounded-lg">
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                  <span className="font-medium">
                    الطلاب ({bulkStudents.length})
                    {selectedStudentIds.size > 0 && (
                      <Badge className="ml-2 bg-[#610000]/10 text-[#610000] hover:bg-[#610000]/10">
                        {selectedStudentIds.size} محدد
                      </Badge>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={toggleSelectAll}
                    className="min-h-[36px]"
                  >
                    {selectedStudentIds.size === bulkStudents.length && bulkStudents.length > 0
                      ? 'إلغاء تحديد الكل'
                      : 'تحديد الكل'}
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {bulkStudents.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      لا يوجد طلاب في هذا الصف
                    </div>
                  ) : (
                    <Table>
                      <TableBody>
                        {bulkStudents.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="w-12">
                              <Checkbox
                                checked={selectedStudentIds.has(s.id)}
                                onCheckedChange={() => toggleStudentSelection(s.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>{s.studentNumber}</TableCell>
                            <TableCell>{s.classroom?.gradeLevel || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSaveBulk}
                disabled={bulkSaving || selectedStudentIds.size === 0}
                className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]"
              >
                {bulkSaving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
                {bulkSaving
                  ? 'جاري التخصيص...'
                  : `تخصيص لـ ${selectedStudentIds.size} طالب`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف تخصيص الرسوم للطالب "{deleteTarget?.student.name}"؟
              لا يمكن الحذف في حال وجود دفعات مرتبطة.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="min-h-[44px]"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="destructive"
              className="min-h-[44px]"
            >
              {deleting ? 'جاري الحذف...' : 'حذف'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit discount dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الخصم</DialogTitle>
            <DialogDescription>
              {editTarget?.student.name} - {editTarget?.fee.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">نوع الخصم</Label>
              <Select value={editDiscountType} onValueChange={setEditDiscountType}>
                <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">قيمة الخصم</Label>
              <Input
                type="number"
                value={editDiscountValue}
                onChange={(e) => setEditDiscountValue(e.target.value)}
                disabled={editDiscountType === 'بدون' || editDiscountType === 'إعفاء'}
                className="min-h-[44px]"
              />
            </div>
            <div>
              <Label className="mb-1 block">سبب الخصم</Label>
              <Input
                value={editDiscountReason}
                onChange={(e) => setEditDiscountReason(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]"
            >
              {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
