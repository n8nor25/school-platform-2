import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/petty-cash/:id/transactions - List transactions for fund
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

    // Ensure fund belongs to school
    const fund = await db.pettyCash.findFirst({ where: { id, schoolId } })
    if (!fund) {
      return NextResponse.json({ error: 'الصندوق غير موجود' }, { status: 404 })
    }

    const type = searchParams.get('type')
    const where: Record<string, unknown> = { pettyCashId: id, schoolId }
    if (type) where.type = type

    const transactions = await db.pettyCashTransaction.findMany({
      where,
      include: {
        expense: { select: { id: true, title: true, amount: true } },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Error fetching petty cash transactions:', error)
    return NextResponse.json({ error: 'تعذر جلب حركات العهد' }, { status: 500 })
  }
}

// POST /api/petty-cash/:id/transactions - Record a transaction
export async function POST(
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

    const fund = await db.pettyCash.findFirst({ where: { id, schoolId } })
    if (!fund) {
      return NextResponse.json({ error: 'الصندوق غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const { type, amount, expenseId, recipient, date, reference, notes, createdBy } = body

    const validTypes = ['صرف', 'تغذية', 'تسوية']
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'نوع الحركة غير صالح (صرف / تغذية / تسوية)' },
        { status: 400 }
      )
    }
    if (amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json(
        { error: 'المبلغ مطلوب' },
        { status: 400 }
      )
    }
    if (!date) {
      return NextResponse.json(
        { error: 'تاريخ الحركة مطلوب' },
        { status: 400 }
      )
    }

    const amt = Math.abs(Number(amount))
    let balanceAfter: number
    let newFundBalance: number

    if (type === 'صرف') {
      balanceAfter = fund.currentBalance - amt
      newFundBalance = balanceAfter
    } else if (type === 'تغذية') {
      balanceAfter = fund.currentBalance + amt
      newFundBalance = balanceAfter
    } else {
      // تسوية: set absolute value
      balanceAfter = amt
      newFundBalance = amt
    }

    // Create the transaction and update the fund balance atomically
    const [created] = await db.$transaction([
      db.pettyCashTransaction.create({
        data: {
          pettyCashId: id,
          schoolId,
          type: String(type),
          amount: amt,
          expenseId: expenseId || null,
          recipient: recipient || null,
          date: new Date(date),
          reference: reference || null,
          notes: notes || null,
          balanceAfter,
          createdBy: createdBy || null,
        },
        include: {
          expense: { select: { id: true, title: true, amount: true } },
        },
      }),
      db.pettyCash.update({
        where: { id },
        data: { currentBalance: newFundBalance },
      }),
    ])

    return NextResponse.json({ transaction: created }, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error creating petty cash transaction:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تسجيل الحركة' },
      { status: 500 }
    )
  }
}
