'use client'

import React, { useState, useEffect } from 'react'
import {
  Check, X, Sparkles, Crown, Rocket, Building2, Loader2,
  School, User, Mail, Phone, Lock, AtSign, MapPin, Palette,
  ChevronRight, ArrowRight, ArrowLeft, ShieldCheck, Clock, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { FEATURE_LABELS } from '@/lib/subscription'

interface Plan {
  id: string
  code: string
  nameAr: string
  description: string
  priceMonthly: number
  priceAnnual: number
  trialDays: number
  maxStudents: number | null
  maxTeachers: number | null
  maxAdmins: number | null
  maxStorageMb: number
  features: string[]
  featureLabels: string[]
  isActive: boolean
  sortOrder: number
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  basic: <Rocket className="w-6 h-6" />,
  pro: <Sparkles className="w-6 h-6" />,
  enterprise: <Building2 className="w-6 h-6" />,
}

const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; btn: string }> = {
  basic: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  pro: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  enterprise: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    btn: 'bg-purple-700 hover:bg-purple-800 text-white',
  },
}

function formatEGP(n: number) {
  return new Intl.NumberFormat('ar-EG').format(n) + ' ج.م'
}

function formatLimit(n: number | null, suffix: string) {
  if (n === null || n === undefined) return 'غير محدود'
  return new Intl.NumberFormat('ar-EG').format(n) + ' ' + suffix
}

function formatStorage(mb: number) {
  if (mb >= 1024) return (mb / 1024) + ' جيجا'
  return mb + ' ميجا'
}

export function PricingPage({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')
  const [signupPlan, setSignupPlan] = useState<Plan | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => {
        if (d.success) setPlans(d.plans)
      })
      .catch(() => toast.error('فشل تحميل الباقات'))
      .finally(() => setLoading(false))
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              باقات الاشتراك
            </DialogTitle>
            <DialogDescription className="text-center">
              اختر الباقة المناسبة لمدرستك — جميع الباقات تشمل فترة تجريبية مجانية 14 يومًا
            </DialogDescription>
          </DialogHeader>

          {/* مبدّل دورة الفوترة */}
          <div className="flex items-center justify-center gap-3 my-4">
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setCycle('MONTHLY')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition ${
                  cycle === 'MONTHLY' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                شهري
              </button>
              <button
                onClick={() => setCycle('ANNUAL')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                  cycle === 'ANNUAL' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                سنوي
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">شهران مجانًا</Badge>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              لا توجد باقات متاحة حاليًا
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {plans.map((plan) => {
                const colors = PLAN_COLORS[plan.code] || PLAN_COLORS.basic
                const isPro = plan.code === 'pro'
                const price = cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-xl border-2 p-5 flex flex-col ${
                      isPro ? colors.border + ' ring-2 ring-amber-200' : colors.border
                    } ${isPro ? 'md:-translate-y-2' : ''}`}
                  >
                    {isPro && (
                      <div className="absolute -top-3 right-1/2 translate-x-1/2">
                        <Badge className="bg-amber-500 text-white px-3 py-1">الأكثر شيوعًا</Badge>
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center mb-3`}>
                      {PLAN_ICONS[plan.code]}
                    </div>
                    <h3 className="text-lg font-bold">{plan.nameAr}</h3>
                    <p className="text-xs text-gray-500 mb-3 min-h-[32px]">{plan.description}</p>

                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{formatEGP(price)}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        / {cycle === 'ANNUAL' ? 'سنويًا' : 'شهريًا'}
                      </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-4 text-center">
                      <span className="text-xs text-blue-700 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        فترة تجريبية {plan.trialDays} يومًا — بدون بطاقة دفع
                      </span>
                    </div>

                    {/* الحدود */}
                    <div className="space-y-1.5 mb-4 text-xs">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>الطلاب</span>
                        <span className="font-medium">{formatLimit(plan.maxStudents, '')}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>المعلمون</span>
                        <span className="font-medium">{formatLimit(plan.maxTeachers, '')}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>المسؤولون</span>
                        <span className="font-medium">{formatLimit(plan.maxAdmins, '')}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>التخزين</span>
                        <span className="font-medium">{formatStorage(plan.maxStorageMb)}</span>
                      </div>
                    </div>

                    <Button
                      className={`w-full mb-4 ${colors.btn}`}
                      onClick={() => setSignupPlan(plan)}
                    >
                      ابدأ التجربة المجانية
                      <ChevronRight className="w-4 h-4 mr-1" />
                    </Button>

                    {/* الميزات */}
                    <div className="space-y-1.5 text-xs border-t pt-3">
                      {plan.featureLabels.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check className={`w-3.5 h-3.5 ${colors.text} mt-0.5 shrink-0`} />
                          <span className="text-gray-700">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            التسجيل يتطلب موافقة إدارة المنصة (خلال 24-48 ساعة) — لا يتم خصم أي مبلغ خلال الفترة التجريبية
          </div>
        </DialogContent>
      </Dialog>

      {/* نموذج التسجيل */}
      <SignupDialog
        plan={signupPlan}
        open={!!signupPlan}
        onOpenChange={(o) => { if (!o) setSignupPlan(null) }}
        onSuccess={() => {
          setSignupPlan(null)
          onOpenChange(false)
        }}
      />
    </>
  )
}

// ============================================================
// نموذج التسجيل
// ============================================================
function SignupDialog({
  plan, open, onOpenChange, onSuccess,
}: {
  plan: Plan | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    schoolName: '', subdomain: '', planCode: '', billingCycle: 'MONTHLY',
    adminName: '', adminEmail: '', adminPhone: '', adminUsername: '', adminPassword: '',
    schoolAddress: '', schoolPhone: '',
    primaryColor: '#610000', secondaryColor: '#009688',
  })

  useEffect(() => {
    if (plan) {
      setForm(f => ({ ...f, planCode: plan.code }))
      setStep(1)
      setSubmitted(false)
    }
  }, [plan])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.schoolName || !form.subdomain || !form.adminName || !form.adminEmail || !form.adminPhone || !form.adminUsername || !form.adminPassword) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    if (form.adminPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/subscriptions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'فشل التسجيل')
        return
      }
      setSubmitted(true)
      toast.success('تم استلام طلب التسجيل بنجاح')
    } catch {
      toast.error('فشل الاتصال بالخادم')
    } finally {
      setSubmitting(false)
    }
  }

  if (!plan) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <School className="w-5 h-5 text-[#610000]" />
            تسجيل مدرسة جديدة
          </DialogTitle>
          <DialogDescription>
            الباقة المختارة: <span className="font-medium text-gray-700">{plan.nameAr}</span>
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">تم استلام طلبك بنجاح!</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              سيتم مراجعة طلب تسجيل مدرستك <span className="font-medium">{form.schoolName}</span> من قِبل إدارة المنصة خلال 24-48 ساعة.
              سيصلك إشعار على بريدك <span className="font-medium" dir="ltr">{form.adminEmail}</span> عند تفعيل الحساب.
            </p>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 max-w-md mx-auto">
              <Clock className="w-3.5 h-3.5 inline ml-1" />
              عند الموافقة، ستبدأ فترة تجريبية مجانية مدتها {plan.trialDays} يومًا — بدون أي رسوم.
            </div>
            <Button className="mt-6" onClick={onSuccess}>تم</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* مؤشر الخطوات */}
            <div className="flex items-center gap-2 text-xs">
              <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-[#610000]' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-[#610000] text-white' : 'bg-gray-200'}`}>1</span>
                بيانات المدرسة
              </div>
              <div className="flex-1 h-px bg-gray-200" />
              <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-[#610000]' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-[#610000] text-white' : 'bg-gray-200'}`}>2</span>
                بيانات المسؤول
              </div>
            </div>

            {step === 1 && (
              <>
                <div>
                  <Label>اسم المدرسة *</Label>
                  <Input
                    value={form.schoolName}
                    onChange={(e) => update('schoolName', e.target.value)}
                    placeholder="مثال: مدرسة النور التجريبية"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>المعرّف الفرعي (Subdomain) *</Label>
                  <div className="flex items-center gap-1 mt-1.5" dir="ltr">
                    <Input
                      value={form.subdomain}
                      onChange={(e) => update('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="alnoor"
                      className="flex-1"
                      dir="ltr"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">.schools-platform.com</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">3-20 حرف إنجليزي أو رقم — سيكون رابط دخول مدرستك</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>هاتف المدرسة</Label>
                    <Input
                      value={form.schoolPhone}
                      onChange={(e) => update('schoolPhone', e.target.value)}
                      placeholder="02XXXXXXXX"
                      className="mt-1.5"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>عنوان المدرسة</Label>
                    <Input
                      value={form.schoolAddress}
                      onChange={(e) => update('schoolAddress', e.target.value)}
                      placeholder="المدينة، الحي"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1"><Palette className="w-3 h-3" /> اللون الأساسي</Label>
                    <Input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => update('primaryColor', e.target.value)}
                      className="mt-1.5 h-10 p-1"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Palette className="w-3 h-3" /> اللون الثانوي</Label>
                    <Input
                      type="color"
                      value={form.secondaryColor}
                      onChange={(e) => update('secondaryColor', e.target.value)}
                      className="mt-1.5 h-10 p-1"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setStep(2)} disabled={!form.schoolName || !form.subdomain}>
                    التالي
                    <ArrowLeft className="w-4 h-4 mr-1" />
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>اسم المسؤول *</Label>
                    <div className="relative mt-1.5">
                      <User className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={form.adminName}
                        onChange={(e) => update('adminName', e.target.value)}
                        placeholder="الاسم الكامل"
                        className="pr-8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>هاتف المسؤول *</Label>
                    <div className="relative mt-1.5">
                      <Phone className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={form.adminPhone}
                        onChange={(e) => update('adminPhone', e.target.value)}
                        placeholder="010XXXXXXXX"
                        className="pr-8"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>البريد الإلكتروني *</Label>
                  <div className="relative mt-1.5">
                    <Mail className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => update('adminEmail', e.target.value)}
                      placeholder="admin@school.edu"
                      className="pr-8"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>اسم المستخدم *</Label>
                    <div className="relative mt-1.5">
                      <AtSign className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={form.adminUsername}
                        onChange={(e) => update('adminUsername', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="admin"
                        className="pr-8"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>كلمة المرور *</Label>
                    <div className="relative mt-1.5">
                      <Lock className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        type="password"
                        value={form.adminPassword}
                        onChange={(e) => update('adminPassword', e.target.value)}
                        placeholder="6 أحرف على الأقل"
                        className="pr-8"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* ملخص الباقة */}
                <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">الباقة:</span>
                    <span className="font-medium">{plan.nameAr}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-600">الفترة التجريبية:</span>
                    <span className="font-medium">{plan.trialDays} يومًا (مجانًا)</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-600">بعد التجربة:</span>
                    <span className="font-medium">{formatEGP(plan.priceMonthly)}/شهر</span>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowRight className="w-4 h-4 ml-1" />
                    السابق
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !form.adminName || !form.adminEmail || !form.adminPhone || !form.adminUsername || !form.adminPassword}
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> جاري الإرسال...</>
                    ) : (
                      <>تقديم طلب التسجيل</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
