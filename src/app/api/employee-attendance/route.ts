import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/employee-attendance - List employee attendance records with filters
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

    // Filter by employee
    const employeeId = searchParams.get('employeeId')
    if (employeeId) where.employeeId = employeeId

    // Filter by department
    const department = searchParams.get('department')
    if (department) {
      where.employee = { department }
    }

    // Filter by status
    const status = searchParams.get('status')
    if (status) where.status = status

    // Filter by job title
    const jobTitle = searchParams.get('jobTitle')
    if (jobTitle) {
      where.employee = { ...(where.employee as Record<string, unknown>), jobTitle }
    }

    const records = await db.employeeAttendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            jobTitle: true,
            department: true,
            imageUrl: true,
          },
        },
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
      const sickLeave = records.filter(r => r.status === 'إجازة مرضية').length
      const officialLeave = records.filter(r => r.status === 'إجازة رسمية').length
      const personalLeave = records.filter(r => r.status === 'إجازة شخصية').length

      return NextResponse.json({
        records,
        stats: {
          total, present, absent, late, sickLeave, officialLeave, personalLeave,
          presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
          absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
          leaveRate: total > 0 ? Math.round(((sickLeave + officialLeave + personalLeave) / total) * 100) : 0,
        },
      })
    }

    return NextResponse.json(records)
  } catch (error) {
    console.error('Error fetching employee attendance:', error)
    return NextResponse.json({ error: 'Failed to fetch employee attendance' }, { status: 500 })
  }
}

// POST /api/employee-attendance - Create a single attendance record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    if (!body.employeeId || !body.date) {
      return NextResponse.json({ error: 'Employee ID and date are required' }, { status: 400 })
    }

    const dateObj = new Date(body.date)
    const startOfDay = new Date(dateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(dateObj)
    endOfDay.setHours(23, 59, 59, 999)

    // Check for duplicate
    const existing = await db.employeeAttendance.findFirst({
      where: {
        schoolId,
        employeeId: body.employeeId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    })

    if (existing) {
      // Update the existing record
      const updated = await db.employeeAttendance.update({
        where: { id: existing.id },
        data: {
          status: body.status || existing.status,
          checkIn: body.checkIn !== undefined ? body.checkIn : existing.checkIn,
          checkOut: body.checkOut !== undefined ? body.checkOut : existing.checkOut,
          leaveType: body.leaveType !== undefined ? body.leaveType : existing.leaveType,
          leaveDuration: body.leaveDuration !== undefined ? body.leaveDuration : existing.leaveDuration,
          notes: body.notes !== undefined ? body.notes : existing.notes,
          recordedBy: body.recordedBy || existing.recordedBy,
        },
      })
      return NextResponse.json(updated)
    }

    const record = await db.employeeAttendance.create({
      data: {
        schoolId,
        employeeId: body.employeeId,
        date: dateObj,
        status: body.status || 'حاضر',
        checkIn: body.checkIn || null,
        checkOut: body.checkOut || null,
        leaveType: body.leaveType || null,
        leaveDuration: body.leaveDuration || 'يوم كامل',
        notes: body.notes || null,
        recordedBy: body.recordedBy || null,
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Error creating employee attendance:', error)
    return NextResponse.json({ error: 'Failed to create employee attendance' }, { status: 500 })
  }
}
