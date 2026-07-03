/**
 * GET /api/exams/student/submissions/[subId]?schoolId&studentId
 * يعرض تسليماً للطالب مع الأسئلة + إجاباته + (بعد التصحيح إن سُمح) النتيجة والإجابة الصحيحة.
 * - إذا كان التسليم جارياً (IN_PROGRESS): يرجع الأسئلة بدون كشف الإجابات
 * - إذا انتهى + showResultImmediately=true: يكشف النتيجة + الإجابات الصحيحة + ملاحظات المعلم
 * - إذا انتهى + showResultImmediately=false: يعرض فقط الحالة العامة (بانتظار التصحيح)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext, buildStudentSubmissionView, errorResponse, successResponse,
} from '../../../_student-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const { subId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  const view = await buildStudentSubmissionView(subId, student.studentId);
  if (!view) return errorResponse('التسليم غير موجود', 404);
  if ((view as any).forbidden) return errorResponse('ممنوع الوصول إلى هذا التسليم', 403);

  return successResponse({ submission: view });
}
