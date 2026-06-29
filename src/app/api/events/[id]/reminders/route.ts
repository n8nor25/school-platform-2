import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/events/:id/reminders - List reminders for an event
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

    const reminders = await db.eventReminder.findMany({
      where: { eventId: id, schoolId },
      orderBy: { sendAt: 'asc' },
    })

    return NextResponse.json({ reminders })
  } catch (error) {
    console.error('Error fetching reminders:', error)
    return NextResponse.json({ error: 'تعذر جلب التذكيرات' }, { status: 500 })
  }
}

// POST /api/events/:id/reminders - Create a reminder
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
    const { sendAt, channel, message, targetCount, sent, sentAt } = body

    if (!sendAt || !message) {
      return NextResponse.json(
        { error: 'وقت الإرسال والرسالة مطلوبان' },
        { status: 400 }
      )
    }

    const created = await db.eventReminder.create({
      data: {
        schoolId,
        eventId: id,
        sendAt: new Date(sendAt),
        channel: channel ? String(channel) : 'داخلي',
        message: String(message),
        targetCount:
          targetCount !== undefined && targetCount !== null
            ? Number(targetCount)
            : 0,
        sent: sent !== undefined ? Boolean(sent) : false,
        sentAt: sentAt ? new Date(sentAt) : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error creating reminder:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء التذكير' },
      { status: 500 }
    )
  }
}
