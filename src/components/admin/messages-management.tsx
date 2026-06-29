'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Mail, Send, Inbox, Star, Archive, Trash2, Search, Plus,
  Loader2, MessageSquare, Check, Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { resolveSchool, formatDate, formatLongDate } from '@/lib/expense-utils'

interface Message {
  id: string
  senderId: string
  senderName: string
  senderRole: string
  recipientId: string
  recipientName: string
  subject: string
  content: string
  attachments: string | string[] | null
  priority: string
  isRead: boolean
  readAt: string | null
  isStarred: boolean
  isArchived: boolean
  createdAt: string
}

interface NewMessageForm {
  recipientId: string
  recipientName: string
  subject: string
  content: string
  priority: string
  attachments: string
}

const defaultForm: NewMessageForm = {
  recipientId: '',
  recipientName: '',
  subject: '',
  content: '',
  priority: 'عادي',
  attachments: '',
}

const PRIORITY_COLORS: Record<string, string> = {
  'عادي': 'bg-gray-100 text-gray-700 border-gray-200',
  'عاجل': 'bg-red-100 text-red-700 border-red-200',
  'هام': 'bg-amber-100 text-amber-700 border-amber-200',
}

const PRIORITIES = ['عادي', 'عاجل', 'هام']

function parseAttachments(raw: string | string[] | null): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string')
    }
    return []
  } catch {
    return []
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export function MessagesManagement() {
  const { adminUser, selectedSchoolId } = useAdminStore()
  const schoolId = resolveSchool(selectedSchoolId)

  const sender = {
    id: adminUser?.id || 'admin',
    name: adminUser?.username || 'مدير النظام',
    role: adminUser?.role || 'مدير',
  }

  const [inbox, setInbox] = useState<Message[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [sent, setSent] = useState<Message[]>([])
  const [sentLoading, setSentLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [activeTab, setActiveTab] = useState('inbox')

  const [form, setForm] = useState<NewMessageForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  const [viewMessage, setViewMessage] = useState<Message | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchInbox = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setInboxLoading(true)
        const params = new URLSearchParams({
          schoolId,
          recipientId: sender.id,
        })
        if (search.trim()) params.set('search', search.trim())
        if (priorityFilter !== 'all') params.set('priority', priorityFilter)
        if (statusFilter === 'read') params.set('isRead', 'true')
        if (statusFilter === 'unread') params.set('isRead', 'false')
        const res = await fetch(`/api/messages?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data: unknown = await res.json()
            const list = (
              data && typeof data === 'object' && 'messages' in data
                ? (data as { messages?: unknown }).messages
                : data
            )
            setInbox(Array.isArray(list) ? (list as Message[]) : [])
          } else {
            toast.error('فشل في تحميل صندوق الوارد')
            setInbox([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل صندوق الوارد')
          setInbox([])
        }
      } finally {
        if (!cancelled) setInboxLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, sender.id, search, priorityFilter, statusFilter])

  useEffect(() => fetchInbox(), [fetchInbox])

  const fetchSent = useCallback(() => {
    let cancelled = false
    const load = async () => {
      try {
        setSentLoading(true)
        const params = new URLSearchParams({
          schoolId,
          senderId: sender.id,
        })
        const res = await fetch(`/api/messages?${params.toString()}`)
        if (!cancelled) {
          if (res.ok) {
            const data: unknown = await res.json()
            const list = (
              data && typeof data === 'object' && 'messages' in data
                ? (data as { messages?: unknown }).messages
                : data
            )
            setSent(Array.isArray(list) ? (list as Message[]) : [])
          } else {
            toast.error('فشل في تحميل الرسائل المرسلة')
            setSent([])
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('فشل في تحميل الرسائل المرسلة')
          setSent([])
        }
      } finally {
        if (!cancelled) setSentLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [schoolId, sender.id])

  useEffect(() => fetchSent(), [fetchSent])

  const markAsRead = useCallback(
    async (msg: Message) => {
      if (msg.isRead) return
      try {
        const res = await fetch(`/api/messages/${msg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true, schoolId }),
        })
        if (res.ok) {
          fetchInbox()
        }
      } catch {
        // silent — don't bother the user on read-receipt failure
      }
    },
    [schoolId, fetchInbox]
  )

  const openMessage = (msg: Message) => {
    setViewMessage(msg)
    setViewOpen(true)
    if (!msg.isRead) {
      void markAsRead(msg)
    }
  }

  const toggleStar = async (msg: Message) => {
    try {
      const res = await fetch(`/api/messages/${msg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !msg.isStarred, schoolId }),
      })
      if (res.ok) {
        toast.success(!msg.isStarred ? 'تم تمييز الرسالة بنجمة' : 'تم إلغاء التمييز')
        fetchInbox()
      } else {
        toast.error('فشل في تحديث الرسالة')
      }
    } catch {
      toast.error('فشل في تحديث الرسالة')
    }
  }

  const toggleArchive = async (msg: Message) => {
    try {
      const res = await fetch(`/api/messages/${msg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !msg.isArchived, schoolId }),
      })
      if (res.ok) {
        toast.success(!msg.isArchived ? 'تمت أرشفة الرسالة' : 'تم إلغاء الأرشفة')
        fetchInbox()
      } else {
        toast.error('فشل في تحديث الرسالة')
      }
    } catch {
      toast.error('فشل في تحديث الرسالة')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/messages/${deleteTarget.id}?schoolId=${schoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الرسالة')
        setDeleteOpen(false)
        setDeleteTarget(null)
        fetchInbox()
      } else {
        const data: unknown = await res.json().catch(() => ({}))
        const errMsg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: unknown }).error)
            : 'فشل في حذف الرسالة'
        toast.error(errMsg)
      }
    } catch {
      toast.error('فشل في حذف الرسالة')
    } finally {
      setDeleting(false)
    }
  }

  const handleSend = async () => {
    if (!form.recipientId.trim()) {
      toast.error('معرف المستلم مطلوب')
      return
    }
    if (!form.subject.trim()) {
      toast.error('الموضوع مطلوب')
      return
    }
    if (!form.content.trim()) {
      toast.error('محتوى الرسالة مطلوب')
      return
    }
    setSaving(true)
    try {
      const attachmentsArray = form.attachments
        ? form.attachments
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
      const body = {
        schoolId,
        senderId: sender.id,
        senderName: sender.name,
        senderRole: sender.role,
        recipientId: form.recipientId.trim(),
        recipientName: form.recipientName.trim() || form.recipientId.trim(),
        subject: form.subject.trim(),
        content: form.content.trim(),
        priority: form.priority,
        attachments: attachmentsArray,
      }
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: unknown = await res.json().catch(() => ({}))
      const errMsg =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error?: unknown }).error)
          : 'فشل في إرسال الرسالة'
      if (res.ok) {
        toast.success('تم إرسال الرسالة بنجاح')
        setForm(defaultForm)
        setActiveTab('sent')
        fetchSent()
      } else {
        toast.error(errMsg)
      }
    } catch {
      toast.error('فشل في إرسال الرسالة')
    } finally {
      setSaving(false)
    }
  }

  // Stats computed from the loaded inbox
  const stats = {
    total: inbox.length,
    unread: inbox.filter((m) => !m.isRead).length,
    starred: inbox.filter((m) => m.isStarred).length,
    archived: inbox.filter((m) => m.isArchived).length,
  }

  const priorityBadge = (p: string) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
        PRIORITY_COLORS[p] || PRIORITY_COLORS['عادي']
      }`}
    >
      {p}
    </span>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#610000]" />
          إدارة الرسائل
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="inbox" className="data-[state=active]:bg-white">
            <Inbox className="w-4 h-4 ml-1" /> صندوق الوارد
          </TabsTrigger>
          <TabsTrigger value="sent" className="data-[state=active]:bg-white">
            <Send className="w-4 h-4 ml-1" /> الرسائل المرسلة
          </TabsTrigger>
          <TabsTrigger value="new" className="data-[state=active]:bg-white">
            <Plus className="w-4 h-4 ml-1" /> رسالة جديدة
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> إجمالي الوارد
                </p>
                <p className="text-xl font-bold text-[#610000] font-mono mt-1">
                  {stats.total}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> غير مقروء
                </p>
                <p className="text-xl font-bold text-amber-600 font-mono mt-1">
                  {stats.unread}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Star className="w-3 h-3" /> مميّزة بنجمة
                </p>
                <p className="text-xl font-bold text-yellow-600 font-mono mt-1">
                  {stats.starred}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Archive className="w-3 h-3" /> مؤرشفة
                </p>
                <p className="text-xl font-bold text-gray-500 font-mono mt-1">
                  {stats.archived}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث في الموضوع أو المحتوى..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="الأولوية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأولويات</SelectItem>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="read">مقروء</SelectItem>
                    <SelectItem value="unread">غير مقروء</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {inboxLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : inbox.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد رسائل في صندوق الوارد.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>المرسل</TableHead>
                        <TableHead>الموضوع</TableHead>
                        <TableHead>المحتوى</TableHead>
                        <TableHead>الأولوية</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inbox.map((m) => (
                        <TableRow
                          key={m.id}
                          className={`hover:bg-gray-50 cursor-pointer ${
                            !m.isRead ? 'bg-[#610000]/[0.02]' : ''
                          }`}
                          onClick={() => openMessage(m)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {!m.isRead && (
                                <span className="w-2 h-2 rounded-full bg-[#610000] shrink-0" />
                              )}
                              <div>
                                <p
                                  className={`text-gray-800 ${
                                    !m.isRead ? 'font-bold' : 'font-medium'
                                  }`}
                                >
                                  {m.senderName || '—'}
                                </p>
                                {m.senderRole && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 mt-0.5"
                                  >
                                    {m.senderRole}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-gray-800 ${
                                !m.isRead ? 'font-semibold' : ''
                              }`}
                            >
                              {m.subject || '(بدون موضوع)'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">
                              {truncate(m.content, 60)}
                            </span>
                          </TableCell>
                          <TableCell>{priorityBadge(m.priority)}</TableCell>
                          <TableCell className="text-center">
                            {m.isRead ? (
                              <Badge
                                variant="outline"
                                className="text-green-700 border-green-200 bg-green-50"
                              >
                                مقروء
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-amber-700 border-amber-200 bg-amber-50"
                              >
                                غير مقروء
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-gray-600">
                              {formatDate(m.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div
                              className="flex items-center justify-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleStar(m)}
                                className={`h-9 w-9 ${
                                  m.isStarred
                                    ? 'text-yellow-500 hover:bg-yellow-50'
                                    : 'text-gray-400 hover:bg-gray-100'
                                }`}
                                title={m.isStarred ? 'إلغاء التمييز' : 'تمييز بنجمة'}
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    m.isStarred ? 'fill-current' : ''
                                  }`}
                                />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleArchive(m)}
                                className={`h-9 w-9 ${
                                  m.isArchived
                                    ? 'text-[#610000] hover:bg-[#610000]/10'
                                    : 'text-gray-400 hover:bg-gray-100'
                                }`}
                                title={m.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(m)
                                  setDeleteOpen(true)
                                }}
                                className="h-9 w-9 text-red-600 hover:bg-red-50"
                                title="حذف"
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

        {/* Sent Tab */}
        <TabsContent value="sent" className="space-y-4">
          {sentLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : sent.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد رسائل مرسلة.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>المستلم</TableHead>
                        <TableHead>الموضوع</TableHead>
                        <TableHead>المحتوى</TableHead>
                        <TableHead>الأولوية</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead className="text-center">عرض</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sent.map((m) => (
                        <TableRow key={m.id} className="hover:bg-gray-50">
                          <TableCell>
                            <p className="text-gray-800 font-medium">
                              {m.recipientName || m.recipientId}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-gray-800">
                              {m.subject || '(بدون موضوع)'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">
                              {truncate(m.content, 60)}
                            </span>
                          </TableCell>
                          <TableCell>{priorityBadge(m.priority)}</TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-gray-600">
                              {formatDate(m.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setViewMessage(m)
                                setViewOpen(true)
                              }}
                              className="h-9 w-9 text-sky-600 hover:bg-sky-50"
                              title="عرض"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
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

        {/* New Message Tab */}
        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#610000]" />
                رسالة جديدة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    معرف المستلم <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.recipientId}
                    onChange={(e) =>
                      setForm({ ...form, recipientId: e.target.value })
                    }
                    placeholder="معرف المستلم"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>اسم المستلم</Label>
                  <Input
                    value={form.recipientName}
                    onChange={(e) =>
                      setForm({ ...form, recipientName: e.target.value })
                    }
                    placeholder="اسم المستلم (اختياري)"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>
                    الموضوع <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    placeholder="موضوع الرسالة"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>
                    المحتوى <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder="نص الرسالة"
                    rows={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الأولوية</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>المرفقات (روابط مفصولة بفواصل)</Label>
                  <Input
                    value={form.attachments}
                    onChange={(e) =>
                      setForm({ ...form, attachments: e.target.value })
                    }
                    placeholder="https://example.com/file1.pdf, https://example.com/file2.jpg"
                    className="h-11"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Sender info preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                <p className="text-gray-500 mb-1">سيتم الإرسال باسم:</p>
                <p className="font-medium text-gray-800">
                  {sender.name}{' '}
                  <span className="text-gray-400">({sender.role})</span>
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm(defaultForm)
                    setActiveTab('inbox')
                  }}
                  className="min-h-[44px]"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={saving}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 ml-1" />
                  )}
                  إرسال
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#610000]" />
              {viewMessage?.subject || '(بدون موضوع)'}
            </DialogTitle>
          </DialogHeader>
          {viewMessage && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">المرسل</p>
                  <p className="font-medium text-gray-800 flex items-center gap-2 flex-wrap">
                    {viewMessage.senderName || '—'}
                    {viewMessage.senderRole && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5"
                      >
                        {viewMessage.senderRole}
                      </Badge>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">المستلم</p>
                  <p className="font-medium text-gray-800">
                    {viewMessage.recipientName || viewMessage.recipientId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">التاريخ</p>
                  <p className="font-medium text-gray-800">
                    {formatLongDate(viewMessage.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">الأولوية</p>
                  <div className="mt-0.5">
                    {priorityBadge(viewMessage.priority)}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">المحتوى</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {viewMessage.content}
                </div>
              </div>
              {parseAttachments(viewMessage.attachments).length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">المرفقات</p>
                  <ul className="space-y-1">
                    {parseAttachments(viewMessage.attachments).map((url, idx) => (
                      <li key={idx}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#610000] hover:underline text-sm break-all"
                          dir="ltr"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewOpen(false)}
              className="min-h-[44px]"
            >
              <Check className="w-4 h-4 ml-1" />
              إغلاق
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
              هل أنت متأكد من حذف الرسالة «
              {deleteTarget?.subject || '(بدون موضوع)'}»؟
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
