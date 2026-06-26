import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const academicYears = await db.academicYear.findMany({
      where: { schoolId },
      include: {
        _count: { select: { classrooms: true, fees: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json(academicYears)
  } catch (error) {
    console.error('Error fetching academic years:', error)
    return NextResponse.json({ error: 'Failed to fetch academic years' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json({ error: 'Name, start date, and end date are required' }, { status: 400 })
    }

    // If setting as active, deactivate others
    if (body.isActive) {
      await db.academicYear.updateMany({
        where: { schoolId, isActive: true },
        data: { isActive: false },
      })
    }

    const academicYear = await db.academicYear.create({
      data: {
        schoolId,
        name: body.name,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        isActive: body.isActive || false,
      },
    })

    return NextResponse.json(academicYear, { status: 201 })
  } catch (error) {
    console.error('Error creating academic year:', error)
    return NextResponse.json({ error: 'Failed to create academic year' }, { status: 500 })
  }
}
