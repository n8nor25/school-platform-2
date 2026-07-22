'use client'

import React, { useState, useEffect } from 'react'
import {
  Building2, Users, DollarSign, Clock, CheckCircle2, XCircle,
  Loader2, Check, X, FileText, TrendingUp, Crown, AlertCircle,
  Search, Eye, Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  statusLabelAr, statusColor, formatEGP,
} from '@/lib/subscription'

export function SuperAdminDashboard({
  open, onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [stats, setStats] = useState<any>(null)
  const [schools, setSchools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [receiptView, setReceiptView] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/super-admin/stats').then(r => r.json()),
      fetch(`/api/super-admin/schools${filter ? `?status=${filter}` : ''}${search ? `${filter ? '&' : '?'}search=${encodeURIComponent(search)}` : ''}`).then(r => r.json()),
    ])
      .then(([s, sc]) => {
        if (s.success) setStats(s)
        if (sc.success) setSchools(sc.schools)
      })
      .catch(() => toast.error('فشل تحميل البيانات'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (open) load()
  }, [open, filter, search])

  const handleApprove = async (schoolId: string) => {
    const res = await fetch('/api/subscriptions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'فشل الموافقة')
      return
    }
    toast.success(data.message)
    load()
  }

  const handleReject = async (schoolId: string) => {
    const res = await fetch('/api/subscriptions/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, reason: rejectReason }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'فشل الرفض')
      return
    }
    toast.success(data.message)
    setRejectReason('')
    load()
  }

  const handleConfirmPayment = async (invoiceId: string) => {
    const res = await fetch('/api/super-admin/schools', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, action: 'confirm_payment' }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'فشل التأكيد')
      return
    }
    toast.success(data.message)
    load()
  }

  const handleRejectPayment = async (invoiceId: string) => {
    const res = await fetch('/api/super-admin/schools', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, action: 'reject_payment', reason: rejectReason }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'فشل الرفض')
      return
    }
    toast.success(data.message)
    setRejectReason('')
    load()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-5 h-5 text-amber-600" />
            لوحة إدارة المنصة
          </DialogTitle>
          <DialogDescription>إدارة المدارس والموافقات والفواتير والإيرادات</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* بطاقات الإحصائيات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={<Building2 className="w-5 h-5" />}
                label="إجمالي المدارس"
                value={stats?.schools.total || 0}
                color="bg-blue-50 text-blue-600"
              />
              <StatCard
                icon={<Clock className="w-5 h-5" />}
                label="بانتظار الموافقة"
                value={stats?.schools.pending || 0}
                color="bg-amber-50 text-amber-600"
                highlight={(stats?.schools.pending || 0) > 0}
              />
              <StatCard
                icon={<DollarSign className="w-5 h-5" />}
                label="إيرادات السنة"
                value={formatEGP(stats?.revenue.year || 0)}
                color="bg-emerald-50 text-emerald-600"
              />
              <StatCard
                icon={<Receipt className="w-5 h-5" />}
                label="فواتير للمراجعة"
                value={stats?.invoices.pendingManual || 0}
                color="bg-orange-50 text-orange-600"
                highlight={(stats?.invoices.pendingManual || 0) > 0}
              />
            </div>

            {/* الفواتير بانتظار مراجعة الدفع اليدوي */}
            {stats?.pendingManualInvoices?.length > 0 && (
              <div className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50/30">
                <h4 className="font-semibold flex items-center gap-2 mb-3 text-orange-800">
                  <AlertCircle className="w-4 h-4" />
                  فواتير بانتظار مراجعة إيصالات التحويل ({stats.pendingManualInvoices.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.pendingManualInvoices.map((inv: any) => (
                    <div key={inv.id} className="bg-white border rounded-lg p-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium" dir="ltr">{inv.invoiceNumber}</div>
                        <div className="text-xs text-gray-500">
                          {inv.school.name} — {inv.plan.nameAr}
                        </div>
                        <div className="text-xs text-gray-400">
                          رُفع في {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatEGP(inv.amount)}</span>
                        <Button size="sm" variant="outline" onClick={() => setReceiptView(inv)}>
                          <Eye className="w-3.5 h-3.5 ml-1" />
                          عرض
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleConfirmPayment(inv.id)}>
                          <Check className="w-3.5 h-3.5 ml-1" />
                          تأكيد
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleRejectPayment(inv.id)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* قائمة المدارس */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h4 className="font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  المدارس ({schools.length})
                </h4>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="بحث..."
                      className="w-40 pr-8 h-9"
                    />
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="h-9 border rounded-md px-2 text-sm bg-background"
                  >
                    <option value="">كل الحالات</option>
                    <option value="PENDING_APPROVAL">بانتظار الموافقة</option>
                    <option value="TRIAL">فترة تجريبية</option>
                    <option value="ACTIVE">نشط</option>
                    <option value="PAST_DUE">متأخر السداد</option>
                    <option value="EXPIRED">منتهي</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {schools.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500 border rounded-lg">
                    لا توجد مدارس
                  </div>
                ) : (
                  schools.map((s) => (
                    <div key={s.id} className="border rounded-lg p-3 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: s.primaryColor }}
                          >
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {s.subdomain} • {s.email || s.registrantEmail}
                            </div>
                            {s.registrantName && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                المسؤول: {s.registrantName} • {s.registrantPhone}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`${statusColor(s.subscriptionStatus)} border text-xs`}>
                            {statusLabelAr(s.subscriptionStatus)}
                          </Badge>
                          {s.subscription?.plan && (
                            <Badge variant="outline" className="text-xs">
                              {s.subscription.plan.nameAr}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* أزرار الموافقة/الرفض للحالات المعلّقة */}
                      {s.subscriptionStatus === 'PENDING_APPROVAL' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(s.id)}>
                            <Check className="w-3.5 h-3.5 ml-1" />
                            موافقة وبدء التجربة
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => handleReject(s.id)}>
                            <X className="w-3.5 h-3.5 ml-1" />
                            رفض
                          </Button>
                          {s.rejectionReason && (
                            <span className="text-xs text-red-600 self-center">سبب الرفض السابق: {s.rejectionReason}</span>
                          )}
                        </div>
                      )}

                      {/* تفاصيل الاشتراك */}
                      {s.subscription && (
                        <div className="mt-2 pt-2 border-t text-xs text-gray-500 grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-gray-400">الدورة:</span>{' '}
                            {s.subscription.billingCycle === 'ANNUAL' ? 'سنوية' : 'شهرية'}
                          </div>
                          <div>
                            <span className="text-gray-400">ينتهي:</span>{' '}
                            {new Date(s.subscription.currentPeriodEnd).toLocaleDateString('ar-EG')}
                          </div>
                          <div>
                            <span className="text-gray-400">التجديد:</span>{' '}
                            {s.subscription.autoRenew ? 'تلقائي' : 'ملغي'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      {/* نافذة عرض الإيصال */}
      <Dialog open={!!receiptView} onOpenChange={(o) => { if (!o) setReceiptView(null) }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#610000]" />
              مراجعة الإيصال
            </DialogTitle>
            <DialogDescription>
              فاتورة <span dir="ltr" className="font-mono">{receiptView?.invoiceNumber}</span>
            </DialogDescription>
          </DialogHeader>
          {receiptView && (
            <div className="space-y-3 mt-2">
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">المدرسة:</span> <span className="font-medium">{receiptView.school.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">الباقة:</span> <span className="font-medium">{receiptView.plan.nameAr}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">المبلغ:</span> <span className="font-bold">{formatEGP(receiptView.amount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">تاريخ الإرسال:</span> <span>{new Date(receiptView.createdAt).toLocaleDateString('ar-EG')}</span></div>
              </div>
              <div className="border rounded-lg overflow-hidden bg-gray-50">
                <iframe
                  src={`/api/invoices/${receiptView.id}/receipt`}
                  className="w-full h-64"
                  title="إيصال التحويل"
                />
              </div>
              <div>
                <Label>سبب الرفض (اختياري — يُستخدم عند الرفض فقط)</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="مثال: الإيصال غير واضح، المبلغ غير مطابق..."
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setReceiptView(null)}>إغلاق</Button>
                <Button variant="outline" className="text-red-600 border-red-200" onClick={() => { handleRejectPayment(receiptView.id); setReceiptView(null) }}>
                  <X className="w-4 h-4 ml-1" /> رفض الدفع
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { handleConfirmPayment(receiptView.id); setReceiptView(null) }}>
                  <Check className="w-4 h-4 ml-1" /> تأكيد الدفع
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

function StatCard({
  icon, label, value, color, highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-amber-300 ring-1 ring-amber-100' : ''}`}>
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
