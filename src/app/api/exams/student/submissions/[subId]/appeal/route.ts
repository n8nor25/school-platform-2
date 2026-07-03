/**
 * POST /api/exams/student/submissions/[subId]/appeal?schoolId&studentId
 * يرفع الطالب تظلّماً على إجابة مُصحّحة محددة.
 * - يجب أن يكون التسليم مُصحّحاً (GRADED) أو مُسلَّماً (SUBMITTED)
 * - الإجابة يجب أن تكون مُصحّحة فعلاً (لها score)
 * - يمنع تظلّمات مكررة على نفس الإجابة وهي PENDING/APPROVED
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractStudentContext, errorResponse, successResponse } from '../../../../_student-helpers';

interface AppealBody {
  answerId: string;
  reason: string;
  requestedScore?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const { subId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  let body: AppealBody;
  try { body = await req.json(); } catch {
    return errorResponse('جسم الطلب غير صالح', 400);
  }

  if (!body.answerId) return errorResponse('معرّف الإجابة مطلوب', 400);
  if (!body.reason || body.reason.trim().length < 10) {
    return errorResponse('يرجى كتابة سبب التظلّم (10 أحرف على الأقل)', 400);
  }
  if (body.reason.length > 2000) return errorResponse('سبب التظلّم يتجاوز 2000 حرف', 400);

  const submission = await db.submission.findUnique({
    where: { id: subId },
    select: { id: true, studentId: true, status: true, examId: true },
  });

  if (!submission) return errorResponse('التسليم غير موجود', 404);
  if (submission.studentId !== student.studentId) return errorResponse('ممنوع', 403);
  if (submission.status === 'IN_PROGRESS') {
    return errorResponse('لا يمكن التظلّم على تسليم لم يُنتهَ منه', 400);
  }

  const answer = await db.answer.findFirst({
    where: { id: body.answerId, submissionId: subId },
    select: { id: true, score: true, maxScore: true, gradedAt: true },
  });

  if (!answer) return errorResponse('الإجابة غير موجودة', 404);
  if (!answer.gradedAt) return errorResponse('لم تُصحَّح هذه الإجابة بعد — لا يمكن التظلّم', 400);

  // Block duplicate pending appeals
  const existing = await db.examAppeal.findFirst({
    where: { answerId: body.answerId, status: { in: ['PENDING', 'APPROVED'] } },
    select: { id: true, status: true },
  });
  if (existing) {
    return errorResponse(
      existing.status === 'PENDING' ? 'لديك تظلّم قيد المراجعة على هذه الإجابة' : 'تم قبول تظلّم سابق على هذه الإجابة',
      409
    );
  }

  const appeal = await db.examAppeal.create({
    data: {
      schoolId: student.schoolId,
      answerId: body.answerId,
      submissionId: subId,
      studentId: student.studentId,
      studentName: student.studentName,
      reason: body.reason.trim(),
      requestedScore: body.requestedScore ?? null,
      status: 'PENDING',
    },
  });

  return successResponse({ appeal, message: 'تم رفع التظلّم بنجاح — سيتم مراجعته من قِبل المعلم' });
}
