'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, School, AlertCircle, X, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ImageUpload } from '@/components/ui/image-upload'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface SchoolItem {
  id: string
  name: string
  subdomain: string
  description: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  address: string
  phone: string
  email: string
  facebookUrl: string | null
  isActive: boolean
  createdAt: string
}

interface SchoolForm {
  name: string
  subdomain: string
  description: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  address: string
  phone: string
  email: string
  facebookUrl: string
  isActive: boolean
}

const defaultForm: SchoolForm = {
  name: '',
  subdomain: '',
  description: '',
  logoUrl: '',
  primaryColor: '#610000',
  secondaryColor: '#009688',
  address: '',
  phone: '',
  email: '',
  facebookUrl: '',
  isActive: true,
}

export function SchoolsManagement() {
  const [schools, setSchools] = useState<SchoolItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<SchoolForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { adminUser } = useAdminStore()

  const isSuperAdmin = adminUser?.role === 'super_admin'

  const fetchSchools = useCallback(async () => {
    try {
      const res = await fetch('/api/schools')
      if (res.ok) {
        const data = await res.json()
        setSchools(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل المدارس')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSchools()
  }, [fetchSchools])

  const openAdd = () => {
    setEditId(null)
    setForm({ ...defaultForm })
    setDialogOpen(true)
  }

  const openEdit = (item: SchoolItem) => {
    setEditId(item.id)
    setForm({
      name: item.name,
      subdomain: item.subdomain,
      description: item.description || '',
      logoUrl: item.logoUrl || '',
      primaryColor: item.primaryColor,
      secondaryColor: item.secondaryColor,
      address: item.address || '',
      phone: item.phone || '',
      email: item.email || '',
      facebookUrl: item.facebookUrl || '',
      isActive: item.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('يرجى إدخال اسم المدرسة')
      return
    }
    if (!form.subdomain.trim()) {
      toast.error('يرجى إدخال النطاق الفرعي')
      return
    }

    setSaving(true)
    try {
      const body = {
        name: form.name,
        subdomain: form.subdomain,
        description: form.description || '',
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        address: form.address || '',
        phone: form.phone || '',
        email: form.email || '',
        facebookUrl: form.facebookUrl || null,
        isActive: form.isActive,
      }

      const res = editId
        ? await fetch(`/api/schools?id=${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/schools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث المدرسة بنجاح' : 'تم إضافة المدرسة بنجاح')
        setDialogOpen(false)
        fetchSchools()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'فشل في حفظ المدرسة')
      }
    } catch {
      toast.error('فشل في حفظ المدرسة')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/schools?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف المدرسة بنجاح')
        fetchSchools()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'فشل في حذف المدرسة')
      }
    } catch {
      toast.error('فشل في حذف المدرسة')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-bold text-gray-500">غير مصرح</h2>
        <p className="text-gray-400 text-sm">هذا القسم متاح فقط للمشرف العام</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <School className="w-5 h-5 text-[#610000]" />
          إدارة المدارس
        </h2>
        <Button onClick={openAdd} className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]">
          <Plus className="w-4 h-4 ml-1" />
          إضافة مدرسة
        </Button>
      </div>

      {/* Schools List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">لا توجد مدارس</p>
            </div>
          ) : (
            <div className="divide-y">
              {schools.map((school) => (
                <div key={school.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: school.primaryColor + '20' }}>
                    <School className="w-5 h-5" style={{ color: school.primaryColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-[#1a1a2e] truncate text-sm">{school.name}</span>
                      <Badge variant={school.isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {school.isActive ? 'مفعّلة' : 'معطّلة'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{school.subdomain}</span>
                      {school.address && <span>• {school.address}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => openEdit(school)}>
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => { setDeleteTarget(school.id); setDeleteDialogOpen(true) }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editId ? 'تعديل المدرسة' : 'إضافة مدرسة جديدة'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات المدرسة' : 'أدخل بيانات المدرسة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>اسم المدرسة *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="اسم المدرسة"
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>النطاق الفرعي *</Label>
                <Input
                  value={form.subdomain}
                  onChange={(e) => setForm({ ...form, subdomain: e.target.value })}
                  placeholder="school-name"
                  className="h-11 mt-1.5"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label>وصف المدرسة</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف مختصر عن المدرسة"
                className="min-h-[80px] mt-1.5"
              />
            </div>
            <ImageUpload
              value={form.logoUrl}
              onChange={(url) => setForm({ ...form, logoUrl: url })}
              folder="logos"
              label="شعار المدرسة"
              placeholder="أدخل رابط الشعار أو ارفع من جهازك"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>اللون الرئيسي</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <Label>اللون الثانوي</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="h-11"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>الهاتف</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                  className="h-11 mt-1.5"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  className="h-11 mt-1.5"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label>العنوان</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="عنوان المدرسة"
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>رابط فيسبوك</Label>
              <Input
                value={form.facebookUrl}
                onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })}
                placeholder="https://facebook.com/..."
                className="h-11 mt-1.5"
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label>مفعّلة</Label>
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
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة المدرسة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذه المدرسة؟ سيتم حذف جميع البيانات المرتبطة بها. لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="min-h-[44px]"
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
