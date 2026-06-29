'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Image as ImageIcon, Plus, Loader2, Search, AlertCircle,
  X, Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { resolveSchool, formatDate } from '@/lib/expense-utils'

interface GalleryImage {
  id: string
  eventId: string
  imageUrl: string
  caption: string | null
  uploadedAt: string
}

interface EventOption {
  id: string
  title: string
  startDate: string
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: unknown }).error
    if (typeof err === 'string') return err
  }
  return fallback
}

export function EventsGallery() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [events, setEvents] = useState<EventOption[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventId, setEventId] = useState('')

  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [newUrl, setNewUrl] = useState('')
  const [newCaption, setNewCaption] = useState('')
  const [adding, setAdding] = useState(false)

  const [preview, setPreview] = useState<GalleryImage | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Fetch events
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setEventsLoading(true)
        const res = await fetch(`/api/events?schoolId=${schoolId}`)
        const data: unknown = await res.json().catch(() => ({}))
        if (!cancelled) {
          const list =
            data && typeof data === 'object' && 'events' in data
              ? (data as { events?: unknown }).events
              : data
          const arr = Array.isArray(list) ? (list as EventOption[]) : []
          setEvents(arr)
          if (arr.length > 0) setEventId(arr[0].id)
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل قائمة الفعاليات')
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  const fetchGallery = useCallback(() => {
    let cancelled = false
    const load = async () => {
      if (!eventId) {
        setImages([])
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const res = await fetch(
          `/api/events/${eventId}/gallery?schoolId=${schoolId}`
        )
        const data: unknown = await res.json().catch(() => ({}))
        if (!cancelled) {
          if (res.ok) {
            const list =
              data && typeof data === 'object' && 'gallery' in data
                ? (data as { gallery?: unknown }).gallery
                : data
            setImages(Array.isArray(list) ? (list as GalleryImage[]) : [])
          } else {
            toast.error(extractErrorMessage(data, 'فشل في تحميل المعرض'))
            setImages([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل المعرض')
          setImages([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [eventId, schoolId])

  useEffect(() => fetchGallery(), [fetchGallery])

  const handleAdd = async () => {
    if (!eventId) {
      toast.error('الرجاء اختيار فعالية')
      return
    }
    if (!newUrl.trim()) {
      toast.error('الرجاء إدخال رابط الصورة')
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/events/${eventId}/gallery?schoolId=${schoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: newUrl.trim(),
          caption: newCaption.trim() || null,
        }),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('تمت إضافة الصورة')
        setNewUrl('')
        setNewCaption('')
        fetchGallery()
      } else {
        toast.error(extractErrorMessage(data, 'فشل في إضافة الصورة'))
      }
    } catch {
      toast.error('فشل في إضافة الصورة')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (img: GalleryImage) => {
    try {
      const res = await fetch(
        `/api/events/${eventId}/gallery/${img.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الصورة')
        setPreviewOpen(false)
        fetchGallery()
      } else {
        const data: unknown = await res.json().catch(() => ({}))
        toast.error(extractErrorMessage(data, 'فشل في حذف الصورة'))
      }
    } catch {
      toast.error('فشل في حذف الصورة')
    }
  }

  const filtered = search.trim()
    ? images.filter(
        (img) =>
          (img.caption || '').toLowerCase().includes(search.trim().toLowerCase())
      )
    : images

  const selectedEvent = events.find((e) => e.id === eventId)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[#610000]" />
          معرض صور الفعاليات
        </h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>الفعالية</Label>
              {eventsLoading ? (
                <Skeleton className="h-11 w-full" />
              ) : (
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر فعالية" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} — {formatDate(e.startDate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>بحث في التعليقات</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="بحث..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10 h-11"
                />
              </div>
            </div>
          </div>
          {selectedEvent && (
            <p className="text-sm text-gray-500">
              <Calendar className="w-4 h-4 inline-block ml-1" />
              {selectedEvent.title} — {formatDate(selectedEvent.startDate)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Image Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#610000]" />
            إضافة صورة جديدة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="h-11"
              dir="ltr"
            />
            <Input
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="تعليق على الصورة (اختياري)"
              className="h-11"
            />
            <Button
              onClick={handleAdd}
              disabled={adding || !eventId}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 ml-1" />
              )}
              إضافة
            </Button>
          </div>
          {newUrl && (
            <img
              src={newUrl}
              alt="معاينة"
              className="max-h-32 rounded-lg border border-gray-200"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Gallery Grid */}
      {!eventId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">الرجاء اختيار فعالية لعرض المعرض.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">لا توجد صور في هذا المعرض.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer"
              onClick={() => {
                setPreview(img)
                setPreviewOpen(true)
              }}
            >
              <img
                src={img.imageUrl}
                alt={img.caption || ''}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              {img.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="truncate">{preview?.caption || 'صورة'}</span>
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <img
                src={preview.imageUrl}
                alt={preview.caption || ''}
                className="w-full max-h-[60vh] object-contain rounded-lg border border-gray-200"
              />
              <div className="text-sm text-gray-500">
                <p>
                  رُفعت في: <span className="font-mono">{formatDate(preview.uploadedAt)}</span>
                </p>
                {preview.caption && <p className="mt-1">{preview.caption}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="min-h-[44px]"
            >
              <X className="w-4 h-4 ml-1" />
              إغلاق
            </Button>
            {preview && (
              <Button
                variant="outline"
                onClick={() => handleDelete(preview)}
                className="text-red-600 border-red-200 hover:bg-red-50 min-h-[44px]"
              >
                حذف
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
