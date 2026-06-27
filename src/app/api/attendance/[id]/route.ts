import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// PUT /api/attendance/[id] - Update an attendance record
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

    const existing = await db.attendance.findFirst({
      where: { id, schoolId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    const updated = await db.attendance.update({
      where: { id },
      data: {
        status: body.status !== undefined ? body.status : existing.status,
        arrivalTime: body.arrivalTime !== undefined ? body.arrivalTime : existing.arrivalTime,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        recordedBy: body.recordedBy !== undefined ? body.recordedBy : existing.recordedBy,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating attendance record:', error)
    return NextResponse.json({ error: 'Failed to update attendance record' }, { status: 500 })
  }
}

// DELETE /api/attendance/[id] - Delete an attendance record
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

    const existing = await db.attendance.findFirst({
      where: { id, schoolId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    await db.attendance.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attendance record:', error)
    return NextResponse.json({ error: 'Failed to delete attendance record' }, { status: 500 })
  }
}
