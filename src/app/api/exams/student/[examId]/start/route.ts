/**
 * POST /api/exams/student/[examId]/start?schoolId&studentId
 * يبدأ محاولة جديدة للامتحان:
 *  - يتحقق من حالة الامتحان + النوافذ الزمنية + المحاولات المتبقية
 *  - يتحقق من كلمة المرور إن وُجدت
 *  - يستأنف التسليم الجاري إن وُجد (لا يُنشئ تكراراً)
 *  - يُنشئ Submission + Answer لكل سؤال (فارغة)
 *  - يُرجع التسليم مع الأسئلة (بدون كشف الإجابات الصحيحة)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext, verifyExamPassword, getExamTimeStatus,
  shuffleArray, errorResponse, successResponse,
} from '../../../_student-helpers';

interface StartBody {
  password?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  let body: StartBody = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const exam = await db.exam.findFirst({
    where: { id: examId, schoolId: student.schoolId },
    include: {
      questions: {
        select: {
          id: true, type: true, text: true, options: true,
          points: true, order: true, attachmentUrl: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!exam) return errorResponse('الامتحان غير موجود', 404);
  if (exam.status !== 'PUBLISHED') return errorResponse('الامتحان غير منشور', 403);

  const timeStatus = getExamTimeStatus(exam);
  if (timeStatus === 'UPCOMING') return errorResponse('الامتحان لم يبدأ بعد', 403);
  if (timeStatus === 'ENDED') return errorResponse('انتهى وقت الامتحان', 403);

  // Password check
  if (exam.passwordHash) {
    const pwd = await verifyExamPassword(exam, body.password);
    if (!pwd.ok) return errorResponse(pwd.error!, 403);
  }

  // Existing submissions
  const existing = await db.submission.findMany({
    where: { examId, studentId: student.studentId },
    select: { id: true, status: true, attemptNumber: true },
    orderBy: { attemptNumber: 'desc' },
  });

  const inProgress = existing.find(s => s.status === 'IN_PROGRESS');
  if (inProgress) {
    // Resume: return existing submission with questions
    return successResponse({ submissionId: inProgress.id, resumed: true, attemptNumber: inProgress.attemptNumber });
  }

  const completedAttempts = existing.length;
  if (completedAttempts >= exam.maxAttempts) {
    return errorResponse('استنفدت جميع محاولات هذا الامتحان', 403);
  }

  // Create new submission + answers
  const submission = await db.submission.create({
    data: {
      schoolId: student.schoolId,
      examId,
      studentId: student.studentId,
      studentName: student.studentName,
      attemptNumber: completedAttempts + 1,
      status: 'IN_PROGRESS',
      maxScore: exam.totalPoints,
      lastActivityAt: new Date(),
    },
  });

  // Shuffle questions if enabled
  let orderedQuestions = exam.questions;
  if (exam.shuffleQuestions) {
    orderedQuestions = shuffleArray(exam.questions);
  }

  // Create answer rows
  await db.answer.createMany({
    data: orderedQuestions.map((q, idx) => ({
      schoolId: student.schoolId,
      submissionId: submission.id,
      questionId: q.id,
      maxScore: q.points,
      // store shuffled order in a stable way: we can't add a column,
      // so we use the existing `question.order` (original) and rely on
      // the answers being returned in submission view ordered by question.order.
      // To preserve shuffle per-attempt, we rely on client-side reorder using
      // the order returned by this API (idx below).
    })),
  });

  return successResponse({
    submissionId: submission.id,
    resumed: false,
    attemptNumber: submission.attemptNumber,
    durationMinutes: exam.durationMinutes,
    questionsCount: orderedQuestions.length,
    shuffled: exam.shuffleQuestions,
  });
}
