import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/events/:id/gallery - List gallery images for an event
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

    const gallery = await db.eventGallery.findMany({
      where: { eventId: id, schoolId },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json({ gallery })
  } catch (error) {
    console.error('Error fetching gallery:', error)
    return NextResponse.json({ error: 'تعذر جلب معرض الصور' }, { status: 500 })
  }
}

// POST /api/events/:id/gallery - Add image(s) to gallery
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

    // Support either a single image object or an array of images
    const items: Array<{ imageUrl?: string; caption?: string }> = Array.isArray(body)
      ? body
      : [body]

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'بيانات الصورة مطلوبة' },
        { status: 400 }
      )
    }

    // Validate each item has imageUrl
    for (const item of items) {
      if (!item.imageUrl) {
        return NextResponse.json(
          { error: 'رابط الصورة مطلوب' },
          { status: 400 }
        )
      }
    }

    const created = await db.$transaction(
      items.map((item) =>
        db.eventGallery.create({
          data: {
            schoolId,
            eventId: id,
            imageUrl: String(item.imageUrl),
            caption: item.caption ? String(item.caption) : null,
          },
        })
      )
    )

    return NextResponse.json(
      created.length === 1 ? created[0] : { gallery: created },
      { status: 201 }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error creating gallery image:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إضافة الصورة للمعرض' },
      { status: 500 }
    )
  }
}
