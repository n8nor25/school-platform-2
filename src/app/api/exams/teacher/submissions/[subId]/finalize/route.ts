/**
 * ============================================================
 *  POST /api/exams/teacher/submissions/[subId]/finalize
 *  ============================================================
 *  يُنهي تصحيح التسليم:
 *    - يُعيد حساب totalScore من كل الإجابات المصحّحة
 *    - يُحدّث percentage و passed
 *    - يُغيّر الحالة إلى GRADED
 *
 *  Query: schoolId, teacherId
 *  Body: { notes?: string }
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext } from '../../../../_teacher-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  try {
    const { subId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const submission = await db.submission.findFirst({
      where: {
        id: subId,
        schoolId: teacher.schoolId,
        exam: { teacherId: teacher.teacherId },
      },
      include: {
        exam: {
          select: { id: true, totalPoints: true, passingScore: true },
        },
        answers: {
          select: {
            id: true,
            score: true,
            maxScore: true,
            gradedAt: true,
            question: { select: { type: true, points: true } },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'التسليم غير موجود أو لا تملك صلاحية عليه' },
        { status: 404 }
      );
    }

    if (submission.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'لا يمكن إنهاء تصحيح محاولة جارية' },
        { status: 400 }
      );
    }

    // التحقق من تصحيح كل الإجابات اليدوية
    const ungradedAnswers = submission.answers.filter(
      (a) => a.gradedAt === null && ['SHORT', 'ESSAY', 'IMAGE_ANSWER', 'FILE_PDF'].includes(a.question.type)
    );

    const body = await request.json().catch(() => ({})) as { notes?: string; force?: boolean };

    if (ungradedAnswers.length > 0 && !body.force) {
      return NextResponse.json(
        {
          error: `يوجد ${ungradedAnswers.length} إجابة غير مُصحّحة بعد`,
          ungradedCount: ungradedAnswers.length,
          ungradedAnswerIds: ungradedAnswers.map((a) => a.id),
          hint: 'استخدم force=true لإنهاء التصحيح حتى مع وجود إجابات غير مصحّحة (تُعطى درجة 0).',
        },
        { status: 409 }
      );
    }

    // منح درجة 0 للإجابات غير المصحّحة إن force=true
    if (ungradedAnswers.length > 0 && body.force) {
      await db.answer.updateMany({
        where: { id: { in: ungradedAnswers.map((a) => a.id) } },
        data: {
          score: 0,
          isCorrect: false,
          gradedAt: new Date(),
          gradedById: teacher.teacherId,
        },
      });
    }

    // إعادة حساب totalScore
    const allAnswers = await db.answer.findMany({
      where: { submissionId: subId },
      select: { score: true, maxScore: true },
    });

    const totalScore = allAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
    const maxScore = submission.exam.totalPoints;
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    const passingScore = submission.exam.passingScore ?? 0;
    const passed = totalScore >= passingScore;

    const updated = await db.submission.update({
      where: { id: subId },
      data: {
        status: 'GRADED',
        totalScore,
        maxScore,
        percentage,
        passed,
        gradedAt: new Date(),
        gradedById: teacher.teacherId,
        gradedByName: teacher.teacherName,
        notes: body.notes || submission.notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم إنهاء التصحيح وحفظ النتيجة النهائية',
      result: {
        submissionId: updated.id,
        status: updated.status,
        totalScore: updated.totalScore,
        maxScore: updated.maxScore,
        percentage: Math.round((updated.percentage || 0) * 100) / 100,
        passed: updated.passed,
        gradedAt: updated.gradedAt,
        gradedByName: updated.gradedByName,
      },
    });
  } catch (error) {
    console.error('[exams/teacher/submissions/[subId]/finalize] error:', error);
    return NextResponse.json(
      { error: 'فشل إنهاء التصحيح', details: (error as Error).message },
      { status: 500 }
    );
  }
}
