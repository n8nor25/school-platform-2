/**
 * ============================================================
 *  POST /api/exams/teacher/[id]/archive
 *  ============================================================
 *  يُؤرشف الامتحان (CLOSED → ARCHIVED). يُبقي البيانات لكن يُخفيه.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../_teacher-helpers';

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

    const ownership = await checkExamOwnership(examId, teacher, { allowClosed: true });
    if (!ownership.ok || !ownership.exam) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }
    const exam = ownership.exam;

    if (exam.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'الامتحان مؤرشف بالفعل' }, { status: 400 });
    }

    // نسمح بأرشفة CLOSED أو PUBLISHED (مع تحذير إن كان منشوراً)
    if (exam.status === 'PUBLISHED') {
      // إغلاق أي محاولات جارية أولاً
      const now = new Date();
      await db.submission.updateMany({
        where: { examId, status: 'IN_PROGRESS' },
        data: { status: 'AUTO_CLOSED', autoClosedAt: now, submittedAt: now },
      });
    }

    const updated = await db.exam.update({
      where: { id: examId },
      data: { status: 'ARCHIVED' },
    });

    return NextResponse.json({
      success: true,
      message: 'تمت أرشفة الامتحان',
      exam: { id: updated.id, status: updated.status },
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/archive] error:', error);
    return NextResponse.json(
      { error: 'فشل أرشفة الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
