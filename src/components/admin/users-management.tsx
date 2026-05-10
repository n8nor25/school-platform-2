'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Users, AlertCircle, X, Shield, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface SchoolOption {
  id: string
  name: string
}

interface UserItem {
  id: string
  username: string
  role: string
  schoolId: string
  permissions: string
  school?: { name: string }
  createdAt: string
}

interface UserForm {
  username: string
  password: string
  schoolId: string
  role: string
  permissions: Record<string, boolean>
}

const permissionLabels: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  sliders: 'السلايدر',
  results: 'النتائج',
  grades: 'الصفوف',
  news: 'الأخبار',
  gallery: 'معرض الصور',
  teachers: 'المعلمين',
  schedules: 'جداول الحصص',
  settings: 'الإعدادات',
  sections: 'أقسام الصفحة',
  users: 'المستخدمين',
  schools: 'المدارس',
}

const allPermissions = Object.keys(permissionLabels)

const defaultPermissions: Record<string, boolean> = {}
allPermissions.forEach((p) => {
  defaultPermissions[p] = true
})

const defaultForm: UserForm = {
  username: '',
  password: '',
  schoolId: '',
  role: 'school_admin',
  permissions: { ...defaultPermissions },
}

export function UsersManagement() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<UserForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { adminUser } = useAdminStore()

  const isSuperAdmin = adminUser?.role === 'super_admin'

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSchools = useCallback(async () => {
    try {
      const res = await fetch('/api/schools')
      if (res.ok) {
        const data = await res.json()
        setSchools(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل المدارس')
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchSchools()
  }, [fetchUsers, fetchSchools])

  const openAdd = () => {
    setEditId(null)
    setForm({ ...defaultForm, permissions: { ...defaultPermissions } })
    setDialogOpen(true)
  }

  const openEdit = (item: UserItem) => {
    setEditId(item.id)
    let parsedPermissions: Record<string, boolean> = { ...defaultPermissions }
    try {
      const perms = JSON.parse(item.permissions || '{}')
      parsedPermissions = { ...defaultPermissions, ...perms }
    } catch {
      // use defaults
    }
    setForm({
      username: item.username,
      password: '',
      schoolId: item.schoolId,
      role: item.role,
      permissions: parsedPermissions,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast.error('يرجى إدخال اسم المستخدم')
      return
    }
    if (!editId && !form.password.trim()) {
      toast.error('يرجى إدخال كلمة المرور')
      return
    }
    if (!form.schoolId) {
      toast.error('يرجى اختيار المدرسة')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        username: form.username,
        schoolId: form.schoolId,
        role: form.role,
        permissions: JSON.stringify(form.permissions),
      }
      if (form.password) {
        body.password = form.password
      }

      const res = editId
        ? await fetch(`/api/users/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح')
        setDialogOpen(false)
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'فشل في حفظ المستخدم')
      }
    } catch {
      toast.error('فشل في حفظ المستخدم')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف المستخدم بنجاح')
        fetchUsers()
      } else {
        toast.error('فشل في حذف المستخدم')
      }
    } catch {
      toast.error('فشل في حذف المستخدم')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const togglePermission = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }))
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
          <Users className="w-5 h-5 text-[#610000]" />
          إدارة المستخدمين
        </h2>
        <Button onClick={openAdd} className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]">
          <Plus className="w-4 h-4 ml-1" />
          إضافة مستخدم
        </Button>
      </div>

      {/* Users List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">لا يوجد مستخدمون</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#610000]/10 flex items-center justify-center shrink-0">
                    {user.role === 'super_admin' ? (
                      <ShieldCheck className="w-5 h-5 text-[#610000]" />
                    ) : (
                      <Users className="w-5 h-5 text-[#610000]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-[#1a1a2e] text-sm">{user.username}</span>
                      <Badge
                        variant={user.role === 'super_admin' ? 'default' : 'secondary'}
                        className={`text-xs shrink-0 ${user.role === 'super_admin' ? 'bg-[#610000]' : ''}`}
                      >
                        {user.role === 'super_admin' ? 'مشرف عام' : 'مشرف مدرسة'}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-400">
                      {user.school?.name || user.schoolId}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => openEdit(user)}>
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => { setDeleteTarget(user.id); setDeleteDialogOpen(true) }}
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
            <DialogTitle>{editId ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات المستخدم والصلاحيات' : 'أدخل بيانات المستخدم الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>اسم المستخدم</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="اسم المستخدم"
                className="h-11 mt-1.5"
                dir="ltr"
              />
            </div>
            <div>
              <Label>{editId ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editId ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية' : 'كلمة المرور'}
                className="h-11 mt-1.5"
                dir="ltr"
              />
            </div>
            <div>
              <Label>المدرسة</Label>
              <Select value={form.schoolId} onValueChange={(val) => setForm({ ...form, schoolId: val })}>
                <SelectTrigger className="h-11 w-full mt-1.5">
                  <SelectValue placeholder="اختر المدرسة" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
                <SelectTrigger className="h-11 w-full mt-1.5">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">مشرف عام</SelectItem>
                  <SelectItem value="school_admin">مشرف مدرسة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-bold">الصلاحيات</Label>
              <p className="text-xs text-gray-400 mb-3">تحكم بالأقسام التي يمكن للمستخدم الوصول إليها</p>
              <div className="grid grid-cols-2 gap-3">
                {allPermissions.map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Switch
                      checked={form.permissions[perm] ?? true}
                      onCheckedChange={() => togglePermission(perm)}
                      className="data-[state=checked]:bg-[#610000]"
                    />
                    <Label className="text-xs cursor-pointer" onClick={() => togglePermission(perm)}>
                      {permissionLabels[perm]}
                    </Label>
                  </div>
                ))}
              </div>
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
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة المستخدم'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
