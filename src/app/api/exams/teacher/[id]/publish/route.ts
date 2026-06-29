/**
 * ============================================================
 *  POST /api/exams/teacher/[id]/publish
 *  ============================================================
 *  يُنشر الامتحان (DRAFT → PUBLISHED).
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership, recomputeExamTotalPoints } from '../../../_teacher-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const ownership = await checkExamOwnership(examId, teacher, { allowDraft: true });
    if (!ownership.ok || !ownership.exam) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }
    const exam = ownership.exam;

    if (exam.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `لا يمكن نشر امتحان بحالة ${exam.status}` },
        { status: 400 }
      );
    }

    const questionsCount = await db.question.count({ where: { examId } });
    if (questionsCount === 0) {
      return NextResponse.json(
        { error: 'لا يمكن نشر امتحان بدون أسئلة' },
        { status: 400 }
      );
    }

    const totalPoints = await recomputeExamTotalPoints(examId);
    if (totalPoints <= 0) {
      return NextResponse.json(
        { error: 'مجموع نقاط الأسئلة يجب أن يكون أكبر من صفر' },
        { status: 400 }
      );
    }

    const now = new Date();
    if (exam.endDate <= now) {
      return NextResponse.json(
        { error: 'وقت انتهاء الامتحان يجب أن يكون في المستقبل' },
        { status: 400 }
      );
    }

    const updated = await db.exam.update({
      where: { id: examId },
      data: { status: 'PUBLISHED' },
    });

    return NextResponse.json({
      success: true,
      message: 'تم نشر الامتحان. أصبح متاحاً للطلاب.',
      exam: { id: updated.id, status: updated.status, totalPoints },
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/publish] error:', error);
    return NextResponse.json(
      { error: 'فشل نشر الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
