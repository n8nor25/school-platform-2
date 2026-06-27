import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

export async function PUT(
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

    const existing = await db.studentTransport.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const body = await request.json()
    const { status, endDate, direction, monthlyFee, notes } = body

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    if (direction !== undefined) data.direction = direction
    if (monthlyFee !== undefined) data.monthlyFee = Number(monthlyFee)
    if (notes !== undefined) data.notes = notes || null

    const updated = await db.studentTransport.update({
      where: { id },
      data,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            phone: true,
            parentPhone: true,
            parentPhone2: true,
            address: true,
            classroom: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            area: true,
            bus: { select: { id: true, plateNumber: true } },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: error?.message || 'Failed to update subscription' }, { status: 500 })
  }
}

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

    const existing = await db.studentTransport.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { payments: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    if (existing._count.payments > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف الاشتراك لوجود ${existing._count.payments} دفعة مسجلة.` },
        { status: 409 }
      )
    }

    await db.studentTransport.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete subscription' }, { status: 500 })
  }
}
