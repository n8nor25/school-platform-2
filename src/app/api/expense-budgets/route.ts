import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expense-budgets - List budgets with optional compare=true (compute actual spend)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const academicYearId = searchParams.get('academicYearId')
    const categoryId = searchParams.get('categoryId')
    const period = searchParams.get('period')
    const compare = searchParams.get('compare') === 'true'

    const where: Record<string, unknown> = { schoolId }
    if (academicYearId) where.academicYearId = academicYearId
    if (categoryId) where.categoryId = categoryId
    if (period) where.period = period

    const budgets = await db.expenseBudget.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ period: 'asc' }, { fiscalMonth: 'asc' }, { fiscalQuarter: 'asc' }],
    })

    if (!compare) {
      return NextResponse.json({ budgets })
    }

    // Compute actual spend per budget based on period and matching category
    const enriched = await Promise.all(
      budgets.map(async (b) => {
        const year = await db.academicYear.findUnique({
          where: { id: b.academicYearId },
          select: { startDate: true, endDate: true },
        })

        let dateFilter: Record<string, unknown> = {}
        if (b.period === 'سنوي' && year) {
          dateFilter = { gte: year.startDate, lte: year.endDate }
        } else if (b.period === 'شهري' && b.fiscalMonth) {
          // Use academic year start year as base, but if start month is e.g. Sept (9),
          // fiscal month mapping: we use calendar month from academic year start.
          // Simpler: derive a date range using current year.
          const y = year?.startDate ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
          const start = new Date(y, b.fiscalMonth - 1, 1)
          const end = new Date(y, b.fiscalMonth, 0, 23, 59, 59, 999)
          dateFilter = { gte: start, lte: end }
        } else if (b.period === 'ربعي' && b.fiscalQuarter) {
          const y = year?.startDate ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
          const startMonth = (b.fiscalQuarter - 1) * 3
          const start = new Date(y, startMonth, 1)
          const end = new Date(y, startMonth + 3, 0, 23, 59, 59, 999)
          dateFilter = { gte: start, lte: end }
        } else if (year) {
          dateFilter = { gte: year.startDate, lte: year.endDate }
        }

        const actualAgg = await db.expense.aggregate({
          where: {
            schoolId,
            categoryId: b.categoryId,
            status: { notIn: ['مرفوض', 'مسودة'] },
            ...(Object.keys(dateFilter).length > 0
              ? { expenseDate: dateFilter }
              : {}),
          },
          _sum: { amount: true },
          _count: true,
        })

        const actualAmount = actualAgg._sum.amount || 0
        const remaining = b.amount - actualAmount
        const percentUsed = b.amount > 0 ? (actualAmount / b.amount) * 100 : 0

        return {
          ...b,
          actualAmount,
          remaining,
          percentUsed: Math.round(percentUsed * 100) / 100,
          expenseCount: actualAgg._count,
        }
      })
    )

    return NextResponse.json({ budgets: enriched })
  } catch (error) {
    console.error('Error fetching expense budgets:', error)
    return NextResponse.json({ error: 'تعذر جلب الميزانيات' }, { status: 500 })
  }
}

// POST /api/expense-budgets - Create a new budget
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { academicYearId, categoryId, period, fiscalMonth, fiscalQuarter, amount, notes } = body

    if (!academicYearId || !categoryId || !period || amount === undefined) {
      return NextResponse.json(
        { error: 'السنة الدراسية والتصنيف والفترة والمبلغ مطلوبة' },
        { status: 400 }
      )
    }

    const created = await db.expenseBudget.create({
      data: {
        schoolId,
        academicYearId: String(academicYearId),
        categoryId: String(categoryId),
        period: String(period),
        fiscalMonth: fiscalMonth !== undefined && fiscalMonth !== null ? Number(fiscalMonth) : null,
        fiscalQuarter: fiscalQuarter !== undefined && fiscalQuarter !== null ? Number(fiscalQuarter) : null,
        amount: Number(amount),
        notes: notes || null,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        academicYear: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'الميزانية مُسجلة بالفعل لهذه الفترة' },
        { status: 409 }
      )
    }
    console.error('Error creating expense budget:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء الميزانية' },
      { status: 500 }
    )
  }
}
