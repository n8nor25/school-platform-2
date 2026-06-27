import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // If setting as active, deactivate others in the same school
    if (body.isActive) {
      const current = await db.academicYear.findUnique({ where: { id } })
      if (current) {
        await db.academicYear.updateMany({
          where: { schoolId: current.schoolId, isActive: true },
          data: { isActive: false },
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if ('name' in body) updateData.name = body.name
    if ('startDate' in body) updateData.startDate = new Date(body.startDate)
    if ('endDate' in body) updateData.endDate = new Date(body.endDate)
    if ('isActive' in body) updateData.isActive = body.isActive

    const academicYear = await db.academicYear.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(academicYear)
  } catch (error) {
    console.error('Error updating academic year:', error)
    return NextResponse.json({ error: 'Failed to update academic year' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.academicYear.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting academic year:', error)
    return NextResponse.json({ error: 'Failed to delete academic year' }, { status: 500 })
  }
}
