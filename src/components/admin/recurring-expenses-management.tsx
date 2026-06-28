'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Search, AlertCircle, Loader2, RefreshCw,
  Calendar, Repeat, Clock, Zap, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  resolveSchool, formatCurrency, formatDate, FREQUENCIES,
  FREQUENCY_COLORS, PAYMENT_METHODS, isOverdue,
} from '@/lib/expense-utils'

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

interface RecurringExpense {
  id: string
  title: string
  amount: number
  frequency: string
  startDate: string
  endDate: string | null
  nextRunDate: string
  lastRunDate: string | null
  paymentMethod: string
  recipient: string | null
  reference: string | null
  notes: string | null
  active: boolean
  autoGenerate: boolean
  categoryId: string | null
  vendorId: string | null
  category: { id: string; name: string; color: string | null; icon: string | null } | null
  vendor: { id: string; name: string; type: string | null } | null
  _count?: { expenses: number }
}

interface RecurringForm {
  title: string
  amount: string
  categoryId: string
  vendorId: string
  frequency: string
  startDate: string
  endDate: string
  paymentMethod: string
  recipient: string
  reference: string
  autoGenerate: boolean
  notes: string
  active: boolean
}

const todayStr = () => new Date().toISOString().slice(0, 10)

const defaultForm: RecurringForm = {
  title: '',
  amount: '',
  categoryId: '',
  vendorId: '',
  frequency: 'شهري',
  startDate: todayStr(),
  endDate: '',
  paymentMethod: 'نقدي',
  recipient: '',
  reference: '',
  autoGenerate: false,
  notes: '',
  active: true,
}

export function RecurringExpensesManagement() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const [form, setForm] = useState<RecurringForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RecurringExpense | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState('list')

  // Load categories & vendors
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

  // Fetch recurring expenses
  const fetchRecurring = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (search.trim()) params.set('search', search.trim())
        if (activeFilter === 'true') params.set('active', 'true')
        if (activeFilter === 'false') params.set('active', 'false')
        const res = await fetch(`/api/recurring-expenses?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setRecurring(Array.isArray(data.recurringExpenses) ? data.recurringExpenses : [])
          } else {
            toast.error('فشل في تحميل المصروفات المتكررة')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل المصروفات المتكررة')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, search, activeFilter])

  useEffect(() => fetchRecurring(), [fetchRecurring])

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (r: RecurringExpense) => {
    setEditId(r.id)
    setForm({
      title: r.title,
      amount: String(r.amount),
      categoryId: r.categoryId || '',
      vendorId: r.vendorId || '',
      frequency: r.frequency,
      startDate: new Date(r.startDate).toISOString().slice(0, 10),
      endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : '',
      paymentMethod: r.paymentMethod || 'نقدي',
      recipient: r.recipient || '',
      reference: r.reference || '',
      autoGenerate: r.autoGenerate,
      notes: r.notes || '',
      active: r.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.amount || !form.frequency || !form.startDate) {
      toast.error('العنوان والمبلغ والتكرار وتاريخ البدء مطلوبة')
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
        title: form.title.trim(),
        amount: amt,
        categoryId: form.categoryId || null,
        vendorId: form.vendorId || null,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || null,
        paymentMethod: form.paymentMethod,
        recipient: form.recipient || null,
        reference: form.reference || null,
        autoGenerate: form.autoGenerate,
        notes: form.notes || null,
        active: form.active,
      }
      const url = editId
        ? `/api/recurring-expenses/${editId}?schoolId=${schoolId}`
        : `/api/recurring-expenses?schoolId=${schoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث المصروف المتكرر' : 'تم إضافة المصروف المتكرر')
        setDialogOpen(false)
        fetchRecurring()
        if (!editId) {
          setForm(defaultForm)
          setActiveTab('list')
        }
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
        `/api/recurring-expenses/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف المصروف المتكرر')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchRecurring()
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف المصروف المتكرر')
      } else {
        toast.error(data.error || 'فشل في الحذف')
      }
    } catch {
      toast.error('فشل في الحذف')
    } finally {
      setDeleting(false)
    }
  }

  const handleGenerate = async (r: RecurringExpense) => {
    setGeneratingId(r.id)
    try {
      const res = await fetch(
        `/api/recurring-expenses/${r.id}/generate?schoolId=${schoolId}`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success(`تم توليد مصروف «${r.title}» بنجاح`)
        fetchRecurring()
      } else {
        toast.error(data.error || 'فشل في توليد المصروف')
      }
    } catch {
      toast.error('فشل في توليد المصروف')
    } finally {
      setGeneratingId(null)
    }
  }

  const toggleActive = async (r: RecurringExpense) => {
    try {
      const res = await fetch(
        `/api/recurring-expenses/${r.id}?schoolId=${schoolId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !r.active }),
        }
      )
      if (res.ok) {
        toast.success(!r.active ? 'تم التفعيل' : 'تم الإيقاف')
        fetchRecurring()
      } else {
        toast.error('فشل في تحديث الحالة')
      }
    } catch {
      toast.error('فشل في تحديث الحالة')
    }
  }

  // Filter past-due recurring
  const dueList = recurring.filter(
    (r) => r.active && isOverdue(r.nextRunDate)
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Repeat className="w-5 h-5 text-[#610000]" />
          المصروفات المتكررة
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Repeat className="w-4 h-4 ml-1" /> القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة مصروف متكرر
          </TabsTrigger>
          <TabsTrigger value="due" className="data-[state=active]:bg-white">
            <Clock className="w-4 h-4 ml-1" /> المستحقة الآن
            {dueList.length > 0 && (
              <Badge className="bg-red-600 text-white ml-1 text-xs">{dueList.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث بالعنوان أو المستلم..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {[
                    { value: 'all', label: 'الكل' },
                    { value: 'true', label: 'نشط' },
                    { value: 'false', label: 'متوقف' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActiveFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px] ${
                        activeFilter === opt.value
                          ? 'bg-white text-[#610000] shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={openAdd}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : recurring.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد مصروفات متكررة مسجلة.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>العنوان</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>التكرار</TableHead>
                        <TableHead>التنفيذ القادم</TableHead>
                        <TableHead>آخر تنفيذ</TableHead>
                        <TableHead>المورد</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recurring.map((r) => {
                        const overdue = isOverdue(r.nextRunDate)
                        return (
                          <TableRow key={r.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {r.category && (
                                  <span
                                    className="inline-block w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: r.category.color || '#610000' }}
                                  />
                                )}
                                <div>
                                  <p className="font-medium text-gray-800">{r.title}</p>
                                  {r._count && r._count.expenses > 0 && (
                                    <p className="text-xs text-gray-400">
                                      تم توليد {r._count.expenses} مرة
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-[#610000]">
                                {formatCurrency(r.amount)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                  FREQUENCY_COLORS[r.frequency] || 'bg-gray-100 text-gray-700 border-gray-200'
                                }`}
                              >
                                {r.frequency}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span
                                  className={`font-mono text-sm ${
                                    overdue ? 'text-red-600 font-bold' : 'text-gray-700'
                                  }`}
                                  dir="ltr"
                                >
                                  {formatDate(r.nextRunDate)}
                                </span>
                                {overdue && (
                                  <span className="text-xs text-red-500 inline-flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" />
                                    مستحقة
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {r.lastRunDate ? (
                                <span className="font-mono text-sm text-gray-600" dir="ltr">
                                  {formatDate(r.lastRunDate)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {r.vendor ? (
                                <span className="text-sm text-gray-700">{r.vendor.name}</span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={r.active}
                                onCheckedChange={() => toggleActive(r)}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleGenerate(r)}
                                  disabled={generatingId === r.id}
                                  className="h-9 w-9 text-green-600 hover:bg-green-50"
                                  title="توليد الآن"
                                >
                                  {generatingId === r.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Zap className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEdit(r)}
                                  className="h-9 w-9 text-[#610000] hover:bg-[#610000]/10"
                                  title="تعديل"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setDeleteTarget(r)
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
                إضافة مصروف متكرر جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>العنوان <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="مثال: إيجار المقر الشهري"
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
                  <Label>التكرار <span className="text-red-500">*</span></Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) => setForm({ ...form, frequency: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ البدء <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ الانتهاء (اختياري)</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
                <div className="space-y-1.5">
                  <Label>التوليد التلقائي</Label>
                  <div className="flex items-center gap-3 h-11">
                    <Switch
                      checked={form.autoGenerate}
                      onCheckedChange={(v) => setForm({ ...form, autoGenerate: v })}
                    />
                    <span className="text-sm text-gray-600">
                      {form.autoGenerate ? 'مفعّل' : 'متوقف'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>الحالة</Label>
                  <div className="flex items-center gap-3 h-11">
                    <Switch
                      checked={form.active}
                      onCheckedChange={(v) => setForm({ ...form, active: v })}
                    />
                    <span className="text-sm text-gray-600">
                      {form.active ? 'نشط' : 'متوقف'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
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
                  حفظ
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Due Tab */}
        <TabsContent value="due" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600">
                المصروفات المتكررة المستحقة للتنفيذ ({dueList.length})
              </p>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : dueList.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد مصروفات مستحقة الآن.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {dueList.map((r) => (
                <Card key={r.id} className="border-r-4 border-r-red-500">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                          {r.category && (
                            <span
                              className="inline-block w-3 h-3 rounded-full"
                              style={{ backgroundColor: r.category.color || '#610000' }}
                            />
                          )}
                          <span className="font-medium text-gray-800">{r.title}</span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                              FREQUENCY_COLORS[r.frequency] || 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {r.frequency}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <Clock className="w-3 h-3" />
                            مستحقة منذ: <span className="font-mono" dir="ltr">{formatDate(r.nextRunDate)}</span>
                          </span>
                          {r.vendor && (
                            <span className="inline-flex items-center gap-1">
                              المورد: {r.vendor.name}
                            </span>
                          )}
                          {r.recipient && (
                            <span>المستلم: {r.recipient}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-end">
                          <p className="text-xs text-gray-400">المبلغ</p>
                          <p className="font-mono font-bold text-[#610000]">
                            {formatCurrency(r.amount)}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleGenerate(r)}
                          disabled={generatingId === r.id}
                          className="bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
                        >
                          {generatingId === r.id ? (
                            <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4 ml-1" />
                          )}
                          توليد الآن
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? 'تعديل المصروف المتكرر' : 'إضافة مصروف متكرر'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>العنوان <span className="text-red-500">*</span></Label>
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
                <Label>التكرار <span className="text-red-500">*</span></Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ البدء <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ الانتهاء</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
                <Label>المرجع</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>المستلم</Label>
              <Input
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>التوليد التلقائي</Label>
                <div className="flex items-center gap-3 h-11">
                  <Switch
                    checked={form.autoGenerate}
                    onCheckedChange={(v) => setForm({ ...form, autoGenerate: v })}
                  />
                  <span className="text-sm text-gray-600">
                    {form.autoGenerate ? 'مفعّل' : 'متوقف'}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <div className="flex items-center gap-3 h-11">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                  <span className="text-sm text-gray-600">
                    {form.active ? 'نشط' : 'متوقف'}
                  </span>
                </div>
              </div>
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
              هل أنت متأكد من حذف المصروف المتكرر «{deleteTarget?.title}»؟
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
