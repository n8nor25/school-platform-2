/**
 * ============================================================
 *  GET /api/exams/teacher/submissions/[subId]
 *  ============================================================
 *  يُرجع تفاصيل تسليم محدد مع كل الإجابات (للتصحيح).
 *
 *  Query: schoolId, teacherId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext } from '../../../_teacher-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  try {
    const { subId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    // نتحقق من أن التسليم يخص امتحاناً يملكه المعلم
    const submission = await db.submission.findFirst({
      where: {
        id: subId,
        schoolId: teacher.schoolId,
        exam: { teacherId: teacher.teacherId },
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            totalPoints: true,
            passingScore: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                type: true,
                text: true,
                options: true,
                correctAnswer: true,
                correctText: true,
                rubric: true,
                points: true,
                explanation: true,
              },
            },
          },
          orderBy: { question: { order: 'asc' } },
        },
        violations: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, type: true, severity: true, details: true, createdAt: true },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reason: true,
            requestedScore: true,
            status: true,
            teacherReply: true,
            reviewedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'التسليم غير موجود أو لا تملك صلاحية عليه' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        examId: submission.examId,
        studentId: submission.studentId,
        studentName: submission.studentName,
        attemptNumber: submission.attemptNumber,
        startedAt: submission.startedAt,
        submittedAt: submission.submittedAt,
        autoClosedAt: submission.autoClosedAt,
        status: submission.status,
        totalScore: submission.totalScore,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        passed: submission.passed,
        focusEvents: submission.focusEvents,
        tabSwitches: submission.tabSwitches,
        copyAttempts: submission.copyAttempts,
        lastActivityAt: submission.lastActivityAt,
        gradedAt: submission.gradedAt,
        gradedByName: submission.gradedByName,
        exam: submission.exam,
        answers: submission.answers.map((a) => ({
          id: a.id,
          questionId: a.questionId,
          textAnswer: a.textAnswer,
          imageAnswerUrl: a.imageAnswerUrl,
          fileAnswerUrl: a.fileAnswerUrl,
          imageHash: a.imageHash,
          textModeration: a.textModeration,
          imageModeration: a.imageModeration,
          fileModeration: a.fileModeration,
          moderationNotes: a.moderationNotes,
          score: a.score,
          maxScore: a.maxScore,
          isCorrect: a.isCorrect,
          teacherNote: a.teacherNote,
          aiSuggestedScore: a.aiSuggestedScore,
          aiConfidence: a.aiConfidence,
          gradedAt: a.gradedAt,
          gradedById: a.gradedById,
          createdAt: a.createdAt,
          question: {
            ...a.question,
            options: a.question.options ? JSON.parse(a.question.options) : null,
            rubric: a.question.rubric ? JSON.parse(a.question.rubric) : null,
          },
        })),
        violations: submission.violations,
        appeals: submission.appeals,
        violationsCount: submission.violations.length,
        appealsCount: submission.appeals.length,
      },
    });
  } catch (error) {
    console.error('[exams/teacher/submissions/[subId] GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب التسليم', details: (error as Error).message },
      { status: 500 }
    );
  }
}
