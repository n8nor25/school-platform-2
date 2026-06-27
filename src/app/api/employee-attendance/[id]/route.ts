import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/employee-attendance/[id]
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

    const existing = await db.employeeAttendance.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const updated = await db.employeeAttendance.update({
      where: { id },
      data: {
        status: body.status !== undefined ? body.status : existing.status,
        checkIn: body.checkIn !== undefined ? body.checkIn : existing.checkIn,
        checkOut: body.checkOut !== undefined ? body.checkOut : existing.checkOut,
        leaveType: body.leaveType !== undefined ? body.leaveType : existing.leaveType,
        leaveDuration: body.leaveDuration !== undefined ? body.leaveDuration : existing.leaveDuration,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        recordedBy: body.recordedBy !== undefined ? body.recordedBy : existing.recordedBy,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating employee attendance:', error)
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
  }
}

// DELETE /api/employee-attendance/[id]
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

    const existing = await db.employeeAttendance.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    await db.employeeAttendance.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting employee attendance:', error)
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
  }
}
