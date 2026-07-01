/**
 * ============================================================
 *  GET /api/exams/coordinator/appeals
 *  ============================================================
 *  قائمة كل التظلّمات على مستوى المدرسة مع فلترة.
 *
 *  Query: schoolId, coordinatorId,
 *         [status=all|PENDING|APPROVED|REJECTED],
 *         [examId], [studentId], [page=1], [pageSize=20]
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractCoordinatorContext } from '../../_coordinator-helpers';

export async function GET(request: NextRequest) {
  try {
    const ctxResult = await extractCoordinatorContext(request);
    if (!ctxResult.coordinator) {
      return NextResponse.json(
        { error: ctxResult.error || 'غير مصرّح' },
        { status: ctxResult.status || 401 }
      );
    }
    const { schoolId } = ctxResult.coordinator;
    const { searchParams } = new URL(request.url);

    const where: {
      schoolId: string;
      status?: string;
      submission?: { examId?: string; studentId?: string };
    } = { schoolId };

    const status = searchParams.get('status');
    if (status && status !== 'all') where.status = status;

    const examId = searchParams.get('examId');
    const studentId = searchParams.get('studentId');
    if (examId || studentId) {
      where.submission = {};
      if (examId) where.submission.examId = examId;
      if (studentId) where.submission.studentId = studentId;
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    );

    const [total, appeals] = await Promise.all([
      db.examAppeal.count({ where }),
      db.examAppeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reason: true,
          requestedScore: true,
          status: true,
          teacherReply: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          studentId: true,
          studentName: true,
          answer: {
            select: {
              id: true,
              score: true,
              maxScore: true,
              isCorrect: true,
              question: {
                select: { id: true, text: true, type: true, points: true },
              },
            },
          },
          submission: {
            select: {
              id: true,
              studentName: true,
              percentage: true,
              exam: {
                select: {
                  id: true,
                  title: true,
                  subject: true,
                  teacherName: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      appeals: appeals.map((a) => ({
        id: a.id,
        reason: a.reason,
        requestedScore: a.requestedScore,
        status: a.status,
        teacherReply: a.teacherReply,
        reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        studentId: a.studentId,
        studentName: a.studentName || 'طالب',
        answerId: a.answer.id,
        currentScore: a.answer.score,
        maxScore: a.answer.maxScore,
        isCorrect: a.answer.isCorrect,
        questionText: a.answer.question.text,
        questionType: a.answer.question.type,
        questionPoints: a.answer.question.points,
        submissionId: a.submission.id,
        examId: a.submission.exam.id,
        examTitle: a.submission.exam.title,
        subject: a.submission.exam.subject,
        teacherName: a.submission.exam.teacherName,
        submissionPercentage: a.submission.percentage,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[coordinator/appeals] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب التظلّمات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
