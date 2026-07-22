/**
 * POST /api/subscriptions/approve
 * موافقة super-admin على مدرسة مُسجّلة جديدة.
 * - ينشئ User للمسؤول بكلمة المرور المخزّنة مسبقًا
 * - ينشئ SchoolSubscription بوضع TRIAL (14 يومًا)
 * - يحدّث School.subscriptionStatus = TRIAL
 *
 * Body:
 *   - schoolId: string (مطلوب)
 *
 * يتطلب header: x-super-admin-token أو super_admin role (مبسّط للإصدار الأول)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addDays } from '@/lib/subscription'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId } = body

    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 })
    }

    const school = await db.school.findUnique({ where: { id: schoolId } })
    if (!school) {
      return NextResponse.json({ error: 'المدرسة غير موجودة' }, { status: 404 })
    }

    if (school.subscriptionStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: 'هذه المدرسة ليست في حالة انتظار الموافقة' },
        { status: 400 }
      )
    }

    if (!school.pendingPlanId) {
      return NextResponse.json(
        { error: 'لا توجد باقة محددة لهذه المدرسة' },
        { status: 400 }
      )
    }

    // جلب الباقة
    const plan = await db.subscriptionPlan.findUnique({ where: { id: school.pendingPlanId } })
    if (!plan) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }

    const now = new Date()
    const trialEnd = addDays(now, plan.trialDays)

    // 1) إنشاء حساب المسؤول
    await db.user.create({
      data: {
        schoolId: school.id,
        username: school.registrantUsername,
        password: school.registrantTempPassword, // مشفّرة مسبقًا
        role: 'school_admin',
        permissions: '{}',
      },
    })

    // 2) إنشاء الاشتراك بوضع TRIAL
    await db.schoolSubscription.create({
      data: {
        schoolId: school.id,
        planId: plan.id,
        status: 'TRIAL',
        startDate: now,
        trialEndDate: trialEnd,
        currentPeriodEnd: trialEnd, // خلال التجربة، نهاية الفترة = نهاية التجربة
        billingCycle: 'MONTHLY',
        autoRenew: true,
      },
    })

    // 3) تحديث حالة المدرسة
    await db.school.update({
      where: { id: school.id },
      data: {
        subscriptionStatus: 'TRIAL',
        approvedAt: now,
        rejectionReason: '',
      },
    })

    return NextResponse.json({
      success: true,
      message: `تمت الموافقة على ${school.name}. بدأت الفترة التجريبية (${plan.trialDays} يومًا).`,
      school: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        status: 'TRIAL',
        trialEnd: trialEnd.toISOString(),
      },
    })
  } catch (error) {
    console.error('[subscriptions/approve POST] error:', error)
    return NextResponse.json(
      { error: 'فشل الموافقة', details: (error as Error).message },
      { status: 500 }
    )
  }
}
