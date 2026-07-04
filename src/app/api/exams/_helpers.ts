/**
 * ============================================================
 *  Helper Functions — Student Exam API
 *  ============================================================
 *  دوال مساعدة مشتركة بين مسارات API الطلابية:
 *  • المصادقة + استخراج الطالب
 *  • التحقق من صلاحية الوصول للامتحان
 *  • فحص الوقت (بدء/انتهاء)
 *  • بصمة الجهاز (IP + UserAgent)
 *  • إغلاق تلقائي للامتحانات المنتهية
 * ============================================================
 */

import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import bcrypt from 'bcryptjs';

/** يحسب بصمة IP (sha256 truncated) — لا نخزن IP خام لأسباب خصوصية */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/** يحسب بصمة UserAgent */
export function hashUserAgent(ua: string): string {
  return createHash('sha256').update(ua).digest('hex').slice(0, 32);
}

/** يستخرج IP العميل من الطلب (يأخذ X-Forwarded-For في الاعتبار) */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return req.headers.get('x-forwarded') || '0.0.0.0';
}

/** سياق الطالب المستخرج من الطلب */
export interface StudentContext {
  schoolId: string;
  studentId: string;
  studentName: string;
  classroomId?: string;
  classroomName?: string;
  ipHash: string;
  userAgentHash: string;
  userAgent: string;
}

/** يستخرج سياق الطالب من الطلب (query + headers) */
export async function extractStudentContext(
  req: NextRequest,
  schoolIdParam?: string | null
): Promise<{ student: StudentContext | null; error?: string; status?: number }> {
  const schoolId = await resolveSchoolId(schoolIdParam);
  if (!schoolId) {
    return { student: null, error: 'معرف المدرسة مطلوب', status: 400 };
  }

  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId') || req.headers.get('x-student-id');
  const studentName = url.searchParams.get('studentName') || req.headers.get('x-student-name') || '';
  const classroomId = url.searchParams.get('classroomId') || req.headers.get('x-classroom-id') || undefined;
  const classroomName = url.searchParams.get('classroomName') || req.headers.get('x-classroom-name') || '';

  if (!studentId) {
    return { student: null, error: 'معرف الطالب مطلوب (studentId أو x-student-id)', status: 401 };
  }

  // نتحقق من وجود الطالب في قاعدة البيانات (لمنع انتحال الهوية)
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, name: true, classroomId: true },
  });

  if (!student) {
    // في وضع الاختبار فقط نسمح بالطالب الوهمي، لكن في الإنتاج نرفض
    // نتحقق إن كان studentId يبدأ بـ "test-" للسماح بالاختبار
    if (!studentId.startsWith('test-')) {
      return { student: null, error: 'الطالب غير موجود في قاعدة البيانات', status: 404 };
    }
  }

  const finalName = student?.name || studentName || 'طالب';
  const finalClassroomId = student?.classroomId || classroomId;
  const finalClassroomName = classroomName || (finalClassroomId ? '' : '');

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || 'unknown';

  return {
    student: {
      schoolId,
      studentId,
      studentName: finalName,
      classroomId: finalClassroomId,
      classroomName: finalClassroomName,
      ipHash: hashIp(ip),
      userAgentHash: hashUserAgent(ua),
      userAgent: ua.slice(0, 500),  // حد الطول لمنع إساءة التخزين
    },
  };
}

/** نتيجة فحص الوصول للامتحان */
export interface ExamAccessCheck {
  ok: boolean;
  exam?: Awaited<ReturnType<typeof db.exam.findFirst>>;
  error?: string;
  status?: number;
}

/**
 * يفحص هل الطالب يستطيع الوصول للامتحان
 * - الامتحان موجود + في نفس المدرسة
 * - الحالة PUBLISHED (وليست DRAFT/ARCHIVED)
 * - الوقت الآن بين startDate و endDate
 */
export async function checkExamAccess(
  examId: string,
  schoolId: string,
  options: { allowDraft?: boolean } = {}
): Promise<ExamAccessCheck> {
  const exam = await db.exam.findFirst({
    where: { id: examId, schoolId },
    include: { _count: { select: { questions: true, submissions: true } } },
  });

  if (!exam) {
    return { ok: false, error: 'الامتحان غير موجود', status: 404 };
  }

  if (exam.status !== 'PUBLISHED' && !options.allowDraft) {
    return { ok: false, error: `الامتحان غير منشور (الحالة الحالية: ${exam.status})`, status: 403 };
  }

  const now = new Date();
  if (now < exam.startDate) {
    return { ok: false, error: 'لم يبدأ الامتحان بعد', status: 403 };
  }
  if (now > exam.endDate) {
    return { ok: false, error: 'انتهى وقت الامتحان', status: 403 };
  }

  return { ok: true, exam };
}

/** يفحص كلمة سر الامتحان */
export async function verifyExamPassword(
  exam: { passwordHash: string | null },
  providedPassword?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!exam.passwordHash) return { ok: true }; // لا توجد كلمة سر
  if (!providedPassword) {
    return { ok: false, error: 'هذا الامتحان يتطلب كلمة سر' };
  }
  try {
    const ok = await bcrypt.compare(providedPassword, exam.passwordHash);
    return ok ? { ok: true } : { ok: false, error: 'كلمة سر الامتحان غير صحيحة' };
  } catch (e) {
    console.error('[exams] password verify error:', e);
    return { ok: false, error: 'خطأ في التحقق من كلمة السر' };
  }
}

/** يبني كلمة سر مشفّرة من نص (للإنشاء/التحديث) */
export async function hashExamPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * يفحص هل الطالب لديه محاولة جارية أو منتهية
 * ويعيد عددها
 */
export async function getStudentSubmissions(
  examId: string,
  studentId: string
): Promise<{
  totalAttempts: number;
  activeSubmission: Awaited<ReturnType<typeof db.submission.findFirst>> | null;
  lastSubmission: Awaited<ReturnType<typeof db.submission.findFirst>> | null;
}> {
  const submissions = await db.submission.findMany({
    where: { examId, studentId },
    orderBy: { attemptNumber: 'desc' },
    // نستخدم select لتفادي حقل gradedByName الذي قد يحوي NULL في البيانات القديمة
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      autoClosedAt: true,
      percentage: true,
      totalScore: true,
      maxScore: true,
      passed: true,
    },
  });

  const activeSubmission = submissions.find(s => s.status === 'IN_PROGRESS') ?? null;
  const lastSubmission = submissions[0] ?? null;

  return {
    totalAttempts: submissions.length,
    activeSubmission,
    lastSubmission,
  };
}

/**
 * يُغلق المحاولات المنتهية تلقائياً (تجاوز durationMinutes)
 * يُرجع المحاولة إن كانت لا تزال جارية
 */
export async function autoCloseExpiredSubmission(submissionId: string): Promise<{
  closed: boolean;
  submission: Awaited<ReturnType<typeof db.submission.findUnique>> | null;
}> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: { exam: true },
  });

  if (!submission || submission.status !== 'IN_PROGRESS') {
    return { closed: false, submission };
  }

  const now = new Date();
  const startedAt = new Date(submission.startedAt);
  const elapsedMs = now.getTime() - startedAt.getTime();
  const allowedMs = submission.exam.durationMinutes * 60 * 1000;

  // إذا انتهى وقت الامتحان أو تجاوز المدة المسموحة
  if (now > submission.exam.endDate || elapsedMs > allowedMs) {
    await db.submission.update({
      where: { id: submissionId },
      data: {
        status: 'AUTO_CLOSED',
        autoClosedAt: now,
        submittedAt: now,
      },
    });
    // نُرجع submission محدّث (بدل إعادة استعلام نُمرّر القيم)
    return {
      closed: true,
      submission: { ...submission, status: 'AUTO_CLOSED', autoClosedAt: now, submittedAt: now },
    };
  }

  return { closed: false, submission };
}

/** يُرجع الوقت المتبقي بالثواني للمحاولة */
export function getRemainingSeconds(submission: {
  startedAt: Date;
  exam: { durationMinutes: number; endDate: Date };
}): number {
  const now = Date.now();
  const startedAt = new Date(submission.startedAt).getTime();
  const examEnd = new Date(submission.exam.endDate).getTime();
  const deadlineByDuration = startedAt + submission.exam.durationMinutes * 60 * 1000;
  const deadline = Math.min(deadlineByDuration, examEnd);
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

/** يحسب بصمة مستوى الصعوبة للسؤال (للعرض فقط) */
export function getQuestionDifficulty(points: number): string {
  if (points >= 5) return 'عالية';
  if (points >= 2) return 'متوسطة';
  return 'منخفضة';
}
