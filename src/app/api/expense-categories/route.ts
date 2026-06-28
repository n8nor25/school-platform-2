import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expense-categories - List categories for school with counts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const active = searchParams.get('active')

    const where: Record<string, unknown> = { schoolId }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false

    const categories = await db.expenseCategory.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true } },
        _count: {
          select: { expenses: true, children: true, budgets: true, recurringExpenses: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json({ error: 'تعذر جلب التصنيفات' }, { status: 500 })
  }
}

// POST /api/expense-categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { name, parentId, icon, color, sortOrder, active } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'اسم التصنيف مطلوب' },
        { status: 400 }
      )
    }

    const created = await db.expenseCategory.create({
      data: {
        schoolId,
        name: String(name).trim(),
        parentId: parentId || null,
        icon: icon || null,
        color: color || null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
        active: active !== undefined ? Boolean(active) : true,
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { expenses: true, children: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'اسم التصنيف مُستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error creating expense category:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء التصنيف' },
      { status: 500 }
    )
  }
}
