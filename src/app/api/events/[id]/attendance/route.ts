import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/events/:id/attendance - List registrations for an event
export async function GET(
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

    const event = await db.event.findFirst({ where: { id, schoolId } })
    if (!event) {
      return NextResponse.json({ error: 'الفعالية غير موجودة' }, { status: 404 })
    }

    const statusParam = searchParams.get('status')
    const where: Record<string, unknown> = { eventId: id, schoolId }
    if (statusParam) where.status = statusParam

    const registrations = await db.eventRegistration.findMany({
      where,
      orderBy: { registeredAt: 'asc' },
    })

    const summary = {
      total: registrations.length,
      attended: registrations.filter((r) => r.attendedAt !== null).length,
      byStatus: registrations.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      }, {}),
    }

    return NextResponse.json({ registrations, summary })
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'تعذر جلب بيانات الحضور' }, { status: 500 })
  }
}

// PUT /api/events/:id/attendance - Bulk update attendance (transaction)
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

    const event = await db.event.findFirst({ where: { id, schoolId } })
    if (!event) {
      return NextResponse.json({ error: 'الفعالية غير موجودة' }, { status: 404 })
    }

    const body = await request.json()
    const { updates } = body as {
      updates: Array<{
        registrationId: string
        status?: string
        attendedAt?: string | null
        notes?: string | null
      }>
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'قائمة التحديثات مطلوبة' },
        { status: 400 }
      )
    }

    const results = await db.$transaction(
      updates.map((u) =>
        db.eventRegistration.updateMany({
          where: { id: u.registrationId, eventId: id, schoolId },
          data: {
            ...(u.status !== undefined ? { status: String(u.status) } : {}),
            ...(u.attendedAt !== undefined
              ? { attendedAt: u.attendedAt ? new Date(u.attendedAt) : null }
              : {}),
            ...(u.notes !== undefined
              ? { notes: u.notes === null ? null : String(u.notes) }
              : {}),
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      updated: results.reduce((sum, r) => sum + r.count, 0),
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error updating attendance:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث بيانات الحضور' },
      { status: 500 }
    )
  }
}
