import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/student-fees - List student fee assignments
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

    const gradeLevel = searchParams.get('gradeLevel')
    const studentWhere: Record<string, unknown> = {}
    if (gradeLevel) {
      studentWhere.classroom = { gradeLevel }
    }

    const search = searchParams.get('search')
    if (search) {
      studentWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere
    }

    const assignments = await db.studentFee.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            classroom: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
        fee: {
          select: {
            id: true,
            name: true,
            feeType: true,
            totalAmount: true,
            installments: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            receiptNumber: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })

    // Aggregate payments per assignment
    const enriched = assignments.map((a) => {
      const totalPaid = a.payments.reduce((sum, p) => sum + p.amount, 0)
      const remaining = a.totalAmount - totalPaid
      return {
        ...a,
        totalPaid,
        remaining,
        paymentsCount: a.payments.length,
        status: remaining <= 0 ? 'مدفوع' : totalPaid > 0 ? 'جزئي' : 'غير مدفوع',
      }
    })

    return NextResponse.json({ assignments: enriched })
  } catch (error) {
    console.error('Error fetching student fees:', error)
    return NextResponse.json({ error: 'Failed to fetch student fees' }, { status: 500 })
  }
}

// POST /api/student-fees - Assign fee to student(s): single or bulk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolId = await resolveSchoolId(body.schoolId)
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    if (!body.feeId) {
      return NextResponse.json({ error: 'feeId is required' }, { status: 400 })
    }

    // Load the fee to compute discount
    const fee = await db.fee.findFirst({ where: { id: body.feeId, schoolId } })
    if (!fee) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    // Compute totalAmount after discount
    const computeTotal = (feeTotal: number): number => {
      const discountType = body.discountType
      const discountValue = Number(body.discountValue || 0)
      if (!discountType || discountType === 'إعفاء') return 0
      if (discountType === 'نسبة') {
        return Math.max(0, feeTotal - (feeTotal * discountValue) / 100)
      }
      if (discountType === 'ثابت') {
        return Math.max(0, feeTotal - discountValue)
      }
      return feeTotal
    }

    const totalAmount = computeTotal(fee.totalAmount)

    // Single mode
    if (body.studentId) {
      const existing = await db.studentFee.findUnique({
        where: {
          schoolId_studentId_feeId: {
            schoolId,
            studentId: body.studentId,
            feeId: body.feeId,
          },
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'This fee is already assigned to this student' },
          { status: 409 }
        )
      }

      // Verify student belongs to school
      const student = await db.student.findFirst({
        where: { id: body.studentId, schoolId },
      })
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      const assignment = await db.studentFee.create({
        data: {
          schoolId,
          studentId: body.studentId,
          feeId: body.feeId,
          totalAmount,
          discountType: body.discountType || null,
          discountValue: body.discountValue ? Number(body.discountValue) : null,
          discountReason: body.discountReason || null,
        },
        include: {
          student: { select: { name: true, studentNumber: true } },
          fee: { select: { name: true, feeType: true } },
        },
      })

      return NextResponse.json({ assignment }, { status: 201 })
    }

    // Bulk mode
    if (Array.isArray(body.studentIds) && body.studentIds.length > 0) {
      const results = { created: 0, skipped: 0, errors: [] as string[] }

      for (const studentId of body.studentIds) {
        try {
          const existing = await db.studentFee.findUnique({
            where: {
              schoolId_studentId_feeId: {
                schoolId,
                studentId,
                feeId: body.feeId,
              },
            },
          })

          if (existing) {
            results.skipped++
            continue
          }

          await db.studentFee.create({
            data: {
              schoolId,
              studentId,
              feeId: body.feeId,
              totalAmount,
              discountType: body.discountType || null,
              discountValue: body.discountValue ? Number(body.discountValue) : null,
              discountReason: body.discountReason || null,
            },
          })
          results.created++
        } catch (err) {
          console.error('Error assigning fee to student:', studentId, err)
          results.errors.push(studentId)
        }
      }

      return NextResponse.json(results, { status: 201 })
    }

    return NextResponse.json(
      { error: 'Either studentId or studentIds[] is required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error assigning fee:', error)
    return NextResponse.json({ error: 'Failed to assign fee' }, { status: 500 })
  }
}
