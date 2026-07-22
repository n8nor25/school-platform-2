'use client'

import React, { useState, useEffect } from 'react'
import {
  CreditCard, Receipt, TrendingUp, Clock, CheckCircle2, XCircle,
  Loader2, Download, Upload, AlertCircle, Calendar, RefreshCw,
  Crown, ChevronUp, ChevronDown, X, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  statusLabelAr, statusColor, formatEGP, BILLING_CYCLE,
} from '@/lib/subscription'

interface BillingData {
  subscription: any
  schoolStatus: string
  pendingPlanId: string | null
}

export function BillingDashboard({
  open, onOpenChange, schoolId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  schoolId: string
}) {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<any[]>([])
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [payInvoice, setPayInvoice] = useState<any | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/subscriptions/billing?schoolId=${schoolId}`).then(r => r.json()),
      fetch('/api/plans').then(r => r.json()),
    ])
      .then(([b, p]) => {
        if (b.success) setData(b)
        if (p.success) setPlans(p.plans)
      })
      .catch(() => toast.error('فشل تحميل بيانات الفوترة'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (open && schoolId) load()
  }, [open, schoolId])

  if (!open) return null

  const sub = data?.subscription
  const plan = sub?.plan
  const invoices = sub?.invoices || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="w-5 h-5 text-[#610000]" />
            الفوترة والاشتراك
          </DialogTitle>
          <DialogDescription>إدارة اشتراك مدرستك وفواتيرك ومدفوعاتك</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : !sub ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {data?.schoolStatus === 'PENDING_APPROVAL'
                ? 'طلب التسجيل قيد المراجعة من إدارة المنصة'
                : 'لا يوجد اشتراك مُفعّل'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* بطاقة حالة الاشتراك */}
            <div className="rounded-xl border-2 p-5" style={{ borderColor: plan?.code === 'pro' ? '#d97706' : plan?.code === 'enterprise' ? '#7c3aed' : '#059669' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-5 h-5" style={{ color: plan?.code === 'pro' ? '#d97706' : plan?.code === 'enterprise' ? '#7c3aed' : '#059669' }} />
                    <h3 className="text-lg font-bold">{plan?.nameAr}</h3>
                  </div>
                  <Badge className={`${statusColor(sub.status)} border`}>
                    {statusLabelAr(sub.status)}
                  </Badge>
                </div>
                <div className="text-left">
                  <div className="text-2xl font-bold">{formatEGP(sub.billingCycle === BILLING_CYCLE.ANNUAL ? plan.priceAnnual : plan.priceMonthly)}</div>
                  <div className="text-xs text-gray-500">/ {sub.billingCycle === BILLING_CYCLE.ANNUAL ? 'سنويًا' : 'شهريًا'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-500">
                      {sub.status === 'TRIAL' ? 'تنتهي الفترة التجريبية' : 'تنتهي الفترة الحالية'}
                    </div>
                    <div className="font-medium">
                      {new Date(sub.currentPeriodEnd).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${sub.autoRenew ? 'text-emerald-500' : 'text-gray-400'}`} />
                  <div>
                    <div className="text-xs text-gray-500">التجديد التلقائي</div>
                    <div className="font-medium">{sub.autoRenew ? 'مُفعّل' : 'مُلغي'}</div>
                  </div>
                </div>
              </div>

              {/* الباقة المعلّقة (ترقية قادمة) */}
              {sub.pendingPlan && (
                <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  سيتم التحويل إلى <span className="font-medium">{sub.pendingPlan.nameAr}</span> من بداية الدورة القادمة
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowUpgrade(true)}>
                  <TrendingUp className="w-3.5 h-3.5 ml-1" />
                  تغيير الباقة
                </Button>
                {sub.autoRenew ? (
                  <Button variant="ghost" size="sm" onClick={() => handleAction('cancel', schoolId, load)}>
                    إلغاء التجديد
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => handleAction('reactivate', schoolId, load)}>
                    إعادة التفعيل
                  </Button>
                )}
              </div>
            </div>

            {/* الفواتير */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  الفواتير
                </h4>
                <Badge variant="outline">{invoices.length} فاتورة</Badge>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500 border rounded-lg">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  لا توجد فواتير بعد
                  {sub.status === 'TRIAL' && (
                    <p className="text-xs mt-1 text-blue-600">ستُولّد أول فاتورة عند انتهاء الفترة التجريبية</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {invoices.map((inv: any) => (
                    <InvoiceRow key={inv.id} invoice={inv} onPay={() => setPayInvoice(inv)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* نافذة تغيير الباقة */}
      <UpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        plans={plans}
        currentPlanCode={plan?.code}
        pendingPlanCode={sub?.pendingPlanId}
        schoolId={schoolId}
        onSuccess={load}
      />

      {/* نافذة الدفع */}
      <PayInvoiceDialog
        invoice={payInvoice}
        open={!!payInvoice}
        onOpenChange={(o) => { if (!o) setPayInvoice(null) }}
        onSuccess={load}
      />
    </Dialog>
  )
}

async function handleAction(action: string, schoolId: string, reload: () => void) {
  try {
    const res = await fetch('/api/subscriptions/billing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, action }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'فشل التحديث')
      return
    }
    toast.success(data.message || 'تم التحديث')
    reload()
  } catch {
    toast.error('فشل الاتصال')
  }
}

function InvoiceRow({ invoice, onPay }: { invoice: any; onPay: () => void }) {
  const statusMap: Record<string, { label: string; cls: string; icon: any }> = {
    PENDING: { label: 'قيد الانتظار', cls: 'bg-amber-100 text-amber-700', icon: Clock },
    PAID: { label: 'مدفوعة', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    FAILED: { label: 'فشلت', cls: 'bg-red-100 text-red-700', icon: XCircle },
    REFUNDED: { label: 'مُستردة', cls: 'bg-gray-100 text-gray-600', icon: RefreshCw },
    VOID: { label: 'ملغاة', cls: 'bg-gray-100 text-gray-600', icon: X },
  }
  const st = statusMap[invoice.status] || statusMap.PENDING
  const Icon = st.icon
  return (
    <div className="border rounded-lg p-3 flex items-center justify-between text-sm hover:bg-gray-50 transition">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${st.cls}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="font-medium" dir="ltr">{invoice.invoiceNumber}</div>
          <div className="text-xs text-gray-500">
            للفترة {new Date(invoice.periodStart).toLocaleDateString('ar-EG')} — {new Date(invoice.periodEnd).toLocaleDateString('ar-EG')}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-left">
          <div className="font-bold">{formatEGP(invoice.amount)}</div>
          {invoice.paidAt && (
            <div className="text-[10px] text-gray-400">
              دُفعت {new Date(invoice.paidAt).toLocaleDateString('ar-EG')}
            </div>
          )}
        </div>
        {invoice.status === 'PENDING' && (
          <Button size="sm" onClick={onPay} className="h-8">
            <Upload className="w-3 h-3 ml-1" />
            ادفع
          </Button>
        )}
      </div>
    </div>
  )
}

function PayInvoiceDialog({
  invoice, open, onOpenChange, onSuccess,
}: {
  invoice: any
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async () => {
    if (!file) {
      toast.error('يرجى رفع إيصال التحويل البنكي')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('method', 'manual')
    fd.append('receipt', file)
    fd.append('notes', notes)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pay`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'فشل تسجيل الدفع')
        return
      }
      toast.success(data.message || 'تم استلام الإيصال')
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('فشل الاتصال')
    } finally {
      setSubmitting(false)
    }
  }

  if (!invoice) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#610000]" />
            دفع الفاتورة
          </DialogTitle>
          <DialogDescription>
            فاتورة <span dir="ltr" className="font-mono">{invoice.invoiceNumber}</span> — {formatEGP(invoice.amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* بيانات التحويل البنكي */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="font-semibold text-blue-900 mb-2 flex items-center gap-1">
              <FileText className="w-4 h-4" />
              بيانات التحويل البنكي
            </div>
            <div className="space-y-1 text-blue-800 text-xs">
              <div>البنك: البنك الأهلي المصري</div>
              <div>اسم الحساب: منصة المدارس التعليمية</div>
              <div>رقم الحساب: 1234 5678 9012 3456</div>
              <div>IBAN: EG00 NBE 0000 1234 5678 9012 3</div>
            </div>
            <div className="mt-2 text-xs text-blue-600">
              بعد التحويل، ارفع صورة/إيصال التحويل لإتمام التفعيل (خلال 24-48 ساعة)
            </div>
          </div>

          <div>
            <Label>إيصال التحويل *</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1.5"
            />
            <p className="text-[11px] text-gray-500 mt-1">PDF أو صورة — بحد أقصى 10 ميجا</p>
          </div>

          <div>
            <Label>ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="رقم العملية، تاريخ التحويل، البنك المحوّل منه..."
              className="mt-1.5"
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={submitting || !file}>
              {submitting ? <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> جاري الإرسال...</> : 'إرسال الإيصال'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function UpgradeDialog({
  open, onOpenChange, plans, currentPlanCode, pendingPlanCode, schoolId, onSuccess,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  plans: any[]
  currentPlanCode?: string
  pendingPlanCode?: string
  schoolId: string
  onSuccess: () => void
}) {
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setSelectedPlan('')
  }, [open])

  const handleUpgrade = async () => {
    if (!selectedPlan) {
      toast.error('اختر باقة')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/subscriptions/billing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, action: 'change_plan', planCode: selectedPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'فشل التحديث')
        return
      }
      toast.success(data.message)
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('فشل الاتصال')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#610000]" />
            تغيير الباقة
          </DialogTitle>
          <DialogDescription>
            التغيير يسري من بداية الدورة القادمة — لا يتم خصم فوري
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {plans.map((p) => {
            const isCurrent = p.code === currentPlanCode
            const isPending = p.id === pendingPlanCode
            return (
              <label
                key={p.id}
                className={`block border-2 rounded-lg p-3 cursor-pointer transition ${
                  selectedPlan === p.code ? 'border-[#610000] bg-[#610000]/5' : 'border-gray-200 hover:border-gray-300'
                } ${isCurrent ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="plan"
                      value={p.code}
                      checked={selectedPlan === p.code}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                      disabled={isCurrent}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">{p.nameAr}</div>
                      <div className="text-xs text-gray-500">{formatEGP(p.priceMonthly)}/شهر — {formatEGP(p.priceAnnual)}/سنة</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {isCurrent && <Badge variant="outline">باقتك الحالية</Badge>}
                    {isPending && <Badge className="bg-blue-100 text-blue-700">قيد التفعيل</Badge>}
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleUpgrade} disabled={submitting || !selectedPlan}>
            {submitting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : null}
            تأكيد التغيير
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
