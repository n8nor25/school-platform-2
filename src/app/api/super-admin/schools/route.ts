/**
 * ============================================================
 *  GET  /api/super-admin/schools
 *    → قائمة كل المدارس + اشتراكاتها (لـ super-admin)
 *  PATCH /api/super-admin/schools
 *    → تأكيد دفع فاتورة يدوية (Body: { invoiceId })
 * ============================================================
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { INVOICE_STATUS } from '@/lib/subscription'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') // PENDING_APPROVAL | TRIAL | ACTIVE | ...
    const search = searchParams.get('search')?.trim()

    const where: Record<string, unknown> = {}
    if (statusFilter) where.subscriptionStatus = statusFilter
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { subdomain: { contains: search } },
        { registrantEmail: { contains: search } },
        { registrantName: { contains: search } },
      ]
    }

    const schools = await db.school.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        subscription: { include: { plan: true } },
      },
    })

    // إحصائيات سريعة
    const total = await db.school.count()
    const pending = await db.school.count({ where: { subscriptionStatus: 'PENDING_APPROVAL' } })
    const trial = await db.school.count({ where: { subscriptionStatus: 'TRIAL' } })
    const active = await db.school.count({ where: { subscriptionStatus: 'ACTIVE' } })
    const expired = await db.school.count({ where: { subscriptionStatus: 'EXPIRED' } })

    // فواتير بانتظار مراجعة الدفع اليدوي
    const pendingInvoices = await db.invoice.count({
      where: {
        status: INVOICE_STATUS.PENDING,
        manualReceiptUrl: { not: null },
      },
    })

    return NextResponse.json({
      success: true,
      schools: schools.map(s => ({
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        email: s.email,
        phone: s.phone,
        primaryColor: s.primaryColor,
        isActive: s.isActive,
        subscriptionStatus: s.subscriptionStatus,
        registrantName: s.registrantName,
        registrantEmail: s.registrantEmail,
        registrantPhone: s.registrantPhone,
        registrantUsername: s.registrantUsername,
        rejectionReason: s.rejectionReason,
        createdAt: s.createdAt,
        approvedAt: s.approvedAt,
        subscription: s.subscription
          ? {
              id: s.subscription.id,
              status: s.subscription.status,
              plan: s.subscription.plan
                ? {
                    id: s.subscription.plan.id,
                    code: s.subscription.plan.code,
                    nameAr: s.subscription.plan.nameAr,
                  }
                : null,
              billingCycle: s.subscription.billingCycle,
              currentPeriodEnd: s.subscription.currentPeriodEnd,
              trialEndDate: s.subscription.trialEndDate,
              autoRenew: s.subscription.autoRenew,
            }
          : null,
      })),
      stats: { total, pending, trial, active, expired, pendingInvoices },
    })
  } catch (error) {
    console.error('[super-admin/schools GET] error:', error)
    return NextResponse.json({ error: 'فشل جلب المدارس' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, action } = body
    if (!invoiceId || !action) {
      return NextResponse.json({ error: 'معرف الفاتورة والإجراء مطلوبان' }, { status: 400 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { subscription: true },
    })
    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    if (action === 'confirm_payment') {
      if (invoice.status !== INVOICE_STATUS.PENDING) {
        return NextResponse.json({ error: 'هذه الفاتورة ليست قيد الانتظار' }, { status: 400 })
      }
      const now = new Date()
      // 1) تحديث الفاتورة لـ PAID
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          status: INVOICE_STATUS.PAID,
          paidAt: now,
          reviewedAt: now,
          paymentMethod: invoice.paymentMethod || 'manual',
        },
      })
      // 2) تحديث حركة الدفع
      await db.paymentTransaction.updateMany({
        where: { invoiceId: invoice.id, gateway: 'manual', status: 'PENDING' },
        data: { status: 'SUCCESS' },
      })
      // 3) تفعيل الاشتراك + مدّ الفترة
      const sub = invoice.subscription
      const newPeriodEnd = new Date(invoice.periodEnd)
      // إن كانت هناك باقة معلّقة، نُفعّلها
      const pendingPlanId = sub.pendingPlanId
      const pendingCycle = sub.pendingCycle
      const planIdToUse = pendingPlanId || invoice.planId
      const cycleToUse = pendingCycle || sub.billingCycle

      await db.schoolSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          planId: planIdToUse,
          billingCycle: cycleToUse,
          currentPeriodEnd: newPeriodEnd,
          startDate: invoice.periodStart,
          pendingPlanId: null,
          pendingCycle: null,
          cancelledAt: null,
        },
      })
      await db.school.update({
        where: { id: invoice.schoolId },
        data: { subscriptionStatus: 'ACTIVE' },
      })
      return NextResponse.json({
        success: true,
        message: `تم تأكيد الدفع وتفعيل الاشتراك حتى ${newPeriodEnd.toLocaleDateString('ar-EG')}.`,
      })
    }

    if (action === 'reject_payment') {
      const { reason = '' } = body
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          status: INVOICE_STATUS.FAILED,
          reviewedAt: new Date(),
          manualNotes: (invoice.manualNotes + ' | سبب الرفض: ' + reason).slice(0, 500),
        },
      })
      await db.paymentTransaction.updateMany({
        where: { invoiceId: invoice.id, gateway: 'manual', status: 'PENDING' },
        data: { status: 'FAILED' },
      })
      return NextResponse.json({ success: true, message: 'تم رفض الإيصال.' })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch (error) {
    console.error('[super-admin/schools PATCH] error:', error)
    return NextResponse.json({ error: 'فشل التحديث' }, { status: 500 })
  }
}
