import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// POST /api/attendance/bulk - Bulk create/update attendance for a class on a date
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const { date, academicYearId, records } = body

    if (!date || !records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Date and records array are required' }, { status: 400 })
    }

    const dateObj = new Date(date)
    const startOfDay = new Date(dateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(dateObj)
    endOfDay.setHours(23, 59, 59, 999)

    const results = { created: 0, updated: 0, errors: 0 }

    for (const record of records) {
      try {
        if (!record.studentId || !record.status) continue

        // Check for existing record
        const existing = await db.attendance.findFirst({
          where: {
            schoolId,
            studentId: record.studentId,
            date: { gte: startOfDay, lte: endOfDay },
          },
        })

        if (existing) {
          await db.attendance.update({
            where: { id: existing.id },
            data: {
              status: record.status,
              arrivalTime: record.arrivalTime || null,
              notes: record.notes || null,
              classroomId: record.classroomId || existing.classroomId,
              recordedBy: record.recordedBy || null,
            },
          })
          results.updated++
        } else {
          await db.attendance.create({
            data: {
              schoolId,
              studentId: record.studentId,
              classroomId: record.classroomId || null,
              academicYearId: academicYearId || null,
              date: dateObj,
              status: record.status,
              arrivalTime: record.arrivalTime || null,
              notes: record.notes || null,
              recordedBy: record.recordedBy || null,
            },
          })
          results.created++
        }
      } catch {
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم تسجيل الحضور: ${results.created} جديد، ${results.updated} محدث`,
      results,
    })
  } catch (error) {
    console.error('Error bulk creating attendance:', error)
    return NextResponse.json({ error: 'Failed to create attendance records' }, { status: 500 })
  }
}
