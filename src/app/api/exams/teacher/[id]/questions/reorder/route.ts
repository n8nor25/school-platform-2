/**
 * ============================================================
 *  PUT /api/exams/teacher/[id]/questions/reorder
 *  ============================================================
 *  يُعيد ترتيب الأسئلة.
 *
 *  Body: { questionIds: string[] }  (بالترتيب الجديد)
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../../_teacher-helpers';

export async function PUT(
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
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }

    const body = await request.json().catch(() => ({})) as {
      questionIds?: string[];
    };

    if (!Array.isArray(body.questionIds) || body.questionIds.length === 0) {
      return NextResponse.json({ error: 'قائمة معرفات الأسئلة مطلوبة' }, { status: 400 });
    }

    // التحقق من أن كل المعرفات تنتمي للامتحان
    const existing = await db.question.findMany({
      where: { examId, id: { in: body.questionIds } },
      select: { id: true },
    });
    if (existing.length !== body.questionIds.length) {
      return NextResponse.json(
        { error: 'بعض المعرفات لا تنتمي لهذا الامتحان' },
        { status: 400 }
      );
    }

    // تحديث الترتيب
    await Promise.all(
      body.questionIds.map((qid, i) =>
        db.question.update({ where: { id: qid }, data: { order: i + 1 } })
      )
    );

    return NextResponse.json({
      success: true,
      message: 'تم تحديث ترتيب الأسئلة',
      reordered: body.questionIds.length,
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/questions/reorder] error:', error);
    return NextResponse.json(
      { error: 'فشل إعادة الترتيب', details: (error as Error).message },
      { status: 500 }
    );
  }
}
