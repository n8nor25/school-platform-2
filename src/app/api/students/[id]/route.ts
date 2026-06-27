import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    if ('name' in body) updateData.name = body.name
    if ('studentNumber' in body) updateData.studentNumber = body.studentNumber
    if ('nationalId' in body) updateData.nationalId = body.nationalId
    if ('dateOfBirth' in body) updateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null
    if ('gender' in body) updateData.gender = body.gender
    if ('address' in body) updateData.address = body.address
    if ('phone' in body) updateData.phone = body.phone
    if ('parentName' in body) updateData.parentName = body.parentName
    if ('parentPhone' in body) updateData.parentPhone = body.parentPhone
    if ('parentNationalId' in body) updateData.parentNationalId = body.parentNationalId
    if ('enrollDate' in body) updateData.enrollDate = body.enrollDate ? new Date(body.enrollDate) : undefined
    if ('status' in body) updateData.status = body.status
    if ('previousSchool' in body) updateData.previousSchool = body.previousSchool
    if ('notes' in body) updateData.notes = body.notes
    if ('classroomId' in body) updateData.classroomId = body.classroomId || null
    if ('archived' in body) updateData.archived = body.archived

    const student = await db.student.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(student)
  } catch (error) {
    console.error('Error updating student:', error)
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.student.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting student:', error)
    return NextResponse.json({ error: 'Failed to delete student' }, { status: 500 })
  }
}
