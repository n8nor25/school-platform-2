import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/announcements/:id - Fetch single announcement and increment viewCount
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

    const existing = await db.announcement.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الإعلان غير موجود' }, { status: 404 })
    }

    const updated = await db.announcement.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })

    return NextResponse.json({
      ...updated,
      targetIds: JSON.parse(updated.targetIds || '[]'),
    })
  } catch (error) {
    console.error('Error fetching announcement:', error)
    return NextResponse.json({ error: 'تعذر جلب الإعلان' }, { status: 500 })
  }
}

// PUT /api/announcements/:id - Update announcement fields
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

    const existing = await db.announcement.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الإعلان غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      content,
      targetType,
      targetIds,
      imageUrl,
      isPinned,
      isPublished,
      publishedAt,
      expiresAt,
    } = body

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = String(title)
    if (content !== undefined) data.content = String(content)
    if (targetType !== undefined) data.targetType = String(targetType)
    if (targetIds !== undefined) {
      data.targetIds = JSON.stringify(Array.isArray(targetIds) ? targetIds : [])
    }
    if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl) : null
    if (isPinned !== undefined) data.isPinned = Boolean(isPinned)
    if (expiresAt !== undefined) {
      data.expiresAt = expiresAt ? new Date(expiresAt) : null
    }

    if (isPublished !== undefined) {
      const newValue = Boolean(isPublished)
      data.isPublished = newValue
      // Transitioning from unpublished to published
      if (newValue && !existing.isPublished) {
        if (publishedAt) {
          data.publishedAt = new Date(publishedAt)
        } else if (!existing.publishedAt) {
          data.publishedAt = new Date()
        }
      } else if (publishedAt !== undefined) {
        data.publishedAt = publishedAt ? new Date(publishedAt) : null
      }
    } else if (publishedAt !== undefined) {
      data.publishedAt = publishedAt ? new Date(publishedAt) : null
    }

    const updated = await db.announcement.update({ where: { id }, data })

    return NextResponse.json({
      ...updated,
      targetIds: JSON.parse(updated.targetIds || '[]'),
    })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error updating announcement:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث الإعلان' },
      { status: 500 }
    )
  }
}

// DELETE /api/announcements/:id - Delete announcement
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

    const existing = await db.announcement.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'الإعلان غير موجود' }, { status: 404 })
    }

    await db.announcement.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting announcement:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف الإعلان' },
      { status: 500 }
    )
  }
}
