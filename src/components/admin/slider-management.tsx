'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Image as ImageIcon, AlertCircle, X, ArrowUp, ArrowDown, Eye, EyeOff, Archive, ArchiveRestore } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { ImageUpload } from '@/components/ui/image-upload'

interface SliderItem {
  id: string
  imageUrl: string
  title: string | null
  subtitle: string | null
  link: string | null
  sortOrder: number
  active: boolean
  archived: boolean
  createdAt: string
}

interface SliderForm {
  imageUrl: string
  title: string
  subtitle: string
  link: string
  sortOrder: number
  active: boolean
}

const defaultForm: SliderForm = {
  imageUrl: '',
  title: '',
  subtitle: '',
  link: '',
  sortOrder: 0,
  active: true,
}

export function SliderManagement() {
  const [sliders, setSliders] = useState<SliderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<SliderForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { selectedSchoolId } = useAdminStore()

  const fetchSliders = useCallback(async () => {
    if (!selectedSchoolId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/sliders?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSliders(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل السلايدرات')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchSliders()
  }, [fetchSliders])

  const archivedCount = sliders.filter(s => s.archived).length

  const openAdd = () => {
    setEditId(null)
    setForm({ ...defaultForm, sortOrder: sliders.length })
    setDialogOpen(true)
  }

  const openEdit = (item: SliderItem) => {
    setEditId(item.id)
    setForm({
      imageUrl: item.imageUrl,
      title: item.title || '',
      subtitle: item.subtitle || '',
      link: item.link || '',
      sortOrder: item.sortOrder,
      active: item.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.imageUrl.trim()) {
      toast.error('يرجى إدخال رابط الصورة')
      return
    }
    if (!selectedSchoolId) {
      toast.error('يرجى اختيار المدرسة أولاً')
      return
    }
    setSaving(true)
    try {
      const body = {
        schoolId: selectedSchoolId,
        imageUrl: form.imageUrl,
        title: form.title || null,
        subtitle: form.subtitle || null,
        link: form.link || null,
        sortOrder: form.sortOrder,
        active: form.active,
      }

      const res = editId
        ? await fetch(`/api/sliders/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/sliders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث السلايدر بنجاح' : 'تم إضافة السلايدر بنجاح')
        setDialogOpen(false)
        fetchSliders()
      } else {
        toast.error('فشل في حفظ السلايدر')
      }
    } catch {
      toast.error('فشل في حفظ السلايدر')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/sliders/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف السلايدر بنجاح')
        fetchSliders()
      } else {
        toast.error('فشل في حذف السلايدر')
      }
    } catch {
      toast.error('فشل في حذف السلايدر')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleToggleActive = async (item: SliderItem) => {
    try {
      const res = await fetch(`/api/sliders/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      if (res.ok) {
        toast.success(item.active ? 'تم إلغاء تفعيل السلايدر' : 'تم تفعيل السلايدر')
        fetchSliders()
      } else {
        toast.error('فشل في تحديث حالة السلايدر')
      }
    } catch {
      toast.error('فشل في تحديث حالة السلايدر')
    }
  }

  const handleArchive = async (item: SliderItem) => {
    try {
      const res = await fetch(`/api/sliders/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة السلايدر بنجاح')
        fetchSliders()
      } else {
        toast.error('فشل في أرشفة السلايدر')
      }
    } catch {
      toast.error('فشل في أرشفة السلايدر')
    }
  }

  const handleRestore = async (item: SliderItem) => {
    try {
      const res = await fetch(`/api/sliders/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة السلايدر بنجاح')
        fetchSliders()
      } else {
        toast.error('فشل في استعادة السلايدر')
      }
    } catch {
      toast.error('فشل في استعادة السلايدر')
    }
  }

  const handleMoveUp = async (item: SliderItem, index: number) => {
    if (index === 0) return
    const prevItem = sliders[index - 1]
    try {
      await fetch(`/api/sliders/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: prevItem.sortOrder }),
      })
      await fetch(`/api/sliders/${prevItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      })
      fetchSliders()
      toast.success('تم تحريك السلايدر لأعلى')
    } catch {
      toast.error('فشل في تحريك السلايدر')
    }
  }

  const handleMoveDown = async (item: SliderItem, index: number) => {
    if (index === sliders.length - 1) return
    const nextItem = sliders[index + 1]
    try {
      await fetch(`/api/sliders/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: nextItem.sortOrder }),
      })
      await fetch(`/api/sliders/${nextItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: item.sortOrder }),
      })
      fetchSliders()
      toast.success('تم تحريك السلايدر لأسفل')
    } catch {
      toast.error('فشل في تحريك السلايدر')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[#610000]" />
          إدارة السلايدر
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? 'default' : 'outline'}
            size="sm"
            className={`min-h-[44px] ${showArchived ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4 ml-1" />
            {showArchived ? 'إخفاء المؤرشف' : 'المؤرشف'}
            {archivedCount > 0 && (
              <Badge variant="secondary" className="mr-1.5 px-1.5 py-0 text-xs">
                {archivedCount}
              </Badge>
            )}
          </Button>
          <Button onClick={openAdd} className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]">
            <Plus className="w-4 h-4 ml-1" />
            إضافة سلايدر
          </Button>
        </div>
      </div>

      {/* Sliders List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : sliders.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">{showArchived ? 'لا توجد سلايدرات مؤرشفة' : 'لا توجد سلايدرات'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {sliders.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${item.archived ? 'opacity-60 bg-gray-50' : ''}`}
                >
                  {/* Thumbnail */}
                  <img
                    src={item.imageUrl}
                    alt={item.title || 'سلايدر'}
                    className="w-[60px] h-[40px] rounded object-cover shrink-0 border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iMzAiIHk9IjIwIiBmb250LXNpemU9IjgiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7YqtmFINin2YQ8L3RleHQ+PC9zdmc+'
                    }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-[#1a1a2e] truncate text-sm">
                        {item.title || 'بدون عنوان'}
                      </span>
                      <Badge variant={item.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {item.active ? 'مفعّل' : 'معطّل'}
                      </Badge>
                      {item.archived && (
                        <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-600 bg-amber-50">
                          مؤرشف
                        </Badge>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span>ترتيب: {item.sortOrder}</span>
                      {item.link && <span className="truncate max-w-[150px]">رابط: {item.link}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[36px] px-1"
                      onClick={() => handleMoveUp(item, index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[36px] px-1"
                      onClick={() => handleMoveDown(item, index)}
                      disabled={index === sliders.length - 1}
                    >
                      <ArrowDown className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Separator orientation="vertical" className="h-6 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[36px] px-1"
                      onClick={() => handleToggleActive(item)}
                    >
                      {item.active ? (
                        <EyeOff className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-green-500" />
                      )}
                    </Button>
                    {item.archived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[36px] px-1"
                        onClick={() => handleRestore(item)}
                        title="استعادة"
                      >
                        <ArchiveRestore className="w-4 h-4 text-green-500" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[36px] px-1"
                        onClick={() => handleArchive(item)}
                        title="أرشفة"
                      >
                        <Archive className="w-4 h-4 text-amber-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[36px] px-1" onClick={() => openEdit(item)}>
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[36px] px-1"
                      onClick={() => { setDeleteTarget(item.id); setDeleteDialogOpen(true) }}
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
            <DialogTitle>{editId ? 'تعديل السلايدر' : 'إضافة سلايدر جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات السلايدر' : 'أدخل بيانات السلايدر الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            <ImageUpload
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              folder="sliders"
              label="رابط الصورة"
              placeholder="أدخل رابط الصورة أو ارفع من جهازك"
              required
            />
            <div>
              <Label>العنوان</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="عنوان السلايدر"
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>العنوان الفرعي</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="العنوان الفرعي"
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>الرابط</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://..."
                className="h-11 mt-1.5"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1">
                الرابط الذي سيتم الانتقال إليه عند الضغط على السلايدر (اختياري)
              </p>
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="h-11 mt-1.5"
                min={0}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
              <Label className="flex items-center gap-1.5 cursor-pointer">
                {form.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {form.active ? 'مفعّل' : 'معطّل'}
              </Label>
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
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة السلايدر'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا السلايدر؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
