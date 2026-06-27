import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/attendance - List attendance records with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const where: Record<string, unknown> = { schoolId }

    // Filter by date
    const date = searchParams.get('date')
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      where.date = { gte: startOfDay, lte: endOfDay }
    }

    // Filter by date range
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom)
      start.setHours(0, 0, 0, 0)
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      where.date = { gte: start, lte: end }
    }

    // Filter by classroom
    const classroomId = searchParams.get('classroomId')
    if (classroomId) where.classroomId = classroomId

    // Filter by student
    const studentId = searchParams.get('studentId')
    if (studentId) where.studentId = studentId

    // Filter by academic year
    const academicYearId = searchParams.get('academicYearId')
    if (academicYearId) where.academicYearId = academicYearId

    // Filter by status
    const status = searchParams.get('status')
    if (status) where.status = status

    const records = await db.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            classroom: { select: { name: true, gradeLevel: true } },
          },
        },
        classroom: { select: { name: true, gradeLevel: true } },
        academicYear: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    // If requested, compute stats
    const includeStats = searchParams.get('includeStats') === 'true'
    if (includeStats) {
      const total = records.length
      const present = records.filter(r => r.status === 'حاضر').length
      const absent = records.filter(r => r.status === 'غائب').length
      const late = records.filter(r => r.status === 'متأخر').length
      const excused = records.filter(r => r.status === 'غائب بعذر').length

      return NextResponse.json({
        records,
        stats: { total, present, absent, late, excused,
          presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
          absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        },
      })
    }

    return NextResponse.json(records)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
  }
}

// POST /api/attendance - Create a single attendance record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    if (!body.studentId || !body.date) {
      return NextResponse.json({ error: 'Student ID and date are required' }, { status: 400 })
    }

    // Check for duplicate (same student, same date, same school)
    const dateObj = new Date(body.date)
    const startOfDay = new Date(dateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(dateObj)
    endOfDay.setHours(23, 59, 59, 999)

    const existing = await db.attendance.findFirst({
      where: {
        schoolId,
        studentId: body.studentId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    })

    if (existing) {
      // Update the existing record instead
      const updated = await db.attendance.update({
        where: { id: existing.id },
        data: {
          status: body.status || 'حاضر',
          arrivalTime: body.arrivalTime || null,
          notes: body.notes || null,
          classroomId: body.classroomId || existing.classroomId,
          academicYearId: body.academicYearId || existing.academicYearId,
          recordedBy: body.recordedBy || null,
        },
      })
      return NextResponse.json(updated)
    }

    const record = await db.attendance.create({
      data: {
        schoolId,
        studentId: body.studentId,
        classroomId: body.classroomId || null,
        academicYearId: body.academicYearId || null,
        date: dateObj,
        status: body.status || 'حاضر',
        arrivalTime: body.arrivalTime || null,
        notes: body.notes || null,
        recordedBy: body.recordedBy || null,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Error creating attendance record:', error)
    return NextResponse.json({ error: 'Failed to create attendance record' }, { status: 500 })
  }
}
