/**
 * ============================================================
 *  POST /api/exams/teacher/questions/[qid]/improve
 * ============================================================
 *  يستخدم LLM لاقتراح تحسينات على نص السؤال + معايير التصحيح + التفسير.
 *
 *  Body: (فارغ)
 *  Returns: { suggestedQuestionText, suggestedRubric, suggestedExplanation, reasoning, modelUsed, success }
 *
 *  الصلاحيات: المعلم يملك امتحان السؤال.
 *  ملاحظة: هذا المسار يقترح فقط ولا يُطبّق — يحتاج المعلم لاستدعاء
 *  PUT /api/exams/teacher/[id]/questions/[qid] لتطبيق التحسين.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../../_teacher-helpers';
import { suggestQuestionImprovement } from '@/lib/exam-security/grade-assist';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ qid: string }> }
) {
  try {
    const { qid: questionId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(
      request,
      searchParams.get('schoolId')
    );
    if (!teacher) {
      return NextResponse.json(
        { error: error || 'فشل المصادقة' },
        { status: status || 401 }
      );
    }

    // نحمّل السؤال مع امتحانه للتحقق من الملكية
    const question = await db.question.findFirst({
      where: { id: questionId, schoolId: teacher.schoolId },
      select: {
        id: true,
        examId: true,
        type: true,
        text: true,
        options: true,
        correctAnswer: true,
        correctText: true,
        rubric: true,
        points: true,
        explanation: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'السؤال غير موجود' },
        { status: 404 }
      );
    }

    // التحقق من ملكية الامتحان
    const ownership = await checkExamOwnership(question.examId, teacher, {
      allowDraft: true,
      allowClosed: true,
    });
    if (!ownership.ok) {
      return NextResponse.json(
        { error: ownership.error },
        { status: ownership.status || 403 }
      );
    }

    // إعداد الخيارات
    let options: string[] | null = null;
    if (question.options) {
      try {
        const parsed = JSON.parse(question.options);
        if (Array.isArray(parsed)) options = parsed as string[];
      } catch {
        options = null;
      }
    }

    // إعداد rubric
    let rubric: unknown = null;
    if (question.rubric) {
      try {
        rubric = JSON.parse(question.rubric);
      } catch {
        rubric = question.rubric;
      }
    }

    const result = await suggestQuestionImprovement({
      type: question.type,
      text: question.text,
      options,
      correctAnswer: question.correctAnswer,
      correctText: question.correctText,
      rubric,
      points: question.points,
    });

    return NextResponse.json({
      success: result.success,
      suggestion: {
        suggestedQuestionText: result.suggestedQuestionText,
        suggestedRubric: result.suggestedRubric,
        suggestedExplanation: result.suggestedExplanation,
        reasoning: result.reasoning,
        modelUsed: result.modelUsed,
      },
      original: {
        id: question.id,
        type: question.type,
        text: question.text,
        points: question.points,
      },
      note: 'الاقتراح غير مُطبَّق — استدعِ PUT /api/exams/teacher/[id]/questions/[qid] لتطبيقه.',
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error(
      '[exams/teacher/questions/[qid]/improve] error:',
      error
    );
    return NextResponse.json(
      { error: 'فشل اقتراح التحسين', details: (error as Error).message },
      { status: 500 }
    );
  }
}
