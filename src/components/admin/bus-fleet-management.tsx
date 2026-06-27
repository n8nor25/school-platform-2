'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Bus as BusIcon, AlertCircle, X, Search,
  Phone, User, Hash, Calendar, Settings, BarChart3
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface Bus {
  id: string
  plateNumber: string
  driverName: string
  driverPhone: string | null
  driverLicense: string | null
  supervisorName: string | null
  supervisorPhone: string | null
  capacity: number
  model: string | null
  color: string | null
  active: boolean
  notes: string | null
  _count?: { routes: number }
}

interface BusForm {
  plateNumber: string
  driverName: string
  driverPhone: string
  driverLicense: string
  supervisorName: string
  supervisorPhone: string
  capacity: string
  model: string
  color: string
  notes: string
  active: boolean
}

const defaultForm: BusForm = {
  plateNumber: '',
  driverName: '',
  driverPhone: '',
  driverLicense: '',
  supervisorName: '',
  supervisorPhone: '',
  capacity: '30',
  model: '',
  color: '',
  notes: '',
  active: true,
}

export function BusFleetManagement() {
  const [buses, setBuses] = useState<Bus[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<BusForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Bus | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const { selectedSchoolId } = useAdminStore()

  const fetchBuses = useCallback(async () => {
    if (!selectedSchoolId) return
    try {
      setLoading(true)
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (search.trim()) params.set('search', search.trim())
      if (activeFilter === 'true') params.set('active', 'true')
      if (activeFilter === 'false') params.set('active', 'false')
      const res = await fetch(`/api/buses?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setBuses(Array.isArray(data.buses) ? data.buses : [])
      } else {
        toast.error('فشل في تحميل الباصات')
      }
    } catch {
      toast.error('فشل في تحميل الباصات')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, search, activeFilter])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId) return
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search.trim()) params.set('search', search.trim())
        if (activeFilter === 'true') params.set('active', 'true')
        if (activeFilter === 'false') params.set('active', 'false')
        const res = await fetch(`/api/buses?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setBuses(Array.isArray(data.buses) ? data.buses : [])
        } else if (!cancelled) {
          toast.error('فشل في تحميل الباصات')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الباصات')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, search, activeFilter])

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (bus: Bus) => {
    setEditId(bus.id)
    setForm({
      plateNumber: bus.plateNumber,
      driverName: bus.driverName,
      driverPhone: bus.driverPhone || '',
      driverLicense: bus.driverLicense || '',
      supervisorName: bus.supervisorName || '',
      supervisorPhone: bus.supervisorPhone || '',
      capacity: String(bus.capacity),
      model: bus.model || '',
      color: bus.color || '',
      notes: bus.notes || '',
      active: bus.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.plateNumber.trim() || !form.driverName.trim()) {
      toast.error('رقم اللوحة واسم السائق مطلوبان')
      return
    }
    setSaving(true)
    try {
      const body = {
        plateNumber: form.plateNumber.trim(),
        driverName: form.driverName.trim(),
        driverPhone: form.driverPhone.trim() || null,
        driverLicense: form.driverLicense.trim() || null,
        supervisorName: form.supervisorName.trim() || null,
        supervisorPhone: form.supervisorPhone.trim() || null,
        capacity: Number(form.capacity) || 30,
        model: form.model.trim() || null,
        color: form.color.trim() || null,
        notes: form.notes.trim() || null,
        active: form.active,
      }
      const url = editId
        ? `/api/buses/${editId}?schoolId=${selectedSchoolId}`
        : `/api/buses?schoolId=${selectedSchoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث الباص' : 'تم إضافة الباص بنجاح')
        setDialogOpen(false)
        fetchBuses()
      } else if (res.status === 409) {
        toast.error(data.error || 'رقم اللوحة مُستخدم بالفعل')
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
    try {
      const res = await fetch(`/api/buses/${deleteTarget.id}?schoolId=${selectedSchoolId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف الباص بنجاح')
        fetchBuses()
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف الباص')
      } else {
        toast.error(data.error || 'فشل في حذف الباص')
      }
    } catch {
      toast.error('فشل في حذف الباص')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  // Stats
  const totalBuses = buses.length
  const activeBuses = buses.filter((b) => b.active).length
  const totalCapacity = buses.reduce((sum, b) => sum + b.capacity, 0)
  const modelCounts: Record<string, number> = {}
  buses.forEach((b) => {
    const m = b.model || 'غير محدد'
    modelCounts[m] = (modelCounts[m] || 0) + 1
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <BusIcon className="w-5 h-5 text-[#610000]" />
          إدارة أسطول الباصات
        </h2>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <BusIcon className="w-4 h-4 ml-1" /> القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة باص
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 ml-1" /> إحصائيات
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
                    placeholder="بحث برقم اللوحة أو اسم السائق..."
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
                  إضافة باص
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : buses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">لا توجد باصات مسجلة</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {buses.map((bus) => (
                <Card key={bus.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-11 h-11 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                          <BusIcon className="w-5 h-5 text-[#610000]" />
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1a1a2e]">{bus.plateNumber}</h3>
                          <p className="text-xs text-gray-500">{bus.model || '—'}</p>
                        </div>
                      </div>
                      <Badge
                        className={
                          bus.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-100'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-200'
                        }
                      >
                        {bus.active ? 'نشط' : 'متوقف'}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4 text-[#610000]" />
                        <span className="font-medium">{bus.driverName}</span>
                      </div>
                      {bus.driverPhone && (
                        <div className="flex items-center gap-2 text-gray-600" dir="ltr">
                          <Phone className="w-4 h-4 text-[#610000]" />
                          <span>{bus.driverPhone}</span>
                        </div>
                      )}
                      {bus.supervisorName && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-xs">مشرف: {bus.supervisorName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Hash className="w-4 h-4 text-[#610000]" />
                        <span className="text-xs">السعة: {bus.capacity} راكب</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-[#610000]" />
                        <span className="text-xs">الخطوط: {bus._count?.routes || 0}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[40px]"
                        onClick={() => openEdit(bus)}
                      >
                        <Edit className="w-3.5 h-3.5 ml-1" />
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[40px]"
                        onClick={() => { setDeleteTarget(bus); setDeleteDialogOpen(true) }}
                      >
                        <Trash2 className="w-3.5 h-3.5 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Add Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#610000]" />
                إضافة باص جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BusFormComponent
                form={defaultForm}
                onChange={() => {}}
                onSubmit={async (body) => {
                  setSaving(true)
                  try {
                    const res = await fetch(`/api/buses?schoolId=${selectedSchoolId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast.success('تم إضافة الباص بنجاح')
                      fetchBuses()
                    } else if (res.status === 409) {
                      toast.error(data.error || 'رقم اللوحة مُستخدم')
                    } else {
                      toast.error(data.error || 'فشل')
                    }
                  } finally {
                    setSaving(false)
                  }
                }}
                saving={saving}
                submitLabel="إضافة الباص"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                    <BusIcon className="w-5 h-5 text-[#610000]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي الباصات</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalBuses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">باصات نشطة</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{activeBuses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي السعة</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalCapacity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center">
                    <BusIcon className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">باصات متوقفة</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalBuses - activeBuses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">توزيع الباصات حسب الموديل</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(modelCounts).length === 0 ? (
                <p className="text-gray-400 text-center py-6">لا توجد بيانات</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(modelCounts).map(([model, count]) => (
                    <div key={model} className="flex items-center gap-3">
                      <span className="text-sm font-medium w-32 truncate">{model}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-[#610000] h-full rounded-full flex items-center justify-end px-2 text-white text-xs font-bold"
                          style={{ width: `${(count / totalBuses) * 100}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل بيانات الباص' : 'إضافة باص جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات الباص' : 'أدخل بيانات الباص الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>رقم اللوحة *</Label>
                <Input
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="رقم اللوحة"
                />
              </div>
              <div>
                <Label>اسم السائق *</Label>
                <Input
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="اسم السائق"
                />
              </div>
              <div>
                <Label>هاتف السائق</Label>
                <Input
                  value={form.driverPhone}
                  onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                  className="h-11 mt-1.5"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div>
                <Label>رقم الرخصة</Label>
                <Input
                  value={form.driverLicense}
                  onChange={(e) => setForm({ ...form, driverLicense: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="رقم الرخصة"
                />
              </div>
              <div>
                <Label>اسم المشرف</Label>
                <Input
                  value={form.supervisorName}
                  onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="اسم المشرف"
                />
              </div>
              <div>
                <Label>هاتف المشرف</Label>
                <Input
                  value={form.supervisorPhone}
                  onChange={(e) => setForm({ ...form, supervisorPhone: e.target.value })}
                  className="h-11 mt-1.5"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div>
                <Label>السعة</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="30"
                />
              </div>
              <div>
                <Label>الموديل</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="مثال: تويوتا كوستر"
                />
              </div>
              <div>
                <Label>اللون</Label>
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="اللون"
                />
              </div>
              <div className="flex items-end gap-3 pb-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                />
                <Label className="cursor-pointer">الباص نشط</Label>
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1.5 min-h-[80px]"
                placeholder="ملاحظات إضافية"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="min-h-[44px]">
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة الباص'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الباص رقم &quot;{deleteTarget?.plateNumber}&quot;؟
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="min-h-[44px]">
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Reusable form component for the "Add" tab
function BusFormComponent({
  form: initialForm,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: BusForm
  onChange: (form: BusForm) => void
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  saving: boolean
  submitLabel: string
}) {
  const [form, setForm] = useState<BusForm>(initialForm)

  const handleSubmit = async () => {
    if (!form.plateNumber.trim() || !form.driverName.trim()) {
      toast.error('رقم اللوحة واسم السائق مطلوبان')
      return
    }
    await onSubmit({
      plateNumber: form.plateNumber.trim(),
      driverName: form.driverName.trim(),
      driverPhone: form.driverPhone.trim() || null,
      driverLicense: form.driverLicense.trim() || null,
      supervisorName: form.supervisorName.trim() || null,
      supervisorPhone: form.supervisorPhone.trim() || null,
      capacity: Number(form.capacity) || 30,
      model: form.model.trim() || null,
      color: form.color.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    })
    setForm(defaultForm)
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>رقم اللوحة *</Label>
          <Input
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>اسم السائق *</Label>
          <Input
            value={form.driverName}
            onChange={(e) => setForm({ ...form, driverName: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>هاتف السائق</Label>
          <Input
            value={form.driverPhone}
            onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
            className="h-11 mt-1.5"
            dir="ltr"
          />
        </div>
        <div>
          <Label>رقم الرخصة</Label>
          <Input
            value={form.driverLicense}
            onChange={(e) => setForm({ ...form, driverLicense: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>اسم المشرف</Label>
          <Input
            value={form.supervisorName}
            onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>هاتف المشرف</Label>
          <Input
            value={form.supervisorPhone}
            onChange={(e) => setForm({ ...form, supervisorPhone: e.target.value })}
            className="h-11 mt-1.5"
            dir="ltr"
          />
        </div>
        <div>
          <Label>السعة</Label>
          <Input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>الموديل</Label>
          <Input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>اللون</Label>
          <Input
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div className="flex items-end gap-3 pb-2">
          <Switch
            checked={form.active}
            onCheckedChange={(checked) => setForm({ ...form, active: checked })}
          />
          <Label className="cursor-pointer">الباص نشط</Label>
        </div>
      </div>
      <div>
        <Label>ملاحظات</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="mt-1.5 min-h-[80px]"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
      >
        {saving ? 'جاري الحفظ...' : submitLabel}
      </Button>
    </div>
  )
}
