/**
 * ============================================================
 *  Helper Functions — Teacher Exam API
 *  ============================================================
 *  دوال مساعدة مشتركة بين مسارات API المعلمين:
 *  • استخراج سياق المعلم (teacherId + schoolId + اسم)
 *  • التحقق من ملكية الامتحان للمعلم
 *  • تعديل نص السؤال عبر Pipeline الأمان قبل الحفظ
 *  • تعديل نص الإجابة الصحيحة / المعايير
 *  • تحديث ملف المعلم (ExamTeacherProfile)
 * ============================================================
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import { moderateTextLocal, moderateTextWithAI, type TextModerationResult } from '@/lib/exam-security';

/** سياق المعلم المستخرج من الطلب */
export interface TeacherContext {
  schoolId: string;
  teacherId: string;
  teacherName: string;
}

/**
 * يستخرج سياق المعلم من الطلب.
 *
 * مصادر المعرف (بالأولوية):
 *   1. x-teacher-id header
 *   2. teacherId query param
 *
 * ملاحظة: المعلم الحقيقي يجب أن يُحقَّق عبر جلسة NextAuth في الإنتاج.
 * هنا نسمح بـ teacherId يبدأ بـ "test-" للاختبار، أو أي teacherId مرتبط
 * بـ ExamTeacherProfile موجود في قاعدة البيانات.
 */
export async function extractTeacherContext(
  req: NextRequest,
  schoolIdParam?: string | null
): Promise<{ teacher: TeacherContext | null; error?: string; status?: number }> {
  const schoolId = await resolveSchoolId(schoolIdParam);
  if (!schoolId) {
    return { teacher: null, error: 'معرف المدرسة مطلوب', status: 400 };
  }

  const url = new URL(req.url);
  const teacherId =
    url.searchParams.get('teacherId') ||
    req.headers.get('x-teacher-id') ||
    '';
  const teacherName =
    url.searchParams.get('teacherName') ||
    req.headers.get('x-teacher-name') ||
    '';

  if (!teacherId) {
    return {
      teacher: null,
      error: 'معرف المعلم مطلوب (teacherId أو x-teacher-id)',
      status: 401,
    };
  }

  // نتحقق من وجود ملف المعلم (أو ننشئه تلقائياً عند أول استخدام)
  let profile = await db.examTeacherProfile.findUnique({
    where: { teacherId },
    select: { teacherId: true, teacherName: true, schoolId: true },
  });

  if (!profile) {
    // في وضع الاختبار نسمح بـ teacherId يبدأ بـ "test-"
    // في الإنتاج، يجب أن يأتي المعرف من جلسة موثّقة
    if (!teacherId.startsWith('test-')) {
      // نحاول إنشاء ملف تلقائياً للمعلمين الجدد (سيتطلب نظام auth حقيقياً لاحقاً)
      // حالياً نرفض المعرفات غير المسجّلة وغير الاختبارية
      return {
        teacher: null,
        error: 'المعلم غير مُسجّل في النظام. سجّل الدخول أولاً.',
        status: 401,
      };
    }
    // إنشاء ملف اختباري تلقائياً
    profile = await db.examTeacherProfile.create({
      data: {
        schoolId,
        teacherId,
        teacherName: teacherName || 'معلم تجريبي',
      },
    });
  }

  // التأكد من أن المعلم ينتمي لنفس المدرسة
  if (profile.schoolId !== schoolId) {
    return {
      teacher: null,
      error: 'صلاحية وصول مرفوضة — المعلم لا ينتمي لهذه المدرسة',
      status: 403,
    };
  }

  return {
    teacher: {
      schoolId,
      teacherId,
      teacherName: profile.teacherName || teacherName || 'معلم',
    },
  };
}

/** نتيجة فحص ملكية الامتحان */
export interface ExamOwnershipCheck {
  ok: boolean;
  exam?: Awaited<ReturnType<typeof db.exam.findFirst>>;
  error?: string;
  status?: number;
}

/**
 * يفحص هل المعلم يملك الامتحان (أو هو مُنشئه) في مدرسته.
 * خيارات:
 *   - allowDraft: السماح بالامتحانات المسودة (للتحرير)
 *   - allowClosed: السماح بالامتحانات المغلقة
 */
export async function checkExamOwnership(
  examId: string,
  teacher: TeacherContext,
  options: { allowDraft?: boolean; allowClosed?: boolean } = {}
): Promise<ExamOwnershipCheck> {
  const exam = await db.exam.findFirst({
    where: { id: examId, schoolId: teacher.schoolId, teacherId: teacher.teacherId },
    include: { _count: { select: { questions: true, submissions: true } } },
  });

  if (!exam) {
    return { ok: false, error: 'الامتحان غير موجود أو لا تملك صلاحية عليه', status: 404 };
  }

  if (exam.status === 'DRAFT' && !options.allowDraft) {
    return { ok: false, error: 'الامتحان مسودة — لا يمكن تنفيذ هذا الإجراء', status: 403 };
  }
  if (exam.status === 'CLOSED' && !options.allowClosed) {
    return { ok: false, error: 'الامتحان مغلق — لا يمكن تعديله', status: 403 };
  }
  if (exam.status === 'ARCHIVED') {
    return { ok: false, error: 'الامتحان مؤرشف', status: 403 };
  }

  return { ok: true, exam };
}

/**
 * يُعدّل نص السؤال عبر Pipeline الأمان قبل الحفظ.
 * للأسئلة الموضوعية (MCQ/TRUE_FALSE) نستخدم الفلتر المحلي فقط.
 * للأسئلة المقالية (SHORT/ESSAY) نستخدم AI للمراجعة السياقية.
 *
 * يُرجع النص المنقّى + حالة الإشراف + ملاحظات.
 */
export async function sanitizeQuestionText(
  text: string,
  useAI: boolean = false
): Promise<{
  cleanedText: string;
  moderation: TextModerationResult;
}> {
  if (!text || typeof text !== 'string') {
    return {
      cleanedText: '',
      moderation: {
        decision: 'BLOCKED',
        reasons: ['نص السؤال فارغ'],
        categories: [],
        confidence: 1,
        cleanedText: '',
        cleanedLength: 0,
        originalLength: 0,
        modelUsed: 'local',
      },
    };
  }

  const moderation = useAI
    ? await moderateTextWithAI(text, 'نص سؤال من معلم — يجب أن يكون تعليمياً نظيفاً')
    : moderateTextLocal(text);

  return {
    cleanedText: moderation.cleanedText,
    moderation,
  };
}

/**
 * يُعدّل نص الإجابة الصحيحة / نص المثال.
 * هذه نصوص قصيرة عادةً — نستخدم الفلتر المحلي فقط للسرعة.
 */
export function sanitizeCorrectText(text: string): { cleanedText: string; decision: string } {
  if (!text) return { cleanedText: '', decision: 'SAFE' };
  const mod = moderateTextLocal(text);
  return { cleanedText: mod.cleanedText, decision: mod.decision };
}

/**
 * يُحدّث ملف المعلم:
 *  - يزيد عدد الامتحانات المُنشأة
 *  - يزيد عدد أسئلة بنك الأسئلة
 *  - يُحدّث الاسم إن تغيّر
 */
export async function updateTeacherProfile(
  teacher: TeacherContext,
  updates: { examsCreatedDelta?: number; questionsInBankDelta?: number; name?: string }
): Promise<void> {
  try {
    await db.examTeacherProfile.update({
      where: { teacherId: teacher.teacherId },
      data: {
        ...(updates.examsCreatedDelta
          ? { totalExamsCreated: { increment: updates.examsCreatedDelta } }
          : {}),
        ...(updates.questionsInBankDelta
          ? { totalQuestionsInBank: { increment: updates.questionsInBankDelta } }
          : {}),
        ...(updates.name && updates.name !== teacher.teacherName
          ? { teacherName: updates.name }
          : {}),
      },
    });
  } catch (e) {
    // فشل تحديث الملف لا يجب أن يوقف العملية الرئيسية
    console.error('[teacher-helpers] updateTeacherProfile failed:', e);
  }
}

/** يتأكد من وجود ملف المعلم ويُرجعه (يُنشئه إن لم يوجد) */
export async function ensureTeacherProfile(
  teacher: TeacherContext
): Promise<void> {
  const existing = await db.examTeacherProfile.findUnique({
    where: { teacherId: teacher.teacherId },
  });
  if (!existing) {
    await db.examTeacherProfile.create({
      data: {
        schoolId: teacher.schoolId,
        teacherId: teacher.teacherId,
        teacherName: teacher.teacherName,
      },
    });
  }
}

/** يتحقق من صحة نوع السؤال والبيانات المطلوبة له */
export function validateQuestionData(
  type: string,
  data: {
    text?: string;
    options?: string[] | null;
    correctAnswer?: string | null;
    correctText?: string | null;
    points?: number;
  }
): { ok: boolean; error?: string } {
  if (!data.text || data.text.trim().length === 0) {
    return { ok: false, error: 'نص السؤال مطلوب' };
  }
  if (data.text.length > 5000) {
    return { ok: false, error: 'نص السؤال يتجاوز 5000 حرف' };
  }

  const validTypes = ['MCQ', 'TRUE_FALSE', 'SHORT', 'ESSAY', 'IMAGE_ANSWER', 'FILE_PDF'];
  if (!validTypes.includes(type)) {
    return { ok: false, error: `نوع السؤال غير صالح: ${type}` };
  }

  if (type === 'MCQ') {
    if (!Array.isArray(data.options) || data.options.length < 2) {
      return { ok: false, error: 'أسئلة MCQ تتطلب خيارين على الأقل' };
    }
    if (data.options.length > 8) {
      return { ok: false, error: 'أسئلة MCQ لا تدعم أكثر من 8 خيارات' };
    }
    if (!data.correctAnswer) {
      return { ok: false, error: 'الإجابة الصحيحة مطلوبة لأسئلة MCQ' };
    }
  }

  if (type === 'TRUE_FALSE' && !data.correctAnswer) {
    return { ok: false, error: 'الإجابة الصحيحة مطلوبة لأسئلة صح/خطأ' };
  }

  if (data.points !== undefined && (data.points < 0 || data.points > 100)) {
    return { ok: false, error: 'الدرجة يجب أن تكون بين 0 و 100' };
  }

  return { ok: true };
}

/** يحسب إجمالي نقاط الامتحان من أسئلته ويُحدّث حقل totalPoints */
export async function recomputeExamTotalPoints(examId: string): Promise<number> {
  const questions = await db.question.findMany({
    where: { examId },
    select: { points: true },
  });
  const total = questions.reduce((sum, q) => sum + q.points, 0);
  await db.exam.update({
    where: { id: examId },
    data: { totalPoints: total },
  });
  return total;
}

/** يبني استجابة الامتحان الكاملة للمعلم (مع الإجابات الصحيحة) */
export async function buildTeacherExamResponse(examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          text: true,
          options: true,
          correctAnswer: true,
          correctText: true,
          rubric: true,
          points: true,
          order: true,
          explanation: true,
          attachmentUrl: true,
          textModeration: true,
          imageModeration: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: { submissions: true },
      },
    },
  });

  if (!exam) return null;

  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    subject: exam.subject,
    teacherName: exam.teacherName,
    classroomId: exam.classroomId,
    classroomName: exam.classroomName,
    startDate: exam.startDate,
    endDate: exam.endDate,
    durationMinutes: exam.durationMinutes,
    hasPassword: !!exam.passwordHash,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    allowReview: exam.allowReview,
    showResultImmediately: exam.showResultImmediately,
    parentVisible: exam.parentVisible,
    maxAttempts: exam.maxAttempts,
    maxFileSizeMb: exam.maxFileSizeMb,
    allowTextAnswers: exam.allowTextAnswers,
    allowImageAnswers: exam.allowImageAnswers,
    allowPdfAnswers: exam.allowPdfAnswers,
    antiCheatEnabled: exam.antiCheatEnabled,
    ipRestriction: exam.ipRestriction,
    status: exam.status,
    totalPoints: exam.totalPoints,
    passingScore: exam.passingScore,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    questionsCount: exam.questions.length,
    submissionsCount: exam._count.submissions,
    questions: exam.questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      rubric: q.rubric ? JSON.parse(q.rubric) : null,
    })),
  };
}
