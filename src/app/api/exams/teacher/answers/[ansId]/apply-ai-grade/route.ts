/**
 * ============================================================
 *  POST /api/exams/teacher/answers/[ansId]/apply-ai-grade
 * ============================================================
 *  يطبّق درجة أكدها المعلم بعد مراجعة اقتراح الذكاء الاصطناعي.
 *
 *  Body: { score: number, teacherNote?: string }
 *  - نفس منطق التصحيح اليدوي + تسجيل aiAssisted: true.
 *
 *  Query: schoolId, teacherId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, sanitizeCorrectText } from '../../../../_teacher-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ansId: string }> }
) {
  try {
    const { ansId } = await params;
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

    const answer = await db.answer.findFirst({
      where: {
        id: ansId,
        schoolId: teacher.schoolId,
        submission: { exam: { teacherId: teacher.teacherId } },
      },
      include: {
        submission: {
          select: { id: true, status: true, examId: true },
        },
        question: {
          select: { id: true, points: true, type: true },
        },
      },
    });

    if (!answer) {
      return NextResponse.json(
        { error: 'الإجابة غير موجودة أو لا تملك صلاحية عليها' },
        { status: 404 }
      );
    }

    if (answer.submission.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'لا يمكن تصحيح إجابة لمحاولة جارية بعد' },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      score?: number;
      teacherNote?: string;
    };

    if (body.score === undefined || typeof body.score !== 'number') {
      return NextResponse.json(
        { error: 'الدرجة مطلوبة (number)' },
        { status: 400 }
      );
    }

    const maxScore = answer.maxScore || answer.question.points;
    if (body.score < 0 || body.score > maxScore) {
      return NextResponse.json(
        { error: `الدرجة يجب أن تكون بين 0 و ${maxScore}` },
        { status: 400 }
      );
    }

    // تعقيم ملاحظة المعلم
    let teacherNoteClean: string | null = null;
    if (body.teacherNote) {
      if (body.teacherNote.length > 2000) {
        return NextResponse.json(
          { error: 'الملاحظة تتجاوز 2000 حرف' },
          { status: 400 }
        );
      }
      const s = sanitizeCorrectText(body.teacherNote);
      teacherNoteClean = s.cleanedText;
    }

    const updated = await db.answer.update({
      where: { id: ansId },
      data: {
        score: body.score,
        isCorrect: body.score >= maxScore * 0.5,
        teacherNote: teacherNoteClean,
        maxScore,
        aiAssisted: true,
        lastAiAssistAt: new Date(),
        gradedAt: new Date(),
        gradedById: teacher.teacherId,
      },
    });

    // سجل الإشراف — يُوثّق أن التصحيح بمساعدة AI
    await db.examModerationLog
      .create({
        data: {
          schoolId: teacher.schoolId,
          answerId: ansId,
          questionId: answer.questionId,
          action: 'HUMAN_APPROVED',
          targetType: 'grade',
          reason: `تصحيح بمساعدة AI: الدرجة ${body.score}/${maxScore}`,
          reviewerId: teacher.teacherId,
          reviewerName: teacher.teacherName,
          metadata: JSON.stringify({
            aiAssisted: true,
            appliedScore: body.score,
            teacherNote: !!teacherNoteClean,
          }),
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'تم حفظ التصحيح بمساعدة الذكاء الاصطناعي',
      answer: {
        id: updated.id,
        score: updated.score,
        maxScore: updated.maxScore,
        isCorrect: updated.isCorrect,
        teacherNote: updated.teacherNote,
        aiAssisted: updated.aiAssisted,
        lastAiAssistAt: updated.lastAiAssistAt,
        gradedAt: updated.gradedAt,
        gradedById: updated.gradedById,
      },
      note: 'استدعِ POST /api/exams/teacher/submissions/[subId]/finalize لإعادة حساب النتيجة الإجمالية.',
    });
  } catch (error) {
    console.error(
      '[exams/teacher/answers/[ansId]/apply-ai-grade] error:',
      error
    );
    return NextResponse.json(
      { error: 'فشل حفظ التصحيح', details: (error as Error).message },
      { status: 500 }
    );
  }
}
