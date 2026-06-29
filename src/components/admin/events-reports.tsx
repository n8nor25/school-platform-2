'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar, Users, Trophy, Activity, Loader2, AlertCircle,
  TrendingUp, Clock, CheckCircle, PartyPopper, Bus, Mic,
  Dumbbell, BookOpen, CalendarDays,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import {
  resolveSchool, formatDate, formatLongDate, formatCurrency,
} from '@/lib/expense-utils'

interface EventItem {
  id: string
  title: string
  type: string
  status: string
  startDate: string
  endDate: string | null
  location: string
  budget: number | null
  maxAttendees: number | null
  _count?: { registrations?: number; gallery?: number; feedback?: number }
  registrations?: Array<{ status: string }>
}

const EVENT_TYPES = [
  'حفل', 'رحلة', 'مسابقة', 'ندوة', 'اجتماع',
  'رياضي', 'ثقافي', 'ديني', 'نشاط',
]

const TYPE_COLORS: Record<string, string> = {
  'حفل': 'bg-amber-100 text-amber-700 border-amber-200',
  'رحلة': 'bg-green-100 text-green-700 border-green-200',
  'مسابقة': 'bg-purple-100 text-purple-700 border-purple-200',
  'ندوة': 'bg-blue-100 text-blue-700 border-blue-200',
  'اجتماع': 'bg-gray-100 text-gray-700 border-gray-200',
  'رياضي': 'bg-orange-100 text-orange-700 border-orange-200',
  'ثقافي': 'bg-pink-100 text-pink-700 border-pink-200',
  'ديني': 'bg-teal-100 text-teal-700 border-teal-200',
  'نشاط': 'bg-sky-100 text-sky-700 border-sky-200',
}

const STATUS_COLORS: Record<string, string> = {
  'مجدولة': 'bg-blue-100 text-blue-700 border-blue-200',
  'جارية': 'bg-green-100 text-green-700 border-green-200',
  'منتهية': 'bg-gray-100 text-gray-700 border-gray-200',
  'ملغاة': 'bg-red-100 text-red-700 border-red-200',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  'حفل': <PartyPopper className="w-3.5 h-3.5" />,
  'رحلة': <Bus className="w-3.5 h-3.5" />,
  'مسابقة': <Trophy className="w-3.5 h-3.5" />,
  'ندوة': <Mic className="w-3.5 h-3.5" />,
  'اجتماع': <Users className="w-3.5 h-3.5" />,
  'رياضي': <Dumbbell className="w-3.5 h-3.5" />,
  'ثقافي': <BookOpen className="w-3.5 h-3.5" />,
  'ديني': <Activity className="w-3.5 h-3.5" />,
  'نشاط': <CalendarDays className="w-3.5 h-3.5" />,
}

export function EventsReports() {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/events?schoolId=${schoolId}`)
        const data: unknown = await res.json().catch(() => ({}))
        if (!cancelled) {
          if (res.ok) {
            const list =
              data && typeof data === 'object' && 'events' in data
                ? (data as { events?: unknown }).events
                : data
            setEvents(Array.isArray(list) ? (list as EventItem[]) : [])
          } else {
            toast.error('فشل في تحميل الفعاليات')
            setEvents([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل الفعاليات')
          setEvents([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId])

  const stats = useMemo(() => {
    const total = events.length
    const byStatus: Record<string, number> = {}
    const byType: Record<string, number> = {}
    let totalRegistrations = 0
    let totalAttended = 0
    let totalBudget = 0
    for (const e of events) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1
      byType[e.type] = (byType[e.type] || 0) + 1
      const regs = e.registrations || []
      const regCount = e._count?.registrations ?? regs.length
      totalRegistrations += regCount
      totalAttended += regs.filter((r) => r.status === 'حضر').length
      totalBudget += e.budget || 0
    }
    const avgAttendance =
      totalRegistrations > 0 ? Math.round((totalAttended / totalRegistrations) * 100) : 0

    const topByRegs = [...events]
      .map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        startDate: e.startDate,
        regCount: e._count?.registrations ?? (e.registrations?.length || 0),
        maxAttendees: e.maxAttendees,
      }))
      .sort((a, b) => b.regCount - a.regCount)
      .slice(0, 5)

    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const upcoming = events
      .filter((e) => {
        const d = new Date(e.startDate)
        return d >= now && d <= sevenDaysLater
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

    return {
      total,
      byStatus,
      byType,
      totalRegistrations,
      avgAttendance,
      totalBudget,
      topByRegs,
      upcoming,
    }
  }, [events])

  const typeBadge = (t: string) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
        TYPE_COLORS[t] || TYPE_COLORS['نشاط']
      }`}
    >
      {TYPE_ICONS[t] || <Calendar className="w-3.5 h-3.5" />}
      {t}
    </span>
  )

  const statusBadge = (s: string) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        STATUS_COLORS[s] || STATUS_COLORS['مجدولة']
      }`}
    >
      {s}
    </span>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[#610000]" />
        تقارير الفعاليات والأنشطة
      </h2>

      {/* Top Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> إجمالي الفعاليات
            </p>
            <p className="text-2xl font-bold text-[#610000] font-mono mt-1">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> إجمالي التسجيلات
            </p>
            <p className="text-2xl font-bold text-blue-600 font-mono mt-1">
              {stats.totalRegistrations}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Activity className="w-3 h-3" /> متوسط نسبة الحضور
            </p>
            <p className="text-2xl font-bold text-green-600 font-mono mt-1">
              {stats.avgAttendance}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> إجمالي الميزانية
            </p>
            <p className="text-xl font-bold text-amber-600 font-mono mt-1">
              {formatCurrency(stats.totalBudget)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#610000]" />
              التوزيع حسب الحالة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.byStatus).length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                لا توجد بيانات
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.byStatus).map(([status, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex items-center justify-between">
                        {statusBadge(status)}
                        <span className="text-sm font-mono text-gray-700">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            status === 'مجدولة' ? 'bg-blue-500'
                              : status === 'جارية' ? 'bg-green-500'
                              : status === 'ملغاة' ? 'bg-red-500'
                              : 'bg-gray-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#610000]" />
              التوزيع حسب النوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.byType).length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                لا توجد بيانات
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.filter((t) => stats.byType[t]).map((t) => (
                  <div
                    key={t}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
                      TYPE_COLORS[t] || TYPE_COLORS['نشاط']
                    }`}
                  >
                    <span className="text-sm font-medium">{t}</span>
                    <span className="text-sm font-bold font-mono">
                      {stats.byType[t]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 5 by registrations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#610000]" />
            أعلى 5 فعاليات حسب التسجيلات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topByRegs.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              لا توجد فعاليات
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topByRegs.map((e, idx) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 p-2 rounded-lg border border-gray-100"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm font-mono ${
                    idx === 0 ? 'bg-amber-100 text-amber-700'
                      : idx === 1 ? 'bg-gray-100 text-gray-700'
                      : idx === 2 ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-50 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{e.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {typeBadge(e.type)}
                      <span className="text-xs text-gray-500 font-mono">
                        {formatDate(e.startDate)}
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-[#610000] font-mono">
                      {e.regCount}
                    </p>
                    {e.maxAttendees != null && (
                      <p className="text-xs text-gray-400 font-mono">
                        / {e.maxAttendees}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#610000]" />
            الفعاليات القادمة (خلال 7 أيام)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.upcoming.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              لا توجد فعاليات قادمة في الأسبوع القادم
            </div>
          ) : (
            <div className="space-y-2">
              {stats.upcoming.map((e) => {
                const days = Math.ceil(
                  (new Date(e.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                  >
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-[#610000]/10 text-[#610000] shrink-0">
                      <span className="text-lg font-bold font-mono leading-none">
                        {new Date(e.startDate).getDate()}
                      </span>
                      <span className="text-xs mt-0.5">
                        {new Date(e.startDate).toLocaleDateString('ar-EG', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{e.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {typeBadge(e.type)}
                        <span className="text-xs text-gray-500">
                          {e.location || '—'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatLongDate(e.startDate)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-blue-700 border-blue-200 bg-blue-50"
                    >
                      بعد {days} {days === 1 ? 'يوم' : 'أيام'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-gray-400 text-center">
        جميع الإحصائيات تُحسب من بيانات الفعاليات المحملة محليًا.
      </p>
    </div>
  )
}
