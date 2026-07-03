/**
 * GET /api/exams/parent/students/[studentId]
 * تفاصيل ابن محدد لولي الأمر:
 *  - معلومات الطالب
 *  - قائمة الامتحانات المتاحة/النشطة/القادمة (بدون كشف الأسئلة)
 *  - قائمة التسليمات (مع كشف النتائج حسب parentVisible)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractParentContext, hasParentStudentAccessFast,
  getExamTimeStatus, successResponse, errorResponse,
} from '../../../_parent-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const ctx = await extractParentContext(req);
  if (!ctx.parent) {
    return errorResponse(ctx.error || 'غير مصرّح', ctx.status || 401);
  }
  const parent = ctx.parent;
  const { studentId } = await params;

  try {
    // ===== جلب بيانات الطالب (مع حقول الهاتف للتحقق السريع) + التسليمات + الامتحانات بالتوازي =====
    // تحقق سريع من الصلاحية بدون استعلام getChildren منفصل (يوفّر ~1s في وضع الاختبار)
    const [student, submissions, publishedExams] = await Promise.all([
      db.student.findUnique({
        where: { id: studentId },
        select: {
          id: true, name: true, studentNumber: true, schoolId: true,
          classroomId: true, gender: true, status: true, enrollDate: true,
          parentPhone: true, parentPhone2: true, phone: true, parentNationalId: true,
        },
      }),
      db.submission.findMany({
        where: { studentId, schoolId: parent.schoolId },
        select: {
          id: true, status: true, percentage: true, passed: true,
          totalScore: true, maxScore: true, attemptNumber: true,
          startedAt: true, submittedAt: true, autoClosedAt: true, gradedAt: true,
          tabSwitches: true, copyAttempts: true, focusEvents: true,
          exam: {
            select: {
              id: true, title: true, subject: true, classroomName: true,
              teacherName: true, durationMinutes: true, totalPoints: true,
              passingScore: true, status: true, parentVisible: true,
              showResultImmediately: true, startDate: true, endDate: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
      }),
      db.exam.findMany({
        where: { schoolId: parent.schoolId, status: 'PUBLISHED' },
        select: {
          id: true, title: true, subject: true, classroomName: true,
          teacherName: true, description: true, durationMinutes: true,
          totalPoints: true, passingScore: true,
          passwordHash: true, startDate: true, endDate: true, maxAttempts: true,
          antiCheatEnabled: true, parentVisible: true,
          _count: { select: { questions: true } },
        },
        orderBy: { startDate: 'desc' },
      }),
    ]);

    // تحقق سريع من الصلاحية (بدون استعلام إضافي)
    if (!student) {
      return errorResponse('الطالب غير موجود', 404);
    }
    if (student.schoolId !== parent.schoolId || !hasParentStudentAccessFast(parent, student)) {
      return errorResponse('لا تملك صلاحية الوصول لهذا الطالب', 403);
    }

    // جلب اسم الفصل (إن وُجد) — استعلام خفيف بعد التحقق
    let classroomName: string | null = null;
    if (student.classroomId) {
      const classroom = await db.classroom.findUnique({
        where: { id: student.classroomId },
        select: { name: true },
      }).catch(() => null);
      classroomName = classroom?.name || null;
    }

    // تصنيف الامتحانات: متاح / نشط / قادم / منتهي
    const now = new Date();
    type ExamWithCount = typeof publishedExams[number];
    const available: ExamWithCount[] = [];
    const upcoming: ExamWithCount[] = [];
    const ended: ExamWithCount[] = [];

    // خريطة محاولات الطالب لكل امتحان
    const submissionsByExam = new Map<string, typeof submissions>();
    for (const s of submissions) {
      const arr = submissionsByExam.get(s.examId) || [];
      arr.push(s);
      submissionsByExam.set(s.examId, arr);
    }

    for (const exam of publishedExams) {
      const status = getExamTimeStatus(exam);
      // نخفي passwordHash عن ولي الأمر
      const { passwordHash: _ph, ...examSafe } = exam as any;
      const hasPassword = !!exam.passwordHash;
      const safeExam = { ...examSafe, hasPassword };

      const subs = submissionsByExam.get(exam.id) || [];
      const attemptsUsed = subs.length;
      const maxAttempts = exam.maxAttempts || 1;
      const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed);

      if (status === 'OPEN') {
        if (attemptsRemaining > 0 || subs.length === 0) {
          available.push({ ...safeExam, attemptsRemaining, attemptsUsed, hasActiveSubmission: subs.some(s => s.status === 'IN_PROGRESS') });
        } else {
          ended.push({ ...safeExam, attemptsRemaining: 0, attemptsUsed, hasActiveSubmission: false });
        }
      } else if (status === 'UPCOMING') {
        upcoming.push({ ...safeExam, attemptsRemaining, attemptsUsed, hasActiveSubmission: false });
      } else {
        // ENDED
        ended.push({ ...safeExam, attemptsRemaining: 0, attemptsUsed, hasActiveSubmission: false });
      }
    }

    // التسليمات مع كشف النتيجة (لولي الأمر)
    const submissionsForParent = submissions.map((s) => {
      const submitted = s.status !== 'IN_PROGRESS';
      const revealResults = submitted && (
        parent.isTestMode ||
        (s.exam.parentVisible && (s.status === 'GRADED' || (s.status === 'SUBMITTED' && s.exam.showResultImmediately)))
      );
      return {
        id: s.id,
        examId: s.examId,
        status: s.status,
        attemptNumber: s.attemptNumber,
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        autoClosedAt: s.autoClosedAt,
        gradedAt: s.gradedAt,
        tabSwitches: s.tabSwitches,
        copyAttempts: s.copyAttempts,
        focusEvents: s.focusEvents,
        exam: {
          id: s.exam.id, title: s.exam.title, subject: s.exam.subject,
          classroomName: s.exam.classroomName, teacherName: s.exam.teacherName,
          durationMinutes: s.exam.durationMinutes, totalPoints: s.exam.totalPoints,
          passingScore: s.exam.passingScore, status: s.exam.status,
        },
        // نُخفي النتيجة إن لم تُكشف لولي الأمر
        percentage: revealResults ? s.percentage : null,
        passed: revealResults ? s.passed : null,
        totalScore: revealResults ? s.totalScore : null,
        maxScore: revealResults ? s.maxScore : null,
        revealResults,
        resultsPending: submitted && !revealResults,
      };
    });

    // إحصاءات سريعة
    const finishedSubs = submissionsForParent.filter(
      (s) => s.status === 'SUBMITTED' || s.status === 'GRADED' || s.status === 'AUTO_CLOSED' || s.status === 'FLAGGED'
    );
    const gradedSubs = submissionsForParent.filter((s) => s.status === 'GRADED' && s.revealResults);
    const passedSubs = gradedSubs.filter((s) => s.passed === true);
    const percentages = gradedSubs
      .map((s) => (typeof s.percentage === 'number' ? s.percentage : null))
      .filter((p): p is number => p !== null);
    const avgPercentage = percentages.length
      ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
      : null;

    return successResponse({
      student: {
        ...student,
        classroomName,
      },
      parent: {
        parentId: parent.parentId,
        parentName: parent.parentName,
        isTestMode: parent.isTestMode,
      },
      availableExams: available,
      upcomingExams: upcoming,
      endedExams: ended,
      submissions: submissionsForParent,
      stats: {
        totalSubmissions: submissionsForParent.length,
        finishedSubmissions: finishedSubs.length,
        gradedSubmissions: gradedSubs.length,
        passedSubmissions: passedSubs.length,
        avgPercentage,
        availableExamsCount: available.length,
        upcomingExamsCount: upcoming.length,
        endedExamsCount: ended.length,
      },
    });
  } catch (e) {
    console.error('[parent student GET] error:', e);
    return errorResponse('فشل جلب بيانات الطالب', 500);
  }
}
