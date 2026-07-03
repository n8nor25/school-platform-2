/**
 * POST /api/exams/student/submissions/[subId]/submit?schoolId&studentId
 * ينهي التسليم نهائياً:
 *  - يصحّح الأسئلة الموضوعية (MCQ / TRUE_FALSE / SHORT) تلقائياً
 *  - يترك الأسئلة المقالية/الصورية بانتظار التصحيح اليدوي/AI
 *  - يحسب totalScore + maxScore + percentage + passed
 *  - يحدد الحالة: GRADED إذا كانت كل الأسئلة موضوعية، SUBMITTED إذا كان فيها مقالي
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractStudentContext, autoGradeObjective, errorResponse, successResponse } from '../../../../_student-helpers';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const { subId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  const submission = await db.submission.findUnique({
    where: { id: subId },
    select: {
      id: true, studentId: true, status: true, examId: true, maxScore: true,
      exam: {
        select: {
          id: true, totalPoints: true, passingScore: true, endDate: true,
          showResultImmediately: true,
        },
      },
    },
  });

  if (!submission) return errorResponse('التسليم غير موجود', 404);
  if (submission.studentId !== student.studentId) return errorResponse('ممنوع', 403);
  if (submission.status !== 'IN_PROGRESS') return errorResponse('التسليم منتهٍ بالفعل', 400);

  // Auto-close if past end date
  const now = new Date();
  const isLate = now > submission.exam.endDate;

  // Fetch all answers with their questions
  const answers = await db.answer.findMany({
    where: { submissionId: subId },
    include: {
      question: {
        select: { id: true, type: true, correctAnswer: true, correctText: true, points: true },
      },
    },
  });

  let totalScore = 0;
  let maxScore = 0;
  let needsManualGrading = false;

  // Grade objective answers
  for (const a of answers) {
    maxScore += a.maxScore;
    const auto = autoGradeObjective(a.question, { textAnswer: a.textAnswer });
    if (auto !== null) {
      totalScore += auto.score;
      await db.answer.update({
        where: { id: a.id },
        data: {
          score: auto.score,
          isCorrect: auto.isCorrect,
          gradedAt: now,
          gradedById: 'system',
        },
      });
    } else {
      needsManualGrading = true;
    }
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;
  const passingScore = submission.exam.passingScore ?? 50;
  const passed = percentage >= passingScore;

  const finalStatus = needsManualGrading ? 'SUBMITTED' : 'GRADED';

  await db.submission.update({
    where: { id: subId },
    data: {
      status: finalStatus,
      submittedAt: now,
      autoClosedAt: isLate ? now : null,
      totalScore,
      maxScore,
      percentage,
      passed: finalStatus === 'GRADED' ? passed : null,
      lastActivityAt: now,
    },
  });

  return successResponse({
    submissionId: subId,
    status: finalStatus,
    submittedAt: now,
    totalScore,
    maxScore,
    percentage,
    passed: finalStatus === 'GRADED' ? passed : null,
    needsManualGrading,
    revealResults: submission.exam.showResultImmediately && !needsManualGrading,
    isLate,
  });
}
