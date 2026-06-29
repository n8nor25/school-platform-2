/**
 * ============================================================
 *  POST /api/exams/[id]/appeals
 *  ============================================================
 *  يقدّم الطالب تظلّماً على درجة سؤال محدد.
 *
 *  Body: { answerId: string, reason: string, requestedScore?: number }
 *  Query: schoolId, studentId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractStudentContext } from '../../_helpers';
import { moderateTextLocal } from '@/lib/exam-security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);

    const { student, error, status } = await extractStudentContext(request, searchParams.get('schoolId'));
    if (!student) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      answerId?: string;
      reason?: string;
      requestedScore?: number;
    };

    if (!body.answerId) {
      return NextResponse.json({ error: 'معرف الإجابة (answerId) مطلوب' }, { status: 400 });
    }
    if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length < 10) {
      return NextResponse.json({ error: 'سبب التظلّم مطلوب (10 أحرف على الأقل)' }, { status: 400 });
    }
    if (body.reason.length > 1000) {
      return NextResponse.json({ error: 'سبب التظلّم يتجاوز 1000 حرف' }, { status: 400 });
    }

    // التحقق من الإجابة
    const answer = await db.answer.findFirst({
      where: {
        id: body.answerId,
        schoolId: student.schoolId,
      },
      include: {
        submission: {
          select: { id: true, examId: true, studentId: true, status: true },
        },
      },
    });

    if (!answer || answer.submission.examId !== examId || answer.submission.studentId !== student.studentId) {
      return NextResponse.json({ error: 'الإجابة غير موجودة أو لا تخصك' }, { status: 404 });
    }

    // التحقق من أن المحاولة مصحّحة
    if (answer.submission.status !== 'GRADED' && answer.submission.status !== 'SUBMITTED') {
      return NextResponse.json({ error: 'لا يمكن التظلّم قبل تسليم المحاولة' }, { status: 400 });
    }

    // التحقق من عدم وجود تظلّم سابق على نفس الإجابة بحالة PENDING
    const existingAppeal = await db.examAppeal.findFirst({
      where: { answerId: body.answerId, status: 'PENDING' },
    });
    if (existingAppeal) {
      return NextResponse.json({ error: 'لديك تظلّم قيد المراجعة على هذه الإجابة بالفعل' }, { status: 409 });
    }

    // تعقيم السبب (فلتر محلي فقط — لا نستهلك AI للتظلّم)
    const moderation = moderateTextLocal(body.reason);
    if (moderation.decision === 'BLOCKED') {
      return NextResponse.json({ error: 'سبب التظلّم يحتوي على محتوى مخالف' }, { status: 400 });
    }

    const appeal = await db.examAppeal.create({
      data: {
        schoolId: student.schoolId,
        answerId: body.answerId,
        submissionId: answer.submission.id,
        studentId: student.studentId,
        studentName: student.studentName,
        reason: moderation.cleanedText,
        requestedScore: body.requestedScore ?? null,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      appeal: {
        id: appeal.id,
        status: appeal.status,
        reason: appeal.reason,
        requestedScore: appeal.requestedScore,
        createdAt: appeal.createdAt,
      },
      message: 'تم تقديم التظلّم بنجاح. سيتم مراجعته من قبل المعلم.',
    });
  } catch (error) {
    console.error('[exams/[id]/appeals] error:', error);
    return NextResponse.json(
      { error: 'فشل تقديم التظلّم', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exams/[id]/appeals
 * يجلب تظلّمات الطالب في هذا الامتحان
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);

    const { student, error, status } = await extractStudentContext(request, searchParams.get('schoolId'));
    if (!student) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const appeals = await db.examAppeal.findMany({
      where: {
        schoolId: student.schoolId,
        studentId: student.studentId,
        submission: { examId },
      },
      include: {
        answer: {
          select: { id: true, questionId: true, score: true, maxScore: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      appeals: appeals.map(a => ({
        id: a.id,
        answerId: a.answerId,
        questionId: a.answer.questionId,
        reason: a.reason,
        requestedScore: a.requestedScore,
        currentScore: a.answer.score,
        maxScore: a.answer.maxScore,
        status: a.status,
        teacherReply: a.teacherReply,
        reviewedAt: a.reviewedAt,
        createdAt: a.createdAt,
      })),
      count: appeals.length,
    });
  } catch (error) {
    console.error('[exams/[id]/appeals GET] error:', error);
    return NextResponse.json({ error: 'فشل جلب التظلّمات' }, { status: 500 });
  }
}
