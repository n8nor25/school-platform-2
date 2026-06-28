import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/student-fees/[id] - Update discount, recalculate totalAmount
export async function PUT(
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

    const existing = await db.studentFee.findFirst({
      where: { id, schoolId },
      include: { fee: { select: { totalAmount: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const discountType =
      body.discountType !== undefined ? body.discountType || null : existing.discountType
    const discountValue =
      body.discountValue !== undefined
        ? body.discountValue !== null && body.discountValue !== ''
          ? Number(body.discountValue)
          : null
        : existing.discountValue
    const discountReason =
      body.discountReason !== undefined ? body.discountReason || null : existing.discountReason

    // Recompute totalAmount
    const feeTotal = existing.fee.totalAmount
    let totalAmount = feeTotal
    if (!discountType || discountType === 'بدون') {
      totalAmount = feeTotal
    } else if (discountType === 'إعفاء') {
      totalAmount = 0
    } else if (discountType === 'نسبة') {
      totalAmount = Math.max(0, feeTotal - (feeTotal * (discountValue || 0)) / 100)
    } else if (discountType === 'ثابت') {
      totalAmount = Math.max(0, feeTotal - (discountValue || 0))
    }

    const updated = await db.studentFee.update({
      where: { id },
      data: {
        discountType,
        discountValue,
        discountReason,
        totalAmount,
      },
      include: {
        student: { select: { name: true, studentNumber: true } },
        fee: { select: { name: true, feeType: true } },
      },
    })

    return NextResponse.json({ assignment: updated })
  } catch (error) {
    console.error('Error updating student fee:', error)
    return NextResponse.json({ error: 'Failed to update student fee' }, { status: 500 })
  }
}

// DELETE /api/student-fees/[id] - Remove assignment if no payments
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

    const existing = await db.studentFee.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const paymentCount = await db.feePayment.count({
      where: { studentFeeId: id, schoolId },
    })

    if (paymentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete assignment with existing payments.' },
        { status: 409 }
      )
    }

    await db.studentFee.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting student fee:', error)
    return NextResponse.json({ error: 'Failed to delete student fee' }, { status: 500 })
  }
}
