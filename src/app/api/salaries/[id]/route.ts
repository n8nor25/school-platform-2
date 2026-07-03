import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/salaries/[id] - Update a salary record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const existing = await db.salary.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }

    const basicSalary = body.basicSalary !== undefined ? parseFloat(body.basicSalary) : existing.basicSalary
    const allowances = body.allowances !== undefined ? parseFloat(body.allowances) : existing.allowances
    const overtime = body.overtime !== undefined ? parseFloat(body.overtime) : existing.overtime
    const bonus = body.bonus !== undefined ? parseFloat(body.bonus) : existing.bonus
    const deductions = body.deductions !== undefined ? parseFloat(body.deductions) : existing.deductions
    const advancePayment = body.advancePayment !== undefined ? parseFloat(body.advancePayment) : existing.advancePayment
    const insurance = body.insurance !== undefined ? parseFloat(body.insurance) : existing.insurance
    const taxes = body.taxes !== undefined ? parseFloat(body.taxes) : existing.taxes

    // Determine if any financial fields changed to recalculate netSalary
    const financialFieldsChanged = [
      'basicSalary', 'allowances', 'overtime', 'bonus',
      'deductions', 'advancePayment', 'insurance', 'taxes',
    ].some(field => body[field] !== undefined)

    // Recalculate netSalary if financial fields changed, otherwise use provided or existing value
    let netSalary: number
    if (body.netSalary !== undefined) {
      netSalary = parseFloat(body.netSalary)
    } else if (financialFieldsChanged) {
      netSalary = basicSalary + allowances + overtime + bonus - deductions - advancePayment - insurance - taxes
    } else {
      netSalary = existing.netSalary
    }

    const updated = await db.salary.update({
      where: { id },
      data: {
        month: body.month !== undefined ? parseInt(body.month) : existing.month,
        year: body.year !== undefined ? parseInt(body.year) : existing.year,
        basicSalary,
        allowances,
        overtime,
        bonus,
        deductions,
        advancePayment,
        insurance,
        taxes,
        netSalary,
        paymentDate: body.paymentDate !== undefined
          ? (body.paymentDate ? new Date(body.paymentDate) : null)
          : existing.paymentDate,
        paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
        status: body.status !== undefined ? body.status : existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            jobTitle: true,
            department: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating salary:', error)
    return NextResponse.json({ error: 'Failed to update salary' }, { status: 500 })
  }
}

// DELETE /api/salaries/[id] - Hard delete a salary record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const existing = await db.salary.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }

    // Hard delete salary records
    await db.salary.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting salary:', error)
    return NextResponse.json({ error: 'Failed to delete salary' }, { status: 500 })
  }
}
