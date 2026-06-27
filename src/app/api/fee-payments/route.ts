import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/fee-payments - List payments with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { schoolId }

    const studentId = searchParams.get('studentId')
    if (studentId) where.studentId = studentId

    const feeId = searchParams.get('feeId')
    if (feeId) where.feeId = feeId

    const studentFeeId = searchParams.get('studentFeeId')
    if (studentFeeId) where.studentFeeId = studentFeeId

    const installmentId = searchParams.get('installmentId')
    if (installmentId) where.installmentId = installmentId

    const paymentMethod = searchParams.get('paymentMethod')
    if (paymentMethod) where.paymentMethod = paymentMethod

    const month = searchParams.get('month')
    const year = searchParams.get('year')
    if (month || year) {
      const dateFilter: Record<string, unknown> = {}
      if (month && year) {
        const m = Number(month)
        const y = Number(year)
        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59, 999)
        where.paymentDate = { gte: start, lte: end }
      } else if (year) {
        const y = Number(year)
        const start = new Date(y, 0, 1)
        const end = new Date(y, 11, 31, 23, 59, 59, 999)
        where.paymentDate = { gte: start, lte: end }
      }
      void dateFilter
    }

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    if (fromDate || toDate) {
      const dateRange: Record<string, unknown> = {}
      if (fromDate) {
        const start = new Date(fromDate)
        start.setHours(0, 0, 0, 0)
        dateRange.gte = start
      }
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        dateRange.lte = end
      }
      where.paymentDate = dateRange
    }

    const search = searchParams.get('search')
    if (search) {
      where.receiptNumber = { contains: search, mode: 'insensitive' }
    }

    const payments = await db.feePayment.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, studentNumber: true, classroom: { select: { name: true, gradeLevel: true } } },
        },
        fee: { select: { id: true, name: true, feeType: true } },
        studentFee: { select: { id: true, totalAmount: true } },
        installment: { select: { id: true, installmentNo: true, amount: true, dueDate: true } },
      },
      orderBy: { paymentDate: 'desc' },
    })

    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Error fetching fee payments:', error)
    return NextResponse.json({ error: 'Failed to fetch fee payments' }, { status: 500 })
  }
}

// POST /api/fee-payments - Record a payment; auto-generate receiptNumber if missing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolId = await resolveSchoolId(body.schoolId)
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    if (!body.feeId || !body.studentId || body.amount === undefined || !body.paymentDate) {
      return NextResponse.json(
        { error: 'feeId, studentId, amount, and paymentDate are required' },
        { status: 400 }
      )
    }

    // Validate fee and student belong to school
    const [fee, student] = await Promise.all([
      db.fee.findFirst({ where: { id: body.feeId, schoolId } }),
      db.student.findFirst({ where: { id: body.studentId, schoolId } }),
    ])

    if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    // Auto-generate receipt number: REC-{year}-{6-digit sequential}
    let receiptNumber = body.receiptNumber
    if (!receiptNumber) {
      const year = new Date().getFullYear()
      const prefix = `REC-${year}-`
      const lastPayment = await db.feePayment.findFirst({
        where: {
          schoolId,
          receiptNumber: { startsWith: prefix },
        },
        orderBy: { receiptNumber: 'desc' },
      })

      let seq = 1
      if (lastPayment?.receiptNumber) {
        const parts = lastPayment.receiptNumber.split('-')
        const lastSeq = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(lastSeq)) seq = lastSeq + 1
      }
      receiptNumber = `${prefix}${String(seq).padStart(6, '0')}`
    }

    const payment = await db.feePayment.create({
      data: {
        schoolId,
        feeId: body.feeId,
        studentId: body.studentId,
        studentFeeId: body.studentFeeId || null,
        installmentId: body.installmentId || null,
        amount: Number(body.amount),
        paymentDate: new Date(body.paymentDate),
        paymentMethod: body.paymentMethod || 'نقدي',
        receiptNumber,
        installmentNo: Number(body.installmentNo || 1),
        notes: body.notes || null,
        createdBy: body.createdBy || null,
      },
      include: {
        student: { select: { name: true, studentNumber: true } },
        fee: { select: { name: true, feeType: true } },
        installment: { select: { installmentNo: true, amount: true, dueDate: true } },
      },
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    console.error('Error creating fee payment:', error)
    return NextResponse.json({ error: 'Failed to create fee payment' }, { status: 500 })
  }
}
