/**
 * ============================================================
 *  GET /api/exams/teacher/[id]/appeals
 *  ============================================================
 *  يُرجع تظلّمات الطلاب في الامتحان.
 *
 *  Query: schoolId, teacherId, status?
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

    const statusFilter = searchParams.get('status');

    const where: Record<string, unknown> = {
      schoolId: teacher.schoolId,
      submission: { examId },
    };
    if (statusFilter) where.status = statusFilter;

    const appeals = await db.examAppeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        answer: {
          select: {
            id: true,
            questionId: true,
            score: true,
            maxScore: true,
            textAnswer: true,
            question: {
              select: { id: true, text: true, type: true, points: true },
            },
          },
        },
        submission: {
          select: { id: true, studentName: true, attemptNumber: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: appeals.length,
      appeals: appeals.map((a) => ({
        id: a.id,
        answerId: a.answerId,
        questionId: a.answer.questionId,
        questionText: a.answer.question.text,
        questionType: a.answer.question.type,
        currentScore: a.answer.score,
        maxScore: a.answer.maxScore,
        requestedScore: a.requestedScore,
        studentName: a.submission.studentName,
        attemptNumber: a.submission.attemptNumber,
        reason: a.reason,
        status: a.status,
        teacherReply: a.teacherReply,
        reviewedAt: a.reviewedAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/appeals GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب التظلّمات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
