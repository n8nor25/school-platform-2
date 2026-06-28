import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/conversations/:id/messages - List messages of a conversation ordered by createdAt asc
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

    const conversation = await db.conversation.findFirst({
      where: { id, schoolId },
    })
    if (!conversation) {
      return NextResponse.json({ error: 'المحادثة غير موجودة' }, { status: 404 })
    }

    const messages = await db.message.findMany({
      where: { conversationId: id, schoolId },
      orderBy: { createdAt: 'asc' },
    })

    const parsed = messages.map((m) => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : [],
    }))

    return NextResponse.json({ messages: parsed })
  } catch (error) {
    console.error('Error fetching conversation messages:', error)
    return NextResponse.json({ error: 'تعذر جلب رسائل المحادثة' }, { status: 500 })
  }
}
