/**
 * GET /api/exams/parent/submissions/[subId]
 * تفاصيل تسليم محدد لولي الأمر — يكشف النتيجة والإجابات حسب parentVisible.
 *
 * التحقق:
 *  1. ولي الأمر مصرّح له (extractParentContext)
 *  2. التسليم يخص ابناً لولي الأمر (checkParentStudentAccess عبر studentId)
 *  3. كشف النتائج حسب shouldRevealResultsForParent
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractParentContext, hasParentStudentAccessFast,
  buildParentSubmissionView, successResponse, errorResponse,
} from '../../../_parent-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const ctx = await extractParentContext(req);
  if (!ctx.parent) {
    return errorResponse(ctx.error || 'غير مصرّح', ctx.status || 401);
  }
  const parent = ctx.parent;
  const { subId } = await params;

  try {
    // أولاً نتحقق أن التسليم موجود ونأخذ studentId
    const basicSub = await db.submission.findUnique({
      where: { id: subId },
      select: { id: true, studentId: true, schoolId: true },
    });
    if (!basicSub) {
      return errorResponse('التسليم غير موجود', 404);
    }
    // التحقق أن التسليم في نفس مدرسة ولي الأمر
    if (basicSub.schoolId !== parent.schoolId) {
      return errorResponse('مرفوض', 403);
    }

    // بالتوازي: جلب بيانات الطالب (مع حقول الهاتف للتحقق السريع) + بناء استجابة التسليم الكاملة
    const [student, result] = await Promise.all([
      db.student.findUnique({
        where: { id: basicSub.studentId },
        select: {
          id: true, name: true, studentNumber: true, schoolId: true, classroomId: true,
          parentName: true, parentPhone: true, parentPhone2: true, phone: true, parentNationalId: true,
        },
      }),
      buildParentSubmissionView(subId, parent.isTestMode),
    ]);

    if (result.notFound) {
      return errorResponse('التسليم غير موجود', 404);
    }

    // تحقق سريع من الصلاحية (بدون استعلام getChildren منفصل)
    if (!student || !hasParentStudentAccessFast(parent, student)) {
      return errorResponse('لا تملك صلاحية الوصول لهذا التسليم', 403);
    }

    return successResponse({
      submission: result.submission,
      student,
      parent: {
        parentId: parent.parentId,
        parentName: parent.parentName,
        isTestMode: parent.isTestMode,
      },
    });
  } catch (e) {
    console.error('[parent submission GET] error:', e);
    return errorResponse('فشل جلب التسليم', 500);
  }
}
