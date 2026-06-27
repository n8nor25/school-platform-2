import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expense-reports?type=... - Various expense reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const type = searchParams.get('type')
    if (!type) {
      return NextResponse.json(
        { error: 'معامل type مطلوب' },
        { status: 400 }
      )
    }

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // ========== 1) Summary ==========
    if (type === 'summary') {
      const where: Record<string, unknown> = { schoolId }
      if (fromDate || toDate) {
        const range: Record<string, unknown> = {}
        if (fromDate) {
          const s = new Date(fromDate); s.setHours(0, 0, 0, 0); range.gte = s
        }
        if (toDate) {
          const e = new Date(toDate); e.setHours(23, 59, 59, 999); range.lte = e
        }
        where.expenseDate = range
      }

      const [expenses, byCategoryRaw, byPaymentMethodRaw, byStatusRaw] = await Promise.all([
        db.expense.findMany({
          where,
          select: { amount: true, categoryId: true, paymentMethod: true, status: true },
        }),
        db.expense.groupBy({
          by: ['categoryId'],
          where,
          _sum: { amount: true },
          _count: true,
        }),
        db.expense.groupBy({
          by: ['paymentMethod'],
          where,
          _sum: { amount: true },
          _count: true,
        }),
        db.expense.groupBy({
          by: ['status'],
          where,
          _sum: { amount: true },
          _count: true,
        }),
      ])

      const categoryIds = byCategoryRaw
        .map((r) => r.categoryId)
        .filter((id): id is string => Boolean(id))
      const categories = categoryIds.length
        ? await db.expenseCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, color: true, icon: true },
          })
        : []
      const catMap = new Map(categories.map((c) => [c.id, c]))

      const total = expenses.reduce((s, e) => s + e.amount, 0)
      const count = expenses.length

      const byCategory = byCategoryRaw
        .filter((r) => r.categoryId)
        .map((r) => ({
          category: catMap.get(r.categoryId!) || { id: r.categoryId, name: 'غير مُصنف' },
          amount: r._sum.amount || 0,
          count: r._count,
        }))

      const byPaymentMethod = byPaymentMethodRaw.map((r) => ({
        paymentMethod: r.paymentMethod,
        amount: r._sum.amount || 0,
        count: r._count,
      }))

      const byStatus = byStatusRaw.map((r) => ({
        status: r.status,
        amount: r._sum.amount || 0,
        count: r._count,
      }))

      return NextResponse.json({
        summary: { total, count, byCategory, byPaymentMethod, byStatus },
      })
    }

    // ========== 2) Monthly ==========
    if (type === 'monthly') {
      const yearStr = searchParams.get('year')
      if (!yearStr) {
        return NextResponse.json(
          { error: 'معامل year مطلوب' },
          { status: 400 }
        )
      }
      const year = Number(yearStr)
      const start = new Date(year, 0, 1)
      const end = new Date(year, 11, 31, 23, 59, 59, 999)

      const expenses = await db.expense.findMany({
        where: {
          schoolId,
          expenseDate: { gte: start, lte: end },
        },
        select: { amount: true, expenseDate: true },
      })

      const monthly: Array<{ month: number; total: number; count: number }> = []
      for (let m = 0; m < 12; m++) {
        const monthExpenses = expenses.filter(
          (e) => new Date(e.expenseDate).getMonth() === m
        )
        monthly.push({
          month: m + 1,
          total: monthExpenses.reduce((s, e) => s + e.amount, 0),
          count: monthExpenses.length,
        })
      }

      return NextResponse.json({ monthly })
    }

    // ========== 3) Category breakdown (with subcategories) ==========
    if (type === 'category-breakdown') {
      const where: Record<string, unknown> = { schoolId }
      if (fromDate || toDate) {
        const range: Record<string, unknown> = {}
        if (fromDate) {
          const s = new Date(fromDate); s.setHours(0, 0, 0, 0); range.gte = s
        }
        if (toDate) {
          const e = new Date(toDate); e.setHours(23, 59, 59, 999); range.lte = e
        }
        where.expenseDate = range
      }

      const [allCategories, expenses] = await Promise.all([
        db.expenseCategory.findMany({
          where: { schoolId },
          include: {
            parent: { select: { id: true, name: true } },
            _count: { select: { expenses: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        db.expense.findMany({
          where,
          select: { amount: true, categoryId: true },
        }),
      ])

      const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
      const aggByCategory = new Map<string, { total: number; count: number }>()
      for (const e of expenses) {
        if (!e.categoryId) continue
        const cur = aggByCategory.get(e.categoryId) || { total: 0, count: 0 }
        cur.total += e.amount
        cur.count += 1
        aggByCategory.set(e.categoryId, cur)
      }

      const categories = allCategories.map((c) => {
        const agg = aggByCategory.get(c.id) || { total: 0, count: 0 }
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          icon: c.icon,
          parentId: c.parentId,
          parentName: c.parent?.name || null,
          totalAmount: agg.total,
          count: agg.count,
          percentage:
            totalAmount > 0 ? Math.round((agg.total / totalAmount) * 10000) / 100 : 0,
        }
      })

      // Sort by totalAmount desc
      categories.sort((a, b) => b.totalAmount - a.totalAmount)

      return NextResponse.json({ categories, totalAmount })
    }

    // ========== 4) Vendor summary ==========
    if (type === 'vendor-summary') {
      const where: Record<string, unknown> = { schoolId }
      if (fromDate || toDate) {
        const range: Record<string, unknown> = {}
        if (fromDate) {
          const s = new Date(fromDate); s.setHours(0, 0, 0, 0); range.gte = s
        }
        if (toDate) {
          const e = new Date(toDate); e.setHours(23, 59, 59, 999); range.lte = e
        }
        where.expenseDate = range
      }

      const vendorAgg = await db.expense.groupBy({
        by: ['vendorId'],
        where: { ...where, vendorId: { not: null } },
        _sum: { amount: true },
        _count: true,
      })

      const vendorIds = vendorAgg
        .map((v) => v.vendorId)
        .filter((id): id is string => Boolean(id))
      const vendors = vendorIds.length
        ? await db.expenseVendor.findMany({
            where: { id: { in: vendorIds } },
            select: { id: true, name: true, type: true, phone: true },
          })
        : []
      const vendorMap = new Map(vendors.map((v) => [v.id, v]))

      const result = vendorAgg
        .filter((v) => v.vendorId)
        .map((v) => ({
          vendor: vendorMap.get(v.vendorId!) || { id: v.vendorId, name: 'غير معروف' },
          totalAmount: v._sum.amount || 0,
          count: v._count,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)

      return NextResponse.json({ vendors: result })
    }

    // ========== 5) Budget vs Actual ==========
    if (type === 'budget-vs-actual') {
      const academicYearId = searchParams.get('academicYearId')
      if (!academicYearId) {
        return NextResponse.json(
          { error: 'معامل academicYearId مطلوب' },
          { status: 400 }
        )
      }

      const budgets = await db.expenseBudget.findMany({
        where: { schoolId, academicYearId },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
        },
        orderBy: [{ period: 'asc' }, { fiscalMonth: 'asc' }, { fiscalQuarter: 'asc' }],
      })

      const year = await db.academicYear.findUnique({
        where: { id: academicYearId },
        select: { startDate: true, endDate: true },
      })

      const items = await Promise.all(
        budgets.map(async (b) => {
          let dateFilter: Record<string, unknown> = {}
          if (b.period === 'سنوي' && year) {
            dateFilter = { gte: year.startDate, lte: year.endDate }
          } else if (b.period === 'شهري' && b.fiscalMonth) {
            const y = year?.startDate ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
            dateFilter = {
              gte: new Date(y, b.fiscalMonth - 1, 1),
              lte: new Date(y, b.fiscalMonth, 0, 23, 59, 59, 999),
            }
          } else if (b.period === 'ربعي' && b.fiscalQuarter) {
            const y = year?.startDate ? new Date(year.startDate).getFullYear() : new Date().getFullYear()
            const startMonth = (b.fiscalQuarter - 1) * 3
            dateFilter = {
              gte: new Date(y, startMonth, 1),
              lte: new Date(y, startMonth + 3, 0, 23, 59, 59, 999),
            }
          } else if (year) {
            dateFilter = { gte: year.startDate, lte: year.endDate }
          }

          const agg = await db.expense.aggregate({
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

          const actualAmount = agg._sum.amount || 0
          const remaining = b.amount - actualAmount
          const percentUsed = b.amount > 0 ? (actualAmount / b.amount) * 100 : 0

          return {
            ...b,
            actualAmount,
            remaining,
            percentUsed: Math.round(percentUsed * 100) / 100,
            expenseCount: agg._count,
          }
        })
      )

      return NextResponse.json({ items })
    }

    // ========== 6) Cash Flow (income vs expenses) ==========
    if (type === 'cash-flow') {
      const range: { gte?: Date; lte?: Date } = {}
      if (fromDate) {
        const s = new Date(fromDate); s.setHours(0, 0, 0, 0); range.gte = s
      }
      if (toDate) {
        const e = new Date(toDate); e.setHours(23, 59, 59, 999); range.lte = e
      }
      const dateFilter =
        Object.keys(range).length > 0
          ? range
          : undefined

      const [feePayments, transportPayments, expenseAggByCat, expenseAggTotal] = await Promise.all([
        db.feePayment.aggregate({
          where: dateFilter ? { schoolId, paymentDate: dateFilter } : { schoolId },
          _sum: { amount: true },
          _count: true,
        }),
        db.transportPayment.aggregate({
          where: dateFilter ? { schoolId, paymentDate: dateFilter } : { schoolId },
          _sum: { amount: true },
          _count: true,
        }),
        db.expense.groupBy({
          by: ['categoryId'],
          where: dateFilter
            ? { schoolId, status: { notIn: ['مرفوض', 'مسودة'] }, expenseDate: dateFilter }
            : { schoolId, status: { notIn: ['مرفوض', 'مسودة'] } },
          _sum: { amount: true },
        }),
        db.expense.aggregate({
          where: dateFilter
            ? { schoolId, status: { notIn: ['مرفوض', 'مسودة'] }, expenseDate: dateFilter }
            : { schoolId, status: { notIn: ['مرفوض', 'مسودة'] } },
          _sum: { amount: true },
          _count: true,
        }),
      ])

      const fees = feePayments._sum.amount || 0
      const transport = transportPayments._sum.amount || 0
      const totalIncome = fees + transport
      const totalExpenses = expenseAggTotal._sum.amount || 0
      const net = totalIncome - totalExpenses

      const categoryIds = expenseAggByCat
        .map((r) => r.categoryId)
        .filter((id): id is string => Boolean(id))
      const categories = categoryIds.length
        ? await db.expenseCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, color: true },
          })
        : []
      const catMap = new Map(categories.map((c) => [c.id, c]))

      const byCategory = expenseAggByCat
        .filter((r) => r.categoryId)
        .map((r) => ({
          category: catMap.get(r.categoryId!) || { id: r.categoryId, name: 'غير مُصنف' },
          amount: r._sum.amount || 0,
        }))

      return NextResponse.json({
        cashFlow: {
          income: { fees, transport, total: totalIncome },
          expenses: { total: totalExpenses, byCategory },
          net,
          feePaymentCount: feePayments._count,
          transportPaymentCount: transportPayments._count,
          expenseCount: expenseAggTotal._count,
        },
      })
    }

    return NextResponse.json(
      { error: 'نوع التقرير غير معروف' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error generating expense report:', error)
    return NextResponse.json({ error: 'تعذر توليد التقرير' }, { status: 500 })
  }
}
