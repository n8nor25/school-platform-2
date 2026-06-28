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

    const existing = await db.bus.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const updated = await db.bus.update({
      where: { id },
      data: {
        ...(plateNumber !== undefined ? { plateNumber: String(plateNumber) } : {}),
        ...(driverName !== undefined ? { driverName: String(driverName) } : {}),
        ...(driverPhone !== undefined ? { driverPhone: driverPhone || null } : {}),
        ...(driverLicense !== undefined ? { driverLicense: driverLicense || null } : {}),
        ...(supervisorName !== undefined ? { supervisorName: supervisorName || null } : {}),
        ...(supervisorPhone !== undefined ? { supervisorPhone: supervisorPhone || null } : {}),
        ...(capacity !== undefined ? { capacity: Number(capacity) } : {}),
        ...(model !== undefined ? { model: model || null } : {}),
        ...(color !== undefined ? { color: color || null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
      include: { _count: { select: { routes: true } } },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'رقم اللوحة مُستخدم بالفعل لهذه المدرسة' },
        { status: 409 }
      )
    }
    console.error('Error updating bus:', error)
    return NextResponse.json({ error: error?.message || 'Failed to update bus' }, { status: 500 })
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

    const existing = await db.bus.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { routes: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    if (existing._count.routes > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف الباص لوجود ${existing._count.routes} خط مرتبط به. احذف الخطوط أولاً.` },
        { status: 409 }
      )
    }

    await db.bus.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting bus:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete bus' }, { status: 500 })
  }
}
