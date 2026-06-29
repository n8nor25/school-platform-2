/**
 * ============================================================
 *  GET /api/exams/teacher/[id]/questions
 *  ============================================================
 *  يُرجع أسئلة الامتحان (مع الإجابات الصحيحة).
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../_teacher-helpers';

export async function GET(
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

    const questions = await db.question.findMany({
      where: { examId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      count: questions.length,
      questions: questions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        rubric: q.rubric ? JSON.parse(q.rubric) : null,
      })),
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/questions GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب الأسئلة', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  POST /api/exams/teacher/[id]/questions
 *  ============================================================
 *  يُضيف سؤالاً جديداً للاختبار.
 *
 *  Body: {
 *    type, text, options?, correctAnswer?, correctText?,
 *    rubric?, points?, order?, explanation?,
 *    fromQuestionBankId?  (إن كان يُستنسخ من بنك الأسئلة)
 *  }
 * ============================================================
 */

import {
  sanitizeQuestionText,
  sanitizeCorrectText,
  validateQuestionData,
  recomputeExamTotalPoints,
} from '../../../_teacher-helpers';

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

    // تحذير: إضافة أسئلة لامتحان منشور له تسليمات
    if (exam.status === 'PUBLISHED' && exam._count.submissions > 0) {
      return NextResponse.json(
        {
          error: `لا يمكن إضافة أسئلة لامتحان منشور له ${exam._count.submissions} تسليم. أغلق الامتحان أولاً أو أنشئ امتحاناً جديداً.`,
        },
        { status: 409 }
      );
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
      explanation?: string;
      fromQuestionBankId?: string;
    };

    // إن كان يُستنسخ من بنك الأسئلة
    if (body.fromQuestionBankId) {
      const bankQ = await db.questionBank.findFirst({
        where: {
          id: body.fromQuestionBankId,
          schoolId: teacher.schoolId,
          OR: [
            { teacherId: teacher.teacherId },
            { isPublic: true },
          ],
        },
      });
      if (!bankQ) {
        return NextResponse.json({ error: 'السؤال غير موجود في بنك الأسئلة' }, { status: 404 });
      }

      // حساب الترتيب التالي
      const maxOrder = await db.question.findFirst({
        where: { examId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const newQ = await db.question.create({
        data: {
          schoolId: teacher.schoolId,
          examId,
          type: bankQ.type,
          text: bankQ.text,
          options: bankQ.options,
          correctAnswer: bankQ.correctAnswer,
          correctText: bankQ.correctText,
          rubric: bankQ.rubric,
          points: bankQ.points,
          order: body.order ?? (maxOrder?.order ?? 0) + 1,
          explanation: bankQ.explanation,
          textModeration: bankQ.textModeration,
          imageModeration: bankQ.imageModeration,
          moderationNotes: bankQ.moderationNotes,
          moderatedAt: bankQ.moderatedAt,
        },
      });

      // زيادة عدّاد الاستخدام في بنك الأسئلة
      await db.questionBank.update({
        where: { id: bankQ.id },
        data: { usageCount: { increment: 1 } },
      }).catch(() => {});

      await recomputeExamTotalPoints(examId);

      return NextResponse.json({
        success: true,
        message: 'تمت إضافة السؤال من بنك الأسئلة',
        question: { ...newQ, options: newQ.options ? JSON.parse(newQ.options) : null },
      }, { status: 201 });
    }

    // إنشاء سؤال جديد عادي
    if (!body.type) {
      return NextResponse.json({ error: 'نوع السؤال مطلوب' }, { status: 400 });
    }

    const validation = validateQuestionData(body.type, {
      text: body.text,
      options: body.options,
      correctAnswer: body.correctAnswer,
      correctText: body.correctText,
      points: body.points,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // تعقيم نص السؤال
    const sanitized = await sanitizeQuestionText(body.text!, false);
    // تعقيم الإجابة الصحيحة / النص النموذجي
    const correctTextSanitized = body.correctText ? sanitizeCorrectText(body.correctText) : null;

    // حساب الترتيب التالي
    const maxOrder = await db.question.findFirst({
      where: { examId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const question = await db.question.create({
      data: {
        schoolId: teacher.schoolId,
        examId,
        type: body.type as 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF',
        text: sanitized.cleanedText,
        options: body.options ? JSON.stringify(body.options) : null,
        correctAnswer: body.correctAnswer || null,
        correctText: correctTextSanitized?.cleanedText || null,
        rubric: body.rubric ? JSON.stringify(body.rubric) : null,
        points: body.points ?? 1,
        order: body.order ?? (maxOrder?.order ?? 0) + 1,
        explanation: body.explanation || null,
        textModeration: (sanitized.moderation.decision === 'SAFE' ? 'SAFE' : 'FLAGGED') as 'SAFE' | 'FLAGGED',
        moderationNotes: JSON.stringify({
          reasons: sanitized.moderation.reasons,
          categories: sanitized.moderation.categories,
        }),
        moderatedAt: new Date(),
      },
    });

    await recomputeExamTotalPoints(examId);

    return NextResponse.json({
      success: true,
      message: 'تمت إضافة السؤال',
      question: { ...question, options: question.options ? JSON.parse(question.options) : null },
      moderation: {
        decision: sanitized.moderation.decision,
        reasons: sanitized.moderation.reasons,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[exams/teacher/[id]/questions POST] error:', error);
    return NextResponse.json(
      { error: 'فشل إضافة السؤال', details: (error as Error).message },
      { status: 500 }
    );
  }
}
