import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/expense-budgets/:id - Update amount / notes
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

    const existing = await db.expenseBudget.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الميزانية غير موجودة' }, { status: 404 })
    }

    const body = await request.json()
    const { amount, notes, categoryId, period, fiscalMonth, fiscalQuarter, academicYearId } = body

    const updated = await db.expenseBudget.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(categoryId !== undefined ? { categoryId: String(categoryId) } : {}),
        ...(period !== undefined ? { period: String(period) } : {}),
        ...(academicYearId !== undefined ? { academicYearId: String(academicYearId) } : {}),
        ...(fiscalMonth !== undefined ? { fiscalMonth: fiscalMonth ? Number(fiscalMonth) : null } : {}),
        ...(fiscalQuarter !== undefined ? { fiscalQuarter: fiscalQuarter ? Number(fiscalQuarter) : null } : {}),
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        academicYear: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'الميزانية مُسجلة بالفعل لهذه الفترة' },
        { status: 409 }
      )
    }
    console.error('Error updating expense budget:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث الميزانية' },
      { status: 500 }
    )
  }
}

// DELETE /api/expense-budgets/:id - Delete budget
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

    const existing = await db.expenseBudget.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الميزانية غير موجودة' }, { status: 404 })
    }

    await db.expenseBudget.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting expense budget:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف الميزانية' },
      { status: 500 }
    )
  }
}
