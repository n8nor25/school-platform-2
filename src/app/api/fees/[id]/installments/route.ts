import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/fees/[id]/installments - List installments for a fee
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

    const fee = await db.fee.findFirst({ where: { id, schoolId } })
    if (!fee) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    const installments = await db.feeInstallment.findMany({
      where: { feeId: id, schoolId },
      orderBy: { installmentNo: 'asc' },
      include: {
        _count: { select: { payments: true } },
      },
    })

    return NextResponse.json({ installments })
  } catch (error) {
    console.error('Error fetching installments:', error)
    return NextResponse.json({ error: 'Failed to fetch installments' }, { status: 500 })
  }
}

// POST /api/fees/[id]/installments - Add or update an installment (upsert)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const schoolId = await resolveSchoolId(body.schoolId)
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const fee = await db.fee.findFirst({ where: { id, schoolId } })
    if (!fee) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    if (body.installmentNo === undefined || body.amount === undefined || !body.dueDate) {
      return NextResponse.json(
        { error: 'installmentNo, amount, and dueDate are required' },
        { status: 400 }
      )
    }

    const installmentNo = Number(body.installmentNo)
    const amount = Number(body.amount)
    const dueDate = new Date(body.dueDate)

    const existing = await db.feeInstallment.findUnique({
      where: {
        schoolId_feeId_installmentNo: {
          schoolId,
          feeId: id,
          installmentNo,
        },
      },
    })

    let installment
    if (existing) {
      installment = await db.feeInstallment.update({
        where: { id: existing.id },
        data: { amount, dueDate },
      })
    } else {
      installment = await db.feeInstallment.create({
        data: {
          schoolId,
          feeId: id,
          installmentNo,
          amount,
          dueDate,
        },
      })
    }

    return NextResponse.json({ installment })
  } catch (error) {
    console.error('Error saving installment:', error)
    return NextResponse.json({ error: 'Failed to save installment' }, { status: 500 })
  }
}
