import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/messages/:id - Fetch single message
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

    const message = await db.message.findFirst({ where: { id, schoolId } })
    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 })
    }

    return NextResponse.json({
      ...message,
      attachments: message.attachments ? JSON.parse(message.attachments) : [],
    })
  } catch (error) {
    console.error('Error fetching message:', error)
    return NextResponse.json({ error: 'تعذر جلب الرسالة' }, { status: 500 })
  }
}

// PUT /api/messages/:id - Update message (read, star, archive, subject, content, etc.)
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

    const existing = await db.message.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 })
    }

    const body = await request.json()
    const { subject, content, attachments, priority, isRead, isStarred, isArchived } = body

    const data: Record<string, unknown> = {}
    if (subject !== undefined) data.subject = String(subject)
    if (content !== undefined) data.content = String(content)
    if (priority !== undefined) data.priority = String(priority)
    if (attachments !== undefined) {
      data.attachments = JSON.stringify(
        Array.isArray(attachments) ? attachments : []
      )
    }
    if (isRead !== undefined) {
      const val = Boolean(isRead)
      data.isRead = val
      data.readAt = val ? new Date() : null
    }
    if (isStarred !== undefined) data.isStarred = Boolean(isStarred)
    if (isArchived !== undefined) data.isArchived = Boolean(isArchived)

    const updated = await db.message.update({ where: { id }, data })

    return NextResponse.json({
      ...updated,
      attachments: updated.attachments ? JSON.parse(updated.attachments) : [],
    })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error updating message:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث الرسالة' },
      { status: 500 }
    )
  }
}

// DELETE /api/messages/:id - Delete message
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

    const existing = await db.message.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الرسالة غير موجودة' }, { status: 404 })
    }

    await db.message.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف الرسالة' },
      { status: 500 }
    )
  }
}
