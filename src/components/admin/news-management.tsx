'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Newspaper, AlertCircle, X, Eye, EyeOff, Archive, ArchiveRestore } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { ImageUpload } from '@/components/ui/image-upload'

interface NewsItem {
  id: string
  title: string
  excerpt: string | null
  content: string | null
  image: string | null
  category: string
  active: boolean
  archived: boolean
  createdAt: string
}

interface NewsForm {
  title: string
  excerpt: string
  content: string
  image: string
  category: string
  active: boolean
}

const defaultForm: NewsForm = {
  title: '',
  excerpt: '',
  content: '',
  image: '',
  category: 'أخبار',
  active: true,
}

const categories = ['أخبار', 'إعلانات', 'فعاليات', 'أنشطة', 'نتائج', 'أخرى']

export function NewsManagement() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<NewsForm>(defaultForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { selectedSchoolId } = useAdminStore()

  const fetchNews = useCallback(async () => {
    if (!selectedSchoolId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/news?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setNews(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل الأخبار')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  const archivedCount = news.filter(n => n.archived).length

  const openAdd = () => {
    setEditId(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  const openEdit = (item: NewsItem) => {
    setEditId(item.id)
    setForm({
      title: item.title,
      excerpt: item.excerpt || '',
      content: item.content || '',
      image: item.image || '',
      category: item.category,
      active: item.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('يرجى إدخال عنوان الخبر')
      return
    }
    setSaving(true)
    try {
      const body = {
        schoolId: selectedSchoolId,
        title: form.title,
        excerpt: form.excerpt || null,
        content: form.content || null,
        image: form.image || null,
        category: form.category,
        active: form.active,
      }

      const res = editId
        ? await fetch(`/api/news/${editId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (res.ok) {
        toast.success(editId ? 'تم تحديث الخبر بنجاح' : 'تم إضافة الخبر بنجاح')
        setDialogOpen(false)
        fetchNews()
      } else {
        toast.error('فشل في حفظ الخبر')
      }
    } catch {
      toast.error('فشل في حفظ الخبر')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الخبر بنجاح')
        fetchNews()
      } else {
        toast.error('فشل في حذف الخبر')
      }
    } catch {
      toast.error('فشل في حذف الخبر')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleArchive = async (item: NewsItem) => {
    try {
      const res = await fetch(`/api/news/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة الخبر بنجاح')
        fetchNews()
      } else {
        toast.error('فشل في أرشفة الخبر')
      }
    } catch {
      toast.error('فشل في أرشفة الخبر')
    }
  }

  const handleRestore = async (item: NewsItem) => {
    try {
      const res = await fetch(`/api/news/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة الخبر بنجاح')
        fetchNews()
      } else {
        toast.error('فشل في استعادة الخبر')
      }
    } catch {
      toast.error('فشل في استعادة الخبر')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-[#610000]" />
          إدارة الأخبار
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
            إضافة خبر
          </Button>
        </div>
      </div>

      {/* News List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">{showArchived ? 'لا توجد أخبار مؤرشفة' : 'لا توجد أخبار'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {news.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors ${item.archived ? 'opacity-60 bg-gray-50' : ''}`}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Newspaper className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-[#1a1a2e] truncate">{item.title}</h3>
                      <Badge variant={item.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {item.active ? 'منشور' : 'مسودة'}
                      </Badge>
                      {item.archived && (
                        <Badge variant="outline" className="text-xs shrink-0 border-amber-400 text-amber-600 bg-amber-50">
                          مؤرشف
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                    {item.excerpt && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-1">{item.excerpt}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {item.archived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => handleRestore(item)}
                        title="استعادة"
                      >
                        <ArchiveRestore className="w-4 h-4 text-green-500" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => handleArchive(item)}
                        title="أرشفة"
                      >
                        <Archive className="w-4 h-4 text-amber-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => openEdit(item)}>
                      <Edit className="w-4 h-4 text-blue-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px]"
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
            <DialogTitle>{editId ? 'تعديل الخبر' : 'إضافة خبر جديد'}</DialogTitle>
            <DialogDescription>
              {editId ? 'تعديل بيانات الخبر' : 'أدخل بيانات الخبر الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>العنوان</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="عنوان الخبر"
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>ملخص</Label>
              <Input
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="ملخص مختصر"
                className="h-11 mt-1.5"
              />
            </div>
            <div>
              <Label>المحتوى</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="محتوى الخبر الكامل"
                className="min-h-[120px] mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>التصنيف</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-11 mt-1.5 rounded-md border border-gray-200 bg-background px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <ImageUpload
                  value={form.image}
                  onChange={(url) => setForm({ ...form, image: url })}
                  folder="news"
                  label="صورة الخبر"
                  placeholder="أدخل رابط الصورة أو ارفع من جهازك"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
              <Label className="flex items-center gap-1.5 cursor-pointer">
                {form.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {form.active ? 'منشور' : 'مسودة'}
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
              {saving ? 'جاري الحفظ...' : editId ? 'حفظ التعديلات' : 'إضافة الخبر'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا الخبر؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
