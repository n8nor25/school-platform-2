/**
 * ============================================================
 *  Helper Functions — Student Exam API
 *  ============================================================
 *  دوال مساعدة مشتركة بين مسارات API الطلاب:
 *  • استخراج سياق الطالب (studentId + schoolId + اسم)
 *  • التحقق من ملكية التسليم للطالب
 *  • التحقق من كلمة مرور الامتحان (bcrypt)
 *  • تصحيح الأسئلة الموضوعية تلقائياً (MCQ / TRUE_FALSE / SHORT)
 *  • بناء استجابة الامتحان للطالب (بدون كشف الإجابات الصحيحة قبل التسليم)
 *  • بناء استجابة التسليم للطالب (مع كشف النتيجة بعد التصحيح)
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import bcrypt from 'bcryptjs';

/** سياق الطالب المستخرج من الطلب */
export interface StudentContext {
  schoolId: string;
  studentId: string;
  studentName: string;
}

/**
 * يستخرج سياق الطالب من الطلب.
 *
 * مصادر المعرف (بالأولوية):
 *   1. x-student-id header
 *  2. studentId query param
 *
 * ملاحظة: الطالب الحقيقي يجب أن يُحقَّق عبر جلسة NextAuth في الإنتاج.
 * هنا نسمح بـ studentId يبدأ بـ "test-" للاختبار، أو أي studentId موجود
 * في جدول Student أو لديه تسليمات سابقة.
 */
export async function extractStudentContext(
  req: NextRequest,
  schoolIdParam?: string | null
): Promise<{ student: StudentContext | null; error?: string; status?: number }> {
  const schoolId = await resolveSchoolId(schoolIdParam);
  if (!schoolId) {
    return { student: null, error: 'معرف المدرسة مطلوب', status: 400 };
  }

  const url = new URL(req.url);
  const studentId =
    url.searchParams.get('studentId') ||
    req.headers.get('x-student-id') ||
    '';
  const studentName =
    url.searchParams.get('studentName') ||
    req.headers.get('x-student-name') ||
    '';

  if (!studentId) {
    return {
      student: null,
      error: 'معرف الطالب مطلوب (studentId أو x-student-id)',
      status: 401,
    };
  }

  // Accept test- prefix or any studentId that exists in Student table or has submissions
  let resolvedName = studentName;
  if (!studentId.startsWith('test-')) {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, schoolId: true },
    }).catch(() => null);

    if (!student) {
      // Check if there are existing submissions for this studentId (allow legacy)
      const existingSub = await db.submission.findFirst({
        where: { studentId },
        select: { studentName: true },
      });
      if (!existingSub) {
        return {
          student: null,
          error: 'الطالب غير مُسجّل في النظام',
          status: 401,
        };
      }
      resolvedName = resolvedName || existingSub.studentName || 'طالب';
    } else {
      if (student.schoolId && student.schoolId !== schoolId) {
        return {
          student: null,
          error: 'صلاحية وصول مرفوضة — الطالب لا ينتمي لهذه المدرسة',
          status: 403,
        };
      }
      resolvedName = resolvedName || student.name || 'طالب';
    }
  } else {
    if (!resolvedName) resolvedName = 'طالب تجريبي';
  }

  return {
    student: {
      schoolId,
      studentId,
      studentName: resolvedName,
    },
  };
}

/** يتحقق من كلمة مرور الامتحان إن وُجدت */
export async function verifyExamPassword(
  exam: { passwordHash: string | null },
  providedPassword?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!exam.passwordHash) return { ok: true };
  if (!providedPassword) {
    return { ok: false, error: 'هذا الامتحان محمي بكلمة مرور' };
  }
  try {
    const match = await bcrypt.compare(providedPassword, exam.passwordHash);
    if (!match) return { ok: false, error: 'كلمة المرور غير صحيحة' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'تعذّر التحقق من كلمة المرور' };
  }
}

/** يحسب حالة الامتحان الزمنية */
export function getExamTimeStatus(exam: { startDate: Date | string; endDate: Date | string }): 'UPCOMING' | 'OPEN' | 'ENDED' {
  const now = new Date();
  const start = new Date(exam.startDate);
  const end = new Date(exam.endDate);
  if (now < start) return 'UPCOMING';
  if (now > end) return 'ENDED';
  return 'OPEN';
}

/**
 * يبني استجابة الامتحان للطالب — يكشف الأسئلة فقط بدون الإجابات الصحيحة.
 * يُستخدم لشاشة تعليمات الامتحان قبل البدء.
 */
export async function buildStudentExamPreview(examId: string) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true, title: true, description: true, subject: true,
      teacherName: true, classroomName: true,
      startDate: true, endDate: true, durationMinutes: true,
      passwordHash: true, shuffleQuestions: true, shuffleOptions: true,
      allowReview: true, showResultImmediately: true, maxAttempts: true,
      allowTextAnswers: true, allowImageAnswers: true, allowPdfAnswers: true,
      maxFileSizeMb: true, antiCheatEnabled: true, status: true,
      totalPoints: true, passingScore: true,
      questions: { select: { id: true, type: true, points: true, order: true }, orderBy: { order: 'asc' } },
    },
  });

  if (!exam) return null;

  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    subject: exam.subject,
    teacherName: exam.teacherName,
    classroomName: exam.classroomName,
    startDate: exam.startDate,
    endDate: exam.endDate,
    durationMinutes: exam.durationMinutes,
    hasPassword: !!exam.passwordHash,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    allowReview: exam.allowReview,
    showResultImmediately: exam.showResultImmediately,
    maxAttempts: exam.maxAttempts,
    allowTextAnswers: exam.allowTextAnswers,
    allowImageAnswers: exam.allowImageAnswers,
    allowPdfAnswers: exam.allowPdfAnswers,
    maxFileSizeMb: exam.maxFileSizeMb,
    antiCheatEnabled: exam.antiCheatEnabled,
    status: exam.status,
    totalPoints: exam.totalPoints,
    passingScore: exam.passingScore,
    questionsCount: exam.questions.length,
    questionTypes: exam.questions.map(q => q.type),
    // ملاحظة: لا نُرجع نصوص الأسئلة هنا — فقط بعد بدء التسليم
  };
}

/** خلط مصفوفة (Fisher–Yates) */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * يبني استجابة التسليم للطالب مع الأسئلة (للأداء).
 * - قبل التسليم: نص السؤال + خيارات MCQ (بدون correctAnswer) + إجابة الطالب الحالية
 * - بعد التسليم + showResultImmediately: يكشف النتيجة + الإجابة الصحيحة + تفسير + ملاحظة المعلم
 */
export async function buildStudentSubmissionView(submissionId: string, studentId: string) {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      exam: {
        select: {
          id: true, title: true, subject: true, description: true,
          teacherName: true, durationMinutes: true, showResultImmediately: true,
          allowReview: true, totalPoints: true, passingScore: true, status: true,
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

  if (!submission) return null;
  if (submission.studentId !== studentId) return { forbidden: true } as const;

  const submitted = submission.status !== 'IN_PROGRESS';
  const revealResults = submitted && submission.exam.showResultImmediately;

  return {
    id: submission.id,
    examId: submission.examId,
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
        // student's own answer
        textAnswer: a.textAnswer,
        imageAnswerUrl: a.imageAnswerUrl,
        fileAnswerUrl: a.fileAnswerUrl,
        // options for MCQ
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
  };
}

/**
 * يصحّح إجابة موضوعية تلقائياً (MCQ / TRUE_FALSE / SHORT).
 * يُعيد { score, isCorrect } أو null إذا كان السؤال مقالياً/صورياً.
 */
export function autoGradeObjective(
  question: { type: string; correctAnswer: string | null; correctText: string | null; points: number },
  studentAnswer: { textAnswer?: string | null }
): { score: number; isCorrect: boolean } | null {
  if (question.type === 'MCQ') {
    const isCorrect = !!question.correctAnswer && !!studentAnswer.textAnswer && studentAnswer.textAnswer === question.correctAnswer;
    return { score: isCorrect ? question.points : 0, isCorrect };
  }
  if (question.type === 'TRUE_FALSE') {
    const isCorrect = !!question.correctAnswer && !!studentAnswer.textAnswer && studentAnswer.textAnswer === question.correctAnswer;
    return { score: isCorrect ? question.points : 0, isCorrect };
  }
  if (question.type === 'SHORT') {
    if (!studentAnswer.textAnswer || !question.correctText) return null;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,،؛;:!?'"()]/g, '');
    const isCorrect = norm(studentAnswer.textAnswer) === norm(question.correctText);
    return { score: isCorrect ? question.points : 0, isCorrect };
  }
  return null; // ESSAY / IMAGE_ANSWER / FILE_PDF — يحتاج تصحيح يدوي/AI
}

/** يجيب JSON خطأ موحّد */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** يجيب JSON نجاح موحّد */
export function successResponse(data: any, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}
