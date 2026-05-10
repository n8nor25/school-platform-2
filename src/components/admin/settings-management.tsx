'use client'

import React, { useState, useEffect } from 'react'
import { Save, Settings, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUpload } from '@/components/ui/image-upload'
import { VideoUpload } from '@/components/ui/video-upload'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface SettingsData {
  // Settings model fields
  heroTitle: string
  heroSubtitle: string
  bannerTitle: string
  bannerImageUrl: string
  vision: string
  aboutImage: string
  aboutVideoUrl: string
  showNewsTicker: boolean
  showHeroBanner: boolean
  showLiveStream: boolean
  liveStreamUrl: string
  facebookUrl: string
  youtubeUrl: string
  // School model fields (also managed here)
  phone: string
  email: string
  address: string
  name: string
  description: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
}

const defaultSettings: SettingsData = {
  heroTitle: '',
  heroSubtitle: '',
  bannerTitle: '',
  bannerImageUrl: '',
  vision: '',
  aboutImage: '',
  aboutVideoUrl: '',
  showNewsTicker: true,
  showHeroBanner: true,
  showLiveStream: false,
  liveStreamUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  phone: '',
  email: '',
  address: '',
  name: '',
  description: '',
  logoUrl: '',
  primaryColor: '#610000',
  secondaryColor: '#009688',
}

export function SettingsManagement() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { selectedSchoolId } = useAdminStore()

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch(`/api/settings?schoolId=${selectedSchoolId}`)
        if (res.ok) {
          const data = await res.json()
          if (data && typeof data === 'object') {
            setSettings({
              heroTitle: data.heroTitle || '',
              heroSubtitle: data.heroSubtitle || '',
              bannerTitle: data.bannerTitle || '',
              bannerImageUrl: data.bannerImageUrl || '',
              vision: data.vision || '',
              aboutImage: data.aboutImage || '',
              aboutVideoUrl: data.aboutVideoUrl || '',
              showNewsTicker: data.showNewsTicker ?? true,
              showHeroBanner: data.showHeroBanner ?? true,
              showLiveStream: data.showLiveStream ?? false,
              liveStreamUrl: data.liveStreamUrl || '',
              facebookUrl: data.facebookUrl || '',
              youtubeUrl: data.youtubeUrl || '',
              phone: data.phone || '',
              email: data.email || '',
              address: data.address || '',
              name: data.name || '',
              description: data.description || '',
              logoUrl: data.logoUrl || '',
              primaryColor: data.primaryColor || '#610000',
              secondaryColor: data.secondaryColor || '#009688',
            })
          }
        }
      } catch {
        toast.error('فشل في تحميل الإعدادات')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/settings?schoolId=${selectedSchoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        toast.success('تم حفظ الإعدادات بنجاح')
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('Save error:', data)
        toast.error('فشل في حفظ الإعدادات')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('فشل في حفظ الإعدادات')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#610000]" />
          إعدادات الموقع
        </h2>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
        >
          {saving ? (
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
      </div>

      {/* School Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">بيانات المدرسة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>اسم المدرسة</Label>
            <Input
              value={settings.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="h-11 mt-1.5"
              placeholder="اسم المدرسة"
            />
          </div>
          <div>
            <Label>وصف المدرسة</Label>
            <Textarea
              value={settings.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="min-h-[80px] mt-1.5"
              placeholder="وصف مختصر عن المدرسة"
            />
          </div>
          <ImageUpload
            value={settings.logoUrl}
            onChange={(url) => updateField('logoUrl', url)}
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
                  value={settings.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border"
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
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
                  value={settings.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border"
                />
                <Input
                  value={settings.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="h-11"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">القسم الرئيسي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>العنوان الرئيسي</Label>
            <Input
              value={settings.heroTitle}
              onChange={(e) => updateField('heroTitle', e.target.value)}
              className="h-11 mt-1.5"
              placeholder="اسم المدرسة"
            />
          </div>
          <div>
            <Label>العنوان الفرعي</Label>
            <Input
              value={settings.heroSubtitle}
              onChange={(e) => updateField('heroSubtitle', e.target.value)}
              className="h-11 mt-1.5"
              placeholder="شعار المدرسة"
            />
          </div>
          <div>
            <Label>رؤية المدرسة</Label>
            <Textarea
              value={settings.vision}
              onChange={(e) => updateField('vision', e.target.value)}
              className="min-h-[80px] mt-1.5"
              placeholder="رؤية ورسالة المدرسة"
            />
          </div>
        </CardContent>
      </Card>

      {/* Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">البانر</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>عنوان البانر</Label>
            <Input
              value={settings.bannerTitle}
              onChange={(e) => updateField('bannerTitle', e.target.value)}
              className="h-11 mt-1.5"
            />
          </div>
          <ImageUpload
            value={settings.bannerImageUrl}
            onChange={(url) => updateField('bannerImageUrl', url)}
            folder="banners"
            label="صورة البانر"
            placeholder="أدخل رابط صورة البانر أو ارفع من جهازك"
          />
          <ImageUpload
            value={settings.aboutImage}
            onChange={(url) => updateField('aboutImage', url)}
            folder="about"
            label="صورة عن المدرسة"
            placeholder="أدخل رابط صورة عن المدرسة أو ارفع من جهازك"
          />
          <VideoUpload
            value={settings.aboutVideoUrl}
            onChange={(url) => updateField('aboutVideoUrl', url)}
            folder="about-video"
            label="فيديو عن المدرسة"
            placeholder="أدخل رابط فيديو YouTube أو رابط مباشر لملف فيديو"
          />
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">معلومات التواصل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>الهاتف</Label>
              <Input
                value={settings.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="h-11 mt-1.5"
                dir="ltr"
              />
            </div>
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input
                value={settings.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="h-11 mt-1.5"
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <Label>العنوان</Label>
            <Input
              value={settings.address}
              onChange={(e) => updateField('address', e.target.value)}
              className="h-11 mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">وسائل التواصل الاجتماعي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>رابط فيسبوك</Label>
              <Input
                value={settings.facebookUrl}
                onChange={(e) => updateField('facebookUrl', e.target.value)}
                className="h-11 mt-1.5"
                placeholder="https://facebook.com/..."
                dir="ltr"
              />
            </div>
            <div>
              <Label>رابط يوتيوب</Label>
              <Input
                value={settings.youtubeUrl}
                onChange={(e) => updateField('youtubeUrl', e.target.value)}
                className="h-11 mt-1.5"
                placeholder="https://youtube.com/..."
                dir="ltr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات العرض</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">شريط الأخبار العاجلة</Label>
              <p className="text-xs text-gray-400">عرض شريط الأخبار المتحرك</p>
            </div>
            <Switch
              checked={settings.showNewsTicker}
              onCheckedChange={(checked) => updateField('showNewsTicker', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">البانر الرئيسي</Label>
              <p className="text-xs text-gray-400">عرض البانر في الصفحة الرئيسية</p>
            </div>
            <Switch
              checked={settings.showHeroBanner}
              onCheckedChange={(checked) => updateField('showHeroBanner', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">البث المباشر</Label>
              <p className="text-xs text-gray-400">عرض قسم البث المباشر</p>
            </div>
            <Switch
              checked={settings.showLiveStream}
              onCheckedChange={(checked) => updateField('showLiveStream', checked)}
            />
          </div>
          {settings.showLiveStream && (
            <div>
              <Label>رابط البث المباشر</Label>
              <Input
                value={settings.liveStreamUrl}
                onChange={(e) => updateField('liveStreamUrl', e.target.value)}
                className="h-11 mt-1.5"
                placeholder="https://..."
                dir="ltr"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button Bottom */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
        >
          {saving ? (
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
    </div>
  )
}
