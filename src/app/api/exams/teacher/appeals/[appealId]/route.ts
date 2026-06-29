/**
 * ============================================================
 *  POST /api/exams/teacher/appeals/[appealId]/review
 *  ============================================================
 *  يراجع المعلم تظلّماً ويوافق/يرفض.
 *
 *  Body: {
 *    action: "APPROVED" | "REJECTED",
 *    newScore?: number,      // إن APPROVED: الدرجة الجديدة (اختياري، يأخذ requestedScore إن لم يُحدّد)
 *    teacherReply?: string   // رد المعلم (يُمر عبر pipeline الأمان)
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
  { params }: { params: Promise<{ appealId: string }> }
) {
  try {
    const { appealId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    // نتحقق من أن التظلّم يخص امتحاناً يملكه المعلم
    const appeal = await db.examAppeal.findFirst({
      where: {
        id: appealId,
        schoolId: teacher.schoolId,
        submission: { exam: { teacherId: teacher.teacherId } },
      },
      include: {
        answer: {
          select: { id: true, maxScore: true, score: true, submissionId: true },
        },
      },
    });

    if (!appeal) {
      return NextResponse.json(
        { error: 'التظلّم غير موجود أو لا تملك صلاحية عليه' },
        { status: 404 }
      );
    }

    if (appeal.status !== 'PENDING') {
      return NextResponse.json(
        { error: `تمت مراجعة هذا التظلّم بالفعل (الحالة: ${appeal.status})` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      action?: string;
      newScore?: number;
      teacherReply?: string;
    };

    if (!body.action || !['APPROVED', 'REJECTED'].includes(body.action)) {
      return NextResponse.json(
        { error: 'الإجراء مطلوب (APPROVED أو REJECTED)' },
        { status: 400 }
      );
    }

    // تعقيم رد المعلم
    let teacherReplyClean: string | null = null;
    if (body.teacherReply) {
      if (body.teacherReply.length > 2000) {
        return NextResponse.json({ error: 'الرد يتجاوز 2000 حرف' }, { status: 400 });
      }
      const s = sanitizeCorrectText(body.teacherReply);
      teacherReplyClean = s.cleanedText;
    }

    // تحديث التظلّم
    const updated = await db.examAppeal.update({
      where: { id: appealId },
      data: {
        status: body.action as 'APPROVED' | 'REJECTED',
        teacherReply: teacherReplyClean,
        reviewedById: teacher.teacherId,
        reviewedAt: new Date(),
      },
    });

    // إن وُافق: تحديث درجة الإجابة
    if (body.action === 'APPROVED') {
      const newScore =
        body.newScore !== undefined
          ? body.newScore
          : appeal.requestedScore ?? appeal.answer.score;

      const maxScore = appeal.answer.maxScore;
      if (newScore < 0 || newScore > maxScore) {
        return NextResponse.json(
          { error: `الدرجة الجديدة يجب أن تكون بين 0 و ${maxScore}` },
          { status: 400 }
        );
      }

      await db.answer.update({
        where: { id: appeal.answer.id },
        data: {
          score: newScore,
          isCorrect: newScore >= maxScore * 0.5,
          gradedAt: new Date(),
          gradedById: teacher.teacherId,
          teacherNote: teacherReplyClean
            ? `${appeal.answer.score ?? ''} → ${newScore}: ${teacherReplyClean}`.slice(0, 2000)
            : `تظلّم مقبول: ${appeal.answer.score ?? ''} → ${newScore}`,
        },
      });

      // إعادة حساب نتيجة التسليم بالكامل
      const allAnswers = await db.answer.findMany({
        where: { submissionId: appeal.answer.submissionId },
        select: { score: true },
      });
      const totalScore = allAnswers.reduce((sum, a) => sum + (a.score || 0), 0);

      const submission = await db.submission.findUnique({
        where: { id: appeal.answer.submissionId },
        select: { maxScore: true, exam: { select: { passingScore: true } } },
      });

      if (submission) {
        const maxScore2 = submission.maxScore || 0;
        const percentage = maxScore2 > 0 ? (totalScore / maxScore2) * 100 : 0;
        const passingScore = submission.exam.passingScore ?? 0;
        await db.submission.update({
          where: { id: appeal.answer.submissionId },
          data: {
            totalScore,
            percentage,
            passed: totalScore >= passingScore,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message:
        body.action === 'APPROVED'
          ? 'تم قبول التظلّم وتحديث الدرجة'
          : 'تم رفض التظلّم',
      appeal: {
        id: updated.id,
        status: updated.status,
        teacherReply: updated.teacherReply,
        reviewedAt: updated.reviewedAt,
      },
      newScore: body.action === 'APPROVED' ? (body.newScore ?? appeal.requestedScore ?? appeal.answer.score) : appeal.answer.score,
    });
  } catch (error) {
    console.error('[exams/teacher/appeals/[appealId]/review] error:', error);
    return NextResponse.json(
      { error: 'فشل مراجعة التظلّم', details: (error as Error).message },
      { status: 500 }
    );
  }
}
