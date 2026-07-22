/**
 * ============================================================
 *  GET  /api/subscriptions/billing?schoolId=X
 *    → عرض اشتراك المدرسة + فواتيرها (لمسؤول المدرسة)
 *
 *  PATCH /api/subscriptions/billing
 *    → طلب تغيير الباقة أو دورة الفوترة (يسري من بداية الدورة التالية)
 *    Body: { schoolId, action: "change_plan"|"change_cycle"|"cancel"|"reactivate", planCode?, cycle? }
 * ============================================================
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BILLING_CYCLE } from '@/lib/subscription'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId')
    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 })
    }

    const subscription = await db.schoolSubscription.findUnique({
      where: { schoolId },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!subscription) {
      // نتحقق من حالة المدرسة (ربما PENDING_APPROVAL)
      const school = await db.school.findUnique({ where: { id: schoolId } })
      return NextResponse.json({
        success: true,
        subscription: null,
        schoolStatus: school?.subscriptionStatus || 'PENDING_APPROVAL',
        pendingPlanId: school?.pendingPlanId || null,
      })
    }

    // الباقة المعلّقة (للترقية/التخفيض القادم)
    let pendingPlan = null
    if (subscription.pendingPlanId) {
      pendingPlan = await db.subscriptionPlan.findUnique({ where: { id: subscription.pendingPlanId } })
    }

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        plan: subscription.plan,
        pendingPlan,
      },
    })
  } catch (error) {
    console.error('[subscriptions/billing GET] error:', error)
    return NextResponse.json({ error: 'فشل جلب بيانات الفوترة' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId, action, planCode, cycle } = body

    if (!schoolId || !action) {
      return NextResponse.json({ error: 'معرف المدرسة والإجراء مطلوبان' }, { status: 400 })
    }

    const subscription = await db.schoolSubscription.findUnique({ where: { schoolId } })
    if (!subscription) {
      return NextResponse.json({ error: 'لا يوجد اشتراك لهذه المدرسة' }, { status: 404 })
    }

    if (action === 'change_plan') {
      if (!planCode) {
        return NextResponse.json({ error: 'كود الباقة مطلوب' }, { status: 400 })
      }
      const newPlan = await db.subscriptionPlan.findUnique({ where: { code: planCode } })
      if (!newPlan) {
        return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
      }
      if (newPlan.id === subscription.planId) {
        return NextResponse.json({ error: 'أنت مشترك في هذه الباقة بالفعل' }, { status: 400 })
      }
      // نسجّل الباقة المعلّقة — تسري من بداية الدورة التالية
      await db.schoolSubscription.update({
        where: { schoolId },
        data: { pendingPlanId: newPlan.id },
      })
      return NextResponse.json({
        success: true,
        message: `سيتم تفعيل باقة "${newPlan.nameAr}" من بداية الدورة القادمة (${new Date(subscription.currentPeriodEnd).toLocaleDateString('ar-EG')}).`,
      })
    }

    if (action === 'change_cycle') {
      if (!cycle || ![BILLING_CYCLE.MONTHLY, BILLING_CYCLE.ANNUAL].includes(cycle)) {
        return NextResponse.json({ error: 'دورة فوترة غير صالحة' }, { status: 400 })
      }
      await db.schoolSubscription.update({
        where: { schoolId },
        data: { pendingCycle: cycle },
      })
      return NextResponse.json({
        success: true,
        message: `سيتم تفعيل دورة الفوترة "${cycle === BILLING_CYCLE.ANNUAL ? 'سنوية' : 'شهرية'}" من بداية الدورة القادمة.`,
      })
    }

    if (action === 'cancel') {
      await db.schoolSubscription.update({
        where: { schoolId },
        data: {
          autoRenew: false,
          cancelledAt: new Date(),
        },
      })
      return NextResponse.json({
        success: true,
        message: 'تم إلغاء التجديد التلقائي. سيستمر الوصول حتى نهاية الفترة الحالية.',
      })
    }

    if (action === 'reactivate') {
      await db.schoolSubscription.update({
        where: { schoolId },
        data: {
          autoRenew: true,
          cancelledAt: null,
        },
      })
      return NextResponse.json({
        success: true,
        message: 'تم إعادة تفعيل التجديد التلقائي.',
      })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch (error) {
    console.error('[subscriptions/billing PATCH] error:', error)
    return NextResponse.json(
      { error: 'فشل تحديث الاشتراك', details: (error as Error).message },
      { status: 500 }
    )
  }
}
