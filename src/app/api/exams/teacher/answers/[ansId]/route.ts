/**
 * ============================================================
 *  POST /api/exams/teacher/answers/[ansId]/grade
 *  ============================================================
 *  يُصحّح إجابة يدوياً.
 *
 *  Body: {
 *    score: number,           // الدرجة (0 إلى maxScore)
 *    isCorrect?: boolean,
 *    teacherNote?: string,    // ملاحظة للطالب (تُمر عبر pipeline الأمان)
 *    aiAssisted?: boolean     // هل استُخدم AI؟ (للسجل)
 *  }
 *
 *  Query: schoolId, teacherId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, sanitizeCorrectText } from '../../../_teacher-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ansId: string }> }
) {
  try {
    const { ansId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    // نتحقق من أن الإجابة تخص امتحاناً يملكه المعلم
    const answer = await db.answer.findFirst({
      where: {
        id: ansId,
        schoolId: teacher.schoolId,
        submission: { exam: { teacherId: teacher.teacherId } },
      },
      include: {
        submission: {
          select: {
            id: true,
            status: true,
            examId: true,
            maxScore: true,
            totalScore: true,
          },
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

    // لا يمكن تصحيح إجابة لمحاولة جارية
    if (answer.submission.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'لا يمكن تصحيح إجابة لمحاولة جارية بعد' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      score?: number;
      isCorrect?: boolean;
      teacherNote?: string;
      aiAssisted?: boolean;
    };

    if (body.score === undefined || typeof body.score !== 'number') {
      return NextResponse.json({ error: 'الدرجة مطلوبة (number)' }, { status: 400 });
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
        return NextResponse.json({ error: 'الملاحظة تتجاوز 2000 حرف' }, { status: 400 });
      }
      const s = sanitizeCorrectText(body.teacherNote);
      teacherNoteClean = s.cleanedText;
    }

    // تحديث الإجابة
    const updated = await db.answer.update({
      where: { id: ansId },
      data: {
        score: body.score,
        isCorrect: body.isCorrect ?? body.score >= maxScore * 0.5,
        teacherNote: teacherNoteClean,
        maxScore,
        gradedAt: new Date(),
        gradedById: teacher.teacherId,
      },
    });

    // تسجيل في سجل الإشراف
    await db.examModerationLog.create({
      data: {
        schoolId: teacher.schoolId,
        answerId: ansId,
        questionId: answer.questionId,
        action: 'HUMAN_APPROVED',
        targetType: 'grade',
        reason: `تصحيح يدوي: الدرجة ${body.score}/${maxScore}`,
        reviewerId: teacher.teacherId,
        reviewerName: teacher.teacherName,
        metadata: JSON.stringify({
          aiAssisted: body.aiAssisted ?? false,
          teacherNote: !!teacherNoteClean,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'تم حفظ التصحيح',
      answer: {
        id: updated.id,
        score: updated.score,
        maxScore: updated.maxScore,
        isCorrect: updated.isCorrect,
        teacherNote: updated.teacherNote,
        gradedAt: updated.gradedAt,
        gradedById: updated.gradedById,
      },
      note: 'استدعِ POST /api/exams/teacher/submissions/[subId]/finalize لإعادة حساب النتيجة الإجمالية وحفظها.',
    });
  } catch (error) {
    console.error('[exams/teacher/answers/[ansId]/grade] error:', error);
    return NextResponse.json(
      { error: 'فشل حفظ التصحيح', details: (error as Error).message },
      { status: 500 }
    );
  }
}
