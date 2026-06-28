import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/petty-cash - List funds with counts
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

    const funds = await db.pettyCash.findMany({
      where,
      include: {
        _count: { select: { transactions: true } },
      },
      orderBy: { openedAt: 'desc' },
    })

    return NextResponse.json({ funds })
  } catch (error) {
    console.error('Error fetching petty cash funds:', error)
    return NextResponse.json({ error: 'تعذر جلب صناديق العهد' }, { status: 500 })
  }
}

// POST /api/petty-cash - Create a new fund
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      custodianId,
      custodianName,
      openingBalance,
      maximumBalance,
      notes,
      active,
    } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'اسم الصندوق مطلوب' },
        { status: 400 }
      )
    }

    const opening = openingBalance !== undefined ? Number(openingBalance) : 0

    const created = await db.pettyCash.create({
      data: {
        schoolId,
        name: String(name).trim(),
        custodianId: custodianId || null,
        custodianName: custodianName || null,
        openingBalance: opening,
        currentBalance: opening,
        maximumBalance: maximumBalance !== undefined ? Number(maximumBalance) : null,
        notes: notes || null,
        active: active !== undefined ? Boolean(active) : true,
      },
      include: {
        _count: { select: { transactions: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'اسم الصندوق مُستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error creating petty cash fund:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء الصندوق' },
      { status: 500 }
    )
  }
}
