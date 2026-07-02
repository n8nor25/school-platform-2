import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/parent/attendance - Fetch attendance records for a single student
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'لم يتم العثور على المدرسة' }, { status: 404 })
    }

    const studentNumber = searchParams.get('studentNumber')
    const parentPhone = searchParams.get('parentPhone')

    if (!studentNumber || !parentPhone) {
      return NextResponse.json(
        { error: 'رقم الطالب ورقم هاتف ولي الأمر مطلوبان' },
        { status: 400 }
      )
    }

    const isTestMode = String(parentPhone).startsWith('test-')

    // Find the student by school + student number
    const student = await db.student.findFirst({
      where: {
        schoolId,
        studentNumber: String(studentNumber),
        archived: false,
      },
      include: {
        classroom: { select: { name: true, gradeLevel: true } },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 })
    }

    // Ownership check (skip in test mode)
    if (!isTestMode) {
      const owns =
        (student.parentPhone && student.parentPhone === parentPhone) ||
        (student.parentPhone2 && student.parentPhone2 === parentPhone)
      if (!owns) {
        return NextResponse.json(
          { error: 'غير مصرح بالوصول إلى بيانات هذا الطالب' },
          { status: 403 }
        )
      }
    }

    // Date range (default last 60 days)
    const now = new Date()
    const defaultFrom = new Date(now)
    defaultFrom.setDate(defaultFrom.getDate() - 60)
    defaultFrom.setHours(0, 0, 0, 0)

    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')

    const dateFrom = dateFromParam ? new Date(dateFromParam) : defaultFrom
    if (!dateFromParam) {
      dateFrom.setHours(0, 0, 0, 0)
    } else {
      dateFrom.setHours(0, 0, 0, 0)
    }

    const dateTo = dateToParam ? new Date(dateToParam) : new Date(now)
    dateTo.setHours(23, 59, 59, 999)

    // Limit (default 60, max 200)
    const limitParam = Number(searchParams.get('limit') || '60')
    const limit = Math.min(Math.max(1, Number.isFinite(limitParam) ? limitParam : 60), 200)

    const records = await db.attendance.findMany({
      where: {
        schoolId,
        studentId: student.id,
        date: { gte: dateFrom, lte: dateTo },
      },
      select: {
        id: true,
        date: true,
        status: true,
        arrivalTime: true,
        notes: true,
        recordedBy: true,
        classroom: { select: { name: true, gradeLevel: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    // Compute stats
    const total = records.length
    const present = records.filter((r) => r.status === 'حاضر').length
    const absent = records.filter((r) => r.status === 'غائب').length
    const late = records.filter((r) => r.status === 'متأخر').length
    const excused = records.filter((r) => r.status === 'غائب بعذر').length

    // Streak: consecutive present/late from most recent, stop at first absence
    // records are ordered desc (most recent first)
    let streak = 0
    for (const r of records) {
      if (r.status === 'حاضر' || r.status === 'متأخر') {
        streak++
      } else {
        break
      }
    }

    const presentRate = total > 0 ? Math.round((present / total) * 100) : 0
    const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0

    const latest = records[0] || null

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        classroomName: student.classroom?.name ?? null,
        gradeName: student.classroom?.gradeLevel ?? null,
      },
      records,
      stats: {
        total,
        present,
        absent,
        late,
        excused,
        presentRate,
        absentRate,
        streak,
      },
      latest,
      range: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      testMode: isTestMode,
    })
  } catch (error) {
    console.error('[parent/attendance] Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب سجلات الحضور' },
      { status: 500 }
    )
  }
}
