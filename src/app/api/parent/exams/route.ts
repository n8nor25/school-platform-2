import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/parent/exams - Fetch exam submissions (results) for a student
// Query params: schoolId, studentId (required), limit (optional, default 100, max 200)
// Visibility rule:
//   • If exam.parentVisible === true  -> always visible
//   • If submission.status === 'GRADED' -> visible (teacher explicitly graded it)
//   • Otherwise                        -> hidden from parents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'لم يتم العثور على المدرسة' }, { status: 404 })
    }

    const studentId = searchParams.get('studentId')
    if (!studentId) {
      return NextResponse.json(
        { error: 'معرّف الطالب مطلوب' },
        { status: 400 }
      )
    }

    // Parse limit (default 100, max 200)
    let limit = 100
    const limitParam = searchParams.get('limit')
    if (limitParam) {
      const parsed = parseInt(limitParam, 10)
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 200)
      }
    }

    // Verify the student exists in this school and is not archived
    const student = await db.student.findFirst({
      where: {
        id: studentId,
        schoolId,
        archived: false,
      },
      select: {
        id: true,
        name: true,
        studentNumber: true,
        classroomId: true,
        classroom: { select: { name: true, gradeLevel: true } },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 })
    }

    // Fetch submissions for this student
    // Only those with status in [SUBMITTED, GRADED, AUTO_CLOSED] (i.e., submitted, not IN_PROGRESS)
    // Use `select` (not `include`) to avoid fetching the `gradedByName` field, which is
    // marked non-nullable in the Prisma schema but has NULL values for some legacy rows
    // in production data (P2032 conflict error).
    const submissions = await db.submission.findMany({
      where: {
        studentId,
        schoolId,
        status: { in: ['SUBMITTED', 'GRADED', 'AUTO_CLOSED'] },
      },
      select: {
        id: true,
        examId: true,
        studentId: true,
        studentName: true,
        attemptNumber: true,
        startedAt: true,
        submittedAt: true,
        autoClosedAt: true,
        status: true,
        totalScore: true,
        maxScore: true,
        percentage: true,
        passed: true,
        gradedAt: true,
        notes: true,
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            classroomName: true,
            totalPoints: true,
            passingScore: true,
            startDate: true,
            endDate: true,
            durationMinutes: true,
            parentVisible: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    })

    // Apply visibility filter:
    //   visible if exam.parentVisible === true OR submission.status === 'GRADED'
    const visible = submissions.filter((s) => {
      const isParentVisible = s.exam?.parentVisible === true
      const isGraded = s.status === 'GRADED'
      return isParentVisible || isGraded
    })

    // Map to clean shape
    const mapped = visible.map((s) => {
      const totalScore = s.totalScore !== null ? Number(s.totalScore) : null
      const maxScore = s.maxScore !== null ? Number(s.maxScore) : null
      const percentage = s.percentage !== null ? Number(s.percentage) : null
      const passed = s.passed === null ? null : Boolean(s.passed)

      return {
        id: s.id,
        examId: s.examId,
        examTitle: s.exam?.title ?? '—',
        subject: s.exam?.subject ?? '—',
        classroomName: s.exam?.classroomName ?? '',
        submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
        status: s.status,
        totalScore,
        maxScore,
        percentage,
        passed,
        gradedAt: s.gradedAt ? s.gradedAt.toISOString() : null,
        attemptNumber: s.attemptNumber,
        durationMinutes: s.exam?.durationMinutes ?? 0,
        examEndDate: s.exam?.endDate ? s.exam.endDate.toISOString() : '',
      }
    })

    return NextResponse.json({
      success: true,
      count: mapped.length,
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        classroomName: student.classroom?.name ?? null,
        gradeName: student.classroom?.gradeLevel ?? null,
      },
      submissions: mapped,
    })
  } catch (error) {
    console.error('[parent/exams] Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب نتائج الامتحانات' },
      { status: 500 }
    )
  }
}
