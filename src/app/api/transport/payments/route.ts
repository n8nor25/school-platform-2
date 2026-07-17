import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const subscriptionId = searchParams.get('subscriptionId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const search = searchParams.get('search')?.trim() || ''

    const where: Record<string, unknown> = { schoolId }
    if (subscriptionId) where.subscriptionId = subscriptionId
    if (month) where.month = Number(month)
    if (year) where.year = Number(year)
    if (search) {
      where.receiptNumber = { contains: search }
    }

    const payments = await db.transportPayment.findMany({
      where,
      include: {
        subscription: {
          select: {
            id: true,
            student: { select: { id: true, name: true, studentNumber: true } },
            route: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Error fetching transport payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      subscriptionId,
      month,
      year,
      amount,
      paymentDate,
      paymentMethod,
      receiptNumber,
      notes,
      createdBy,
    } = body

    if (!subscriptionId || !month || !year || amount === undefined || !paymentDate) {
      return NextResponse.json(
        { error: 'subscriptionId, month, year, amount and paymentDate are required' },
        { status: 400 }
      )
    }

    const sub = await db.studentTransport.findFirst({
      where: { id: subscriptionId, schoolId },
    })
    if (!sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Auto-generate receipt number if missing: TR-{year}-{sequential}
    let finalReceipt = receiptNumber || null
    if (!finalReceipt) {
      const count = await db.transportPayment.count({
        where: { schoolId, year: Number(year) },
      })
      finalReceipt = `TR-${year}-${String(count + 1).padStart(4, '0')}`
    }

    const created = await db.transportPayment.create({
      data: {
        schoolId,
        subscriptionId,
        month: Number(month),
        year: Number(year),
        amount: Number(amount),
        paymentDate: new Date(paymentDate),
        paymentMethod: paymentMethod || 'نقدي',
        receiptNumber: finalReceipt,
        notes: notes || null,
        createdBy: createdBy || null,
      },
      include: {
        subscription: {
          select: {
            id: true,
            student: { select: { id: true, name: true, studentNumber: true } },
            route: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'تم تسجيل دفعة لهذا الشهر بالفعل لهذا الاشتراك' },
        { status: 409 }
      )
    }
    console.error('Error creating transport payment:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create payment' }, { status: 500 })
  }
}
