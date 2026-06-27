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
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const archivedOnly = searchParams.get('archivedOnly') === 'true'
    if (archivedOnly) {
      where.archived = true
    } else if (!includeArchived) {
      where.archived = false
    }

    const classroomId = searchParams.get('classroomId')
    if (classroomId) where.classroomId = classroomId

    const status = searchParams.get('status')
    if (status) where.status = status

    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNumber: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    const students = await db.student.findMany({
      where,
      include: {
        classroom: { select: { name: true, gradeLevel: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(students)
  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
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

    if (!body.name || !body.studentNumber) {
      return NextResponse.json({ error: 'Name and student number are required' }, { status: 400 })
    }

    // Check for duplicate student number within the same school
    const existing = await db.student.findUnique({
      where: { schoolId_studentNumber: { schoolId, studentNumber: body.studentNumber } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Student number already exists in this school' }, { status: 409 })
    }

    const student = await db.student.create({
      data: {
        schoolId,
        classroomId: body.classroomId || null,
        studentNumber: body.studentNumber,
        name: body.name,
        nationalId: body.nationalId || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender || 'ذكر',
        address: body.address || null,
        phone: body.phone || null,
        parentName: body.parentName || null,
        parentPhone: body.parentPhone || null,
        parentNationalId: body.parentNationalId || null,
        enrollDate: body.enrollDate ? new Date(body.enrollDate) : new Date(),
        status: body.status || 'نشط',
        previousSchool: body.previousSchool || null,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    console.error('Error creating student:', error)
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 })
  }
}
