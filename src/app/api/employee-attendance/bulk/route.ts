import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// POST /api/employee-attendance/bulk - Bulk create/update attendance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const { date, records } = body

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
        if (!record.employeeId || !record.status) continue

        const existing = await db.employeeAttendance.findFirst({
          where: {
            schoolId,
            employeeId: record.employeeId,
            date: { gte: startOfDay, lte: endOfDay },
          },
        })

        if (existing) {
          await db.employeeAttendance.update({
            where: { id: existing.id },
            data: {
              status: record.status,
              checkIn: record.checkIn || null,
              checkOut: record.checkOut || null,
              leaveType: record.leaveType || null,
              leaveDuration: record.leaveDuration || 'يوم كامل',
              notes: record.notes || null,
              recordedBy: record.recordedBy || null,
            },
          })
          results.updated++
        } else {
          await db.employeeAttendance.create({
            data: {
              schoolId,
              employeeId: record.employeeId,
              date: dateObj,
              status: record.status,
              checkIn: record.checkIn || null,
              checkOut: record.checkOut || null,
              leaveType: record.leaveType || null,
              leaveDuration: record.leaveDuration || 'يوم كامل',
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
    console.error('Error bulk creating employee attendance:', error)
    return NextResponse.json({ error: 'Failed to create attendance records' }, { status: 500 })
  }
}
