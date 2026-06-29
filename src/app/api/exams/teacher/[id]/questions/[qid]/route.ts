/**
 * ============================================================
 *  PUT /api/exams/teacher/[id]/questions/[qid]
 *  ============================================================
 *  يُحدّث سؤالاً موجوداً.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractTeacherContext,
  checkExamOwnership,
  sanitizeQuestionText,
  sanitizeCorrectText,
  validateQuestionData,
  recomputeExamTotalPoints,
} from '../../../../_teacher-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  try {
    const { id: examId, qid: questionId } = await params;
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

    // منع تعديل أسئلة امتحان منشور له تسليمات
    if (exam.status === 'PUBLISHED' && exam._count.submissions > 0) {
      return NextResponse.json(
        { error: `لا يمكن تعديل أسئلة امتحان منشور له ${exam._count.submissions} تسليم` },
        { status: 409 }
      );
    }

    const existing = await db.question.findFirst({
      where: { id: questionId, examId, schoolId: teacher.schoolId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as {
      type?: string;
      text?: string;
      options?: string[] | null;
      correctAnswer?: string | null;
      correctText?: string | null;
      rubric?: Record<string, unknown> | null;
      points?: number;
      order?: number;
      explanation?: string | null;
    };

    const updateData: Record<string, unknown> = {};

    if (body.type !== undefined) {
      const validation = validateQuestionData(body.type, {
        text: body.text ?? existing.text,
        options: body.options ?? (existing.options ? JSON.parse(existing.options) : null),
        correctAnswer: body.correctAnswer ?? existing.correctAnswer,
        correctText: body.correctText ?? existing.correctText,
        points: body.points ?? existing.points,
      });
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      updateData.type = body.type as 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF';
    }

    if (body.text !== undefined) {
      const sanitized = await sanitizeQuestionText(body.text, false);
      updateData.text = sanitized.cleanedText;
      updateData.textModeration = sanitized.moderation.decision === 'SAFE' ? 'SAFE' : 'FLAGGED';
      updateData.moderationNotes = JSON.stringify({
        reasons: sanitized.moderation.reasons,
        categories: sanitized.moderation.categories,
      });
      updateData.moderatedAt = new Date();
    }

    if (body.options !== undefined) {
      updateData.options = body.options ? JSON.stringify(body.options) : null;
    }
    if (body.correctAnswer !== undefined) {
      updateData.correctAnswer = body.correctAnswer || null;
    }
    if (body.correctText !== undefined) {
      const s = sanitizeCorrectText(body.correctText);
      updateData.correctText = s.cleanedText || null;
    }
    if (body.rubric !== undefined) {
      updateData.rubric = body.rubric ? JSON.stringify(body.rubric) : null;
    }
    if (body.points !== undefined) {
      if (body.points < 0 || body.points > 100) {
        return NextResponse.json({ error: 'الدرجة يجب أن تكون بين 0 و 100' }, { status: 400 });
      }
      updateData.points = body.points;
    }
    if (body.order !== undefined) {
      updateData.order = body.order;
    }
    if (body.explanation !== undefined) {
      updateData.explanation = body.explanation || null;
    }

    const updated = await db.question.update({
      where: { id: questionId },
      data: updateData,
    });

    // إعادة حساب النقاط إن تغيّرت
    if (body.points !== undefined) {
      await recomputeExamTotalPoints(examId);
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث السؤال',
      question: { ...updated, options: updated.options ? JSON.parse(updated.options) : null },
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/questions/[qid] PUT] error:', error);
    return NextResponse.json(
      { error: 'فشل تحديث السؤال', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  DELETE /api/exams/teacher/[id]/questions/[qid]
 *  ============================================================
 *  يحذف سؤالاً.
 * ============================================================
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  try {
    const { id: examId, qid: questionId } = await params;
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

    if (exam.status === 'PUBLISHED' && exam._count.submissions > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف أسئلة امتحان منشور له ${exam._count.submissions} تسليم` },
        { status: 409 }
      );
    }

    const existing = await db.question.findFirst({
      where: { id: questionId, examId, schoolId: teacher.schoolId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });
    }

    await db.question.delete({ where: { id: questionId } });

    // إعادة ترقيم الترتيب + إعادة حساب النقاط
    const remaining = await db.question.findMany({
      where: { examId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    await Promise.all(
      remaining.map((q, i) =>
        db.question.update({ where: { id: q.id }, data: { order: i + 1 } })
      )
    );
    await recomputeExamTotalPoints(examId);

    return NextResponse.json({
      success: true,
      message: 'تم حذف السؤال',
      remainingQuestions: remaining.length,
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/questions/[qid] DELETE] error:', error);
    return NextResponse.json(
      { error: 'فشل حذف السؤال', details: (error as Error).message },
      { status: 500 }
    );
  }
}
