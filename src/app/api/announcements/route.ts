import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/announcements - List announcements with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const targetType = searchParams.get('targetType')
    const authorId = searchParams.get('authorId')
    const isPublished = searchParams.get('isPublished')
    const isPinned = searchParams.get('isPinned')
    const limitParam = searchParams.get('limit')

    const where: Record<string, unknown> = { schoolId }
    if (targetType) where.targetType = targetType
    if (authorId) where.authorId = authorId
    if (isPublished === 'true') where.isPublished = true
    if (isPublished === 'false') where.isPublished = false
    if (isPinned === 'true') where.isPinned = true
    if (isPinned === 'false') where.isPinned = false
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ]
    }

    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    const take = limit && !Number.isNaN(limit) && limit > 0 ? limit : undefined

    const announcements = await db.announcement.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      ...(take ? { take } : {}),
    })

    const parsed = announcements.map((a) => ({
      ...a,
      targetIds: JSON.parse(a.targetIds || '[]'),
    }))

    return NextResponse.json({ announcements: parsed })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'تعذر جلب الإعلانات' }, { status: 500 })
  }
}

// POST /api/announcements - Create an announcement
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      title,
      content,
      targetType,
      targetIds,
      authorId,
      authorName,
      imageUrl,
      isPinned,
      isPublished,
      publishedAt,
      expiresAt,
      academicYearId,
    } = body

    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: 'العنوان والمحتوى والناشر مطلوبون' },
        { status: 400 }
      )
    }

    // Resolve academic year: provided > active year for school > null
    let resolvedAcademicYearId: string | null = academicYearId || null
    if (!resolvedAcademicYearId) {
      const activeYear = await db.academicYear.findFirst({
        where: { schoolId, isActive: true },
      })
      resolvedAcademicYearId = activeYear?.id || null
    }

    const willPublish = isPublished === undefined ? true : Boolean(isPublished)
    let resolvedPublishedAt: Date | null = null
    if (publishedAt) {
      resolvedPublishedAt = new Date(publishedAt)
    } else if (willPublish) {
      resolvedPublishedAt = new Date()
    }

    const created = await db.announcement.create({
      data: {
        schoolId,
        academicYearId: resolvedAcademicYearId,
        title: String(title),
        content: String(content),
        targetType: targetType ? String(targetType) : 'الكل',
        targetIds: JSON.stringify(Array.isArray(targetIds) ? targetIds : []),
        authorId: String(authorId),
        authorName: authorName ? String(authorName) : '',
        imageUrl: imageUrl ? String(imageUrl) : null,
        isPinned: isPinned !== undefined ? Boolean(isPinned) : false,
        isPublished: willPublish,
        publishedAt: resolvedPublishedAt,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json(
      {
        ...created,
        targetIds: JSON.parse(created.targetIds || '[]'),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error creating announcement:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء الإعلان' },
      { status: 500 }
    )
  }
}
