import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// Helper: safely parse a JSON array string
function safeParseArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/events/:id - Fetch single event, increment viewCount
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

    const event = await db.event.findFirst({
      where: { id, schoolId },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: { select: { registrations: true, feedback: true, gallery: true, reminders: true } },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'الفعالية غير موجودة' }, { status: 404 })
    }

    // Increment viewCount (non-blocking; ignore errors)
    db.event
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch((err) => console.error('Error incrementing viewCount:', err))

    return NextResponse.json({
      ...event,
      targetIds: JSON.parse(event.targetIds || '[]'),
      program: event.program ? safeParseArray(event.program) : null,
    })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json({ error: 'تعذر جلب الفعالية' }, { status: 500 })
  }
}

// PUT /api/events/:id - Update event fields
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

    const existing = await db.event.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الفعالية غير موجودة' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      type,
      status,
      startDate,
      endDate,
      location,
      coverImageUrl,
      organizerId,
      organizerName,
      targetAudience,
      targetIds,
      maxAttendees,
      isPublic,
      program,
      requirements,
      budget,
      aiGenerated,
      academicYearId,
    } = body

    const updated = await db.event.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(description !== undefined ? { description: String(description) } : {}),
        ...(type !== undefined ? { type: String(type) } : {}),
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined
          ? { endDate: endDate ? new Date(endDate) : null }
          : {}),
        ...(location !== undefined ? { location: String(location) } : {}),
        ...(coverImageUrl !== undefined
          ? { coverImageUrl: coverImageUrl ? String(coverImageUrl) : null }
          : {}),
        ...(organizerId !== undefined ? { organizerId: String(organizerId) } : {}),
        ...(organizerName !== undefined
          ? { organizerName: String(organizerName) }
          : {}),
        ...(targetAudience !== undefined
          ? { targetAudience: String(targetAudience) }
          : {}),
        ...(targetIds !== undefined
          ? {
              targetIds: JSON.stringify(
                Array.isArray(targetIds) ? targetIds : []
              ),
            }
          : {}),
        ...(maxAttendees !== undefined
          ? {
              maxAttendees:
                maxAttendees === null ? null : Number(maxAttendees),
            }
          : {}),
        ...(isPublic !== undefined ? { isPublic: Boolean(isPublic) } : {}),
        ...(program !== undefined
          ? {
              program: program
                ? JSON.stringify(Array.isArray(program) ? program : [])
                : null,
            }
          : {}),
        ...(requirements !== undefined
          ? { requirements: requirements ? String(requirements) : null }
          : {}),
        ...(budget !== undefined
          ? { budget: budget === null ? null : Number(budget) }
          : {}),
        ...(aiGenerated !== undefined ? { aiGenerated: Boolean(aiGenerated) } : {}),
        ...(academicYearId !== undefined
          ? { academicYearId: academicYearId || null }
          : {}),
      },
      include: {
        _count: { select: { registrations: true, feedback: true, gallery: true } },
      },
    })

    return NextResponse.json({
      ...updated,
      targetIds: JSON.parse(updated.targetIds || '[]'),
      program: updated.program ? safeParseArray(updated.program) : null,
    })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث الفعالية' },
      { status: 500 }
    )
  }
}

// DELETE /api/events/:id - Delete event (cascade handled by Prisma)
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

    const existing = await db.event.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الفعالية غير موجودة' }, { status: 404 })
    }

    await db.event.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف الفعالية' },
      { status: 500 }
    )
  }
}
