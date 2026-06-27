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

    const where: Record<string, unknown> = { schoolId }
    const academicYearId = searchParams.get('academicYearId')
    if (academicYearId) where.academicYearId = academicYearId

    const classrooms = await db.classroom.findMany({
      where,
      include: {
        _count: { select: { students: true } },
        academicYear: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(classrooms)
  } catch (error) {
    console.error('Error fetching classrooms:', error)
    return NextResponse.json({ error: 'Failed to fetch classrooms' }, { status: 500 })
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

    if (!body.name || !body.academicYearId) {
      return NextResponse.json({ error: 'Name and academic year are required' }, { status: 400 })
    }

    const classroom = await db.classroom.create({
      data: {
        schoolId,
        academicYearId: body.academicYearId,
        name: body.name,
        gradeLevel: body.gradeLevel || '',
        section: body.section || 'أ',
        capacity: body.capacity || 30,
        teacherId: body.teacherId || null,
      },
    })

    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    console.error('Error creating classroom:', error)
    return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 })
  }
}
