'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Search, Truck, AlertCircle, Loader2,
  Phone, Mail, MapPin, User, Building, Printer, FileText, X,
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
  resolveSchool, formatCurrency, formatDate, getStatusColor,
  VENDOR_TYPES, VENDOR_TYPE_COLORS,
} from '@/lib/expense-utils'

interface Vendor {
  id: string
  name: string
  type: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxNumber: string | null
  taxOffice: string | null
  bankName: string | null
  bankAccount: string | null
  openingBalance: number
  notes: string | null
  active: boolean
  _count?: { expenses: number; recurringExpenses: number }
}

interface VendorWithExpenses extends Vendor {
  expenses?: Array<{
    id: string
    title: string
    amount: number
    expenseDate: string
    status: string
    paymentMethod: string
    category: { id: string; name: string } | null
  }>
}

interface VendorForm {
  name: string
  type: string
  contactPerson: string
  phone: string
  email: string
  address: string
  taxNumber: string
  taxOffice: string
  bankName: string
  bankAccount: string
  openingBalance: string
  notes: string
  active: boolean
}

const defaultForm: VendorForm = {
  name: '',
  type: 'مورد',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  taxOffice: '',
  bankName: '',
  bankAccount: '',
  openingBalance: '0',
  notes: '',
  active: true,
}

export function ExpenseVendorsManagement() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const [form, setForm] = useState<VendorForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [activeTab, setActiveTab] = useState('list')
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [vendorDetails, setVendorDetails] = useState<VendorWithExpenses | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const fetchVendors = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (search.trim()) params.set('search', search.trim())
        if (activeFilter === 'true') params.set('active', 'true')
        if (activeFilter === 'false') params.set('active', 'false')
        if (typeFilter !== 'all') params.set('type', typeFilter)
        const res = await fetch(`/api/expense-vendors?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setVendors(Array.isArray(data.vendors) ? data.vendors : [])
          } else {
            toast.error('فشل في تحميل الموردين')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الموردين')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, search, activeFilter, typeFilter])

  useEffect(() => fetchVendors(), [fetchVendors])

  // Load vendor details when selected
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedVendorId) {
        if (!cancelled) setVendorDetails(null)
        return
      }
      try {
        setDetailsLoading(true)
        const res = await fetch(
          `/api/expense-vendors/${selectedVendorId}?schoolId=${schoolId}`
        )
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setVendorDetails(data)
          } else {
            toast.error('فشل في تحميل تفاصيل المورد')
            setVendorDetails(null)
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل تفاصيل المورد')
          setVendorDetails(null)
        }
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedVendorId, schoolId])

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (v: Vendor) => {
    setEditId(v.id)
    setForm({
      name: v.name,
      type: v.type || 'مورد',
      contactPerson: v.contactPerson || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
      taxNumber: v.taxNumber || '',
      taxOffice: v.taxOffice || '',
      bankName: v.bankName || '',
      bankAccount: v.bankAccount || '',
      openingBalance: String(v.openingBalance || 0),
      notes: v.notes || '',
      active: v.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('اسم المورد مطلوب')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        contactPerson: form.contactPerson || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        taxNumber: form.taxNumber || null,
        taxOffice: form.taxOffice || null,
        bankName: form.bankName || null,
        bankAccount: form.bankAccount || null,
        openingBalance: Number(form.openingBalance) || 0,
        notes: form.notes || null,
        active: form.active,
      }
      const url = editId
        ? `/api/expense-vendors/${editId}?schoolId=${schoolId}`
        : `/api/expense-vendors?schoolId=${schoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث المورد' : 'تم إضافة المورد بنجاح')
        setDialogOpen(false)
        fetchVendors()
        if (!editId) {
          setForm(defaultForm)
          setActiveTab('list')
        }
      } else if (res.status === 409) {
        toast.error(data.error || 'اسم المورد مُستخدم بالفعل')
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
        `/api/expense-vendors/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف المورد')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchVendors()
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف المورد لوجود مصروفات مرتبطة')
      } else {
        toast.error(data.error || 'فشل في حذف المورد')
      }
    } catch {
      toast.error('فشل في حذف المورد')
    } finally {
      setDeleting(false)
    }
  }

  const totalSpent = vendorDetails?.expenses?.reduce(
    (s, e) => s + (e.status !== 'مرفوض' ? e.amount : 0),
    0
  ) || 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#610000]" />
          إدارة الموردين
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Truck className="w-4 h-4 ml-1" /> القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة مورد
          </TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-white">
            <FileText className="w-4 h-4 ml-1" /> تفاصيل المورد
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
                    placeholder="بحث بالاسم أو المسؤول أو الهاتف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    {VENDOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  إضافة مورد
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا يوجد موردون مسجلون.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>المورد</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>المسؤول</TableHead>
                        <TableHead>الهاتف</TableHead>
                        <TableHead>الرقم الضريبي</TableHead>
                        <TableHead className="text-center">المصروفات</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map((v) => (
                        <TableRow key={v.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-[#610000]/10 flex items-center justify-center shrink-0">
                                <Building className="w-4 h-4 text-[#610000]" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{v.name}</p>
                                {!v.active && (
                                  <Badge variant="outline" className="text-xs">متوقف</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                VENDOR_TYPE_COLORS[v.type] || 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {v.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            {v.contactPerson ? (
                              <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {v.contactPerson}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {v.phone ? (
                              <span className="font-mono text-sm text-gray-700" dir="ltr">
                                {v.phone}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {v.taxNumber ? (
                              <span className="font-mono text-sm text-gray-700" dir="ltr">
                                {v.taxNumber}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono text-gray-700">
                              {v._count?.expenses || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedVendorId(v.id)
                                  setActiveTab('details')
                                }}
                                className="h-9 w-9 text-sky-600 hover:bg-sky-50"
                                title="عرض التفاصيل"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(v)}
                                className="h-9 w-9 text-[#610000] hover:bg-[#610000]/10"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(v)
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
                إضافة مورد جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>اسم المورد <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="مثال: شركة النور للأدوات المدرسية"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>النوع</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDOR_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>المسؤول</Label>
                  <Input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    placeholder="اسم الشخص المسؤول"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الهاتف</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01000000000"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="info@example.com"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>العنوان</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="العنوان"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الرقم الضريبي</Label>
                  <Input
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    placeholder="123-456-789"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ال مأمورية الضرائب</Label>
                  <Input
                    value={form.taxOffice}
                    onChange={(e) => setForm({ ...form, taxOffice: e.target.value })}
                    placeholder="ال مأمورية"
                    className="h-11"
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
                  <Label>رقم الحساب البنكي</Label>
                  <Input
                    value={form.bankAccount}
                    onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                    placeholder="000000000000"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>رصيد افتتاحي</Label>
                  <Input
                    type="number"
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
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
                  placeholder="ملاحظات إضافية"
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
                  حفظ المورد
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[280px]">
                  <Label>اختر المورد</Label>
                  <Select
                    value={selectedVendorId}
                    onValueChange={setSelectedVendorId}
                  >
                    <SelectTrigger className="h-11 mt-1.5">
                      <SelectValue placeholder="اختر المورد..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} {v.type ? `(${v.type})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {vendorDetails && (
                  <Button
                    onClick={() => window.print()}
                    className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                  >
                    <Printer className="w-4 h-4 ml-1" />
                    طباعة
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {!selectedVendorId ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">اختر موردًا لعرض تفاصيله ومصروفاته.</p>
              </CardContent>
            </Card>
          ) : detailsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : vendorDetails ? (
            <div className="space-y-4">
              {/* Vendor Info Card */}
              <Card className="border-2 border-[#610000]/20 print:shadow-none print:border-2 print:border-[#610000]">
                <CardHeader className="bg-[#610000]/5 print:bg-[#610000]/5">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-[#610000]" />
                      {vendorDetails.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        VENDOR_TYPE_COLORS[vendorDetails.type] || 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {vendorDetails.type}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vendorDetails.contactPerson && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">المسؤول</p>
                          <p className="text-sm font-medium">{vendorDetails.contactPerson}</p>
                        </div>
                      </div>
                    )}
                    {vendorDetails.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">الهاتف</p>
                          <p className="text-sm font-mono" dir="ltr">{vendorDetails.phone}</p>
                        </div>
                      </div>
                    )}
                    {vendorDetails.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">البريد الإلكتروني</p>
                          <p className="text-sm font-mono" dir="ltr">{vendorDetails.email}</p>
                        </div>
                      </div>
                    )}
                    {vendorDetails.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">العنوان</p>
                          <p className="text-sm">{vendorDetails.address}</p>
                        </div>
                      </div>
                    )}
                    {vendorDetails.taxNumber && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">الرقم الضريبي</p>
                          <p className="text-sm font-mono" dir="ltr">{vendorDetails.taxNumber}</p>
                        </div>
                      </div>
                    )}
                    {vendorDetails.bankName && (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">البنك</p>
                          <p className="text-sm">{vendorDetails.bankName}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {vendorDetails.notes && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">ملاحظات</p>
                      <p className="text-sm text-gray-700">{vendorDetails.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">إجمالي المصروفات</p>
                    <p className="text-xl font-bold text-[#610000] font-mono">
                      {formatCurrency(totalSpent)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">عدد المصروفات</p>
                    <p className="text-xl font-bold text-gray-800 font-mono">
                      {vendorDetails._count?.expenses || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500">رصيد افتتاحي</p>
                    <p className="text-xl font-bold text-gray-800 font-mono">
                      {formatCurrency(vendorDetails.openingBalance)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent expenses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">آخر المصروفات</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {vendorDetails.expenses && vendorDetails.expenses.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>التاريخ</TableHead>
                          <TableHead>العنوان</TableHead>
                          <TableHead>التصنيف</TableHead>
                          <TableHead>المبلغ</TableHead>
                          <TableHead className="text-center">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorDetails.expenses.map((e) => {
                          const sc = getStatusColor(e.status)
                          return (
                            <TableRow key={e.id} className="hover:bg-gray-50">
                              <TableCell>
                                <span className="font-mono text-sm text-gray-700">
                                  {formatDate(e.expenseDate)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-gray-800">{e.title}</span>
                              </TableCell>
                              <TableCell>
                                {e.category ? (
                                  <span className="text-sm text-gray-600">{e.category.name}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-sm font-bold text-[#610000]">
                                  {formatCurrency(e.amount)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {e.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      لا توجد مصروفات مسجلة لهذا المورد.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? 'تعديل المورد' : 'إضافة مورد جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>اسم المورد <span className="text-red-500">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المسؤول</Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الرقم الضريبي</Label>
                <Input
                  value={form.taxNumber}
                  onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
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
                <Label>رقم الحساب</Label>
                <Input
                  value={form.bankAccount}
                  onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>رصيد افتتاحي</Label>
                <Input
                  type="number"
                  value={form.openingBalance}
                  onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                  className="h-11"
                  dir="ltr"
                />
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
              <Label>العنوان</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="h-11"
              />
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
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px]"
            >
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
              هل أنت متأكد من حذف المورد «{deleteTarget?.name}»؟
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
