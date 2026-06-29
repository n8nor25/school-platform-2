import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// POST /api/events/:id/register - Register a person for an event
export async function POST(
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
    const {
      registrantId,
      registrantName,
      registrantType,
      status,
      notes,
    } = body

    if (!registrantId) {
      return NextResponse.json(
        { error: 'معرف المسجل مطلوب' },
        { status: 400 }
      )
    }

    // Check maxAttendees capacity if status would be "مسجل"
    if (event.maxAttendees && (status === 'مسجل' || !status)) {
      const confirmedCount = await db.eventRegistration.count({
        where: { eventId: id, status: 'مسجل' },
      })
      if (confirmedCount >= event.maxAttendees) {
        return NextResponse.json(
          { error: 'اكتمل العدد الأقصى للمسجلين في هذه الفعالية' },
          { status: 409 }
        )
      }
    }

    const created = await db.eventRegistration.create({
      data: {
        schoolId,
        eventId: id,
        registrantId: String(registrantId),
        registrantName: registrantName ? String(registrantName) : '',
        registrantType: registrantType ? String(registrantType) : 'طالب',
        status: status ? String(status) : 'مسجل',
        notes: notes ? String(notes) : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'هذا المسجل مُسجل بالفعل في هذه الفعالية' },
        { status: 409 }
      )
    }
    console.error('Error registering for event:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تسجيل المشترك في الفعالية' },
      { status: 500 }
    )
  }
}
