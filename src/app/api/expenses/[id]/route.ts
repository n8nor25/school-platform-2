import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expenses/:id - Single expense with all relations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const expense = await db.expense.findFirst({
      where: { id, schoolId },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true, phone: true } },
        academicYear: { select: { id: true, name: true } },
        recurringExpense: {
          select: { id: true, title: true, frequency: true, amount: true },
        },
        approvals: { orderBy: { approvedAt: 'desc' } },
        pettyCashTx: { orderBy: { date: 'desc' } },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json({ error: 'تعذر جلب المصروف' }, { status: 500 })
  }
}

// PUT /api/expenses/:id - Update any field
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const existing = await db.expense.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
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
      academicYearId,
      approvedBy,
      approvedAt,
    } = body

    const updated = await db.expense.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(expenseDate !== undefined ? { expenseDate: new Date(expenseDate) } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod: String(paymentMethod) } : {}),
        ...(categoryId !== undefined ? { categoryId: categoryId || null } : {}),
        ...(vendorId !== undefined ? { vendorId: vendorId || null } : {}),
        ...(recurringExpenseId !== undefined ? { recurringExpenseId: recurringExpenseId || null } : {}),
        ...(recipient !== undefined ? { recipient: recipient || null } : {}),
        ...(reference !== undefined ? { reference: reference || null } : {}),
        ...(checkNumber !== undefined ? { checkNumber: checkNumber || null } : {}),
        ...(bankName !== undefined ? { bankName: bankName || null } : {}),
        ...(checkDate !== undefined ? { checkDate: checkDate ? new Date(checkDate) : null } : {}),
        ...(attachments !== undefined
          ? {
              attachments: JSON.stringify(
                Array.isArray(attachments) ? attachments : []
              ),
            }
          : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(academicYearId !== undefined ? { academicYearId: academicYearId || null } : {}),
        ...(approvedBy !== undefined ? { approvedBy: approvedBy || null } : {}),
        ...(approvedAt !== undefined ? { approvedAt: approvedAt ? new Date(approvedAt) : null } : {}),
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        approvals: { orderBy: { approvedAt: 'desc' } },
        pettyCashTx: { orderBy: { date: 'desc' } },
        recurringExpense: { select: { id: true, title: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'هذا المصروف مُسجل بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error updating expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث المصروف' },
      { status: 500 }
    )
  }
}

// DELETE /api/expenses/:id - Cascade protection (petty-cash tx + approvals)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const existing = await db.expense.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { pettyCashTx: true, approvals: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    if (existing._count.pettyCashTx > 0 || existing._count.approvals > 0) {
      return NextResponse.json(
        {
          error:
            'لا يمكن حذف المصروف لوجود حركات عهد أو طلبات اعتماد مرتبطة به. احذفها أولاً.',
        },
        { status: 409 }
      )
    }

    await db.expense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف المصروف' },
      { status: 500 }
    )
  }
}
