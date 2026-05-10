'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Image as ImageIcon, AlertCircle, Archive, ArchiveRestore, Pencil, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { ImageUpload } from '@/components/ui/image-upload'

interface GalleryItem {
  id: string
  title: string | null
  imageUrl: string
  archived: boolean
  createdAt: string
}

export function GalleryManagement() {
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GalleryItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const { selectedSchoolId } = useAdminStore()

  const fetchGallery = useCallback(async () => {
    try {
      const params = new URLSearchParams({ schoolId: selectedSchoolId })
      if (showArchived) {
        params.set('includeArchived', 'true')
      }
      const res = await fetch(`/api/gallery?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setGallery(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error('فشل في تحميل الصور')
    } finally {
      setLoading(false)
    }
  }, [selectedSchoolId, showArchived])

  useEffect(() => {
    fetchGallery()
  }, [fetchGallery])

  const archivedCount = gallery.filter((item) => item.archived).length

  const handleAdd = async () => {
    if (!imageUrl.trim()) {
      toast.error('يرجى إدخال رابط الصورة')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          title: title || null,
          imageUrl,
        }),
      })

      if (res.ok) {
        toast.success('تم إضافة الصورة بنجاح')
        setTitle('')
        setImageUrl('')
        fetchGallery()
      } else {
        toast.error('فشل في إضافة الصورة')
      }
    } catch {
      toast.error('فشل في إضافة الصورة')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الصورة بنجاح')
        fetchGallery()
      } else {
        toast.error('فشل في حذف الصورة')
      }
    } catch {
      toast.error('فشل في حذف الصورة')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (res.ok) {
        toast.success('تم أرشفة الصورة')
        fetchGallery()
      } else {
        toast.error('فشل في أرشفة الصورة')
      }
    } catch {
      toast.error('فشل في أرشفة الصورة')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (res.ok) {
        toast.success('تم استعادة الصورة')
        fetchGallery()
      } else {
        toast.error('فشل في استعادة الصورة')
      }
    } catch {
      toast.error('فشل في استعادة الصورة')
    }
  }

  const openEdit = (item: GalleryItem) => {
    setEditTarget(item)
    setEditTitle(item.title || '')
    setEditImageUrl(item.imageUrl)
    setEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!editImageUrl.trim()) {
      toast.error('يرجى إدخال رابط الصورة')
      return
    }
    if (!editTarget) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/gallery/${editTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle || null,
          imageUrl: editImageUrl,
        }),
      })
      if (res.ok) {
        toast.success('تم تحديث الصورة بنجاح')
        setEditDialogOpen(false)
        fetchGallery()
      } else {
        toast.error('فشل في تحديث الصورة')
      }
    } catch {
      toast.error('فشل في تحديث الصورة')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Image Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="w-5 h-5 text-[#610000]" />
            إضافة صورة جديدة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">العنوان (اختياري)</label>
              <Input
                placeholder="عنوان الصورة"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11"
              />
            </div>
            <div>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="gallery"
                label="الصورة"
                placeholder="أدخل رابط الصورة أو ارفع من جهازك"
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handleAdd}
              disabled={saving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {saving ? 'جاري الإضافة...' : (
                <span className="flex items-center gap-1">
                  <Plus className="w-4 h-4" />
                  إضافة
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="w-5 h-5 text-[#610000]" />
              معرض الصور ({gallery.length})
            </CardTitle>
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              className={`min-h-[44px] ${showArchived ? 'bg-[#610000] hover:bg-[#8B0000] text-white' : ''}`}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <ArchiveRestore className="w-4 h-4 ml-1" /> : <Archive className="w-4 h-4 ml-1" />}
              {showArchived ? 'إخفاء المؤرشف' : 'المؤرشف'}
              {archivedCount > 0 && (
                <span className="mr-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{archivedCount}</span>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : gallery.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400">لا توجد صور في المعرض</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className={`group relative aspect-square rounded-xl overflow-hidden shadow-md border ${item.archived ? 'opacity-60 grayscale-[30%]' : ''}`}
                >
                  {item.archived && (
                    <div className="absolute top-2 right-2 z-10 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">
                      مؤرشف
                    </div>
                  )}
                  <img
                    src={item.imageUrl}
                    alt={item.title || 'صورة'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+TgCDYqtmFINi12YjYsdipPC90ZXh0Pjwvc3ZnPg=='
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    {item.title && (
                      <p className="text-white text-sm font-medium truncate">{item.title}</p>
                    )}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-[36px] text-xs"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="w-3 h-3 ml-0.5" />
                        تعديل
                      </Button>
                      {item.archived ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-[36px] text-xs text-green-600"
                          onClick={() => handleRestore(item.id)}
                        >
                          <ArchiveRestore className="w-3 h-3 ml-0.5" />
                          استعادة
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-[36px] text-xs text-orange-500"
                          onClick={() => handleArchive(item.id)}
                        >
                          <Archive className="w-3 h-3 ml-0.5" />
                          أرشفة
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="min-h-[36px] text-xs"
                        onClick={() => { setDeleteTarget(item.id); setDeleteDialogOpen(true) }}
                      >
                        <Trash2 className="w-3 h-3 ml-0.5" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الصورة</DialogTitle>
            <DialogDescription>تعديل بيانات الصورة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">العنوان (اختياري)</label>
              <Input
                placeholder="عنوان الصورة"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-11"
              />
            </div>
            <ImageUpload
              value={editImageUrl}
              onChange={setEditImageUrl}
              folder="gallery"
              label="الصورة"
              placeholder="أدخل رابط الصورة أو ارفع من جهازك"
              required
            />
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="min-h-[44px]">
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذه الصورة؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
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
