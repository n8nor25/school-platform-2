/**
 * ============================================================
 *  GET /api/exams/[id]
 *  ============================================================
 *  يُرجع تفاصيل الامتحان للطالب:
 *  • معلومات الامتحان (بدون إجابات صحيحة)
 *  • الأسئلة (بدون correctAnswer/correctText/rubric/explanation)
 *  • حالة المحاولة الحالية للطالب
 *
 *  Query: schoolId, studentId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import { autoCloseExpiredSubmission, getStudentSubmissions, getRemainingSeconds } from '../_helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'));
    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 });
    }

    const studentId = searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'معرف الطالب مطلوب' }, { status: 400 });
    }

    const exam = await db.exam.findFirst({
      where: { id: examId, schoolId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            type: true,
            text: true,
            options: true,
            points: true,
            order: true,
            attachmentUrl: true,
            // لا نُرجع: correctAnswer, correctText, rubric, explanation
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    if (exam.status !== 'PUBLISHED') {
      return NextResponse.json({ error: `الامتحان ${exam.status === 'DRAFT' ? 'مسودة' : 'مؤرشف'}` }, { status: 403 });
    }

    // حالة المحاولة الحالية للطالب
    const { activeSubmission, totalAttempts, lastSubmission } = await getStudentSubmissions(examId, studentId);

    let activeState: Record<string, unknown> | null = null;
    if (activeSubmission) {
      // فحص الإغلاق التلقائي
      const { closed, submission } = await autoCloseExpiredSubmission(activeSubmission.id);
      if (closed || !submission || submission.status !== 'IN_PROGRESS') {
        activeState = null;
      } else {
        const remaining = getRemainingSeconds({
          startedAt: activeSubmission.startedAt,
          exam: { durationMinutes: exam.durationMinutes, endDate: exam.endDate },
        });
        activeState = {
          submissionId: activeSubmission.id,
          attemptNumber: activeSubmission.attemptNumber,
          startedAt: activeSubmission.startedAt,
          remainingSeconds: remaining,
          focusEvents: activeSubmission.focusEvents,
          tabSwitches: activeSubmission.tabSwitches,
          copyAttempts: activeSubmission.copyAttempts,
          lastActivityAt: activeSubmission.lastActivityAt,
        };
      }
    }

    // الأسئلة (نخفي الإجابات الصحيحة تماماً)
    const safeQuestions = exam.questions.map(q => ({
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.options ? JSON.parse(q.options) : null,
      points: q.points,
      order: q.order,
      hasAttachment: !!q.attachmentUrl,
      attachmentUrl: q.attachmentUrl,
    }));

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        subject: exam.subject,
        teacherName: exam.teacherName,
        classroomName: exam.classroomName,
        startDate: exam.startDate,
        endDate: exam.endDate,
        durationMinutes: exam.durationMinutes,
        maxAttempts: exam.maxAttempts,
        shuffleQuestions: exam.shuffleQuestions,
        shuffleOptions: exam.shuffleOptions,
        allowReview: exam.allowReview,
        showResultImmediately: exam.showResultImmediately,
        parentVisible: exam.parentVisible,
        allowTextAnswers: exam.allowTextAnswers,
        allowImageAnswers: exam.allowImageAnswers,
        allowPdfAnswers: exam.allowPdfAnswers,
        antiCheatEnabled: exam.antiCheatEnabled,
        hasPassword: !!exam.passwordHash,
        totalPoints: exam.totalPoints,
        passingScore: exam.passingScore,
      },
      questions: safeQuestions,
      student: {
        attemptsUsed: totalAttempts,
        attemptsLeft: Math.max(0, exam.maxAttempts - totalAttempts),
        activeSubmission: activeState,
        lastSubmission: lastSubmission ? {
          id: lastSubmission.id,
          status: lastSubmission.status,
          submittedAt: lastSubmission.submittedAt,
          totalScore: lastSubmission.totalScore,
          maxScore: lastSubmission.maxScore,
          percentage: lastSubmission.percentage,
          passed: lastSubmission.passed,
        } : null,
      },
      now: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[exams/[id]/GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب تفاصيل الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
