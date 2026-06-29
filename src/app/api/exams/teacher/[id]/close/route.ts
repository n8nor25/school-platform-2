/**
 * ============================================================
 *  POST /api/exams/teacher/[id]/close
 *  ============================================================
 *  يُغلق الامتحان (PUBLISHED → CLOSED). يمنع الطلاب من بدء محاولات جديدة.
 *  المحاولات الجارية تُغلق تلقائياً.
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

    const ownership = await checkExamOwnership(examId, teacher, { allowDraft: true, allowClosed: true });
    if (!ownership.ok || !ownership.exam) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }
    const exam = ownership.exam;

    if (exam.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: `لا يمكن إغلاق امتحان بحالة ${exam.status}` },
        { status: 400 }
      );
    }

    // إغلاق المحاولات الجارية تلقائياً
    const now = new Date();
    const activeSubs = await db.submission.findMany({
      where: { examId, status: 'IN_PROGRESS' },
      select: { id: true },
    });

    if (activeSubs.length > 0) {
      await db.submission.updateMany({
        where: { id: { in: activeSubs.map((s) => s.id) } },
        data: {
          status: 'AUTO_CLOSED',
          autoClosedAt: now,
          submittedAt: now,
        },
      });
    }

    // تعجيل وقت الانتهاء إلى الآن (لمنع أي بدء جديد)
    const updated = await db.exam.update({
      where: { id: examId },
      data: {
        status: 'CLOSED',
        endDate: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم إغلاق الامتحان. ${activeSubs.length} محاولة جارية أُغلقت تلقائياً.`,
      exam: { id: updated.id, status: updated.status, endDate: updated.endDate },
      closedSubmissions: activeSubs.length,
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/close] error:', error);
    return NextResponse.json(
      { error: 'فشل إغلاق الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
