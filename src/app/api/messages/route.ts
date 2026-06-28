import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/messages - List messages with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const recipientId = searchParams.get('recipientId')
    const senderId = searchParams.get('senderId')
    const priority = searchParams.get('priority')
    const isRead = searchParams.get('isRead')
    const isStarred = searchParams.get('isStarred')
    const isArchived = searchParams.get('isArchived')

    const where: Record<string, unknown> = { schoolId }
    if (recipientId) where.recipientId = recipientId
    if (senderId) where.senderId = senderId
    if (priority) where.priority = priority
    if (isRead === 'true') where.isRead = true
    if (isRead === 'false') where.isRead = false
    if (isStarred === 'true') where.isStarred = true
    if (isStarred === 'false') where.isStarred = false
    if (isArchived === 'true') where.isArchived = true
    if (isArchived === 'false') where.isArchived = false
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    const messages = await db.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const parsed = messages.map((m) => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : [],
    }))

    return NextResponse.json({ messages: parsed })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'تعذر جلب الرسائل' }, { status: 500 })
  }
}

// POST /api/messages - Create a new message
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      senderId,
      senderName,
      senderRole,
      recipientId,
      recipientName,
      subject,
      content,
      attachments,
      priority,
      conversationId,
    } = body

    if (!senderId || !recipientId || !content) {
      return NextResponse.json(
        { error: 'المرسل والمستقبل والمحتوى مطلوبون' },
        { status: 400 }
      )
    }

    const created = await db.message.create({
      data: {
        schoolId,
        senderId: String(senderId),
        senderName: senderName ? String(senderName) : '',
        senderRole: senderRole ? String(senderRole) : '',
        recipientId: String(recipientId),
        recipientName: recipientName ? String(recipientName) : '',
        subject: subject ? String(subject) : '',
        content: String(content),
        attachments: attachments
          ? JSON.stringify(Array.isArray(attachments) ? attachments : [])
          : null,
        priority: priority ? String(priority) : 'عادي',
        conversationId: conversationId || null,
      },
    })

    if (conversationId) {
      await db.conversation.update({
        where: { id: String(conversationId) },
        data: { lastMessageAt: new Date() },
      })
    }

    return NextResponse.json(
      {
        ...created,
        attachments: created.attachments ? JSON.parse(created.attachments) : [],
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error creating message:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء الرسالة' },
      { status: 500 }
    )
  }
}
