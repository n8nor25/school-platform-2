import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/expense-categories/:id - Update category fields
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

    const existing = await db.expenseCategory.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'التصنيف غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const { name, parentId, icon, color, sortOrder, active } = body

    // Prevent setting parentId to self or one of descendants (basic self-loop guard)
    if (parentId && parentId === id) {
      return NextResponse.json(
        { error: 'لا يمكن أن يكون التصنيف أبًا لنفسه' },
        { status: 400 }
      )
    }

    const updated = await db.expenseCategory.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
        ...(icon !== undefined ? { icon: icon || null } : {}),
        ...(color !== undefined ? { color: color || null } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { expenses: true, children: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'اسم التصنيف مُستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error updating expense category:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث التصنيف' },
      { status: 500 }
    )
  }
}

// DELETE /api/expense-categories/:id - Cascade protection (children + expenses)
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

    const existing = await db.expenseCategory.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { expenses: true, children: true, budgets: true, recurringExpenses: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'التصنيف غير موجود' }, { status: 404 })
    }

    if (
      existing._count.children > 0 ||
      existing._count.expenses > 0 ||
      existing._count.budgets > 0 ||
      existing._count.recurringExpenses > 0
    ) {
      return NextResponse.json(
        {
          error:
            'لا يمكن حذف التصنيف لوجود تصنيفات فرعية أو مصروفات أو ميزانيات مرتبطة به.',
        },
        { status: 409 }
      )
    }

    await db.expenseCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting expense category:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف التصنيف' },
      { status: 500 }
    )
  }
}
