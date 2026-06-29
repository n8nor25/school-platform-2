import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// Helper: safely parse a JSON array string (used for program field)
function safeParseArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// GET /api/events - List events with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const targetAudience = searchParams.get('targetAudience')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const academicYearId = searchParams.get('academicYearId')

    const where: Record<string, unknown> = { schoolId }
    if (type) where.type = type
    if (status) where.status = status
    if (targetAudience) where.targetAudience = targetAudience
    if (academicYearId) where.academicYearId = academicYearId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (fromDate || toDate) {
      const dateRange: Record<string, unknown> = {}
      if (fromDate) {
        const start = new Date(fromDate)
        start.setHours(0, 0, 0, 0)
        dateRange.gte = start
      }
      if (toDate) {
        const end = new Date(toDate)
        end.setHours(23, 59, 59, 999)
        dateRange.lte = end
      }
      where.startDate = dateRange
    }

    const events = await db.event.findMany({
      where,
      include: {
        _count: { select: { registrations: true, feedback: true, gallery: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    const parsed = events.map((e) => ({
      ...e,
      targetIds: JSON.parse(e.targetIds || '[]'),
      program: e.program ? safeParseArray(e.program) : null,
    }))

    return NextResponse.json({ events: parsed })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'تعذر جلب الفعاليات' }, { status: 500 })
  }
}

// POST /api/events - Create a new event
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
      description,
      type,
      status,
      startDate,
      endDate,
      location,
      coverImageUrl,
      organizerId,
      organizerName,
      targetAudience,
      targetIds,
      maxAttendees,
      isPublic,
      program,
      requirements,
      budget,
      aiGenerated,
      academicYearId,
    } = body

    if (!title || !startDate || !organizerId) {
      return NextResponse.json(
        { error: 'العنوان وتاريخ البداية ومنظم الفعالية مطلوبة' },
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

    const created = await db.event.create({
      data: {
        schoolId,
        academicYearId: resolvedAcademicYearId,
        title: String(title),
        description: description ? String(description) : '',
        type: type ? String(type) : 'نشاط',
        status: status ? String(status) : 'مجدولة',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location: location ? String(location) : '',
        coverImageUrl: coverImageUrl ? String(coverImageUrl) : null,
        organizerId: String(organizerId),
        organizerName: organizerName ? String(organizerName) : '',
        targetAudience: targetAudience ? String(targetAudience) : 'الكل',
        targetIds: JSON.stringify(Array.isArray(targetIds) ? targetIds : []),
        maxAttendees:
          maxAttendees !== undefined && maxAttendees !== null
            ? Number(maxAttendees)
            : null,
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        program: program
          ? JSON.stringify(Array.isArray(program) ? program : [])
          : null,
        requirements: requirements ? String(requirements) : null,
        budget: budget !== undefined && budget !== null ? Number(budget) : null,
        aiGenerated: aiGenerated !== undefined ? Boolean(aiGenerated) : false,
      },
      include: {
        _count: { select: { registrations: true, feedback: true, gallery: true } },
      },
    })

    return NextResponse.json(
      {
        ...created,
        targetIds: JSON.parse(created.targetIds || '[]'),
        program: created.program ? safeParseArray(created.program) : null,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء الفعالية' },
      { status: 500 }
    )
  }
}
