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

    const existing = await db.busRoute.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      busId,
      name,
      area,
      morningTime,
      afternoonTime,
      stops,
      monthlyFee,
      active,
    } = body

    if (busId) {
      const bus = await db.bus.findFirst({ where: { id: busId, schoolId } })
      if (!bus) {
        return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
      }
    }

    const data: Record<string, unknown> = {}
    if (busId !== undefined) data.busId = busId
    if (name !== undefined) data.name = String(name)
    if (area !== undefined) data.area = String(area)
    if (morningTime !== undefined) data.morningTime = morningTime || null
    if (afternoonTime !== undefined) data.afternoonTime = afternoonTime || null
    if (stops !== undefined) {
      data.stops = Array.isArray(stops) ? JSON.stringify(stops) : (stops || '[]')
    }
    if (monthlyFee !== undefined) data.monthlyFee = Number(monthlyFee)
    if (active !== undefined) data.active = Boolean(active)

    const updated = await db.busRoute.update({
      where: { id },
      data,
      include: {
        bus: { select: { id: true, plateNumber: true, driverName: true } },
        _count: { select: { subscriptions: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating bus route:', error)
    return NextResponse.json({ error: error?.message || 'Failed to update route' }, { status: 500 })
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

    const existing = await db.busRoute.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { subscriptions: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    if (existing._count.subscriptions > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف الخط لوجود ${existing._count.subscriptions} اشتراك مرتبط به.` },
        { status: 409 }
      )
    }

    await db.busRoute.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting bus route:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete route' }, { status: 500 })
  }
}
