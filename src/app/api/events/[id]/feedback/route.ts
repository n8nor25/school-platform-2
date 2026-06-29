import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/events/:id/feedback - List feedback with stats
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

    const feedback = await db.eventFeedback.findMany({
      where: { eventId: id, schoolId },
      orderBy: { createdAt: 'desc' },
    })

    const total = feedback.length
    const sumRatings = feedback.reduce((sum, f) => sum + f.rating, 0)
    const average = total > 0 ? Number((sumRatings / total).toFixed(2)) : 0

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const f of feedback) {
      if (f.rating >= 1 && f.rating <= 5) distribution[f.rating] += 1
    }

    return NextResponse.json({
      feedback,
      stats: { total, average, distribution },
    })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'تعذر جلب التقييمات' }, { status: 500 })
  }
}

// POST /api/events/:id/feedback - Submit feedback (rating 1-5)
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
    const { reviewerId, reviewerName, rating, comment } = body

    if (!reviewerId) {
      return NextResponse.json(
        { error: 'معرف المُقيّم مطلوب' },
        { status: 400 }
      )
    }

    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: 'التقييم يجب أن يكون عدداً صحيحاً بين 1 و 5' },
        { status: 400 }
      )
    }

    const created = await db.eventFeedback.create({
      data: {
        schoolId,
        eventId: id,
        reviewerId: String(reviewerId),
        reviewerName: reviewerName ? String(reviewerName) : '',
        rating: ratingNum,
        comment: comment ? String(comment) : null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'لقد قمت بتقييم هذه الفعالية مسبقاً' },
        { status: 409 }
      )
    }
    console.error('Error creating feedback:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إضافة التقييم' },
      { status: 500 }
    )
  }
}
