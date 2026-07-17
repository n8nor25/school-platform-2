import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expenses - List expenses with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const categoryId = searchParams.get('categoryId')
    const vendorId = searchParams.get('vendorId')
    const status = searchParams.get('status')
    const paymentMethod = searchParams.get('paymentMethod')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const academicYearId = searchParams.get('academicYearId')

    const where: Record<string, unknown> = { schoolId }
    if (categoryId) where.categoryId = categoryId
    if (vendorId) where.vendorId = vendorId
    if (status) where.status = status
    if (paymentMethod) where.paymentMethod = paymentMethod
    if (academicYearId) where.academicYearId = academicYearId
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { recipient: { contains: search } },
        { reference: { contains: search } },
      ]
    }
    if (fromDate || toDate) {
      const dateRange: Record<string, unknown> = {}
      if (fromDate) {
        const start = new Date(fromDate)
        start.setHours(0, 0, 0, 0)
        dateRange.gte = start
      }
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        dateRange.lte = end
      }
      where.expenseDate = dateRange
    }

    const expenses = await db.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        approvals: {
          orderBy: { approvedAt: 'desc' },
        },
      },
      orderBy: { expenseDate: 'desc' },
    })

    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'تعذر جلب المصروفات' }, { status: 500 })
  }
}

// POST /api/expenses - Create a new expense
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      title,
      amount,
      expenseDate,
      paymentMethod,
      categoryId,
      vendorId,
      recurringExpenseId,
      recipient,
      reference,
      checkNumber,
      bankName,
      checkDate,
      attachments,
      notes,
      status,
      createdBy,
      academicYearId,
    } = body

    if (!title || amount === undefined || !expenseDate) {
      return NextResponse.json(
        { error: 'العنوان والمبلغ وتاريخ المصروف مطلوبة' },
        { status: 400 }
      )
    }

    // Resolve academic year: provided > active year for school > null
    let resolvedAcademicYearId: string | null = academicYearId || null
    if (!resolvedAcademicYearId) {
      const activeYear = await db.academicYear.findFirst({
        where: { schoolId, isActive: true },
      })
      resolvedAcademicYearId = activeYear?.id || null
    }

    const created = await db.expense.create({
      data: {
        schoolId,
        academicYearId: resolvedAcademicYearId,
        categoryId: categoryId || null,
        vendorId: vendorId || null,
        recurringExpenseId: recurringExpenseId || null,
        title: String(title),
        amount: Number(amount),
        expenseDate: new Date(expenseDate),
        paymentMethod: paymentMethod ? String(paymentMethod) : 'نقدي',
        recipient: recipient || null,
        reference: reference || null,
        checkNumber: checkNumber || null,
        bankName: bankName || null,
        checkDate: checkDate ? new Date(checkDate) : null,
        attachments: attachments
          ? JSON.stringify(Array.isArray(attachments) ? attachments : [])
          : null,
        notes: notes || null,
        status: status ? String(status) : 'مدفوع',
        createdBy: createdBy || null,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        approvals: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'هذا المصروف مُسجل بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error creating expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء المصروف' },
      { status: 500 }
    )
  }
}
