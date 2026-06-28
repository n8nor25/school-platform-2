import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/conversations - List conversations for a school
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const participantId = searchParams.get('participantId')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = { schoolId }
    if (type) where.type = type
    if (participantId) {
      // participants is a JSON array string; check membership via substring
      where.participants = { contains: `"${participantId}"` }
    }

    const conversations = await db.conversation.findMany({
      where,
      include: {
        _count: { select: { messages: true } },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    })

    const parsed = conversations.map((c) => ({
      ...c,
      participants: JSON.parse(c.participants || '[]'),
    }))

    return NextResponse.json({ conversations: parsed })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: 'تعذر جلب المحادثات' }, { status: 500 })
  }
}

// POST /api/conversations - Create a conversation (optionally with first message)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { type, title, participants, message } = body

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json(
        { error: 'المشاركون مطلوبون (قائمة غير فارغة)' },
        { status: 400 }
      )
    }

    const created = await db.conversation.create({
      data: {
        schoolId,
        type: type ? String(type) : 'فردية',
        title: title ? String(title) : '',
        participants: JSON.stringify(participants),
      },
      include: {
        _count: { select: { messages: true } },
      },
    })

    // Optional first message
    let firstMessage: Record<string, unknown> | null = null
    if (message && typeof message === 'object') {
      const msg = message as {
        senderId?: string
        senderName?: string
        senderRole?: string
        recipientId?: string
        recipientName?: string
        subject?: string
        content?: string
        attachments?: unknown[]
        priority?: string
      }
      if (msg.senderId && msg.content) {
        const m = await db.message.create({
          data: {
            schoolId,
            conversationId: created.id,
            senderId: String(msg.senderId),
            senderName: msg.senderName ? String(msg.senderName) : '',
            senderRole: msg.senderRole ? String(msg.senderRole) : '',
            recipientId: msg.recipientId ? String(msg.recipientId) : '',
            recipientName: msg.recipientName ? String(msg.recipientName) : '',
            subject: msg.subject ? String(msg.subject) : '',
            content: String(msg.content),
            attachments: msg.attachments
              ? JSON.stringify(Array.isArray(msg.attachments) ? msg.attachments : [])
              : null,
            priority: msg.priority ? String(msg.priority) : 'عادي',
          },
        })
        await db.conversation.update({
          where: { id: created.id },
          data: { lastMessageAt: new Date() },
        })
        firstMessage = {
          ...m,
          attachments: m.attachments ? JSON.parse(m.attachments) : [],
        }
      }
    }

    return NextResponse.json(
      {
        ...created,
        participants: JSON.parse(created.participants || '[]'),
        ...(firstMessage ? { firstMessage } : {}),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء المحادثة' },
      { status: 500 }
    )
  }
}
