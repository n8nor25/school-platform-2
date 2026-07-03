/**
 * GET /api/exams/student/[examId]?schoolId&studentId
 * معاينة الامتحان للطالب (قبل البدء): معلومات + عدّاد المحاولات + حالة الوقت.
 * لا يكشف نصوص الأسئلة أو الإجابات الصحيحة.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext, getExamTimeStatus, buildStudentExamPreview, errorResponse, successResponse,
} from '../../_student-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  const exam = await db.exam.findFirst({
    where: { id: examId, schoolId: student.schoolId },
    select: { id: true, status: true, startDate: true, endDate: true, maxAttempts: true },
  });

  if (!exam) return errorResponse('الامتحان غير موجود', 404);
  if (exam.status !== 'PUBLISHED') return errorResponse('الامتحان غير متاح حالياً', 403);

  // Existing submissions for this student
  const submissions = await db.submission.findMany({
    where: { examId, studentId: student.studentId },
    select: {
      id: true, status: true, attemptNumber: true,
      startedAt: true, submittedAt: true, totalScore: true, maxScore: true, percentage: true, passed: true,
    },
    orderBy: { attemptNumber: 'desc' },
  });

  const completedAttempts = submissions.filter(s => s.status !== 'IN_PROGRESS').length;
  const inProgress = submissions.find(s => s.status === 'IN_PROGRESS');

  const preview = await buildStudentExamPreview(examId);
  if (!preview) return errorResponse('تعذّر تحميل بيانات الامتحان', 500);

  const timeStatus = getExamTimeStatus({
    startDate: exam.startDate,
    endDate: exam.endDate,
  });

  return successResponse({
    exam: preview,
    timeStatus,
    attemptsUsed: completedAttempts,
    attemptsRemaining: Math.max(0, exam.maxAttempts - completedAttempts),
    inProgressSubmissionId: inProgress?.id || null,
    submissions,
  });
}
