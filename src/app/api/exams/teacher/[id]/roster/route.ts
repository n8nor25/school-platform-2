/**
 * GET /api/exams/teacher/[id]/roster
 * قائمة طلاب الصف المرتبطين بالامتحان + حالة تسليم كل طالب:
 *  - من المدرسة (إن لم يُحدد classroomId) أو من classroomId المُسجَّل
 *  - يربط كل طالب بتسليماته على هذا الامتحان
 *  - يصنّف: submitted / in_progress / not_started
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../_teacher-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await extractTeacherContext(req);
  if (!ctx.teacher) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
  }
  const { id } = await params;
  const own = await checkExamOwnership(id, ctx.teacher, { allowDraft: true, allowClosed: true });
  if (!own.ok) {
    return NextResponse.json({ error: own.error }, { status: own.status || 403 });
  }

  try {
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true, classroomId: true, classroomName: true, title: true,
        maxAttempts: true, totalPoints: true,
      },
    });
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    // جلب طلاب المدرسة (أو صف محدد إن وُجد classroomId)
    const studentWhere: Record<string, unknown> = {
      schoolId: ctx.teacher!.schoolId,
      archived: false,
      status: 'نشط',
    };
    if (exam.classroomId) {
      studentWhere.classroomId = exam.classroomId;
    }
    const students = await db.student.findMany({
      where: studentWhere,
      select: {
        id: true, name: true, studentNumber: true, classroomId: true,
      },
      orderBy: { name: 'asc' },
    });

    // تسليمات هذا الامتحان
    const submissions = await db.submission.findMany({
      where: { examId: id },
      select: {
        id: true, studentId: true, status: true, attemptNumber: true,
        totalScore: true, percentage: true, passed: true,
        startedAt: true, submittedAt: true,
      },
      orderBy: { attemptNumber: 'desc' },
    });

    // تجميع التسليمات لكل طالب
    const subsByStudent = new Map<string, typeof submissions>();
    for (const s of submissions) {
      if (!subsByStudent.has(s.studentId)) subsByStudent.set(s.studentId, []);
      subsByStudent.get(s.studentId)!.push(s);
    }

    const roster = students.map(st => {
      const subs = subsByStudent.get(st.id) || [];
      const completed = subs.filter(s => s.status !== 'IN_PROGRESS');
      const inProgress = subs.find(s => s.status === 'IN_PROGRESS');
      const best = subs
        .filter(s => s.percentage != null)
        .reduce((m, s) => ((s.percentage! > m) ? s.percentage! : m), 0) || null;

      let category: 'submitted' | 'in_progress' | 'not_started';
      if (inProgress && completed.length === 0) category = 'in_progress';
      else if (completed.length > 0) category = 'submitted';
      else category = 'not_started';

      return {
        studentId: st.id,
        studentName: st.name,
        studentNumber: st.studentNumber,
        attemptsUsed: completed.length,
        attemptsRemaining: Math.max(0, exam.maxAttempts - completed.length),
        inProgressSubmissionId: inProgress?.id || null,
        bestPercentage: best,
        passed: subs.some(s => s.passed === true),
        lastAttemptStatus: subs[0]?.status || null,
        category,
      };
    });

    // إحصاءات
    const summary = {
      totalStudents: roster.length,
      submitted: roster.filter(r => r.category === 'submitted').length,
      inProgress: roster.filter(r => r.category === 'in_progress').length,
      notStarted: roster.filter(r => r.category === 'not_started').length,
      passed: roster.filter(r => r.passed).length,
      avgBest: (() => {
        const vals = roster.map(r => r.bestPercentage).filter((v): v is number => v !== null);
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : 0;
      })(),
    };

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        classroomName: exam.classroomName || 'كل الطلاب',
      },
      summary,
      roster,
    });
  } catch (e) {
    console.error('[teacher roster] error:', e);
    return NextResponse.json(
      { error: 'فشل جلب قائمة الطلاب', details: (e as Error).message },
      { status: 500 }
    );
  }
}
