'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Search, Tag, FolderTree, BarChart3,
  AlertCircle, Loader2, ChevronLeft, Folder,
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
import { resolveSchool, TEST_SCHOOL_ID } from '@/lib/expense-utils'

interface ExpenseCategory {
  id: string
  name: string
  icon: string | null
  color: string | null
  sortOrder: number
  active: boolean
  parentId: string | null
  parent: { id: string; name: string } | null
  _count?: { expenses: number; children: number; budgets: number; recurringExpenses: number }
}

interface CategoryForm {
  name: string
  parentId: string
  icon: string
  color: string
  sortOrder: string
  active: boolean
}

const defaultForm: CategoryForm = {
  name: '',
  parentId: '',
  icon: '',
  color: '#610000',
  sortOrder: '0',
  active: true,
}

export function ExpenseCategoriesManagement() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const [form, setForm] = useState<CategoryForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [activeTab, setActiveTab] = useState('list')

  const fetchCategories = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (activeFilter === 'true') params.set('active', 'true')
        if (activeFilter === 'false') params.set('active', 'false')
        const res = await fetch(`/api/expense-categories?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json()
            setCategories(Array.isArray(data.categories) ? data.categories : [])
          } else {
            toast.error('فشل في تحميل التصنيفات')
          }
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل التصنيفات')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, activeFilter])

  useEffect(() => fetchCategories(), [fetchCategories])

  const filtered = categories.filter((c) => {
    if (search.trim() && !c.name.includes(search.trim())) return false
    return true
  })

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (cat: ExpenseCategory) => {
    setEditId(cat.id)
    setForm({
      name: cat.name,
      parentId: cat.parentId || '',
      icon: cat.icon || '',
      color: cat.color || '#610000',
      sortOrder: String(cat.sortOrder || 0),
      active: cat.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('اسم التصنيف مطلوب')
      return
    }
    if (editId && form.parentId === editId) {
      toast.error('لا يمكن أن يكون التصنيف أبًا لنفسه')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        parentId: form.parentId || null,
        icon: form.icon.trim() || null,
        color: form.color || null,
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      }
      const url = editId
        ? `/api/expense-categories/${editId}?schoolId=${schoolId}`
        : `/api/expense-categories?schoolId=${schoolId}`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editId ? 'تم تحديث التصنيف' : 'تم إضافة التصنيف بنجاح')
        setDialogOpen(false)
        fetchCategories()
        if (!editId) {
          setForm(defaultForm)
          setActiveTab('list')
        }
      } else if (res.status === 409) {
        toast.error(data.error || 'اسم التصنيف مُستخدم بالفعل')
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
        `/api/expense-categories/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف التصنيف')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchCategories()
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف التصنيف لوجود عناصر مرتبطة')
      } else {
        toast.error(data.error || 'فشل في حذف التصنيف')
      }
    } catch {
      toast.error('فشل في حذف التصنيف')
    } finally {
      setDeleting(false)
    }
  }

  const toggleActive = async (cat: ExpenseCategory) => {
    try {
      const res = await fetch(
        `/api/expense-categories/${cat.id}?schoolId=${schoolId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !cat.active }),
        }
      )
      if (res.ok) {
        toast.success(!cat.active ? 'تم تفعيل التصنيف' : 'تم إيقاف التصنيف')
        fetchCategories()
      } else {
        toast.error('فشل في تحديث الحالة')
      }
    } catch {
      toast.error('فشل في تحديث الحالة')
    }
  }

  // Build tree view for stats tab
  const roots = categories.filter((c) => !c.parentId)
  const renderTree = (cat: ExpenseCategory, depth = 0): React.ReactNode => {
    const children = categories.filter((c) => c.parentId === cat.id)
    return (
      <div key={cat.id} className="space-y-1">
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50"
          style={{ paddingInlineStart: `${depth * 1.5}rem` }}
        >
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: cat.color || '#610000' }}
          />
          {cat.icon && <span className="text-xs text-gray-400">{cat.icon}</span>}
          <span className="font-medium text-sm text-gray-700">{cat.name}</span>
          <span className="text-xs text-gray-400">
            ({cat._count?.expenses || 0})
          </span>
          {!cat.active && (
            <Badge variant="outline" className="text-xs">متوقف</Badge>
          )}
        </div>
        {children.map((ch) => renderTree(ch, depth + 1))}
      </div>
    )
  }

  // Stats
  const totalCategories = categories.length
  const activeCategories = categories.filter((c) => c.active).length
  const rootCategories = roots.length
  const totalExpenses = categories.reduce(
    (s, c) => s + (c._count?.expenses || 0),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Tag className="w-5 h-5 text-[#610000]" />
          تصنيفات المصروفات
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="list" className="data-[state=active]:bg-white">
            <Tag className="w-4 h-4 ml-1" /> القائمة
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> إضافة تصنيف
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
                    placeholder="بحث باسم التصنيف..."
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
                  إضافة تصنيف
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
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد تصنيفات. ابدأ بإضافة تصنيف جديد.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>التصنيف</TableHead>
                        <TableHead>التصنيف الأب</TableHead>
                        <TableHead className="text-center">المصروفات</TableHead>
                        <TableHead className="text-center">الترتيب</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((cat) => (
                        <TableRow key={cat.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color || '#610000' }}
                              />
                              {cat.icon && (
                                <span className="text-xs text-gray-400">{cat.icon}</span>
                              )}
                              <span className="font-medium text-gray-800">{cat.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {cat.parent ? (
                              <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                                <ChevronLeft className="w-3 h-3" />
                                {cat.parent.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono inline-flex items-center justify-center gap-1">
                              {cat._count?.expenses || 0}
                              {(cat._count?.children || 0) > 0 && (
                                <span className="text-xs text-gray-400">
                                  +{cat._count?.children} فرعي
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono text-gray-600">{cat.sortOrder}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={cat.active}
                              onCheckedChange={() => toggleActive(cat)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(cat)}
                                className="h-9 w-9 text-[#610000] hover:bg-[#610000]/10"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(cat)
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
                إضافة تصنيف جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    اسم التصنيف <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="مثال: مصاريف تشغيلية"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>التصنيف الأب</Label>
                  <Select
                    value={form.parentId}
                    onValueChange={(v) => setForm({ ...form, parentId: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="بدون (تصنيف رئيسي)" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => c.id !== editId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>أيقونة (اختياري)</Label>
                  <Input
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="مثال: Building, Car, Lightbulb..."
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>اللون</Label>
                  <div className="flex items-center gap-3 h-11">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                      dir="ltr"
                    />
                    <span className="font-mono text-sm text-gray-600" dir="ltr">
                      {form.color}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>ترتيب العرض</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
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
                  حفظ التصنيف
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                        <Tag className="w-5 h-5 text-[#610000]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي التصنيفات</p>
                        <p className="text-xl font-bold text-gray-800 font-mono">
                          {totalCategories}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <Tag className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">تصنيفات نشطة</p>
                        <p className="text-xl font-bold text-gray-800 font-mono">
                          {activeCategories}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <FolderTree className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">تصنيفات رئيسية</p>
                        <p className="text-xl font-bold text-gray-800 font-mono">
                          {rootCategories}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                        <Folder className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">إجمالي المصروفات</p>
                        <p className="text-xl font-bold text-gray-800 font-mono">
                          {totalExpenses}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-[#610000]" />
                    الشجرة الهرمية للتصنيفات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {roots.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      لا توجد تصنيفات لعرضها
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {roots.map((cat) => renderTree(cat))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                اسم التصنيف <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: مصاريف تشغيلية"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف الأب</Label>
              <Select
                value={form.parentId}
                onValueChange={(v) => setForm({ ...form, parentId: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="بدون (تصنيف رئيسي)" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.id !== editId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>أيقونة (Lucide)</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="Building, Car..."
                  className="h-11"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>اللون</Label>
                <div className="flex items-center gap-3 h-11">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                    dir="ltr"
                  />
                  <span className="font-mono text-sm text-gray-600" dir="ltr">
                    {form.color}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>ترتيب العرض</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
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
              هل أنت متأكد من حذف التصنيف «{deleteTarget?.name}»؟ لا يمكن التراجع عن هذا الإجراء.
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
