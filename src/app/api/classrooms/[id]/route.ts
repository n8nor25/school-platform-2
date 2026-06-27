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
    if ('gradeLevel' in body) updateData.gradeLevel = body.gradeLevel
    if ('section' in body) updateData.section = body.section
    if ('capacity' in body) updateData.capacity = body.capacity
    if ('teacherId' in body) updateData.teacherId = body.teacherId || null

    const classroom = await db.classroom.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(classroom)
  } catch (error) {
    console.error('Error updating classroom:', error)
    return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.classroom.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting classroom:', error)
    return NextResponse.json({ error: 'Failed to delete classroom' }, { status: 500 })
  }
}
