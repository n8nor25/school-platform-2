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

    const search = searchParams.get('search')?.trim() || ''
    const active = searchParams.get('active')

    const where: Record<string, unknown> = { schoolId }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (search) {
      where.OR = [
        { plateNumber: { contains: search } },
        { driverName: { contains: search } },
      ]
    }

    const buses = await db.bus.findMany({
      where,
      include: {
        _count: { select: { routes: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ buses })
  } catch (error) {
    console.error('Error fetching buses:', error)
    return NextResponse.json({ error: 'Failed to fetch buses' }, { status: 500 })
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
      plateNumber,
      driverName,
      driverPhone,
      driverLicense,
      supervisorName,
      supervisorPhone,
      capacity,
      model,
      color,
      notes,
      active,
    } = body

    if (!plateNumber || !driverName) {
      return NextResponse.json(
        { error: 'plateNumber and driverName are required' },
        { status: 400 }
      )
    }

    const created = await db.bus.create({
      data: {
        schoolId,
        plateNumber: String(plateNumber),
        driverName: String(driverName),
        driverPhone: driverPhone || null,
        driverLicense: driverLicense || null,
        supervisorName: supervisorName || null,
        supervisorPhone: supervisorPhone || null,
        capacity: capacity ? Number(capacity) : 30,
        model: model || null,
        color: color || null,
        notes: notes || null,
        active: active !== undefined ? Boolean(active) : true,
      },
      include: { _count: { select: { routes: true } } },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'رقم اللوحة مُستخدم بالفعل لهذه المدرسة' },
        { status: 409 }
      )
    }
    console.error('Error creating bus:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create bus' }, { status: 500 })
  }
}
