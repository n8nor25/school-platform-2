/**
 * ============================================================
 *  مكتبة الاشتراكات SaaS
 *  - حلّ الباقة والاشتراك والميزات
 *  - التحكم في الوصول (gating)
 *  - توليد الفواتير وأرقامها
 *  - حالة الاشتراك وتواريخها
 * ============================================================
 */
import { db } from '@/lib/db'

// قيم الحالات
export const SUBSCRIPTION_STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const

export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  VOID: 'VOID',
} as const

export const BILLING_CYCLE = {
  MONTHLY: 'MONTHLY',
  ANNUAL: 'ANNUAL',
} as const

export const PAYMENT_METHOD = {
  PAYMOB: 'paymob',
  MANUAL: 'manual',
  STRIPE: 'stripe',
} as const

export type SubscriptionStatus = keyof typeof SUBSCRIPTION_STATUS
export type PlanWithDetails = {
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
  isActive: boolean
  sortOrder: number
}

/** هل يُسمح بالوصول الكامل لهذه الحالة؟ */
export function isAccessGranted(status: string): boolean {
  return status === SUBSCRIPTION_STATUS.TRIAL || status === SUBSCRIPTION_STATUS.ACTIVE
}

/** هل يُسمح بالقراءة فقط (لا كتابة)؟ */
export function isReadOnly(status: string): boolean {
  return status === SUBSCRIPTION_STATUS.PAST_DUE
}

/** هل الوصول مرفوض تمامًا؟ */
export function isAccessBlocked(status: string): boolean {
  return (
    status === SUBSCRIPTION_STATUS.EXPIRED ||
    status === SUBSCRIPTION_STATUS.CANCELLED ||
    status === SUBSCRIPTION_STATUS.PENDING_APPROVAL
  )
}

/** هل الوصول مرفوض مع إمكانية التجديد؟ (شاشة جدّد الاشتراك) */
export function isRenewableBlock(status: string): boolean {
  return status === SUBSCRIPTION_STATUS.EXPIRED || status === SUBSCRIPTION_STATUS.CANCELLED
}

/** أخذ باقة من قاعدة البيانات وتحويلها لصيغة آمنة (features كمصفوفة) */
export async function getPlanById(planId: string): Promise<PlanWithDetails | null> {
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!plan) return null
  return normalizePlan(plan)
}

export async function getPlanByCode(code: string): Promise<PlanWithDetails | null> {
  const plan = await db.subscriptionPlan.findUnique({ where: { code } })
  if (!plan) return null
  return normalizePlan(plan)
}

export async function getAllActivePlans(): Promise<PlanWithDetails[]> {
  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  return plans.map(normalizePlan)
}

function normalizePlan(p: any): PlanWithDetails {
  let features: string[] = []
  try {
    features = JSON.parse(p.features || '[]')
  } catch {
    features = []
  }
  return {
    id: p.id,
    code: p.code,
    nameAr: p.nameAr,
    description: p.description,
    priceMonthly: p.priceMonthly,
    priceAnnual: p.priceAnnual,
    trialDays: p.trialDays,
    maxStudents: p.maxStudents,
    maxTeachers: p.maxTeachers,
    maxAdmins: p.maxAdmins,
    maxStorageMb: p.maxStorageMb,
    features,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  }
}

/** أخذ اشتراك المدرسة الكامل مع تفاصيل الباقة */
export async function getSchoolSubscription(schoolId: string) {
  const sub = await db.schoolSubscription.findUnique({
    where: { schoolId },
    include: { plan: true },
  })
  if (!sub) return null
  const plan = normalizePlan(sub.plan)
  return { ...sub, plan }
}

/** هل الميزة مُفعّلة في الباقة؟ */
export function hasFeature(plan: PlanWithDetails | null, featureKey: string): boolean {
  if (!plan) return false
  return plan.features.includes(featureKey)
}

/** هل الوصول متاح لهذه المدرسة (لا يُحظر)؟ */
export async function checkSchoolAccess(schoolId: string): Promise<{
  allowed: boolean
  readOnly: boolean
  blocked: boolean
  renewableBlock: boolean
  status: string
  subscription: Awaited<ReturnType<typeof getSchoolSubscription>>
}> {
  const subscription = await getSchoolSubscription(schoolId)
  const status = subscription?.status || (await db.school.findUnique({ where: { id: schoolId } }))?.subscriptionStatus || SUBSCRIPTION_STATUS.PENDING_APPROVAL
  return {
    allowed: isAccessGranted(status),
    readOnly: isReadOnly(status),
    blocked: isAccessBlocked(status),
    renewableBlock: isRenewableBlock(status),
    status,
    subscription,
  }
}

/** إضافة أيام لتاريخ */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** إضافة أشهر لتاريخ */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/** توليد رقم فاتورة فريد */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  // آخر فاتورة لهذا العام
  const last = await db.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } },
    orderBy: { invoiceNumber: 'desc' },
  })
  let seq = 1
  if (last) {
    const parts = last.invoiceNumber.split('-')
    seq = (parseInt(parts[2] || '0', 10) || 0) + 1
  }
  const seqStr = String(seq).padStart(5, '0')
  return `INV-${year}-${seqStr}`
}

/** حساب مبلغ الباقة حسب الدورة */
export function computePlanAmount(plan: PlanWithDetails, cycle: string): number {
  return cycle === BILLING_CYCLE.ANNUAL ? plan.priceAnnual : plan.priceMonthly
}

/** إنشاء فاتورة جديدة لفترة */
export async function createInvoiceForPeriod(params: {
  schoolId: string
  subscriptionId: string
  planId: string
  amount: number
  periodStart: Date
  periodEnd: Date
  dueDate: Date
}): Promise<{ id: string; invoiceNumber: string }> {
  const invoiceNumber = await generateInvoiceNumber()
  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      subscriptionId: params.subscriptionId,
      schoolId: params.schoolId,
      planId: params.planId,
      amount: params.amount,
      currency: 'EGP',
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      status: INVOICE_STATUS.PENDING,
      dueDate: params.dueDate,
    },
  })
  return { id: invoice.id, invoiceNumber: invoice.invoiceNumber }
}

/** تنسيق المبلغ بالجنيه المصري */
export function formatEGP(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + ' ج.م'
}

/** وصف حالة الاشتراك بالعربية */
export function statusLabelAr(status: string): string {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'في انتظار الموافقة',
    TRIAL: 'فترة تجريبية',
    ACTIVE: 'نشط',
    PAST_DUE: 'متأخر السداد',
    CANCELLED: 'ملغي',
    EXPIRED: 'منتهي',
  }
  return map[status] || status
}

/** لون الحالة (للأختام/الشارات) */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700 border-amber-200',
    TRIAL: 'bg-blue-100 text-blue-700 border-blue-200',
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    PAST_DUE: 'bg-orange-100 text-orange-700 border-orange-200',
    CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
    EXPIRED: 'bg-red-100 text-red-700 border-red-200',
  }
  return map[status] || 'bg-gray-100 text-gray-600 border-gray-200'
}

/** قائمة الميزات الكاملة بالعربية (للعرض في صفحة الباقات) */
export const FEATURE_LABELS: Record<string, string> = {
  news: 'الأخبار',
  sliders: 'السلايدر',
  gallery: 'معرض الصور',
  teachers: 'فريق التدريس',
  students: 'إدارة الطلاب',
  classrooms: 'الفصول الدراسية',
  academic_years: 'السنوات الدراسية',
  results: 'النتائج',
  schedules: 'جداول الحصص',
  library: 'المكتبة الرقمية',
  parent_portal: 'بوابة أولياء الأمور',
  teacher_portal: 'بوابة المعلم',
  exams_training: 'الامتحانات التدريبية',
  exams_official: 'الامتحانات الرسمية',
  transport: 'النقل المدرسي',
  fees: 'الأقساط والرسوم',
  fee_payments: 'تسجيل المدفوعات',
  expenses: 'المصروفات',
  expense_vendors: 'الموردون',
  recurring_expenses: 'المصروفات المتكررة',
  petty_cash: 'العهد والصناديق',
  budgets: 'الميزانيات',
  staff: 'شئون العاملين',
  employees: 'الموظفون',
  salaries: 'الرواتب',
  employee_attendance: 'حضور العاملين',
  downloads: 'مركز التحميل',
  messages: 'الرسائل الداخلية',
  announcements: 'الإعلانات',
  events: 'الفعاليات',
  analytics: 'التحليلات المقارنة',
  coordinator: 'لوحة المنسّق',
  api_access: 'وصول API خارجي',
}

/** تسمية الباقة بالعربية من الكود */
export function planNameAr(code: string): string {
  const map: Record<string, string> = {
    basic: 'الباقة الأساسية',
    pro: 'الباقة الاحترافية',
    enterprise: 'باقة المؤسسات',
  }
  return map[code] || code
}

/** توليد كلمة مرور عشوائية قصيرة */
export function generateTempPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pwd
}

/** توليد اسم مستخدم مقترح من البريد */
export function suggestUsername(email: string): string {
  if (!email) return ''
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** توليد subdomain مقترح من اسم المدرسة */
export function suggestSubdomain(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, 'a')
    .replace(/ى/g, 'y')
    .replace(/ة/g, 'h')
    .replace(/ؤ/g, 'o')
    .replace(/ئ/g, 'e')
    .replace(/ء/g, '')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'school'
}
