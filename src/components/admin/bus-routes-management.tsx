'use client'

import React, { useState, useEffect } from 'react'
import {
  Plus, Edit, Trash2, Route as RouteIcon, AlertCircle, X, Search,
  MapPin, Clock, Bus as BusIcon, DollarSign, Users, BarChart3, Calendar
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface Bus {
  id: string
  plateNumber: string
  driverName: string
}

interface BusRoute {
  id: string
  busId: string
  name: string
  area: string
  morningTime: string | null
  afternoonTime: string | null
  stops: string
  monthlyFee: number
  active: boolean
  bus?: { id: string; plateNumber: string; driverName: string }
  _count?: { subscriptions: number }
}

interface StopItem {
  name: string
  time: string
}

interface RouteForm {
  busId: string
  name: string
  area: string
  morningTime: string
  afternoonTime: string
  monthlyFee: string
  stops: StopItem[]
  active: boolean
}

const defaultForm: RouteForm = {
  busId: '',
  name: '',
  area: '',
  morningTime: '',
  afternoonTime: '',
  monthlyFee: '0',
  stops: [],
  active: true,
}

export function BusRoutesManagement() {
  const [routes, setRoutes] = useState<BusRoute[]>([])
  const [buses, setBuses] = useState<Bus[]>([])
  const [loading, setLoading] = useState(true)
  const [busesLoading, setBusesLoading] = useState(true)
  const [form, setForm] = useState<RouteForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BusRoute | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [busFilter, setBusFilter] = useState<string>('all')
  const { selectedSchoolId } = useAdminStore()

  // Load buses for the select dropdown
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId) return
      try {
        setBusesLoading(true)
        const res = await fetch(`/api/buses?schoolId=${selectedSchoolId}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setBuses(Array.isArray(data.buses) ? data.buses : [])
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setBusesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load routes
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
        if (busFilter !== 'all') params.set('busId', busFilter)
        const res = await fetch(`/api/bus-routes?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setRoutes(Array.isArray(data.routes) ? data.routes : [])
        } else if (!cancelled) {
          toast.error('فشل في تحميل الخطوط')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الخطوط')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, search, activeFilter, busFilter])

  const parseStops = (stopsStr: string): StopItem[] => {
    try {
      const parsed = JSON.parse(stopsStr || '[]')
      if (Array.isArray(parsed)) return parsed
      return []
    } catch {
      return []
    }
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ ...defaultForm, busId: buses[0]?.id || '' })
    setDialogOpen(true)
  }

  const openEdit = (route: BusRoute) => {
    setEditId(route.id)
    setForm({
      busId: route.busId,
      name: route.name,
      area: route.area,
      morningTime: route.morningTime || '',
      afternoonTime: route.afternoonTime || '',
      monthlyFee: String(route.monthlyFee),
      stops: parseStops(route.stops),
      active: route.active,
    })
    setDialogOpen(true)
  }

  const addStop = () => {
    setForm({ ...form, stops: [...form.stops, { name: '', time: '' }] })
  }
  const removeStop = (idx: number) => {
    setForm({ ...form, stops: form.stops.filter((_, i) => i !== idx) })
  }
  const updateStop = (idx: number, field: keyof StopItem, value: string) => {
    const newStops = [...form.stops]
    newStops[idx] = { ...newStops[idx], [field]: value }
    setForm({ ...form, stops: newStops })
  }

  const handleSave = async () => {
    if (!form.busId) {
      toast.error('يرجى اختيار الباص')
      return
    }
    if (!form.name.trim() || !form.area.trim()) {
      toast.error('اسم الخط والمنطقة مطلوبان')
      return
    }
    setSaving(true)
    try {
      const body = {
        busId: form.busId,
        name: form.name.trim(),
        area: form.area.trim(),
        morningTime: form.morningTime.trim() || null,
        afternoonTime: form.afternoonTime.trim() || null,
        stops: form.stops.filter((s) => s.name.trim()),
        monthlyFee: Number(form.monthlyFee) || 0,
        active: form.active,
      }
      const url = editId
        ? `/api/bus-routes/${editId}?schoolId=${selectedSchoolId}`
        : `/api/bus-routes?schoolId=${selectedSchoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث الخط' : 'تم إضافة الخط بنجاح')
        setDialogOpen(false)
        // Refresh list
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search.trim()) params.set('search', search.trim())
        if (activeFilter === 'true') params.set('active', 'true')
        if (activeFilter === 'false') params.set('active', 'false')
        if (busFilter !== 'all') params.set('busId', busFilter)
        const refreshRes = await fetch(`/api/bus-routes?${params.toString()}`)
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          setRoutes(Array.isArray(refreshData.routes) ? refreshData.routes : [])
        }
      } else {
        toast.error(data.error || 'فشل في الحفظ')
      }
    } catch {
      toast.error('فشل في الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/bus-routes/${deleteTarget.id}?schoolId=${selectedSchoolId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف الخط')
        setRoutes((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف الخط')
      } else {
        toast.error(data.error || 'فشل في الحذف')
      }
    } catch {
      toast.error('فشل في الحذف')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  // Stats
  const totalRoutes = routes.length
  const activeRoutes = routes.filter((r) => r.active).length
  const totalStudents = routes.reduce((sum, r) => sum + (r._count?.subscriptions || 0), 0)
  const totalRevenue = routes.reduce(
    (sum, r) => sum + (r._count?.subscriptions || 0) * Number(r.monthlyFee),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <RouteIcon className="w-5 h-5 text-[#610000]" />
          إدارة خطوط الباصات
        </h2>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <RouteIcon className="w-4 h-4 ml-1" /> القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة خط
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
                    placeholder="بحث باسم الخط أو المنطقة..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <Select value={busFilter} onValueChange={setBusFilter}>
                  <SelectTrigger className="w-[180px] h-11">
                    <SelectValue placeholder="كل الباصات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الباصات</SelectItem>
                    {buses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.plateNumber}
                      </SelectItem>
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
                  disabled={busesLoading || buses.length === 0}
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة خط
                </Button>
              </div>
              {buses.length === 0 && !busesLoading && (
                <p className="text-sm text-amber-600 mt-2">
                  لا توجد باصات مسجلة. أضف باصاً أولاً من قسم إدارة الباصات.
                </p>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : routes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">لا توجد خطوط مسجلة</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-right">اسم الخط</TableHead>
                        <TableHead className="text-right">المنطقة</TableHead>
                        <TableHead className="text-right">الباص</TableHead>
                        <TableHead className="text-right">المواعيد</TableHead>
                        <TableHead className="text-right">الرسوم</TableHead>
                        <TableHead className="text-right">الطلاب</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routes.map((route) => (
                        <TableRow key={route.id}>
                          <TableCell className="font-medium text-[#1a1a2e]">{route.name}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="w-3.5 h-3.5 text-[#610000]" />
                              {route.area}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[#610000] border-[#610000]/30">
                              {route.bus?.plateNumber || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {route.morningTime && (
                              <div dir="ltr" className="flex items-center gap-1 text-gray-700">
                                <Clock className="w-3 h-3" /> ص: {route.morningTime}
                              </div>
                            )}
                            {route.afternoonTime && (
                              <div dir="ltr" className="flex items-center gap-1 text-gray-700 mt-0.5">
                                <Clock className="w-3 h-3" /> م: {route.afternoonTime}
                              </div>
                            )}
                            {!route.morningTime && !route.afternoonTime && <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-[#610000]">
                              {Number(route.monthlyFee).toLocaleString()} ج.م
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              {route._count?.subscriptions || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                route.active
                                  ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-200'
                              }
                            >
                              {route.active ? 'نشط' : 'متوقف'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[36px] min-w-[36px]"
                                onClick={() => openEdit(route)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[36px] min-w-[36px]"
                                onClick={() => { setDeleteTarget(route); setDeleteDialogOpen(true) }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                إضافة خط جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RouteFormView
                form={defaultForm}
                buses={buses}
                busesLoading={busesLoading}
                onFormChange={() => {}}
                onSubmit={async (body) => {
                  setSaving(true)
                  try {
                    const res = await fetch(`/api/bus-routes?schoolId=${selectedSchoolId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast.success('تم إضافة الخط بنجاح')
                      const params = new URLSearchParams({ schoolId: selectedSchoolId })
                      const refreshRes = await fetch(`/api/bus-routes?${params.toString()}`)
                      if (refreshRes.ok) {
                        const refreshData = await refreshRes.json()
                        setRoutes(Array.isArray(refreshData.routes) ? refreshData.routes : [])
                      }
                    } else {
                      toast.error(data.error || 'فشل')
                    }
                  } finally {
                    setSaving(false)
                  }
                }}
                saving={saving}
                submitLabel="إضافة الخط"
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
                    <RouteIcon className="w-5 h-5 text-[#610000]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي الخطوط</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalRoutes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">خطوط نشطة</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{activeRoutes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي الطلاب</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalStudents}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">الإيراد الشهري المتوقع</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل بيانات الخط' : 'إضافة خط جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات الخط' : 'أدخل بيانات الخط الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>الباص *</Label>
              <Select
                value={form.busId}
                onValueChange={(v) => setForm({ ...form, busId: v })}
              >
                <SelectTrigger className="h-11 mt-1.5">
                  <SelectValue placeholder="اختر الباص" />
                </SelectTrigger>
                <SelectContent>
                  {buses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.plateNumber} - {b.driverName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>اسم الخط *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="مثال: خط المنتزه"
                />
              </div>
              <div>
                <Label>المنطقة *</Label>
                <Input
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  className="h-11 mt-1.5"
                  placeholder="المنطقة الجغرافية"
                />
              </div>
              <div>
                <Label>موعد الصباح</Label>
                <Input
                  value={form.morningTime}
                  onChange={(e) => setForm({ ...form, morningTime: e.target.value })}
                  className="h-11 mt-1.5"
                  dir="ltr"
                  placeholder="07:00"
                />
              </div>
              <div>
                <Label>موعد الظهيرة</Label>
                <Input
                  value={form.afternoonTime}
                  onChange={(e) => setForm({ ...form, afternoonTime: e.target.value })}
                  className="h-11 mt-1.5"
                  dir="ltr"
                  placeholder="14:00"
                />
              </div>
              <div>
                <Label>الرسوم الشهرية</Label>
                <Input
                  type="number"
                  value={form.monthlyFee}
                  onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div className="flex items-end gap-3 pb-2">
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                />
                <Label className="cursor-pointer">الخط نشط</Label>
              </div>
            </div>

            {/* Stops dynamic list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>المحطات</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[36px]"
                  onClick={addStop}
                >
                  <Plus className="w-3.5 h-3.5 ml-1" />
                  إضافة محطة
                </Button>
              </div>
              {form.stops.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-lg">
                  لا توجد محطات. اضغط &quot;إضافة محطة&quot; لإضافة.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.stops.map((stop, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-sm text-gray-400 w-6">{idx + 1}</span>
                      <Input
                        value={stop.name}
                        onChange={(e) => updateStop(idx, 'name', e.target.value)}
                        className="h-10"
                        placeholder="اسم المحطة"
                      />
                      <Input
                        value={stop.time}
                        onChange={(e) => updateStop(idx, 'time', e.target.value)}
                        className="h-10 w-32"
                        dir="ltr"
                        placeholder="الوقت"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 min-h-[36px] min-w-[36px]"
                        onClick={() => removeStop(idx)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة الخط'}
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
              هل أنت متأكد من حذف الخط &quot;{deleteTarget?.name}&quot;؟
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

function RouteFormView({
  form: initialForm,
  buses,
  busesLoading,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: RouteForm
  buses: Bus[]
  busesLoading: boolean
  onFormChange: (form: RouteForm) => void
  onSubmit: (body: Record<string, unknown>) => Promise<void>
  saving: boolean
  submitLabel: string
}) {
  // Use lazy initializer so busId is set once on mount from available buses.
  // When buses load later (and busId is empty), the Select will show placeholder
  // until the user picks one — no setState-in-effect needed.
  const [form, setForm] = useState<RouteForm>(() => ({
    ...initialForm,
    busId: initialForm.busId || (buses.length > 0 ? buses[0].id : ''),
  }))

  const addStop = () => {
    setForm({ ...form, stops: [...form.stops, { name: '', time: '' }] })
  }
  const removeStop = (idx: number) => {
    setForm({ ...form, stops: form.stops.filter((_, i) => i !== idx) })
  }
  const updateStop = (idx: number, field: keyof StopItem, value: string) => {
    const newStops = [...form.stops]
    newStops[idx] = { ...newStops[idx], [field]: value }
    setForm({ ...form, stops: newStops })
  }

  const handleSubmit = async () => {
    if (!form.busId) {
      toast.error('يرجى اختيار الباص')
      return
    }
    if (!form.name.trim() || !form.area.trim()) {
      toast.error('اسم الخط والمنطقة مطلوبان')
      return
    }
    await onSubmit({
      busId: form.busId,
      name: form.name.trim(),
      area: form.area.trim(),
      morningTime: form.morningTime.trim() || null,
      afternoonTime: form.afternoonTime.trim() || null,
      stops: form.stops.filter((s) => s.name.trim()),
      monthlyFee: Number(form.monthlyFee) || 0,
      active: form.active,
    })
    setForm({ ...defaultForm, busId: buses[0]?.id || '' })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>الباص *</Label>
        <Select value={form.busId} onValueChange={(v) => setForm({ ...form, busId: v })}>
          <SelectTrigger className="h-11 mt-1.5">
            <SelectValue placeholder={busesLoading ? 'جاري التحميل...' : 'اختر الباص'} />
          </SelectTrigger>
          <SelectContent>
            {buses.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.plateNumber} - {b.driverName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>اسم الخط *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>المنطقة *</Label>
          <Input
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div>
          <Label>موعد الصباح</Label>
          <Input
            value={form.morningTime}
            onChange={(e) => setForm({ ...form, morningTime: e.target.value })}
            className="h-11 mt-1.5"
            dir="ltr"
          />
        </div>
        <div>
          <Label>موعد الظهيرة</Label>
          <Input
            value={form.afternoonTime}
            onChange={(e) => setForm({ ...form, afternoonTime: e.target.value })}
            className="h-11 mt-1.5"
            dir="ltr"
          />
        </div>
        <div>
          <Label>الرسوم الشهرية</Label>
          <Input
            type="number"
            value={form.monthlyFee}
            onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
            className="h-11 mt-1.5"
          />
        </div>
        <div className="flex items-end gap-3 pb-2">
          <Switch
            checked={form.active}
            onCheckedChange={(checked) => setForm({ ...form, active: checked })}
          />
          <Label className="cursor-pointer">الخط نشط</Label>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>المحطات</Label>
          <Button type="button" variant="outline" size="sm" className="min-h-[36px]" onClick={addStop}>
            <Plus className="w-3.5 h-3.5 ml-1" />
            إضافة محطة
          </Button>
        </div>
        {form.stops.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-lg">
            لا توجد محطات
          </p>
        ) : (
          <div className="space-y-2">
            {form.stops.map((stop, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="text-sm text-gray-400 w-6">{idx + 1}</span>
                <Input
                  value={stop.name}
                  onChange={(e) => updateStop(idx, 'name', e.target.value)}
                  className="h-10"
                  placeholder="اسم المحطة"
                />
                <Input
                  value={stop.time}
                  onChange={(e) => updateStop(idx, 'time', e.target.value)}
                  className="h-10 w-32"
                  dir="ltr"
                  placeholder="الوقت"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 min-h-[36px] min-w-[36px]"
                  onClick={() => removeStop(idx)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Button
        onClick={handleSubmit}
        disabled={saving || buses.length === 0}
        className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
      >
        {saving ? 'جاري الحفظ...' : submitLabel}
      </Button>
    </div>
  )
}
