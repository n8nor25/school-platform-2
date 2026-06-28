import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/fees/[id] - Get fee by id with installments and count
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

    const fee = await db.fee.findFirst({
      where: { id, schoolId },
      include: {
        feeInstallments: { orderBy: { installmentNo: 'asc' } },
        academicYear: { select: { name: true } },
        _count: {
          select: {
            studentFees: true,
            payments: true,
          },
        },
      },
    })

    if (!fee) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    return NextResponse.json({ fee })
  } catch (error) {
    console.error('Error fetching fee:', error)
    return NextResponse.json({ error: 'Failed to fetch fee' }, { status: 500 })
  }
}

// PUT /api/fees/[id] - Update fee; recalc installments if totalAmount or installments change
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

    const existing = await db.fee.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.gradeLevel !== undefined) updateData.gradeLevel = body.gradeLevel || null
    if (body.feeType !== undefined) updateData.feeType = body.feeType
    if (body.academicYearId !== undefined) updateData.academicYearId = body.academicYearId
    if (body.active !== undefined) updateData.active = !!body.active

    const newTotal = body.totalAmount !== undefined ? Number(body.totalAmount) : existing.totalAmount
    const newInstallmentsCount =
      body.installments !== undefined
        ? Number(body.installments) > 0
          ? Number(body.installments)
          : 1
        : existing.installments

    const totalChanged = newTotal !== existing.totalAmount
    const installmentsChanged = newInstallmentsCount !== existing.installments

    let newInstallmentAmount = existing.installmentAmount
    if (body.installmentAmount !== undefined && body.installmentAmount !== null) {
      newInstallmentAmount = Number(body.installmentAmount)
    } else if (totalChanged || installmentsChanged) {
      newInstallmentAmount = newTotal / newInstallmentsCount
    }

    updateData.totalAmount = newTotal
    updateData.installments = newInstallmentsCount
    updateData.installmentAmount = newInstallmentAmount

    // Update dueDates if provided
    let dueDates: string[] = []
    if (body.dueDates !== undefined) {
      if (Array.isArray(body.dueDates)) {
        dueDates = body.dueDates.filter(
          (d: unknown): d is string => typeof d === 'string' && d !== ''
        )
      } else if (typeof body.dueDates === 'string') {
        try {
          const parsed = JSON.parse(body.dueDates)
          if (Array.isArray(parsed)) {
            dueDates = parsed.filter(
              (d: unknown): d is string => typeof d === 'string' && d !== ''
            )
          }
        } catch {
          dueDates = []
        }
      }
      updateData.dueDates = JSON.stringify(dueDates)
    } else {
      // Use existing
      try {
        dueDates = JSON.parse(existing.dueDates || '[]')
      } catch {
        dueDates = []
      }
    }

    // Update the fee record
    const updated = await db.fee.update({
      where: { id },
      data: updateData,
    })

    // If installments changed or dueDates changed, recalc FeeInstallment records
    if (installmentsChanged || body.dueDates !== undefined || totalChanged) {
      // Delete existing installments and recreate
      await db.feeInstallment.deleteMany({ where: { feeId: id, schoolId } })

      const installmentsToCreate = []
      const limit = Math.max(newInstallmentsCount, dueDates.length)
      for (let i = 0; i < limit; i++) {
        const dueDateStr = dueDates[i] || new Date().toISOString()
        installmentsToCreate.push({
          schoolId,
          feeId: id,
          installmentNo: i + 1,
          amount: newInstallmentAmount || 0,
          dueDate: new Date(dueDateStr),
        })
      }

      if (installmentsToCreate.length > 0) {
        await db.feeInstallment.createMany({ data: installmentsToCreate })
      }
    }

    const result = await db.fee.findUnique({
      where: { id },
      include: {
        feeInstallments: { orderBy: { installmentNo: 'asc' } },
        _count: { select: { studentFees: true } },
      },
    })

    return NextResponse.json({ fee: result })
  } catch (error) {
    console.error('Error updating fee:', error)
    return NextResponse.json({ error: 'Failed to update fee' }, { status: 500 })
  }
}

// DELETE /api/fees/[id] - Delete fee if no payments exist
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

    const existing = await db.fee.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
    }

    const paymentCount = await db.feePayment.count({
      where: { feeId: id, schoolId },
    })

    if (paymentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete fee with existing payments. Delete payments first.' },
        { status: 409 }
      )
    }

    // Cascade delete installments and student fees
    await db.feeInstallment.deleteMany({ where: { feeId: id, schoolId } })
    await db.studentFee.deleteMany({ where: { feeId: id, schoolId } })
    await db.fee.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting fee:', error)
    return NextResponse.json({ error: 'Failed to delete fee' }, { status: 500 })
  }
}
