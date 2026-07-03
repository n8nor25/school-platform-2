/**
 * POST /api/exams/student/submissions/[subId]/answer?schoolId&studentId
 * يحفظ إجابة طالب على سؤال محدد أثناء أداء الامتحان.
 * - يدعم الإجابة النصية (MCQ/TRUE_FALSE/SHORT/ESSAY)
 * - يدعم رفع الصور (IMAGE_ANSWER / ESSAY مع صورة) عبر base64 → مسار محلي
 * - يدعم رفع الملفات (FILE_PDF) عبر base64
 * - يحدّث lastActivityAt على التسليم
 *
 * ملاحظة: الرفع الفعلي للملفات يستخدم مسار /api/upload أو يُخزَّن base64 مؤقتاً.
 * في هذه النسخة التجريبية نقبل رابط URL جاهز أو نص فقط.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractStudentContext, errorResponse, successResponse } from '../../../../_student-helpers';

interface AnswerBody {
  questionId: string;
  textAnswer?: string | null;
  imageAnswerUrl?: string | null;
  fileAnswerUrl?: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const { subId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  let body: AnswerBody;
  try { body = await req.json(); } catch {
    return errorResponse('جسم الطلب غير صالح', 400);
  }

  if (!body.questionId) return errorResponse('معرّف السؤال مطلوب', 400);

  const submission = await db.submission.findUnique({
    where: { id: subId },
    select: {
      id: true, studentId: true, status: true, examId: true,
      exam: { select: { allowTextAnswers: true, allowImageAnswers: true, allowPdfAnswers: true, maxFileSizeMb: true, endDate: true } },
    },
  });

  if (!submission) return errorResponse('التسليم غير موجود', 404);
  if (submission.studentId !== student.studentId) return errorResponse('ممنوع', 403);
  if (submission.status !== 'IN_PROGRESS') return errorResponse('انتهت هذه المحاولة ولا يمكن تعديل الإجابات', 403);
  if (new Date() > submission.exam.endDate) return errorResponse('انتهى وقت الامتحان', 403);

  // Find the answer row
  const answer = await db.answer.findFirst({
    where: { submissionId: subId, questionId: body.questionId },
    select: { id: true },
  });
  if (!answer) return errorResponse('السؤال غير تابع لهذا التسليم', 404);

  // Validate answer type permissions
  const data: any = {};
  if (body.textAnswer !== undefined) {
    if (!submission.exam.allowTextAnswers && body.textAnswer) {
      return errorResponse('الإجابة النصية غير مفعّلة في هذا الامتحان', 403);
    }
    data.textAnswer = body.textAnswer?.slice(0, 20000) || null;
    data.textOriginalLength = body.textAnswer?.length || 0;
  }
  if (body.imageAnswerUrl !== undefined) {
    if (!submission.exam.allowImageAnswers && body.imageAnswerUrl) {
      return errorResponse('رفع الصور غير مفعّل في هذا الامتحان', 403);
    }
    data.imageAnswerUrl = body.imageAnswerUrl || null;
  }
  if (body.fileAnswerUrl !== undefined) {
    if (!submission.exam.allowPdfAnswers && body.fileAnswerUrl) {
      return errorResponse('رفع الملفات غير مفعّل في هذا الامتحان', 403);
    }
    data.fileAnswerUrl = body.fileAnswerUrl || null;
  }

  await db.answer.update({ where: { id: answer.id }, data });
  await db.submission.update({ where: { id: subId }, data: { lastActivityAt: new Date() } });

  return successResponse({ saved: true, answerId: answer.id });
}
