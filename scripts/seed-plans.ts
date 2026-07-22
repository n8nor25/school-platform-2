// Seed الباقات الثلاث للنظام (basic / pro / enterprise)
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const PLANS = [
  {
    code: 'basic',
    nameAr: 'الباقة الأساسية',
    description: 'مناسبة للمدارس الصغيرة والمجتمعية — الأساسيات لإدارة المدرسة',
    priceMonthly: 499,
    priceAnnual: 4990,
    trialDays: 14,
    maxStudents: 200,
    maxTeachers: 20,
    maxAdmins: 2,
    maxStorageMb: 2048, // 2 جيجا
    features: JSON.stringify([
      'news', 'sliders', 'gallery', 'teachers',
      'students', 'classrooms', 'academic_years',
      'results', 'schedules', 'library',
      'parent_portal', 'teacher_portal',
      'exams_training', 'downloads', 'messages', 'announcements', 'events',
    ]),
    sortOrder: 1,
  },
  {
    code: 'pro',
    nameAr: 'الباقة الاحترافية',
    description: 'الأنسب للمدارس المتوسطة — كل الأساسيات + الوحدات المالية والنقل والامتحانات الرسمية',
    priceMonthly: 999,
    priceAnnual: 9990,
    trialDays: 14,
    maxStudents: 1000,
    maxTeachers: 100,
    maxAdmins: 10,
    maxStorageMb: 10240, // 10 جيجا
    features: JSON.stringify([
      'news', 'sliders', 'gallery', 'teachers',
      'students', 'classrooms', 'academic_years',
      'results', 'schedules', 'library',
      'parent_portal', 'teacher_portal',
      'exams_training', 'exams_official',
      'transport', 'fees', 'fee_payments',
      'downloads', 'messages', 'announcements', 'events',
      'analytics', 'coordinator',
    ]),
    sortOrder: 2,
  },
  {
    code: 'enterprise',
    nameAr: 'باقة المؤسسات',
    description: 'للسلاسل التعليمية والمدارس الكبيرة — كل الوحدات بدون قيود تقريبًا',
    priceMonthly: 1999,
    priceAnnual: 19990,
    trialDays: 14,
    maxStudents: null,
    maxTeachers: null,
    maxAdmins: null,
    maxStorageMb: 51200, // 50 جيجا
    features: JSON.stringify([
      'news', 'sliders', 'gallery', 'teachers',
      'students', 'classrooms', 'academic_years',
      'results', 'schedules', 'library',
      'parent_portal', 'teacher_portal',
      'exams_training', 'exams_official',
      'transport', 'fees', 'fee_payments',
      'expenses', 'expense_vendors', 'recurring_expenses', 'petty_cash', 'budgets',
      'staff', 'employees', 'salaries', 'employee_attendance',
      'downloads', 'messages', 'announcements', 'events',
      'analytics', 'coordinator', 'api_access',
    ]),
    sortOrder: 3,
  },
]

async function main() {
  for (const p of PLANS) {
    const plan = await db.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {
        nameAr: p.nameAr,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        trialDays: p.trialDays,
        maxStudents: p.maxStudents,
        maxTeachers: p.maxTeachers,
        maxAdmins: p.maxAdmins,
        maxStorageMb: p.maxStorageMb,
        features: p.features,
        isActive: true,
        sortOrder: p.sortOrder,
      },
      create: p,
    })
    console.log(`✅ Plan: ${plan.code} — ${plan.nameAr} — ${plan.priceMonthly} ج.م/شهر | ${plan.priceAnnual} ج.م/سنة`)
  }

  // تحديث المدرسة الحالية لتكون في حالة ACTIVE مع الباقة الاحترافية (تجنّب تعطيل الوصول أثناء التطوير)
  const school = await db.school.findFirst({ where: { subdomain: 'default' } })
  if (school) {
    const proPlan = await db.subscriptionPlan.findUnique({ where: { code: 'pro' } })
    if (proPlan) {
      const existing = await db.schoolSubscription.findUnique({ where: { schoolId: school.id } })
      const now = new Date()
      const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // سنة كاملة
      if (!existing) {
        await db.schoolSubscription.create({
          data: {
            schoolId: school.id,
            planId: proPlan.id,
            status: 'ACTIVE',
            startDate: now,
            trialEndDate: null,
            currentPeriodEnd: periodEnd,
            billingCycle: 'ANNUAL',
            autoRenew: true,
          },
        })
        await db.school.update({
          where: { id: school.id },
          data: { subscriptionStatus: 'ACTIVE', pendingPlanId: null, approvedAt: now, approvedById: null },
        })
        console.log(`✅ Existing school "${school.name}" set to ACTIVE on Pro plan (annual, 1 year period)`)
      } else {
        console.log(`ℹ️  School "${school.name}" already has a subscription (status: ${existing.status})`)
      }
    }
  }

  console.log('\n========== SEED PLANS COMPLETE ==========')
  const all = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })
  for (const p of all) {
    console.log(`  • ${p.code}: ${p.nameAr} — شهري ${p.priceMonthly} / سنوي ${p.priceAnnual} — تجربة ${p.trialDays} يوم`)
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
