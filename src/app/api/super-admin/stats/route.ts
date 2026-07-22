/**
 * GET /api/super-admin/stats
 * إحصائيات الإيرادات والمدارس للوحة super-admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_request: NextRequest) {
  try {
    // إحصاءات المدارس
    const totalSchools = await db.school.count()
    const pending = await db.school.count({ where: { subscriptionStatus: 'PENDING_APPROVAL' } })
    const trial = await db.school.count({ where: { subscriptionStatus: 'TRIAL' } })
    const active = await db.school.count({ where: { subscriptionStatus: 'ACTIVE' } })
    const pastDue = await db.school.count({ where: { subscriptionStatus: 'PAST_DUE' } })
    const expired = await db.school.count({ where: { subscriptionStatus: 'EXPIRED' } })

    // إحصاءات الفواتير
    const totalInvoices = await db.invoice.count()
    const paidInvoices = await db.invoice.count({ where: { status: 'PAID' } })
    const pendingInvoices = await db.invoice.count({ where: { status: 'PENDING' } })
    const pendingManualInvoices = await db.invoice.count({
      where: { status: 'PENDING', manualReceiptUrl: { not: null } },
    })

    // الإيرادات (مجموع الفواتير المدفوعة)
    const paidAgg = await db.invoice.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    })
    const totalRevenue = paidAgg._sum.amount || 0

    // الإيرادات هذا الشهر
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthAgg = await db.invoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: monthStart } },
      _sum: { amount: true },
    })
    const monthRevenue = monthAgg._sum.amount || 0

    // الإيرادات هذه السنة
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const yearAgg = await db.invoice.aggregate({
      where: { status: 'PAID', paidAt: { gte: yearStart } },
      _sum: { amount: true },
    })
    const yearRevenue = yearAgg._sum.amount || 0

    // الفواتير المعلّقة (بانتظار مراجعة يدوية)
    const pendingManualList = await db.invoice.findMany({
      where: { status: 'PENDING', manualReceiptUrl: { not: null } },
      include: { school: true, plan: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // توزيع المدارس على الباقات
    const plansDist = await db.schoolSubscription.groupBy({
      by: ['planId'],
      where: { status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE'] } },
      _count: { planId: true },
    })
    const plans = await db.subscriptionPlan.findMany()
    const planDistribution = plans.map(p => ({
      code: p.code,
      nameAr: p.nameAr,
      count: plansDist.find(d => d.planId === p.id)?._count.planId || 0,
    }))

    return NextResponse.json({
      success: true,
      schools: { total: totalSchools, pending, trial, active, pastDue, expired },
      invoices: { total: totalInvoices, paid: paidInvoices, pending: pendingInvoices, pendingManual: pendingManualInvoices },
      revenue: { total: totalRevenue, month: monthRevenue, year: yearRevenue },
      pendingManualInvoices: pendingManualList.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency: inv.currency,
        periodEnd: inv.periodEnd,
        createdAt: inv.createdAt,
        school: { id: inv.school.id, name: inv.school.name, subdomain: inv.school.subdomain },
        plan: { code: inv.plan.code, nameAr: inv.plan.nameAr },
      })),
      planDistribution,
    })
  } catch (error) {
    console.error('[super-admin/stats GET] error:', error)
    return NextResponse.json({ error: 'فشل جلب الإحصائيات' }, { status: 500 })
  }
}
