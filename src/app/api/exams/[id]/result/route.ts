/**
 * ============================================================
 *  GET /api/exams/[id]/result
 *  ============================================================
 *  يُرجع نتيجة الطالب بعد التسليم.
 *
 *  - إن كان showResultImmediately=true يُرجع التفاصيل فوراً
 *  - وإلا ينتظر حتى يُصحّح المعلم الأسئلة المقالية (status=GRADED)
 *  - يخفي الإجابات الصحيحة إن لم يُفعّل allowReview
 *
 *  Query: schoolId, studentId, submissionId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import { extractStudentContext } from '../../_helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);

    const { student, error, status } = await extractStudentContext(request, searchParams.get('schoolId'));
    if (!student) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const submissionId = searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json({ error: 'معرف المحاولة مطلوب' }, { status: 400 });
    }

    const submission = await db.submission.findFirst({
      where: {
        id: submissionId,
        examId,
        studentId: student.studentId,
        schoolId: student.schoolId,
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            totalPoints: true,
            passingScore: true,
            showResultImmediately: true,
            allowReview: true,
            durationMinutes: true,
          },
        },
        answers: {
          select: {
            id: true,
            questionId: true,
            textAnswer: true,
            imageAnswerUrl: true,
            fileAnswerUrl: true,
            textModeration: true,
            imageModeration: true,
            score: true,
            maxScore: true,
            isCorrect: true,
            teacherNote: true,
            aiSuggestedScore: true,
            gradedAt: true,
          },
        },
        violations: {
          select: { id: true, type: true, severity: true, details: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'المحاولة غير موجودة' }, { status: 404 });
    }

    // إن لم تُسلَّم بعد
    if (submission.status === 'IN_PROGRESS') {
      return NextResponse.json({
        success: true,
        status: 'IN_PROGRESS',
        message: 'لم يتم تسليم المحاولة بعد',
      });
    }

    // إن لم تُصحّح بعد وshowResultImmediately=false
    if (submission.status === 'SUBMITTED' && !submission.exam.showResultImmediately) {
      return NextResponse.json({
        success: true,
        status: 'SUBMITTED',
        message: 'تم تسليم المحاولة. النتيجة غير متاحة حتى يُكمل المعلم التصحيح.',
        submittedAt: submission.submittedAt,
      });
    }

    // إعداد الإجابات
    const showCorrectAnswers = submission.exam.allowReview && submission.status === 'GRADED';

    const answers = submission.answers.map(a => ({
      id: a.id,
      questionId: a.questionId,
      hasText: !!a.textAnswer,
      hasImage: !!a.imageAnswerUrl,
      hasFile: !!a.fileAnswerUrl,
      textModeration: a.textModeration,
      imageModeration: a.imageModeration,
      score: a.score,
      maxScore: a.maxScore,
      isCorrect: a.isCorrect,
      teacherNote: a.teacherNote,
      aiSuggestedScore: a.aiSuggestedScore,
      graded: !!a.gradedAt,
    }));

    return NextResponse.json({
      success: true,
      result: {
        submissionId: submission.id,
        status: submission.status,
        startedAt: submission.startedAt,
        submittedAt: submission.submittedAt,
        autoClosedAt: submission.autoClosedAt,
        gradedAt: submission.gradedAt,
        totalScore: submission.totalScore,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        passed: submission.passed,
        passingScore: submission.exam.passingScore,
        exam: {
          id: submission.exam.id,
          title: submission.exam.title,
          subject: submission.exam.subject,
          totalPoints: submission.exam.totalPoints,
        },
        answers,
        showCorrectAnswers,
        violations: submission.violations,
        violationsCount: submission.violations.length,
        autoClosed: submission.status === 'AUTO_CLOSED',
      },
    });
  } catch (error) {
    console.error('[exams/[id]/result] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب النتيجة', details: (error as Error).message },
      { status: 500 }
    );
  }
}
