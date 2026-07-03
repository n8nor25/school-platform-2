/**
 * ============================================================
 *  Helper Functions — Parent Exam API
 *  ============================================================
 *  دوال مساعدة مشتركة بين مسارات API أولياء الأمور:
 *  • استخراج سياق ولي الأمر (parentId + parentName + schoolId)
 *  • جلب قائمة الأبناء المرتبطين بولي الأمر
 *  • التحقق من أن الطالب ابن لولي الأمر
 *  • بناء استجابة التسليم لولي الأمر (يكشف النتيجة فقط حسب parentVisible + showResultImmediately)
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';

/** سياق ولي الأمر المستخرج من الطلب */
export interface ParentContext {
  schoolId: string;
  parentId: string;
  parentName: string;
  /** رقم هاتف ولي الأمر (يُستخدم لربط الأبناء) — null في وضع الاختبار */
  parentPhone: string | null;
  /** رقم قومي لولي الأمر — null في وضع الاختبار */
  parentNationalId: string | null;
  /** وضع الاختبار (parentId يبدأ بـ test-) */
  isTestMode: boolean;
}

/**
 * يستخرج سياق ولي الأمر من الطلب.
 *
 * مصادر المعرف (بالأولوية):
 *   1. x-parent-id header
 *   2. parentId query param
 *
 * ملاحظة: ولي الأمر الحقيقي يجب أن يُحقَّق عبر جلسة NextAuth في الإنتاج.
 * هنا نسمح بـ parentId يبدأ بـ "test-" للاختبار (يُربط تلقائياً بـ test-student-001).
 * في الإنتاج: يُربط ولي الأمر بالأبناء عبر parentPhone أو parentNationalId.
 */
export async function extractParentContext(
  req: NextRequest,
  schoolIdParam?: string | null
): Promise<{ parent: ParentContext | null; error?: string; status?: number }> {
  const schoolId = await resolveSchoolId(schoolIdParam);
  if (!schoolId) {
    return { parent: null, error: 'معرف المدرسة مطلوب', status: 400 };
  }

  const url = new URL(req.url);
  const parentId =
    url.searchParams.get('parentId') ||
    req.headers.get('x-parent-id') ||
    '';
  const parentName =
    url.searchParams.get('parentName') ||
    req.headers.get('x-parent-name') ||
    '';
  // parentPhone اختياري (للربط الحقيقي بالأبناء)
  const parentPhone =
    url.searchParams.get('parentPhone') ||
    req.headers.get('x-parent-phone') ||
    null;
  const parentNationalId =
    url.searchParams.get('parentNationalId') ||
    req.headers.get('x-parent-national-id') ||
    null;

  if (!parentId) {
    return {
      parent: null,
      error: 'معرف ولي الأمر مطلوب (parentId أو x-parent-id)',
      status: 401,
    };
  }

  const isTestMode = parentId.startsWith('test-');
  let resolvedName = parentName;

  if (isTestMode) {
    if (!resolvedName) resolvedName = 'ولي أمر تجريبي';
    return {
      parent: {
        schoolId,
        parentId,
        parentName: resolvedName,
        parentPhone,
        parentNationalId,
        isTestMode: true,
      },
    };
  }

  // الوضع الحقيقي: نتحقق أن ولي الأمر موجود كـ parentPhone أو parentNationalId لطالب واحد على الأقل
  // أو نسمح بالمرور مؤقتاً ثم نُعيد قائمة أبناء فارغة (لوالي أمر جديد)
  return {
    parent: {
      schoolId,
      parentId,
      parentName: resolvedName || 'ولي أمر',
      parentPhone,
      parentNationalId,
      isTestMode: false,
    },
  };
}

/**
 * يجلب قائمة الأبناء المرتبطين بولي الأمر.
 *
 * - وضع الاختبار (parentId يبدأ بـ test-): يُرجع الطالب التجريبي test-student-001
 * - الوضع الحقيقي: يبحث في جدول Student بـ parentPhone أو parentNationalId (إن وُجدا)
 *   + يُرجع كل الطلاب المرتبطين
 */
export async function getChildren(parent: ParentContext) {
  // وضع الاختبار: ربط مع test-student-001
  if (parent.isTestMode) {
    const testStudent = await db.student.findUnique({
      where: { id: 'test-student-001' },
      select: {
        id: true, name: true, studentNumber: true, schoolId: true,
        classroomId: true, parentName: true, parentPhone: true,
      },
    }).catch(() => null);

    if (testStudent && testStudent.schoolId === parent.schoolId) {
      return [testStudent];
    }
    // fallback: نبحث عن أي طالب في المدرسة كـ demo
    const fallback = await db.student.findFirst({
      where: { schoolId: parent.schoolId, archived: false },
      select: {
        id: true, name: true, studentNumber: true, schoolId: true,
        classroomId: true, parentName: true, parentPhone: true,
      },
    }).catch(() => null);
    return fallback ? [fallback] : [];
  }

  // الوضع الحقيقي: ابحث بـ parentPhone أو parentNationalId
  const or: any[] = [];
  if (parent.parentPhone) {
    or.push({ parentPhone: parent.parentPhone });
    or.push({ parentPhone2: parent.parentPhone });
    or.push({ phone: parent.parentPhone });
  }
  if (parent.parentNationalId) {
    or.push({ parentNationalId: parent.parentNationalId });
  }
  if (or.length === 0) return [];

  return db.student.findMany({
    where: {
      schoolId: parent.schoolId,
      archived: false,
      OR: or,
    },
    select: {
      id: true, name: true, studentNumber: true, schoolId: true,
      classroomId: true, parentName: true, parentPhone: true,
    },
    orderBy: { name: 'asc' },
  }).catch(() => []);
}

/**
 * يتحقق من أن الطالب ابن لولي الأمر، ويُرجع الطالب إن صحّ ذلك.
 */
export async function checkParentStudentAccess(
  parent: ParentContext,
  studentId: string
): Promise<{ ok: boolean; student?: any; error?: string; status?: number }> {
  const children = await getChildren(parent);
  const student = children.find((s) => s.id === studentId);
  if (!student) {
    return {
      ok: false,
      error: 'لا تملك صلاحية الوصول لهذا الطالب — الطالب غير مرتبط بحسابك',
      status: 403,
    };
  }
  return { ok: true, student };
}

/**
 * تحقق سريع من الصلاحية بدون استعلام إضافي — يُستخدم عند جلب بيانات الطالب أصلاً.
 * يُرجع true فقط (لا يُرجع كائن الطالب). مناسب عندما نسأل "هل يملك ولي الأمر وصولاً؟"
 * بعد أن نكون قد جلبنا بيانات الطالب بالفعل.
 *
 * - وضع الاختبار: يقبل test-student-001 فقط (بدون استعلام DB)
 * - الوضع الحقيقي: يتحقق من parentPhone/parentNationalId على الطالب المُمرَّر
 */
export function hasParentStudentAccessFast(
  parent: ParentContext,
  student: { id: string; parentPhone?: string | null; parentPhone2?: string | null; phone?: string | null; parentNationalId?: string | null } | null
): boolean {
  if (!student) return false;
  if (parent.isTestMode) {
    return student.id === 'test-student-001';
  }
  // الوضع الحقيقي: تحقق من تطابق الهاتف/الرقم القومي
  if (parent.parentPhone) {
    if (student.parentPhone === parent.parentPhone) return true;
    if (student.parentPhone2 === parent.parentPhone) return true;
    if (student.phone === parent.parentPhone) return true;
  }
  if (parent.parentNationalId && student.parentNationalId === parent.parentNationalId) {
    return true;
  }
  return false;
}

/**
 * يجيب JSON خطأ موحّد
 */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * يجيب JSON نجاح موحّد
 */
export function successResponse(data: any, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * يحسب حالة الامتحان الزمنية
 */
export function getExamTimeStatus(exam: { startDate: Date | string; endDate: Date | string }): 'UPCOMING' | 'OPEN' | 'ENDED' {
  const now = new Date();
  const start = new Date(exam.startDate);
  const end = new Date(exam.endDate);
  if (now < start) return 'UPCOMING';
  if (now > end) return 'ENDED';
  return 'OPEN';
}

/**
 * يحسب حالة ظهور النتائج لولي الأمر:
 * - يكشف النتيجة فقط إذا: الامتحان parentVisible=true AND التسليم مُصحَّح AND (showResultImmediately=true OR التسليم GRADED)
 * - في وضع الاختبار، نكشف دائماً (لأغراض العرض)
 */
export function shouldRevealResultsForParent(
  exam: { parentVisible: boolean; showResultImmediately: boolean; status: string },
  submission: { status: string },
  isTestMode: boolean
): boolean {
  if (isTestMode) {
    // في وضع الاختبار: نكشف النتيجة لأي تسليم غير قيد التقدّم (لأغراض التجربة)
    return submission.status !== 'IN_PROGRESS';
  }
  // في الإنتاج: نحتاج parentVisible=true + التسليم مُصحَّح
  if (!exam.parentVisible) return false;
  return submission.status === 'GRADED' || (submission.status === 'SUBMITTED' && exam.showResultImmediately);
}

/**
 * يبني استجابة التسليم لولي الأمر (يكشف النتيجة حسب shouldRevealResultsForParent)
 */
export async function buildParentSubmissionView(
  submissionId: string,
  isTestMode: boolean
): Promise<{ submission?: any; forbidden?: boolean; notFound?: boolean }> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      exam: {
        select: {
          id: true, title: true, subject: true, description: true,
          teacherName: true, classroomName: true, durationMinutes: true,
          showResultImmediately: true, parentVisible: true, totalPoints: true,
          passingScore: true, status: true, startDate: true, endDate: true,
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true, type: true, text: true, options: true,
              correctAnswer: true, correctText: true, rubric: true,
              points: true, order: true, explanation: true, attachmentUrl: true,
            },
          },
        },
        orderBy: { question: { order: 'asc' } },
      },
    },
  });

  if (!submission) return { notFound: true };

  const submitted = submission.status !== 'IN_PROGRESS';
  const revealResults = submitted && shouldRevealResultsForParent(submission.exam, submission, isTestMode);

  return {
    submission: {
      id: submission.id,
      examId: submission.examId,
      studentId: submission.studentId,
      studentName: submission.studentName,
      status: submission.status,
      attemptNumber: submission.attemptNumber,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      autoClosedAt: submission.autoClosedAt,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      passed: submission.passed,
      focusEvents: submission.focusEvents,
      tabSwitches: submission.tabSwitches,
      copyAttempts: submission.copyAttempts,
      notes: submission.notes,
      gradedAt: submission.gradedAt,
      gradedByName: submission.gradedByName,
      exam: submission.exam,
      answers: submission.answers.map((a) => {
        const q = a.question;
        const base: any = {
          id: a.id,
          questionId: a.questionId,
          type: q.type,
          text: q.text,
          points: q.points,
          maxScore: a.maxScore,
          order: q.order,
          attachmentUrl: q.attachmentUrl,
          // إجابة الطالب (يُكشف دائماً لولي الأمر بعد التسليم)
          textAnswer: a.textAnswer,
          imageAnswerUrl: a.imageAnswerUrl,
          fileAnswerUrl: a.fileAnswerUrl,
          // خيارات MCQ
          options: q.options ? JSON.parse(q.options) : null,
        };
        if (revealResults) {
          base.score = a.score;
          base.isCorrect = a.isCorrect;
          base.teacherNote = a.teacherNote;
          base.correctAnswer = q.correctAnswer;
          base.correctText = q.correctText;
          base.explanation = q.explanation;
          base.gradedAt = a.gradedAt;
        }
        return base;
      }),
      revealResults,
      // علم إضافي يُخبر الواجهة أن النتيجة لم تُكشف بعد (لولي الأمر)
      resultsPending: submitted && !revealResults,
    },
  };
}
