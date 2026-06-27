'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Edit, Trash2, Ticket, AlertCircle, X, Search,
  Bus as BusIcon, User, Phone, MapPin, DollarSign, Calendar,
  Wallet, TrendingUp, BarChart3, CreditCard, CheckCircle2, Circle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useAdminStore } from '@/lib/admin-store'

interface Student {
  id: string
  name: string
  studentNumber: string
  phone: string | null
  parentPhone: string | null
  parentPhone2: string | null
  address: string | null
  classroom?: { name: string; gradeLevel: string } | null
}

interface Route {
  id: string
  name: string
  area: string
  monthlyFee: number
  bus?: { plateNumber: string } | null
}

interface Subscription {
  id: string
  studentId: string
  routeId: string
  startDate: string
  endDate: string | null
  direction: string
  monthlyFee: number
  status: string
  notes: string | null
  student: Student
  route: Route
  paidTotal?: number
  paidCount?: number
}

interface Payment {
  id: string
  subscriptionId: string
  month: number
  year: number
  amount: number
  paymentDate: string
  paymentMethod: string
  receiptNumber: string | null
  notes: string | null
  subscription?: {
    id: string
    student: { id: string; name: string; studentNumber: string }
    route: { id: string; name: string }
  }
}

const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const DIRECTIONS = ['ذهاب', 'عودة', 'ذهاب وعودة']
const STATUSES = ['نشط', 'متوقف', 'ملغي']
const PAYMENT_METHODS = ['نقدي', 'تحويل', 'بطاقة', 'محفظة إلكترونية']

interface SubForm {
  studentId: string
  routeId: string
  startDate: string
  endDate: string
  direction: string
  monthlyFee: string
  status: string
  notes: string
}

const defaultSubForm: SubForm = {
  studentId: '',
  routeId: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  direction: 'ذهاب وعودة',
  monthlyFee: '0',
  status: 'نشط',
  notes: '',
}

export function TransportSubscriptionsManagement() {
  const { selectedSchoolId } = useAdminStore()
  const [tab, setTab] = useState('subs')

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subLoading, setSubLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [routeFilter, setRouteFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [directionFilter, setDirectionFilter] = useState('all')

  // Routes for filter & form
  const [routes, setRoutes] = useState<Route[]>([])
  const [routesLoading, setRoutesLoading] = useState(true)

  // Students for form
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<Student[]>([])
  const [studentSearchLoading, setStudentSearchLoading] = useState(false)

  // Dialogs
  const [subDialogOpen, setSubDialogOpen] = useState(false)
  const [editSubId, setEditSubId] = useState<string | null>(null)
  const [subForm, setSubForm] = useState<SubForm>(defaultSubForm)
  const [savingSub, setSavingSub] = useState(false)
  const [deleteSubOpen, setDeleteSubOpen] = useState(false)
  const [deleteSubTarget, setDeleteSubTarget] = useState<Subscription | null>(null)

  // Payments
  const [selectedSubId, setSelectedSubId] = useState<string>('')
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentYear, setPaymentYear] = useState<number>(new Date().getFullYear())
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    amount: '0',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقدي',
    receiptNumber: '',
    notes: '',
  })
  const [savingPayment, setSavingPayment] = useState(false)
  const [deletePaymentOpen, setDeletePaymentOpen] = useState(false)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<Payment | null>(null)

  // Load routes for filter & form
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId) return
      try {
        setRoutesLoading(true)
        const res = await fetch(`/api/bus-routes?schoolId=${selectedSchoolId}&active=true`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setRoutes(Array.isArray(data.routes) ? data.routes : [])
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setRoutesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId])

  // Load subscriptions
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!selectedSchoolId) return
      try {
        setSubLoading(true)
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search.trim()) params.set('search', search.trim())
        if (routeFilter !== 'all') params.set('routeId', routeFilter)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (directionFilter !== 'all') params.set('direction', directionFilter)
        const res = await fetch(`/api/transport?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : [])
        } else if (!cancelled) {
          toast.error('فشل في تحميل الاشتراكات')
        }
      } catch {
        if (!cancelled) toast.error('فشل في تحميل الاشتراكات')
      } finally {
        if (!cancelled) setSubLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedSchoolId, search, routeFilter, statusFilter, directionFilter])

  // Search students for form
  const searchStudents = useCallback(async (query: string) => {
    if (!selectedSchoolId || !query.trim()) {
      setStudentResults([])
      return
    }
    try {
      setStudentSearchLoading(true)
      const params = new URLSearchParams({ schoolId: selectedSchoolId, search: query.trim() })
      const res = await fetch(`/api/students?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStudentResults(Array.isArray(data) ? data : [])
      } else {
        setStudentResults([])
      }
    } catch {
      setStudentResults([])
    } finally {
      setStudentSearchLoading(false)
    }
  }, [selectedSchoolId])

  // Load payments for selected subscription
  const loadPayments = useCallback(async (subId: string) => {
    if (!selectedSchoolId || !subId) return
    try {
      setPaymentsLoading(true)
      const res = await fetch(
        `/api/transport/payments?schoolId=${selectedSchoolId}&subscriptionId=${subId}`
      )
      if (res.ok) {
        const data = await res.json()
        setPayments(Array.isArray(data.payments) ? data.payments : [])
      } else {
        setPayments([])
      }
    } catch {
      setPayments([])
    } finally {
      setPaymentsLoading(false)
    }
  }, [selectedSchoolId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (tab !== 'payments') return
      // Auto-pick the first subscription when none is selected
      if (!selectedSubId && subscriptions.length > 0) {
        if (!cancelled) setSelectedSubId(subscriptions[0].id)
        return
      }
      if (!selectedSubId || !selectedSchoolId) return
      // Update the subscription summary (sync read, but inside async function = ok)
      const found = subscriptions.find((s) => s.id === selectedSubId) || null
      if (!cancelled) setSelectedSub(found)
      // Fetch payments
      try {
        if (!cancelled) setPaymentsLoading(true)
        const res = await fetch(
          `/api/transport/payments?schoolId=${selectedSchoolId}&subscriptionId=${selectedSubId}`
        )
        const data = res.ok ? await res.json() : { payments: [] }
        if (!cancelled) setPayments(Array.isArray(data.payments) ? data.payments : [])
      } catch {
        if (!cancelled) setPayments([])
      } finally {
        if (!cancelled) setPaymentsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tab, selectedSubId, subscriptions, selectedSchoolId])

  const openAddSub = () => {
    setEditSubId(null)
    setSubForm(defaultSubForm)
    setStudentSearch('')
    setStudentResults([])
    setSubDialogOpen(true)
  }

  const openEditSub = (sub: Subscription) => {
    setEditSubId(sub.id)
    setSubForm({
      studentId: sub.studentId,
      routeId: sub.routeId,
      startDate: sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : '',
      endDate: sub.endDate ? new Date(sub.endDate).toISOString().split('T')[0] : '',
      direction: sub.direction,
      monthlyFee: String(sub.monthlyFee),
      status: sub.status,
      notes: sub.notes || '',
    })
    setStudentSearch(sub.student.name)
    setStudentResults([sub.student])
    setSubDialogOpen(true)
  }

  const handleSaveSub = async () => {
    if (!subForm.studentId) {
      toast.error('يرجى اختيار طالب')
      return
    }
    if (!subForm.routeId) {
      toast.error('يرجى اختيار خط')
      return
    }
    if (!subForm.startDate) {
      toast.error('تاريخ البداية مطلوب')
      return
    }
    setSavingSub(true)
    try {
      const body = {
        studentId: subForm.studentId,
        routeId: subForm.routeId,
        startDate: subForm.startDate,
        endDate: subForm.endDate || null,
        direction: subForm.direction,
        monthlyFee: Number(subForm.monthlyFee) || 0,
        status: subForm.status,
        notes: subForm.notes.trim() || null,
      }
      const url = editSubId
        ? `/api/transport/${editSubId}?schoolId=${selectedSchoolId}`
        : `/api/transport?schoolId=${selectedSchoolId}`
      const res = await fetch(url, {
        method: editSubId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(editSubId ? 'تم تحديث الاشتراك' : 'تم إضافة الاشتراك بنجاح')
        setSubDialogOpen(false)
        // Refresh
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search.trim()) params.set('search', search.trim())
        if (routeFilter !== 'all') params.set('routeId', routeFilter)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (directionFilter !== 'all') params.set('direction', directionFilter)
        const refreshRes = await fetch(`/api/transport?${params.toString()}`)
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          setSubscriptions(Array.isArray(refreshData.subscriptions) ? refreshData.subscriptions : [])
        }
      } else if (res.status === 409) {
        toast.error(data.error || 'تعارض: البيانات مكررة')
      } else {
        toast.error(data.error || 'فشل في الحفظ')
      }
    } catch {
      toast.error('فشل في الحفظ')
    } finally {
      setSavingSub(false)
    }
  }

  const handleDeleteSub = async () => {
    if (!deleteSubTarget) return
    try {
      const res = await fetch(`/api/transport/${deleteSubTarget.id}?schoolId=${selectedSchoolId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('تم حذف الاشتراك')
        setSubscriptions((prev) => prev.filter((s) => s.id !== deleteSubTarget.id))
      } else if (res.status === 409) {
        toast.error(data.error || 'لا يمكن حذف الاشتراك')
      } else {
        toast.error(data.error || 'فشل في الحذف')
      }
    } catch {
      toast.error('فشل في الحذف')
    } finally {
      setDeleteSubOpen(false)
      setDeleteSubTarget(null)
    }
  }

  // When route selected in form, auto-fill monthlyFee
  const onRouteChangeInForm = (routeId: string) => {
    const route = routes.find((r) => r.id === routeId)
    setSubForm({
      ...subForm,
      routeId,
      monthlyFee: route ? String(route.monthlyFee) : subForm.monthlyFee,
    })
  }

  // Payment handlers
  const openAddPayment = () => {
    if (!selectedSub) {
      toast.error('اختر اشتراكاً أولاً')
      return
    }
    setPaymentForm({
      month: String(new Date().getMonth() + 1),
      year: String(paymentYear),
      amount: String(selectedSub.monthlyFee),
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'نقدي',
      receiptNumber: '',
      notes: '',
    })
    setPaymentDialogOpen(true)
  }

  const handleSavePayment = async () => {
    if (!selectedSubId) return
    if (!paymentForm.month || !paymentForm.year || !paymentForm.amount || !paymentForm.paymentDate) {
      toast.error('يرجى إكمال البيانات')
      return
    }
    setSavingPayment(true)
    try {
      const body = {
        subscriptionId: selectedSubId,
        month: Number(paymentForm.month),
        year: Number(paymentForm.year),
        amount: Number(paymentForm.amount),
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        receiptNumber: paymentForm.receiptNumber.trim() || null,
        notes: paymentForm.notes.trim() || null,
      }
      const res = await fetch(`/api/transport/payments?schoolId=${selectedSchoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('تم تسجيل الدفعة بنجاح')
        setPaymentDialogOpen(false)
        loadPayments(selectedSubId)
        // Refresh subscriptions to update paid counts
        const params = new URLSearchParams({ schoolId: selectedSchoolId })
        if (search.trim()) params.set('search', search.trim())
        if (routeFilter !== 'all') params.set('routeId', routeFilter)
        if (statusFilter !== 'all') params.set('status', statusFilter)
        if (directionFilter !== 'all') params.set('direction', directionFilter)
        const refreshRes = await fetch(`/api/transport?${params.toString()}`)
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          setSubscriptions(Array.isArray(refreshData.subscriptions) ? refreshData.subscriptions : [])
        }
      } else if (res.status === 409) {
        toast.error(data.error || 'دفعة مسجلة بالفعل لهذا الشهر')
      } else {
        toast.error(data.error || 'فشل في تسجيل الدفعة')
      }
    } catch {
      toast.error('فشل في تسجيل الدفعة')
    } finally {
      setSavingPayment(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return
    try {
      const res = await fetch(
        `/api/transport/payments/${deletePaymentTarget.id}?schoolId=${selectedSchoolId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('تم حذف الدفعة')
        setPayments((prev) => prev.filter((p) => p.id !== deletePaymentTarget.id))
      } else {
        toast.error('فشل في حذف الدفعة')
      }
    } catch {
      toast.error('فشل في حذف الدفعة')
    } finally {
      setDeletePaymentOpen(false)
      setDeletePaymentTarget(null)
    }
  }

  // Stats
  const totalSubs = subscriptions.length
  const activeSubs = subscriptions.filter((s) => s.status === 'نشط').length
  const stoppedSubs = subscriptions.filter((s) => s.status === 'متوقف').length
  const cancelledSubs = subscriptions.filter((s) => s.status === 'ملغي').length
  const totalMonthlyRevenue = subscriptions
    .filter((s) => s.status === 'نشط')
    .reduce((sum, s) => sum + Number(s.monthlyFee), 0)
  const collectedThisMonth = subscriptions.reduce(
    (sum, s) => sum + (s.paidTotal || 0),
    0
  )
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const outstanding =
    totalMonthlyRevenue -
    subscriptions
      .filter((s) => s.status === 'نشط')
      .reduce(
        (sum, s) =>
          sum +
          (payments
            .filter((p) => p.month === currentMonth && p.year === currentYear)
            .reduce((s2, p) => s2 + Number(p.amount), 0) > 0
            ? Number(s.monthlyFee)
            : 0),
        0
      )

  // Direction stats
  const directionCounts: Record<string, number> = {}
  subscriptions.forEach((s) => {
    directionCounts[s.direction] = (directionCounts[s.direction] || 0) + 1
  })

  // For the payments grid: show 12 months with paid status for selected year
  const monthPaymentMap: Record<number, Payment | undefined> = {}
  payments
    .filter((p) => p.year === paymentYear)
    .forEach((p) => {
      monthPaymentMap[p.month] = p
    })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-bold text-[#1a1a2e] flex items-center gap-2">
          <Ticket className="w-5 h-5 text-[#610000]" />
          إدارة اشتراكات النقل
        </h2>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="subs" className="data-[state=active]:bg-white">
            <Ticket className="w-4 h-4 ml-1" /> الاشتراكات
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-white">
            <Wallet className="w-4 h-4 ml-1" /> المدفوعات
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-white">
            <BarChart3 className="w-4 h-4 ml-1" /> الإحصائيات
          </TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subs" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث باسم الطالب أو رقمه..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10 h-11"
                  />
                </div>
                <Select value={routeFilter} onValueChange={setRouteFilter}>
                  <SelectTrigger className="w-[160px] h-11">
                    <SelectValue placeholder="كل الخطوط" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الخطوط</SelectItem>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-11">
                    <SelectValue placeholder="كل الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={directionFilter} onValueChange={setDirectionFilter}>
                  <SelectTrigger className="w-[150px] h-11">
                    <SelectValue placeholder="كل الاتجاهات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الاتجاهات</SelectItem>
                    {DIRECTIONS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={openAddSub}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة اشتراك
                </Button>
              </div>
            </CardContent>
          </Card>

          {subLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : subscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">لا توجد اشتراكات مسجلة</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-right">الطالب</TableHead>
                        <TableHead className="text-right">رقم الطالب</TableHead>
                        <TableHead className="text-right">الخط</TableHead>
                        <TableHead className="text-right">الباص</TableHead>
                        <TableHead className="text-right">الاتجاه</TableHead>
                        <TableHead className="text-right">الرسوم</TableHead>
                        <TableHead className="text-right">المدفوع</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium text-[#1a1a2e]">
                            {sub.student.name}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {sub.student.studentNumber}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[#610000] border-[#610000]/30">
                              {sub.route.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {sub.route.bus?.plateNumber || '—'}
                          </TableCell>
                          <TableCell className="text-sm">{sub.direction}</TableCell>
                          <TableCell className="font-semibold text-[#610000]">
                            {Number(sub.monthlyFee).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">
                              {sub.paidCount || 0} شهر /{' '}
                              <span className="text-green-600 font-medium">
                                {(sub.paidTotal || 0).toLocaleString()}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                sub.status === 'نشط'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                  : sub.status === 'متوقف'
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                  : 'bg-red-100 text-red-700 hover:bg-red-100'
                              }
                            >
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[36px] min-w-[36px]"
                                onClick={() => openEditSub(sub)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:bg-red-50 min-h-[36px] min-w-[36px]"
                                onClick={() => { setDeleteSubTarget(sub); setDeleteSubOpen(true) }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[280px]">
                  <Label className="text-xs">اختر الاشتراك</Label>
                  <Select value={selectedSubId} onValueChange={setSelectedSubId}>
                    <SelectTrigger className="h-11 mt-1">
                      <SelectValue placeholder="اختر اشتراك..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subscriptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.student.name} - {s.student.studentNumber} ({s.route.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">السنة</Label>
                  <Select
                    value={String(paymentYear)}
                    onValueChange={(v) => setPaymentYear(Number(v))}
                  >
                    <SelectTrigger className="h-11 mt-1 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[paymentYear - 1, paymentYear, paymentYear + 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={openAddPayment}
                  disabled={!selectedSub}
                  className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px] mt-5"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  تسجيل دفعة
                </Button>
              </div>
            </CardContent>
          </Card>

          {selectedSub ? (
            <>
              {/* Subscription summary card */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#610000]" />
                      <div>
                        <p className="text-xs text-gray-500">الطالب</p>
                        <p className="font-medium text-sm">{selectedSub.student.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BusIcon className="w-4 h-4 text-[#610000]" />
                      <div>
                        <p className="text-xs text-gray-500">الخط</p>
                        <p className="font-medium text-sm">{selectedSub.route.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#610000]" />
                      <div>
                        <p className="text-xs text-gray-500">الرسوم الشهرية</p>
                        <p className="font-medium text-sm">
                          {Number(selectedSub.monthlyFee).toLocaleString()} ج.م
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#610000]" />
                      <div>
                        <p className="text-xs text-gray-500">الاتجاه</p>
                        <p className="font-medium text-sm">{selectedSub.direction}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 12-month grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    المدفوعات الشهرية - {paymentYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {MONTHS.map((monthName, idx) => {
                        const monthNum = idx + 1
                        const paid = monthPaymentMap[monthNum]
                        return (
                          <div
                            key={monthNum}
                            className={`rounded-lg border p-3 transition-colors ${
                              paid
                                ? 'bg-green-50 border-green-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{monthName}</span>
                              {paid ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-300" />
                              )}
                            </div>
                            {paid ? (
                              <div className="space-y-1">
                                <p className="text-xs text-gray-600">
                                  المبلغ:{' '}
                                  <span className="font-semibold text-green-700">
                                    {Number(paid.amount).toLocaleString()}
                                  </span>
                                </p>
                                <p className="text-xs text-gray-500" dir="ltr">
                                  {paid.receiptNumber || '—'}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:bg-red-50 h-7 px-2 text-xs min-h-[28px]"
                                  onClick={() => {
                                    setDeletePaymentTarget(paid)
                                    setDeletePaymentOpen(true)
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 ml-1" />
                                  حذف
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-1 min-h-[32px] text-xs"
                                onClick={() => {
                                  setPaymentForm({
                                    month: String(monthNum),
                                    year: String(paymentYear),
                                    amount: String(selectedSub.monthlyFee),
                                    paymentDate: new Date().toISOString().split('T')[0],
                                    paymentMethod: 'نقدي',
                                    receiptNumber: '',
                                    notes: '',
                                  })
                                  setPaymentDialogOpen(true)
                                }}
                              >
                                <Plus className="w-3 h-3 ml-1" />
                                تسجيل
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400">اختر اشتراكاً لعرض المدفوعات</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-[#610000]/10 flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-[#610000]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي الاشتراكات</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{totalSubs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">اشتراكات نشطة</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">{activeSubs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي الإيراد الشهري</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">
                      {totalMonthlyRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">إجمالي المحصّل</p>
                    <p className="text-xl font-bold text-[#1a1a2e]">
                      {collectedThisMonth.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الحالات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatRow label="نشط" value={activeSubs} total={totalSubs} color="bg-green-500" />
                <StatRow label="متوقف" value={stoppedSubs} total={totalSubs} color="bg-amber-500" />
                <StatRow label="ملغي" value={cancelledSubs} total={totalSubs} color="bg-red-500" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الاتجاهات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {DIRECTIONS.map((d) => (
                  <StatRow
                    key={d}
                    label={d}
                    value={directionCounts[d] || 0}
                    total={totalSubs}
                    color="bg-[#610000]"
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {outstanding > 0 && (
            <Card className="mt-4 border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">المتأخر للشهر الحالي</p>
                    <p className="text-xl font-bold text-amber-900">
                      {outstanding.toLocaleString()} ج.م
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Subscription Dialog */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSubId ? 'تعديل الاشتراك' : 'إضافة اشتراك جديد'}</DialogTitle>
            <DialogDescription>
              {editSubId ? 'تعديل بيانات الاشتراك' : 'أدخل بيانات الاشتراك الجديد'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Student search */}
            <div>
              <Label>الطالب *</Label>
              <div className="relative mt-1.5">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value)
                    searchStudents(e.target.value)
                  }}
                  className="pr-10 h-11"
                  placeholder="ابحث باسم الطالب أو رقمه..."
                  disabled={!!editSubId}
                />
              </div>
              {studentSearchLoading && (
                <p className="text-xs text-gray-400 mt-1">جاري البحث...</p>
              )}
              {!studentSearchLoading && studentSearch && studentResults.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {studentResults.slice(0, 20).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setSubForm({ ...subForm, studentId: st.id })
                        setStudentSearch(st.name)
                        setStudentResults([])
                      }}
                      className={`w-full text-right p-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 ${
                        subForm.studentId === st.id ? 'bg-[#610000]/5' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm text-[#1a1a2e]">{st.name}</p>
                        <p className="text-xs text-gray-500">
                          {st.studentNumber}
                          {st.classroom ? ` - ${st.classroom.name}` : ''}
                        </p>
                      </div>
                      {subForm.studentId === st.id && (
                        <CheckCircle2 className="w-4 h-4 text-[#610000]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {subForm.studentId && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  تم اختيار الطالب
                </p>
              )}
            </div>

            {/* Route */}
            <div>
              <Label>الخط *</Label>
              <Select
                value={subForm.routeId}
                onValueChange={onRouteChangeInForm}
              >
                <SelectTrigger className="h-11 mt-1.5">
                  <SelectValue placeholder="اختر الخط" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} - {r.area} ({Number(r.monthlyFee).toLocaleString()} ج.م)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {routesLoading && (
                <p className="text-xs text-gray-400 mt-1">جاري تحميل الخطوط...</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>اتجاه النقل</Label>
                <Select
                  value={subForm.direction}
                  onValueChange={(v) => setSubForm({ ...subForm, direction: v })}
                >
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الرسوم الشهرية</Label>
                <Input
                  type="number"
                  value={subForm.monthlyFee}
                  onChange={(e) => setSubForm({ ...subForm, monthlyFee: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>تاريخ البداية *</Label>
                <Input
                  type="date"
                  value={subForm.startDate}
                  onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>تاريخ النهاية</Label>
                <Input
                  type="date"
                  value={subForm.endDate}
                  onChange={(e) => setSubForm({ ...subForm, endDate: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>الحالة</Label>
                <Select
                  value={subForm.status}
                  onValueChange={(v) => setSubForm({ ...subForm, status: v })}
                >
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={subForm.notes}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                className="mt-1.5 min-h-[70px]"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setSubDialogOpen(false)} className="min-h-[44px]">
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleSaveSub}
              disabled={savingSub}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {savingSub ? 'جاري الحفظ...' : editSubId ? 'حفظ التعديلات' : 'إضافة الاشتراك'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة</DialogTitle>
            <DialogDescription>
              {selectedSub && (
                <span>
                  الطالب: {selectedSub.student.name} - الخط: {selectedSub.route.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الشهر</Label>
                <Select
                  value={paymentForm.month}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, month: v })}
                >
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>السنة</Label>
                <Input
                  type="number"
                  value={paymentForm.year}
                  onChange={(e) => setPaymentForm({ ...paymentForm, year: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>المبلغ</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>تاريخ الدفع</Label>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="h-11 mt-1.5"
                />
              </div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}
                >
                  <SelectTrigger className="h-11 mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رقم الإيصال (اختياري)</Label>
                <Input
                  value={paymentForm.receiptNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })}
                  className="h-11 mt-1.5"
                  dir="ltr"
                  placeholder="يُولّد تلقائياً"
                />
              </div>
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="mt-1.5 min-h-[60px]"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} className="min-h-[44px]">
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={handleSavePayment}
              disabled={savingPayment}
              className="bg-[#610000] hover:bg-[#8B0000] text-white min-h-[44px]"
            >
              {savingPayment ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Subscription Confirmation */}
      <Dialog open={deleteSubOpen} onOpenChange={setDeleteSubOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف اشتراك &quot;{deleteSubTarget?.student.name}&quot;؟
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteSubOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDeleteSub} className="min-h-[44px]">
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <Dialog open={deletePaymentOpen} onOpenChange={setDeletePaymentOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد حذف الدفعة</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف دفعة شهر{' '}
              {deletePaymentTarget ? MONTHS[deletePaymentTarget.month - 1] : ''}{' '}
              {deletePaymentTarget?.year}؟
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeletePaymentOpen(false)} className="min-h-[44px]">
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDeletePayment} className="min-h-[44px]">
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatRow({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const percent = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-24">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div
          className={`${color} h-full rounded-full flex items-center justify-end px-2 text-white text-xs font-bold transition-all`}
          style={{ width: `${Math.max(percent, 10)}%` }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
