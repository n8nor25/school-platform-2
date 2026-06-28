import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/petty-cash/:id - Single fund with recent transactions
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

    const fund = await db.pettyCash.findFirst({
      where: { id, schoolId },
      include: {
        transactions: {
          take: 50,
          orderBy: { date: 'desc' },
          include: {
            expense: { select: { id: true, title: true, amount: true } },
          },
        },
        _count: { select: { transactions: true } },
      },
    })

    if (!fund) {
      return NextResponse.json({ error: 'الصندوق غير موجود' }, { status: 404 })
    }

    return NextResponse.json(fund)
  } catch (error) {
    console.error('Error fetching petty cash fund:', error)
    return NextResponse.json({ error: 'تعذر جلب الصندوق' }, { status: 500 })
  }
}

// PUT /api/petty-cash/:id - Update fund metadata
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

    const existing = await db.pettyCash.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الصندوق غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      custodianId,
      custodianName,
      maximumBalance,
      active,
      notes,
      currentBalance,
      closedAt,
    } = body

    const updated = await db.pettyCash.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(custodianId !== undefined ? { custodianId: custodianId || null } : {}),
        ...(custodianName !== undefined ? { custodianName: custodianName || null } : {}),
        ...(maximumBalance !== undefined ? { maximumBalance: maximumBalance ? Number(maximumBalance) : null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(currentBalance !== undefined ? { currentBalance: Number(currentBalance) } : {}),
        ...(closedAt !== undefined ? { closedAt: closedAt ? new Date(closedAt) : null } : {}),
      },
      include: {
        _count: { select: { transactions: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'اسم الصندوق مُستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error updating petty cash fund:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث الصندوق' },
      { status: 500 }
    )
  }
}

// DELETE /api/petty-cash/:id - Cascade protection (transactions)
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

    const existing = await db.pettyCash.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { transactions: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'الصندوق غير موجود' }, { status: 404 })
    }

    if (existing._count.transactions > 0) {
      return NextResponse.json(
        {
          error: `لا يمكن حذف الصندوق لوجود ${existing._count.transactions} حركة مرتبطة به.`,
        },
        { status: 409 }
      )
    }

    await db.pettyCash.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting petty cash fund:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف الصندوق' },
      { status: 500 }
    )
  }
}
