'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Loader2, Search, Calendar, CheckCircle, XCircle,
  Printer, AlertCircle, UserCheck, Activity,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'
import { resolveSchool, formatDate } from '@/lib/expense-utils'

interface Registration {
  id: string
  registrantId: string
  registrantName: string
  registrantType: string
  status: string
  registeredAt: string
  attendedAt: string | null
  notes: string | null
}

interface EventOption {
  id: string
  title: string
  startDate: string
}

const ATTENDANCE_STATUSES = ['مسجل', 'حضر', 'غاب']

const STATUS_BADGE_COLORS: Record<string, string> = {
  'مسجل': 'bg-blue-100 text-blue-700 border-blue-200',
  'حضر': 'bg-green-100 text-green-700 border-green-200',
  'غاب': 'bg-red-100 text-red-700 border-red-200',
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: unknown }).error
    if (typeof err === 'string') return err
  }
  return fallback
}

export interface EventAttendanceProps {
  eventId?: string
}

export function EventAttendance({ eventId: initialEventId }: EventAttendanceProps) {
  const { selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const [events, setEvents] = useState<EventOption[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventId, setEventId] = useState<string>(initialEventId || '')

  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState<string | null>(null)

  // Fetch events list for picker
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
          if (!initialEventId && arr.length > 0) setEventId(arr[0].id)
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل قائمة الفعاليات')
      } finally {
        if (!cancelled) setEventsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, initialEventId])

  // Fetch registrations
  const fetchRegistrations = useCallback(() => {
    let cancelled = false
    const load = async () => {
      if (!eventId) {
        setRegistrations([])
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        const params = new URLSearchParams({ schoolId })
        if (search.trim()) params.set('search', search.trim())
        if (statusFilter !== 'all') params.set('status', statusFilter)
        const res = await fetch(
          `/api/events/${eventId}/attendance?${params.toString()}`
        )
        const data: unknown = await res.json().catch(() => ({}))
        if (!cancelled) {
          if (res.ok) {
            const list =
              data && typeof data === 'object' && 'registrations' in data
                ? (data as { registrations?: unknown }).registrations
                : data
            setRegistrations(Array.isArray(list) ? (list as Registration[]) : [])
          } else {
            toast.error(extractErrorMessage(data, 'فشل في تحميل التسجيلات'))
            setRegistrations([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل التسجيلات')
          setRegistrations([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [eventId, schoolId, search, statusFilter])

  useEffect(() => fetchRegistrations(), [fetchRegistrations])

  // ===== Stats =====
  const stats = useMemo(() => {
    const total = registrations.length
    const attended = registrations.filter((r) => r.status === 'حضر').length
    const absent = registrations.filter((r) => r.status === 'غاب').length
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0
    return { total, attended, absent, rate }
  }, [registrations])

  // ===== Selection =====
  const toggleAll = () => {
    if (selected.size === registrations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(registrations.map((r) => r.id)))
    }
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ===== Update row status =====
  const updateRowStatus = async (id: string, status: string) => {
    setUpdating(id)
    try {
      const res = await fetch(`/api/events/${eventId}/attendance?schoolId=${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ id, status }],
        }),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('تم تحديث الحالة')
        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  attendedAt: status === 'حضر' ? new Date().toISOString() : null,
                }
              : r
          )
        )
      } else {
        toast.error(extractErrorMessage(data, 'فشل في تحديث الحالة'))
      }
    } catch {
      toast.error('فشل في تحديث الحالة')
    } finally {
      setUpdating(null)
    }
  }

  const bulkUpdate = async (status: 'حضر' | 'غاب') => {
    if (selected.size === 0) {
      toast.error('الرجاء تحديد تسجيلات أولًا')
      return
    }
    setUpdating('bulk-' + status)
    try {
      const updates = registrations
        .filter((r) => selected.has(r.id))
        .map((r) => ({
          id: r.id,
          status,
          attendedAt: status === 'حضر' ? new Date().toISOString() : null,
        }))
      const res = await fetch(`/api/events/${eventId}/attendance?schoolId=${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data: unknown = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`تم تحديث ${updates.length} تسجيل`)
        setRegistrations((prev) =>
          prev.map((r) => {
            if (!selected.has(r.id)) return r
            return {
              ...r,
              status,
              attendedAt: status === 'حضر' ? new Date().toISOString() : null,
            }
          })
        )
        setSelected(new Set())
      } else {
        toast.error(extractErrorMessage(data, 'فشل في التحديث الجماعي'))
      }
    } catch {
      toast.error('فشل في التحديث الجماعي')
    } finally {
      setUpdating(null)
    }
  }

  const statusBadge = (s: string) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        STATUS_BADGE_COLORS[s] || STATUS_BADGE_COLORS['مسجل']
      }`}
    >
      {s}
    </span>
  )

  const selectedEvent = events.find((e) => e.id === eventId)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#610000]" />
          حضور الفعاليات
        </h2>
        <Button
          variant="outline"
          onClick={() => window.print()}
          className="min-h-[44px]"
        >
          <Printer className="w-4 h-4 ml-1" />
          طباعة
        </Button>
      </div>

      {/* Event picker */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label>بحث</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="بحث بالاسم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> إجمالي المسجلين
            </p>
            <p className="text-xl font-bold text-[#610000] font-mono mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> الحاضرون
            </p>
            <p className="text-xl font-bold text-green-600 font-mono mt-1">{stats.attended}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> الغائبون
            </p>
            <p className="text-xl font-bold text-red-600 font-mono mt-1">{stats.absent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Activity className="w-3 h-3" /> نسبة الحضور
            </p>
            <p className="text-xl font-bold text-blue-600 font-mono mt-1">{stats.rate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700">
                تم تحديد <span className="font-bold">{selected.size}</span> تسجيل
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => bulkUpdate('حضر')}
                  disabled={!!updating}
                  className="bg-green-600 hover:bg-green-700 text-white h-9"
                >
                  {updating === 'bulk-حضر' ? (
                    <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 ml-1" />
                  )}
                  تحديد الكل كحاضر
                </Button>
                <Button
                  size="sm"
                  onClick={() => bulkUpdate('غاب')}
                  disabled={!!updating}
                  className="bg-red-600 hover:bg-red-700 text-white h-9"
                >
                  {updating === 'bulk-غاب' ? (
                    <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 ml-1" />
                  )}
                  تحديد الكل كغائب
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                  className="h-9"
                >
                  إلغاء التحديد
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!eventId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">الرجاء اختيار فعالية لعرض التسجيلات.</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">لا توجد تسجيلات لهذه الفعالية.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          registrations.length > 0 &&
                          selected.size === registrations.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>وقت الحضور</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead className="text-center">تغيير الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((r) => (
                    <TableRow key={r.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-gray-800">
                          {r.registrantName || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-gray-600 border-gray-200">
                          {r.registrantType || 'طالب'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-gray-600">
                          {formatDate(r.registeredAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-gray-600">
                          {r.attendedAt ? formatDate(r.attendedAt) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-600">
                          {r.notes || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={r.status}
                          onValueChange={(v) => updateRowStatus(r.id, v)}
                          disabled={updating === r.id}
                        >
                          <SelectTrigger className="h-9 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
