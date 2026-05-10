'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Save,
  LayoutDashboard,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  ImageIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { ImageUpload } from '@/components/ui/image-upload'

// ===== Types =====

interface SectionToggle {
  key: string
  label: string
  description: string
}

interface CustomSection {
  id: string
  schoolId: string
  title: string
  content: string
  imageUrl: string | null
  layout: string
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface SectionOrderItem {
  id: string
  label: string
  isCustom: boolean
}

// ===== Constants =====

const sectionToggles: SectionToggle[] = [
  { key: 'showSlider', label: 'السلايدر', description: 'عرض سلايدر الصور في الصفحة الرئيسية' },
  { key: 'showAbout', label: 'من نحن', description: 'عرض قسم من نحن / عن المدرسة' },
  { key: 'showNews', label: 'الأخبار', description: 'عرض قسم الأخبار' },
  { key: 'showServices', label: 'الخدمات الإلكترونية', description: 'عرض قسم الخدمات الإلكترونية' },
  { key: 'showGallery', label: 'معرض الصور', description: 'عرض معرض الصور' },
  { key: 'showTeachers', label: 'المعلمون', description: 'عرض قسم المعلمين' },
  { key: 'showStats', label: 'الإحصائيات', description: 'عرض قسم الإحصائيات' },
  { key: 'showContact', label: 'التواصل', description: 'عرض قسم التواصل' },
  { key: 'showNewsTicker', label: 'شريط الأخبار العاجلة', description: 'عرض شريط الأخبار المتحرك' },
  { key: 'showHeroBanner', label: 'البانر', description: 'عرض البانر الرئيسي' },
  { key: 'showLiveStream', label: 'البث المباشر', description: 'عرض قسم البث المباشر' },
]

const defaultSectionsOrder: string[] = [
  'slider',
  'about',
  'news',
  'services',
  'gallery',
  'teachers',
  'stats',
  'contact',
]

const sectionIdToLabel: Record<string, string> = {
  slider: 'السلايدر',
  about: 'من نحن',
  news: 'الأخبار',
  services: 'الخدمات الإلكترونية',
  gallery: 'معرض الصور',
  teachers: 'المعلمون',
  stats: 'الإحصائيات',
  contact: 'التواصل',
}

const layoutOptions = [
  { value: 'full', label: 'عرض كامل' },
  { value: 'image-right', label: 'صورة يمين' },
  { value: 'image-left', label: 'صورة يسار' },
  { value: 'cards', label: 'بطاقات' },
]

type SectionsState = Record<string, boolean>

const defaultToggleState: SectionsState = {}
sectionToggles.forEach((s) => {
  defaultToggleState[s.key] = true
})
defaultToggleState.showLiveStream = false

// ===== Main Component =====

export function SectionsManagement() {
  const { selectedSchoolId } = useAdminStore()

  // Tab state
  const [activeTab, setActiveTab] = useState('order')

  // Show/Hide state
  const [sections, setSections] = useState<SectionsState>(defaultToggleState)
  const [savingToggles, setSavingToggles] = useState(false)

  // Section order state
  const [sectionOrder, setSectionOrder] = useState<string[]>([...defaultSectionsOrder])
  const [savingOrder, setSavingOrder] = useState(false)

  // Custom sections state
  const [customSections, setCustomSections] = useState<CustomSection[]>([])
  const [loadingCustom, setLoadingCustom] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<CustomSection | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formLayout, setFormLayout] = useState('full')
  const [formActive, setFormActive] = useState(true)
  const [savingCustom, setSavingCustom] = useState(false)

  // Loading
  const [loading, setLoading] = useState(true)

  // ===== Fetch settings =====
  const fetchSettings = useCallback(async () => {
    if (!selectedSchoolId) return
    try {
      const res = await fetch(`/api/settings?schoolId=${selectedSchoolId}`)
      if (res.ok) {
        const data = await res.json()
        if (data && typeof data === 'object') {
          // Load toggle states
          const newState: SectionsState = {}
          sectionToggles.forEach((s) => {
            newState[s.key] = s.key in data ? data[s.key] : defaultToggleState[s.key]
          })
          setSections(newState)

          // Load section order
          if (data.sectionOrder) {
            try {
              const parsed = JSON.parse(data.sectionOrder)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSectionOrder(parsed)
              }
            } catch {
              // Keep default order
            }
          }
        }
      }
    } catch {
      toast.error('فشل في تحميل الإعدادات')
    }
  }, [selectedSchoolId])

  // ===== Fetch custom sections =====
  const fetchCustomSections = useCallback(async () => {
    if (!selectedSchoolId) return
    setLoadingCustom(true)
    try {
      const res = await fetch(`/api/custom-sections?schoolId=${selectedSchoolId}`)
      if (res.ok) {
        const data = await res.json()
        setCustomSections(data)
      }
    } catch {
      toast.error('فشل في جلب الأقسام المخصصة')
    } finally {
      setLoadingCustom(false)
    }
  }, [selectedSchoolId])

  // ===== Initial load =====
  useEffect(() => {
    async function load() {
      setLoading(true)
      await Promise.all([fetchSettings(), fetchCustomSections()])
      setLoading(false)
    }
    load()
  }, [fetchSettings, fetchCustomSections])

  // ===== Build the ordered section list for Tab 1 =====
  const buildOrderItems = (): SectionOrderItem[] => {
    const items: SectionOrderItem[] = []

    for (const id of sectionOrder) {
      if (id.startsWith('custom-')) {
        const csId = id.replace('custom-', '')
        const cs = customSections.find((c) => c.id === csId)
        if (cs) {
          items.push({ id, label: cs.title, isCustom: true })
        }
      } else if (sectionIdToLabel[id]) {
        items.push({ id, label: sectionIdToLabel[id], isCustom: false })
      }
    }

    // Add any default sections not in the order
    for (const id of defaultSectionsOrder) {
      if (!items.some((item) => item.id === id)) {
        items.push({ id, label: sectionIdToLabel[id], isCustom: false })
      }
    }

    // Add any custom sections not in the order
    for (const cs of customSections) {
      const csKey = `custom-${cs.id}`
      if (!items.some((item) => item.id === csKey)) {
        items.push({ id: csKey, label: cs.title, isCustom: true })
      }
    }

    return items
  }

  const orderItems = buildOrderItems()

  // ===== Move section up/down =====
  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderItems.map((item) => item.id)]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex < 0 || targetIndex >= newOrder.length) return

    const temp = newOrder[index]
    newOrder[index] = newOrder[targetIndex]
    newOrder[targetIndex] = temp

    setSectionOrder(newOrder)
  }

  // ===== Save section order =====
  const handleSaveOrder = async () => {
    if (!selectedSchoolId) {
      toast.error('يرجى اختيار المدرسة أولاً')
      return
    }
    setSavingOrder(true)
    try {
      const res = await fetch('/api/custom-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrder',
          schoolId: selectedSchoolId,
          sectionOrder,
        }),
      })

      if (res.ok) {
        toast.success('تم حفظ ترتيب الأقسام بنجاح')
      } else {
        toast.error('فشل في حفظ ترتيب الأقسام')
      }
    } catch {
      toast.error('فشل في حفظ ترتيب الأقسام')
    } finally {
      setSavingOrder(false)
    }
  }

  // ===== Save toggle states =====
  const handleSaveToggles = async () => {
    if (!selectedSchoolId) {
      toast.error('يرجى اختيار المدرسة أولاً')
      return
    }
    setSavingToggles(true)
    try {
      const res = await fetch(`/api/settings?schoolId=${selectedSchoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: selectedSchoolId, ...sections }),
      })

      if (res.ok) {
        toast.success('تم حفظ إعدادات العرض بنجاح')
      } else {
        toast.error('فشل في حفظ إعدادات العرض')
      }
    } catch {
      toast.error('فشل في حفظ إعدادات العرض')
    } finally {
      setSavingToggles(false)
    }
  }

  // ===== Toggle section visibility =====
  const toggleSection = (key: string, value: boolean) => {
    setSections((prev) => ({ ...prev, [key]: value }))
  }

  // ===== Open dialog for new custom section =====
  const openNewSectionDialog = () => {
    setEditingSection(null)
    setFormTitle('')
    setFormContent('')
    setFormImageUrl('')
    setFormLayout('full')
    setFormActive(true)
    setDialogOpen(true)
  }

  // ===== Open dialog for editing custom section =====
  const openEditSectionDialog = (section: CustomSection) => {
    setEditingSection(section)
    setFormTitle(section.title)
    setFormContent(section.content)
    setFormImageUrl(section.imageUrl || '')
    setFormLayout(section.layout)
    setFormActive(section.active)
    setDialogOpen(true)
  }

  // ===== Save custom section (create or update) =====
  const handleSaveCustomSection = async () => {
    if (!selectedSchoolId) {
      toast.error('يرجى اختيار المدرسة أولاً')
      return
    }
    if (!formTitle.trim()) {
      toast.error('يرجى إدخال عنوان القسم')
      return
    }

    setSavingCustom(true)
    try {
      if (editingSection) {
        // Update
        const res = await fetch('/api/custom-sections', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingSection.id,
            title: formTitle,
            content: formContent,
            imageUrl: formImageUrl || null,
            layout: formLayout,
            active: formActive,
          }),
        })

        if (res.ok) {
          toast.success('تم تحديث القسم المخصص بنجاح')
          setDialogOpen(false)
          fetchCustomSections()
        } else {
          toast.error('فشل في تحديث القسم المخصص')
        }
      } else {
        // Create
        const res = await fetch('/api/custom-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: selectedSchoolId,
            title: formTitle,
            content: formContent,
            imageUrl: formImageUrl || null,
            layout: formLayout,
            active: formActive,
          }),
        })

        if (res.ok) {
          toast.success('تم إنشاء القسم المخصص بنجاح')
          setDialogOpen(false)
          fetchCustomSections()
        } else {
          toast.error('فشل في إنشاء القسم المخصص')
        }
      }
    } catch {
      toast.error('حدث خطأ أثناء الحفظ')
    } finally {
      setSavingCustom(false)
    }
  }

  // ===== Delete custom section =====
  const handleDeleteCustomSection = async (id: string) => {
    try {
      const res = await fetch('/api/custom-sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        toast.success('تم حذف القسم المخصص بنجاح')
        fetchCustomSections()
      } else {
        toast.error('فشل في حذف القسم المخصص')
      }
    } catch {
      toast.error('فشل في حذف القسم المخصص')
    }
  }

  // ===== Toggle custom section active state =====
  const handleToggleCustomActive = async (section: CustomSection) => {
    try {
      const res = await fetch('/api/custom-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: section.id,
          active: !section.active,
        }),
      })

      if (res.ok) {
        toast.success(section.active ? 'تم إلغاء تفعيل القسم' : 'تم تفعيل القسم')
        fetchCustomSections()
      } else {
        toast.error('فشل في تحديث حالة القسم')
      }
    } catch {
      toast.error('فشل في تحديث حالة القسم')
    }
  }

  // ===== Loading skeleton =====
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-[#610000]" />
          إدارة أقسام الصفحة الرئيسية
        </h2>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="order" className="gap-1.5">
            <ArrowUp className="w-3.5 h-3.5" />
            ترتيب الأقسام
          </TabsTrigger>
          <TabsTrigger value="toggles" className="gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            عرض/إخفاء
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            أقسام مخصصة
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Section Order ===== */}
        <TabsContent value="order" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">ترتيب ظهور الأقسام</CardTitle>
              <Button
                onClick={handleSaveOrder}
                disabled={savingOrder}
                className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                size="sm"
              >
                {savingOrder ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    حفظ الترتيب
                  </span>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-0">
              {orderItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-2 py-0.5 shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {item.label}
                        </span>
                        {item.isCustom && (
                          <span className="text-xs text-[#610000] bg-[#610000]/10 px-1.5 py-0.5 rounded">
                            مخصص
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => moveSection(index, 'up')}
                        title="نقل لأعلى"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === orderItems.length - 1}
                        onClick={() => moveSection(index, 'down')}
                        title="نقل لأسفل"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {index < orderItems.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </CardContent>
          </Card>

          {/* Save button at bottom */}
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSaveOrder}
              disabled={savingOrder}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {savingOrder ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري الحفظ...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  حفظ الترتيب
                </span>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ===== Tab 2: Show/Hide ===== */}
        <TabsContent value="toggles" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">تحكم بعرض الأقسام</CardTitle>
              <Button
                onClick={handleSaveToggles}
                disabled={savingToggles}
                className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                size="sm"
              >
                {savingToggles ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    حفظ الإعدادات
                  </span>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-0">
              {sectionToggles.map((section, index) => (
                <React.Fragment key={section.key}>
                  <div className="flex items-center justify-between py-4">
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-medium">{section.label}</Label>
                      <p className="text-xs text-gray-400 mt-0.5">{section.description}</p>
                    </div>
                    <Switch
                      checked={sections[section.key] ?? true}
                      onCheckedChange={(checked) => toggleSection(section.key, checked)}
                    />
                  </div>
                  {index < sectionToggles.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">ملخص الأقسام</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sectionToggles.map((section) => (
                  <span
                    key={section.key}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      sections[section.key]
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {sections[section.key] ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                    {section.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Save button at bottom */}
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSaveToggles}
              disabled={savingToggles}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {savingToggles ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري الحفظ...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  حفظ جميع الإعدادات
                </span>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ===== Tab 3: Custom Sections ===== */}
        <TabsContent value="custom" className="mt-4">
          {/* Add new section button + dialog */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-[#1a1a2e]">
              الأقسام المخصصة
            </h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openNewSectionDialog}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px] gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة قسم مخصص
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader>
                  <DialogTitle>
                    {editingSection ? 'تعديل القسم المخصص' : 'إضافة قسم مخصص جديد'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="section-title">
                      عنوان القسم
                      <span className="text-red-500 mr-1">*</span>
                    </Label>
                    <Input
                      id="section-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="أدخل عنوان القسم"
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <Label htmlFor="section-content">المحتوى (HTML)</Label>
                    <Textarea
                      id="section-content"
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="أدخل محتوى القسم (يدعم HTML)"
                      rows={6}
                      className="resize-y"
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <ImageUpload
                      value={formImageUrl}
                      onChange={(url) => setFormImageUrl(url)}
                      folder="custom-sections"
                      label="صورة القسم"
                    />
                  </div>

                  {/* Layout */}
                  <div className="space-y-2">
                    <Label>التخطيط</Label>
                    <Select value={formLayout} onValueChange={setFormLayout}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التخطيط" />
                      </SelectTrigger>
                      <SelectContent>
                        {layoutOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Active */}
                  <div className="flex items-center justify-between py-2">
                    <Label>تفعيل القسم</Label>
                    <Switch
                      checked={formActive}
                      onCheckedChange={setFormActive}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={savingCustom}
                    >
                      إلغاء
                    </Button>
                    <Button
                      onClick={handleSaveCustomSection}
                      disabled={savingCustom || !formTitle.trim()}
                      className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                    >
                      {savingCustom ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          جاري الحفظ...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Save className="w-4 h-4" />
                          {editingSection ? 'تحديث' : 'إنشاء'}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Custom sections list */}
          {loadingCustom ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : customSections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 text-center">
                  لا توجد أقسام مخصصة بعد
                </p>
                <p className="text-xs text-gray-400 mt-1 text-center">
                  اضغط على &quot;إضافة قسم مخصص&quot; لإنشاء قسم جديد
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {customSections.map((section) => (
                <Card
                  key={section.id}
                  className={`transition-opacity ${
                    section.active ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold truncate">
                            {section.title}
                          </h4>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              section.active
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {section.active ? (
                              <>
                                <Eye className="w-2.5 h-2.5" />
                                مفعّل
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-2.5 h-2.5" />
                                معطّل
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>
                            التخطيط:{' '}
                            {layoutOptions.find((l) => l.value === section.layout)?.label || section.layout}
                          </span>
                          {section.imageUrl && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              يحتوي صورة
                            </span>
                          )}
                        </div>
                        {section.content && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {section.content.replace(/<[^>]*>/g, '').substring(0, 100)}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleCustomActive(section)}
                          title={section.active ? 'إلغاء التفعيل' : 'تفعيل'}
                        >
                          {section.active ? (
                            <EyeOff className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Eye className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditSectionDialog(section)}
                          title="تعديل"
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل أنت متأكد من حذف القسم &quot;{section.title}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCustomSection(section.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
