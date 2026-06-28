import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/recurring-expenses/:id - Update fields. Recompute nextRunDate if startDate changes.
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

    const existing = await db.recurringExpense.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف المتكرر غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      amount,
      frequency,
      startDate,
      endDate,
      categoryId,
      vendorId,
      paymentMethod,
      recipient,
      reference,
      notes,
      active,
      autoGenerate,
      nextRunDate,
    } = body

    // If startDate changed, recompute nextRunDate from new start (unless explicitly provided)
    let computedNextRun: Date | undefined
    if (startDate !== undefined) {
      const newStart = new Date(startDate)
      computedNextRun = nextRunDate ? new Date(nextRunDate) : newStart
    } else if (nextRunDate !== undefined) {
      computedNextRun = new Date(nextRunDate)
    }

    const updated = await db.recurringExpense.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(frequency !== undefined ? { frequency: String(frequency) } : {}),
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(categoryId !== undefined ? { categoryId: categoryId || null } : {}),
        ...(vendorId !== undefined ? { vendorId: vendorId || null } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod: String(paymentMethod) } : {}),
        ...(recipient !== undefined ? { recipient: recipient || null } : {}),
        ...(reference !== undefined ? { reference: reference || null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...(autoGenerate !== undefined ? { autoGenerate: Boolean(autoGenerate) } : {}),
        ...(computedNextRun ? { nextRunDate: computedNextRun } : {}),
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        _count: { select: { expenses: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error updating recurring expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث المصروف المتكرر' },
      { status: 500 }
    )
  }
}

// DELETE /api/recurring-expenses/:id - Cascade protection (expenses)
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

    const existing = await db.recurringExpense.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { expenses: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف المتكرر غير موجود' }, { status: 404 })
    }

    if (existing._count.expenses > 0) {
      return NextResponse.json(
        {
          error: `لا يمكن حذف المصروف المتكرر لوجود ${existing._count.expenses} مصروف مرتبط به.`,
        },
        { status: 409 }
      )
    }

    await db.recurringExpense.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting recurring expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف المصروف المتكرر' },
      { status: 500 }
    )
  }
}
