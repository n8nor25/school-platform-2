import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const busId = searchParams.get('busId')
    const search = searchParams.get('search')?.trim() || ''
    const active = searchParams.get('active')

    const where: Record<string, unknown> = { schoolId }
    if (busId) where.busId = busId
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { area: { contains: search } },
      ]
    }

    const routes = await db.busRoute.findMany({
      where,
      include: {
        bus: { select: { id: true, plateNumber: true, driverName: true } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ routes })
  } catch (error) {
    console.error('Error fetching bus routes:', error)
    return NextResponse.json({ error: 'Failed to fetch bus routes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
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

    if (!busId || !name || !area) {
      return NextResponse.json(
        { error: 'busId, name and area are required' },
        { status: 400 }
      )
    }

    // Validate bus belongs to school
    const bus = await db.bus.findFirst({ where: { id: busId, schoolId } })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const stopsStr = Array.isArray(stops) ? JSON.stringify(stops) : (stops || '[]')

    const created = await db.busRoute.create({
      data: {
        schoolId,
        busId,
        name: String(name),
        area: String(area),
        morningTime: morningTime || null,
        afternoonTime: afternoonTime || null,
        stops: stopsStr,
        monthlyFee: monthlyFee ? Number(monthlyFee) : 0,
        active: active !== undefined ? Boolean(active) : true,
      },
      include: {
        bus: { select: { id: true, plateNumber: true, driverName: true } },
        _count: { select: { subscriptions: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('Error creating bus route:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create bus route' }, { status: 500 })
  }
}
