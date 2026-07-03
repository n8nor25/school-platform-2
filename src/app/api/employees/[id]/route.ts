import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/employees/[id] - Update an employee
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

    const existing = await db.employee.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // If employeeNumber is being changed, check for uniqueness
    if (body.employeeNumber && body.employeeNumber !== existing.employeeNumber) {
      const duplicate = await db.employee.findUnique({
        where: { schoolId_employeeNumber: { schoolId, employeeNumber: body.employeeNumber } },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'Employee number already exists' }, { status: 409 })
      }
    }

    const updated = await db.employee.update({
      where: { id },
      data: {
        employeeNumber: body.employeeNumber !== undefined ? body.employeeNumber : existing.employeeNumber,
        name: body.name !== undefined ? body.name : existing.name,
        nationalId: body.nationalId !== undefined ? body.nationalId : existing.nationalId,
        jobTitle: body.jobTitle !== undefined ? body.jobTitle : existing.jobTitle,
        department: body.department !== undefined ? body.department : existing.department,
        qualification: body.qualification !== undefined ? body.qualification : existing.qualification,
        specialization: body.specialization !== undefined ? body.specialization : existing.specialization,
        hireDate: body.hireDate !== undefined ? (body.hireDate ? new Date(body.hireDate) : null) : existing.hireDate,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        email: body.email !== undefined ? body.email : existing.email,
        address: body.address !== undefined ? body.address : existing.address,
        salary: body.salary !== undefined ? body.salary : existing.salary,
        allowances: body.allowances !== undefined ? body.allowances : existing.allowances,
        deductions: body.deductions !== undefined ? body.deductions : existing.deductions,
        contractType: body.contractType !== undefined ? body.contractType : existing.contractType,
        status: body.status !== undefined ? body.status : existing.status,
        bankName: body.bankName !== undefined ? body.bankName : existing.bankName,
        bankAccount: body.bankAccount !== undefined ? body.bankAccount : existing.bankAccount,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating employee:', error)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

// DELETE /api/employees/[id] - Soft delete an employee (archive)
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

    const existing = await db.employee.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Soft delete by archiving
    const archived = await db.employee.update({
      where: { id },
      data: { archived: true },
    })

    return NextResponse.json({ success: true, archived })
  } catch (error) {
    console.error('Error deleting employee:', error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
