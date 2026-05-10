'use client'

import React, { useState, useEffect } from 'react'
import { Newspaper, Image, Users, FileBarChart, TrendingUp, Calendar, Settings, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminStore } from '@/lib/admin-store'

interface DashboardStats {
  newsCount: number
  galleryCount: number
  teachersCount: number
  resultsCount: number
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { setAdminView, selectedSchoolId } = useAdminStore()

  useEffect(() => {
    async function fetchStats() {
      try {
        const [newsRes, galleryRes, teachersRes, resultsRes] = await Promise.allSettled([
          fetch(`/api/news?schoolId=${selectedSchoolId}`),
          fetch(`/api/gallery?schoolId=${selectedSchoolId}`),
          fetch(`/api/teachers?schoolId=${selectedSchoolId}`),
          fetch('/api/results'),
        ])

        const newsCount = newsRes.status === 'fulfilled' && newsRes.value.ok
          ? (await newsRes.value.json()).length || 0 : 0
        const galleryCount = galleryRes.status === 'fulfilled' && galleryRes.value.ok
          ? (await galleryRes.value.json()).length || 0 : 0
        const teachersCount = teachersRes.status === 'fulfilled' && teachersRes.value.ok
          ? (await teachersRes.value.json()).length || 0 : 0
        const resultsCount = resultsRes.status === 'fulfilled' && resultsRes.value.ok
          ? (await resultsRes.value.json()).length || 0 : 0

        setStats({ newsCount, galleryCount, teachersCount, resultsCount })
      } catch {
        setStats({ newsCount: 0, galleryCount: 0, teachersCount: 0, resultsCount: 0 })
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [selectedSchoolId])

  const statCards = [
    { title: 'الأخبار', value: stats?.newsCount ?? 0, icon: Newspaper, color: 'from-amber-500 to-orange-500', view: 'news' as const },
    { title: 'الصور', value: stats?.galleryCount ?? 0, icon: Image, color: 'from-emerald-500 to-teal-500', view: 'gallery' as const },
    { title: 'المعلمون', value: stats?.teachersCount ?? 0, icon: Users, color: 'from-blue-500 to-cyan-500', view: 'teachers' as const },
    { title: 'النتائج', value: stats?.resultsCount ?? 0, icon: FileBarChart, color: 'from-rose-500 to-pink-500', view: 'results' as const },
  ]

  const quickActions = [
    { label: 'إضافة خبر', icon: Plus, view: 'news' as const },
    { label: 'رفع نتائج', icon: TrendingUp, view: 'results' as const },
    { label: 'إضافة معلم', icon: Users, view: 'teachers' as const },
    { label: 'إضافة جدول', icon: Calendar, view: 'schedules' as const },
    { label: 'إعدادات الموقع', icon: Settings, view: 'settings' as const },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          : statCards.map((stat) => (
              <Card
                key={stat.title}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setAdminView(stat.view)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{stat.title}</p>
                      <p className="text-2xl font-bold text-[#1a1a2e]">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setAdminView(action.view)}
              >
                <action.icon className="w-4 h-4 ml-2" />
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Welcome Card */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center mx-auto mb-4">
              <Newspaper className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#1a1a2e] mb-2">مرحباً بك في لوحة الإدارة</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              يمكنك إدارة جميع محتويات الموقع من هنا. استخدم القائمة الجانبية للتنقل بين الأقسام المختلفة.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
