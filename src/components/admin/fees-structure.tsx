'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Search, Filter, Save, X, Calendar,
  Coins, Layers, ListChecks, RefreshCw, AlertCircle,
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
interface AcademicYear {
  id: string
  name: string
  isActive: boolean
}

interface Classroom {
  id: string
  name: string
  gradeLevel: string
}

interface FeeInstallment {
  id: string
  installmentNo: number
  amount: number
  dueDate: string
}

interface Fee {
  id: string
  name: string
  feeType: string
  gradeLevel: string | null
  totalAmount: number
  installments: number
  installmentAmount: number | null
  dueDates: string
  active: boolean
  createdAt: string
  academicYear?: { name: string } | null
  _count?: { studentFees: number; feeInstallments: number }
  feeInstallments?: FeeInstallment[]
}

const FEE_TYPES = ['دراسة', 'أنشطة', 'كتب', 'أخرى']

const formatCurrency = (n: number) => `${Number(n || 0).toLocaleString('ar-EG')} ج.م`

const formatDate = (d: string | Date) => {
  const date = new Date(d)
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function FeesStructure() {
  const { selectedSchoolId } = useAdminStore()

  const [activeTab, setActiveTab] = useState('list')
  const [fees, setFees] = useState<Fee[]>([])
  const [loading, setLoading] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [feeTypeFilter, setFeeTypeFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    feeType: 'دراسة',
    gradeLevel: 'all',
    academicYearId: '',
    totalAmount: '',
    installments: '1',
    dueDates: [] as string[],
    active: true,
  })

  // Installments tab
  const [selectedFeeId, setSelectedFeeId] = useState<string>('')
  const [installments, setInstallments] = useState<FeeInstallment[]>([])
  const [installmentsLoading, setInstallmentsLoading] = useState(false)
  const [editedInstallments, setEditedInstallments] = useState<Record<number, { amount: string; dueDate: string }>>({})
  const [savingInstallment, setSavingInstallment] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Fee | null>(null)
  const [deleting, setDeleting] = useState(false)

  const gradeLevels = Array.from(new Set(classrooms.map((c) => c.gradeLevel).filter(Boolean)))

  // Load academic years and classrooms once
  useEffect(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      try {
        const [yRes, cRes] = await Promise.all([
          fetch(`/api/academic-years?schoolId=${selectedSchoolId}`),
          fetch(`/api/classrooms?schoolId=${selectedSchoolId}`),
        ])
        if (!cancelled) {
          if (yRes.ok) {
            const yData = await yRes.json()
            const years = Array.isArray(yData) ? yData : yData.academicYears || []
            setAcademicYears(years)
            const active = years.find((y: AcademicYear) => y.isActive)
            if (active) setForm((f) => ({ ...f, academicYearId: active.id }))
            else if (years.length > 0) setForm((f) => ({ ...f, academicYearId: years[0].id }))
          }
          if (cRes.ok) {
            const cData = await cRes.json()
            const list = Array.isArray(cData) ? cData : cData.classrooms || []
            setClassrooms(list)
          }
        }
      } catch (err) {
        if (!cancelled) console.error('Error loading meta:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load fees
  const loadFees = useCallback(() => {
    if (!selectedSchoolId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search) params.set('search', search)
        if (feeTypeFilter !== 'all') params.set('feeType', feeTypeFilter)
        if (gradeFilter !== 'all') params.set('gradeLevel', gradeFilter)
        if (activeFilter !== 'all') params.set('active', activeFilter)

        const res = await fetch(`/api/fees?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setFees(data.fees || [])
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching fees:', err)
          toast.error('فشل تحميل الرسوم')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, search, feeTypeFilter, gradeFilter, activeFilter])

  useEffect(() => {
    const cleanup = loadFees()
    return cleanup
  }, [loadFees])

  // Load installments for selected fee
  useEffect(() => {
    if (!selectedSchoolId || !selectedFeeId) return
    let cancelled = false
    const load = async () => {
      setInstallmentsLoading(true)
      try {
        const res = await fetch(
          `/api/fees/${selectedFeeId}/installments?schoolId=${selectedSchoolId}`
        )
        if (res.ok && !cancelled) {
          const data = await res.json()
          setInstallments(data.installments || [])
          const edits: Record<number, { amount: string; dueDate: string }> = {}
          ;(data.installments || []).forEach((i: FeeInstallment) => {
            edits[i.installmentNo] = {
              amount: String(i.amount),
              dueDate: new Date(i.dueDate).toISOString().split('T')[0],
            }
          })
          setEditedInstallments(edits)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching installments:', err)
          toast.error('فشل تحميل الأقساط')
        }
      } finally {
        if (!cancelled) setInstallmentsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, selectedFeeId])

  // Handlers
  const openCreate = () => {
    setEditingFee(null)
    setForm({
      name: '',
      feeType: 'دراسة',
      gradeLevel: 'all',
      academicYearId: academicYears.find((y) => y.isActive)?.id || academicYears[0]?.id || '',
      totalAmount: '',
      installments: '1',
      dueDates: [new Date().toISOString().split('T')[0]],
      active: true,
    })
    setFormOpen(true)
  }

  const openEdit = (fee: Fee) => {
    let dueDates: string[] = []
    try {
      dueDates = JSON.parse(fee.dueDates || '[]')
    } catch { dueDates = [] }

    setEditingFee(fee)
    setForm({
      name: fee.name,
      feeType: fee.feeType || 'دراسة',
      gradeLevel: fee.gradeLevel || 'all',
      academicYearId: '',
      totalAmount: String(fee.totalAmount),
      installments: String(fee.installments),
      dueDates: dueDates.length > 0
        ? dueDates
        : Array.from({ length: fee.installments }, () => new Date().toISOString().split('T')[0]),
      active: fee.active,
    })
    setFormOpen(true)
  }

  const handleInstallmentsCountChange = (val: string) => {
    const n = Math.max(1, Number(val) || 1)
    setForm((f) => {
      const dates = [...f.dueDates]
      while (dates.length < n) {
        dates.push(new Date().toISOString().split('T')[0])
      }
      while (dates.length > n) {
        dates.pop()
      }
      return { ...f, installments: String(n), dueDates: dates }
    })
  }

  const handleSave = async () => {
    if (!selectedSchoolId) return
    if (!form.name || !form.totalAmount || !form.academicYearId) {
      toast.error('يرجى تعبئة الاسم والإجمالي والسنة الدراسية')
      return
    }
    setSaving(true)
    try {
      const payload = {
        schoolId: selectedSchoolId,
        academicYearId: form.academicYearId,
        name: form.name,
        feeType: form.feeType,
        gradeLevel: form.gradeLevel === 'all' ? null : form.gradeLevel,
        totalAmount: Number(form.totalAmount),
        installments: Number(form.installments),
        dueDates: form.dueDates,
        active: form.active,
      }

      let res
      if (editingFee) {
        res = await fetch(`/api/fees/${editingFee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/fees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(editingFee ? 'تم تحديث الرسوم' : 'تم إنشاء الرسوم')
        setFormOpen(false)
        loadFees()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل الحفظ')
      }
    } catch (err) {
      console.error('Error saving fee:', err)
      toast.error('فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSchoolId || !deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/fees/${deleteTarget.id}?schoolId=${selectedSchoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الرسوم')
        setDeleteDialogOpen(false)
        setDeleteTarget(null)
        loadFees()
      } else if (res.status === 409) {
        toast.error('لا يمكن حذف الرسوم لوجود دفعات مرتبطة')
      } else {
        toast.error('فشل الحذف')
      }
    } catch (err) {
      console.error('Error deleting fee:', err)
      toast.error('فشل الحذف')
    } finally {
      setDeleting(false)
    }
  }

  const saveInstallment = async (no: number) => {
    if (!selectedSchoolId || !selectedFeeId) return
    const edit = editedInstallments[no]
    if (!edit) return
    setSavingInstallment(true)
    try {
      const res = await fetch(`/api/fees/${selectedFeeId}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          installmentNo: no,
          amount: Number(edit.amount),
          dueDate: edit.dueDate,
        }),
      })
      if (res.ok) {
        toast.success(`تم حفظ القسط رقم ${no}`)
        // Reload
        const listRes = await fetch(`/api/fees/${selectedFeeId}/installments?schoolId=${selectedSchoolId}`)
        if (listRes.ok) {
          const data = await listRes.json()
          setInstallments(data.installments || [])
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل الحفظ')
      }
    } catch (err) {
      console.error('Error saving installment:', err)
      toast.error('فشل الحفظ')
    } finally {
      setSavingInstallment(false)
    }
  }

  const computedInstallmentAmount = form.totalAmount && form.installments
    ? Number(form.totalAmount) / Math.max(1, Number(form.installments))
    : 0

  return (
    <div className="space-y-4" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border">
          <TabsTrigger value="list" className="min-h-[36px]">
            <ListChecks className="w-4 h-4 ml-1" />
            القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="min-h-[36px]">
            <Plus className="w-4 h-4 ml-1" />
            إضافة رسم
          </TabsTrigger>
          <TabsTrigger value="installments" className="min-h-[36px]">
            <Layers className="w-4 h-4 ml-1" />
            الأقساط
          </TabsTrigger>
        </TabsList>

        {/* ===== LIST TAB ===== */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2 text-[#610000]">
                  <Coins className="w-5 h-5" />
                  الرسوم الدراسية
                </span>
                <Button
                  onClick={openCreate}
                  className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة رسم
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="mb-1 block text-sm">بحث</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="ابحث بالاسم..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-9 min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="min-w-[160px]">
                  <Label className="mb-1 block text-sm">النوع</Label>
                  <Select value={feeTypeFilter} onValueChange={setFeeTypeFilter}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {FEE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
                <div className="min-w-[120px]">
                  <Label className="mb-1 block text-sm">الحالة</Label>
                  <Select value={activeFilter} onValueChange={setActiveFilter}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="true">نشط</SelectItem>
                      <SelectItem value="false">غير نشط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={loadFees}
                  className="min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4 ml-1" />
                  تحديث
                </Button>
              </div>

              {/* Table */}
              <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الصف</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>عدد الأقساط</TableHead>
                      <TableHead>قيمة القسط</TableHead>
                      <TableHead>عدد الطلاب</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : fees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          لا توجد رسوم
                        </TableCell>
                      </TableRow>
                    ) : (
                      fees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{fee.feeType}</Badge>
                          </TableCell>
                          <TableCell>{fee.gradeLevel || 'الكل'}</TableCell>
                          <TableCell>{formatCurrency(fee.totalAmount)}</TableCell>
                          <TableCell>{fee.installments}</TableCell>
                          <TableCell>{formatCurrency(fee.installmentAmount || 0)}</TableCell>
                          <TableCell>{fee._count?.studentFees || 0}</TableCell>
                          <TableCell>
                            <Badge
                              className={fee.active
                                ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-100'}
                            >
                              {fee.active ? 'نشط' : 'موقوف'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(fee)}
                                className="min-h-[36px] min-w-[36px] p-0"
                              >
                                <Edit className="w-4 h-4 text-[#610000]" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(fee)
                                  setDeleteDialogOpen(true)
                                }}
                                className="min-h-[36px] min-w-[36px] p-0"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
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
        </TabsContent>

        {/* ===== ADD/EDIT TAB ===== */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingFee ? 'تعديل رسم' : 'إضافة رسم جديد'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">اسم الرسوم *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="مثال: رسوم الدراسة - الصف الأول"
                    className="min-h-[44px]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">النوع</Label>
                  <Select value={form.feeType} onValueChange={(v) => setForm({ ...form, feeType: v })}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FEE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">الصف الدراسي</Label>
                  <Select value={form.gradeLevel} onValueChange={(v) => setForm({ ...form, gradeLevel: v })}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الصفوف</SelectItem>
                      {gradeLevels.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">السنة الدراسية *</Label>
                  <Select value={form.academicYearId} onValueChange={(v) => setForm({ ...form, academicYearId: v })}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="اختر السنة" /></SelectTrigger>
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
                  <Label className="mb-1 block">الإجمالي (ج.م) *</Label>
                  <Input
                    type="number"
                    value={form.totalAmount}
                    onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                    placeholder="0"
                    className="min-h-[44px]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">عدد الأقساط</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.installments}
                    onChange={(e) => handleInstallmentsCountChange(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {/* Computed installment amount */}
              <div className="bg-[#610000]/5 border border-[#610000]/20 rounded-lg p-3 flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#610000]" />
                <span className="text-sm">
                  قيمة القسط المحسوبة تلقائياً:{' '}
                  <span className="font-bold text-[#610000]">
                    {formatCurrency(computedInstallmentAmount)}
                  </span>
                </span>
              </div>

              {/* Due dates */}
              <div>
                <Label className="mb-2 block">تواريخ الاستحقاق ({form.dueDates.length})</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {form.dueDates.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className="min-w-[60px] justify-center">قسط {i + 1}</Badge>
                      <Input
                        type="date"
                        value={d}
                        onChange={(e) => {
                          const newDates = [...form.dueDates]
                          newDates[i] = e.target.value
                          setForm({ ...form, dueDates: newDates })
                        }}
                        className="min-h-[44px]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="active"
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: !!checked })}
                />
                <Label htmlFor="active" className="cursor-pointer">نشط</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]"
                >
                  <Save className="w-4 h-4 ml-1" />
                  {saving ? 'جاري الحفظ...' : editingFee ? 'تحديث' : 'حفظ'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false)
                    setActiveTab('list')
                  }}
                  className="min-h-[44px]"
                >
                  <X className="w-4 h-4 ml-1" />
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== INSTALLMENTS TAB ===== */}
        <TabsContent value="installments">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#610000] flex items-center gap-2">
                <Layers className="w-5 h-5" />
                إدارة الأقساط
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-1 block">اختر الرسوم</Label>
                <Select value={selectedFeeId} onValueChange={setSelectedFeeId}>
                  <SelectTrigger className="min-h-[44px] w-full">
                    <SelectValue placeholder="اختر الرسوم" />
                  </SelectTrigger>
                  <SelectContent>
                    {fees.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} ({formatCurrency(f.totalAmount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedFeeId ? (
                <div className="text-center text-gray-500 py-8">
                  <Layers className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  اختر رسوم لعرض أقساطها
                </div>
              ) : installmentsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : installments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  لا توجد أقساط لهذه الرسوم
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>القسط رقم</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>تاريخ الاستحقاق</TableHead>
                        <TableHead>إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.map((inst) => {
                        const edit = editedInstallments[inst.installmentNo] || {
                          amount: String(inst.amount),
                          dueDate: new Date(inst.dueDate).toISOString().split('T')[0],
                        }
                        return (
                          <TableRow key={inst.id}>
                            <TableCell>
                              <Badge className="bg-[#610000]/10 text-[#610000] hover:bg-[#610000]/10">
                                {inst.installmentNo}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={edit.amount}
                                onChange={(e) =>
                                  setEditedInstallments({
                                    ...editedInstallments,
                                    [inst.installmentNo]: {
                                      ...edit,
                                      amount: e.target.value,
                                    },
                                  })
                                }
                                className="min-h-[40px] w-32"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={edit.dueDate}
                                onChange={(e) =>
                                  setEditedInstallments({
                                    ...editedInstallments,
                                    [inst.installmentNo]: {
                                      ...edit,
                                      dueDate: e.target.value,
                                    },
                                  })
                                }
                                className="min-h-[40px] w-44"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => saveInstallment(inst.installmentNo)}
                                disabled={savingInstallment}
                                className="bg-[#610000] hover:bg-[#7a0000] min-h-[36px]"
                              >
                                <Save className="w-3.5 h-3.5 ml-1" />
                                حفظ
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف رسوم "{deleteTarget?.name}"؟
              سيتم حذف الأقساط والتخصيصات المرتبطة بها (في حال عدم وجود دفعات).
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

      {/* Edit Dialog (alternate UI - unused but kept for compatibility) */}
      <Dialog open={formOpen && !!editingFee} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل رسم</DialogTitle>
            <DialogDescription>عدّل بيانات الرسوم ثم احفظ</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الاسم</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-[44px]" />
            </div>
            <div>
              <Label>الإجمالي</Label>
              <Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} className="min-h-[44px]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button onClick={handleSave} disabled={saving} className="bg-[#610000] hover:bg-[#7a0000] min-h-[44px]">
              <Save className="w-4 h-4 ml-1" />
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
