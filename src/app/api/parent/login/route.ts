import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// POST /api/parent/login - Parent portal login (real + test mode)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam || body.schoolId)
    if (!schoolId) {
      return NextResponse.json({ error: 'لم يتم العثور على المدرسة' }, { status: 404 })
    }

    const { studentNumber, parentPhone } = body as {
      studentNumber?: string
      parentPhone?: string
    }

    if (!studentNumber || !parentPhone) {
      return NextResponse.json(
        { error: 'رقم الطالب ورقم هاتف ولي الأمر مطلوبان' },
        { status: 400 }
      )
    }

    const isTestMode = String(parentPhone).startsWith('test-')

    // Helper to project a student into a child object
    const toChild = (s: {
      id: string
      studentNumber: string
      name: string
      classroomId: string | null
      classroom: { name: string; gradeLevel: string } | null
    }) => ({
      id: s.id,
      studentNumber: s.studentNumber,
      name: s.name,
      classroomId: s.classroomId,
      classroomName: s.classroom?.name ?? null,
      gradeName: s.classroom?.gradeLevel ?? null,
    })

    if (isTestMode) {
      // Try to find a real student matching the given studentNumber in this school
      const matched = await db.student.findFirst({
        where: {
          schoolId,
          studentNumber: String(studentNumber),
          archived: false,
        },
        include: {
          classroom: { select: { name: true, gradeLevel: true } },
        },
      })

      if (matched) {
        return NextResponse.json({
          parentName: matched.parentName || 'ولي الأمر',
          parentPhone: matched.parentPhone || parentPhone,
          children: [toChild(matched)],
          testMode: true,
          fakeStudent: false,
        })
      }

      // Not found — pick ANY real student in the school
      const fallback = await db.student.findFirst({
        where: { schoolId, archived: false },
        orderBy: { studentNumber: 'asc' },
        include: {
          classroom: { select: { name: true, gradeLevel: true } },
        },
      })

      if (!fallback) {
        // No students at all — return pure fake data
        return NextResponse.json({
          parentName: 'ولي الأمر (تجريبي)',
          parentPhone,
          children: [
            {
              id: 'test-student',
              studentNumber: String(studentNumber),
              name: 'طالب تجريبي',
              classroomId: null,
              classroomName: null,
              gradeName: null,
            },
          ],
          testMode: true,
          fakeStudent: true,
          warning:
            'لا يوجد طلاب مسجلون في المدرسة حالياً. يتم عرض بيانات تجريبية لأغراض الاختبار فقط.',
        })
      }

      // Found a fallback student — return it with a warning
      const warning = `رقم الطالب "${studentNumber}" غير موجود. تم اختيار طالب آخر (${fallback.studentNumber} - ${fallback.name}) تلقائياً لأغراض الاختبار.`
      return NextResponse.json({
        parentName: fallback.parentName || 'ولي الأمر',
        parentPhone: fallback.parentPhone || parentPhone,
        children: [toChild(fallback)],
        testMode: true,
        fakeStudent: true,
        originalStudentNumber: String(studentNumber),
        warning,
      })
    }

    // ===== Real mode =====
    const student = await db.student.findFirst({
      where: {
        schoolId,
        studentNumber: String(studentNumber),
        OR: [
          { parentPhone: String(parentPhone) },
          { parentPhone2: String(parentPhone) },
        ],
        archived: false,
      },
      include: {
        classroom: { select: { name: true, gradeLevel: true } },
      },
    })

    if (!student) {
      return NextResponse.json(
        { error: 'بيانات الدخول غير صحيحة. تأكد من رقم الطالب ورقم هاتف ولي الأمر.' },
        { status: 401 }
      )
    }

    // Find ALL children with the same parent phone (primary or secondary)
    const children = await db.student.findMany({
      where: {
        schoolId,
        archived: false,
        OR: [
          { parentPhone: String(parentPhone) },
          { parentPhone2: String(parentPhone) },
        ],
      },
      include: {
        classroom: { select: { name: true, gradeLevel: true } },
      },
      orderBy: { studentNumber: 'asc' },
    })

    return NextResponse.json({
      parentName: student.parentName || 'ولي الأمر',
      parentPhone: student.parentPhone || parentPhone,
      children: children.map(toChild),
      testMode: false,
    })
  } catch (error) {
    console.error('[parent/login] Error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    )
  }
}
