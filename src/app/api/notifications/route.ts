/**
 * ============================================================
 *  GET /api/notifications
 *  ============================================================
 *  يُرجع قائمة إشعارات مشتقة من البيانات الموجودة (بدون جدول إشعارات).
 *
 *  المعاملات:
 *    role       — 'parent' | 'teacher' | 'student' (مطلوب)
 *    schoolId   — معرف المدرسة
 *
 *  لولي الأمر (role=parent):
 *    parentId, parentName (وباقي سياق ولي الأمر كما في /api/exams/parent)
 *
 *  للمعلم (role=teacher):
 *    teacherId, teacherName
 *
 *  للطالب (role=student):
 *    studentId, studentName
 *
 *  الاستجابة:
 *    { success: true, notifications: AppNotification[], count, unreadHint }
 *  حيث unreadHint = عدد الإشعارات في آخر 7 أيام (للعرض كـ badge)
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import { extractParentContext, getChildren } from '@/app/api/exams/_parent-helpers';
import type { AppNotification, NotificationType } from './_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// نافذة الإشعارات: آخر 7 أيام
const WINDOW_DAYS = 7;
// نافذة "القادم": خلال 24 ساعة قادمة
const UPCOMING_HOURS = 24;
// حد الإشعارات لكل دور
const MAX_NOTIFICATIONS = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const role = url.searchParams.get('role') || '';
  const schoolIdParam = url.searchParams.get('schoolId');

  if (!role || !['parent', 'teacher', 'student'].includes(role)) {
    return NextResponse.json(
      { success: false, error: 'role مطلوب (parent/teacher/student)' },
      { status: 400 }
    );
  }

  const schoolId = await resolveSchoolId(schoolIdParam);
  if (!schoolId) {
    return NextResponse.json(
      { success: false, error: 'معرف المدرسة مطلوب' },
      { status: 400 }
    );
  }

  try {
    let notifications: AppNotification[] = [];

    if (role === 'parent') {
      const { parent, error, status } = await extractParentContext(req, schoolId);
      if (!parent) {
        return NextResponse.json({ success: false, error }, { status });
      }
      notifications = await buildParentNotifications(parent);
    } else if (role === 'teacher') {
      const teacherId = url.searchParams.get('teacherId') || req.headers.get('x-teacher-id') || '';
      const teacherName = url.searchParams.get('teacherName') || req.headers.get('x-teacher-name') || '';
      if (!teacherId) {
        return NextResponse.json(
          { success: false, error: 'teacherId مطلوب' },
          { status: 400 }
        );
      }
      notifications = await buildTeacherNotifications(schoolId, teacherId, teacherName);
    } else if (role === 'student') {
      const studentId = url.searchParams.get('studentId') || req.headers.get('x-student-id') || '';
      const studentName = url.searchParams.get('studentName') || req.headers.get('x-student-name') || '';
      if (!studentId) {
        return NextResponse.json(
          { success: false, error: 'studentId مطلوب' },
          { status: 400 }
        );
      }
      notifications = await buildStudentNotifications(schoolId, studentId, studentName);
    }

    // ترتيب تنازلي حسب التاريخ
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // حدّ العدد
    const limited = notifications.slice(0, MAX_NOTIFICATIONS);

    return NextResponse.json({
      success: true,
      notifications: limited,
      count: limited.length,
      // تلميح لعدد "غير المقروء" المحتمل = كل الإشعارات (الواجهة تحسب الفعلي عبر localStorage)
      unreadHint: limited.length,
    });
  } catch (err: any) {
    console.error('[notifications] error:', err);
    return NextResponse.json(
      { success: false, error: 'تعذّر جلب الإشعارات', notifications: [] },
      { status: 500 }
    );
  }
}

// ============================================================
//  إشعارات ولي الأمر
// ============================================================
async function buildParentNotifications(parent: {
  schoolId: string;
  parentId: string;
  parentName: string;
  isTestMode: boolean;
}): Promise<AppNotification[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(now.getTime() + UPCOMING_HOURS * 60 * 60 * 1000);

  const notifications: AppNotification[] = [];

  // جلب الأبناء
  const children = await getChildren(parent);
  if (children.length === 0) {
    // لا أبناء — نُرجع إشعار ترحيب في وضع الاختبار فقط
    if (parent.isTestMode) {
      notifications.push({
        id: 'welcome-parent',
        type: 'exam_published',
        title: 'مرحباً بك في بوابة ولي الأمر',
        message: 'يمكنك متابعة نتائج وأداء أبنائك في الامتحانات الإلكترونية.',
        timestamp: now.toISOString(),
        severity: 'info',
      });
    }
    return notifications;
  }

  const childIds = children.map((c) => c.id);
  const childNames: Record<string, string> = Object.fromEntries(children.map((c) => [c.id, c.name]));
  const classroomIds = children.map((c) => c.classroomId).filter(Boolean) as string[];

  // استعلامات متوازية لتقليل زمن الاستجابة
  const [recentSubmissions, recentPublishedExams, upcomingExams, recentAppeals] = await Promise.all([
    // 1. تسليمات الأبناء في آخر 7 أيام (بدأ/سلّم/صُحِّح/إغلاق تلقائي)
    db.submission.findMany({
      where: {
        schoolId: parent.schoolId,
        studentId: { in: childIds },
        OR: [
          { startedAt: { gte: windowStart } },
          { submittedAt: { gte: windowStart } },
          { gradedAt: { gte: windowStart } },
          { autoClosedAt: { gte: windowStart } },
        ],
      },
      include: {
        exam: { select: { id: true, title: true, subject: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    }).catch(() => []),

    // 2. امتحانات منشورة حديثاً لفصول الأبناء (آخر 7 أيام)
    db.exam.findMany({
      where: {
        schoolId: parent.schoolId,
        status: 'PUBLISHED',
        classroomId: { in: classroomIds.length ? classroomIds : undefined },
        createdAt: { gte: windowStart },
      },
      select: {
        id: true, title: true, subject: true, startDate: true, endDate: true,
        classroomName: true, teacherName: true, durationMinutes: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),

    // 3. امتحانات قادمة خلال 24 ساعة (تبدأ قريباً) لفصول الأبناء
    db.exam.findMany({
      where: {
        schoolId: parent.schoolId,
        status: 'PUBLISHED',
        classroomId: { in: classroomIds.length ? classroomIds : undefined },
        startDate: { gte: now, lte: upcomingEnd },
      },
      select: {
        id: true, title: true, subject: true, startDate: true, endDate: true,
        classroomName: true, durationMinutes: true,
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    }).catch(() => []),

    // 4. تظلمات حُسِمت مؤخراً لأبنائي
    db.examAppeal.findMany({
      where: {
        schoolId: parent.schoolId,
        studentId: { in: childIds },
        status: { in: ['APPROVED', 'REJECTED'] },
        reviewedAt: { gte: windowStart },
      },
      include: {
        submission: { include: { exam: { select: { id: true, title: true, subject: true } } } },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
    }).catch(() => []),
  ]);

  // معالجة التسليمات → إشعارات
  for (const sub of recentSubmissions) {
    const childName = childNames[sub.studentId] || 'ابنك';
    const examTitle = sub.exam?.title || 'امتحان';
    const examSubject = sub.exam?.subject || '';

    // تصحيح نتيجة
    if (sub.status === 'GRADED' && sub.gradedAt && new Date(sub.gradedAt) >= windowStart) {
      const pct = sub.percentage !== null && sub.percentage !== undefined ? Math.round(sub.percentage) : null;
      notifications.push({
        id: `sub-graded:${sub.id}`,
        type: 'sub_graded',
        title: `تم تصحيح نتيجة ${childName}`,
        message: `امتحان «${examTitle}»${examSubject ? ` — ${examSubject}` : ''}${pct !== null ? ` — النتيجة: ${pct}%` : ''}${sub.passed === true ? ' (ناجح)' : sub.passed === false ? ' (دور ثانٍ)' : ''}`,
        timestamp: sub.gradedAt.toISOString(),
        severity: sub.passed === false ? 'warning' : 'success',
        link: `/api/exams/parent/submissions/${sub.id}`,
        metadata: { studentId: sub.studentId, examId: sub.examId, percentage: pct, passed: sub.passed },
      });
      continue;
    }

    // إغلاق تلقائي
    if (sub.status === 'AUTO_CLOSED' && sub.autoClosedAt && new Date(sub.autoClosedAt) >= windowStart) {
      notifications.push({
        id: `sub-auto:${sub.id}`,
        type: 'sub_auto_closed',
        title: `إغلاق تلقائي لامتحان ${childName}`,
        message: `تم إغلاق امتحان «${examTitle}» تلقائياً لانتهاء الوقت أو مخالفة المراقبة.`,
        timestamp: sub.autoClosedAt.toISOString(),
        severity: 'warning',
        link: `/api/exams/parent/submissions/${sub.id}`,
        metadata: { studentId: sub.studentId, examId: sub.examId },
      });
      continue;
    }

    // تسليم
    if (sub.status === 'SUBMITTED' && sub.submittedAt && new Date(sub.submittedAt) >= windowStart) {
      notifications.push({
        id: `sub-submitted:${sub.id}`,
        type: 'sub_submitted',
        title: `${childName} سلّم امتحاناً`,
        message: `سلّم ${childName} امتحان «${examTitle}»${examSubject ? ` — ${examSubject}` : ''} — بانتظار التصحيح.`,
        timestamp: sub.submittedAt.toISOString(),
        severity: 'info',
        link: `/api/exams/parent/submissions/${sub.id}`,
        metadata: { studentId: sub.studentId, examId: sub.examId },
      });
      continue;
    }

    // بدء
    if (sub.status === 'IN_PROGRESS' && sub.startedAt && new Date(sub.startedAt) >= windowStart) {
      notifications.push({
        id: `sub-started:${sub.id}`,
        type: 'sub_started',
        title: `${childName} بدأ امتحاناً`,
        message: `بدأ ${childName} امتحان «${examTitle}»${examSubject ? ` — ${examSubject}` : ''}.`,
        timestamp: sub.startedAt.toISOString(),
        severity: 'info',
        metadata: { studentId: sub.studentId, examId: sub.examId },
      });
      continue;
    }
  }

  // معالجة الامتحانات المنشورة حديثاً → إشعارات
  for (const exam of recentPublishedExams) {
    // ابحث عن الابن الذي يخصه هذا الامتحان (حسب classroomName أو classroomId)
    const matchingChild = children.find((c) => c.classroomId && classroomIds.includes(c.classroomId));
    const childName = matchingChild?.name || 'ابنك';
    notifications.push({
      id: `exam-published:${exam.id}`,
      type: 'exam_published',
      title: 'امتحان جديد منشور',
      message: `تم نشر امتحان «${exam.title}»${exam.subject ? ` — ${exam.subject}` : ''}${exam.classroomName ? ` — ${exam.classroomName}` : ''} لـ${childName}. يبدأ: ${new Date(exam.startDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`,
      timestamp: exam.createdAt.toISOString(),
      severity: 'success',
      metadata: { examId: exam.id, classroomId: exam.classroomName },
    });
  }

  // معالجة الامتحانات القادمة → إشعارات
  for (const exam of upcomingExams) {
    const startDate = new Date(exam.startDate);
    const hoursUntil = Math.round((startDate.getTime() - now.getTime()) / (60 * 60 * 1000));
    notifications.push({
      id: `exam-upcoming:${exam.id}`,
      type: 'exam_upcoming',
      title: 'امتحان قادم قريباً',
      message: `امتحان «${exam.title}»${exam.subject ? ` — ${exam.subject}` : ''} يبدأ خلال ${hoursUntil} ساعة (${startDate.toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}).`,
      timestamp: now.toISOString(),
      severity: 'warning',
      metadata: { examId: exam.id, hoursUntil },
    });
  }

  // معالجة التظلمات المحسومة → إشعارات
  for (const appeal of recentAppeals) {
    const childName = childNames[appeal.studentId] || 'ابنك';
    const examTitle = appeal.submission?.exam?.title || 'امتحان';
    const approved = appeal.status === 'APPROVED';
    notifications.push({
      id: `appeal-resolved:${appeal.id}`,
      type: 'appeal_resolved',
      title: approved ? `قُبل تظلّم ${childName}` : `رُفض تظلّم ${childName}`,
      message: `تظلّم ${childName} على درجة امتحان «${examTitle}» ${approved ? 'قُبل وتم تعديل الدرجة' : 'رُفض بعد المراجعة'}.`,
      timestamp: (appeal.reviewedAt || appeal.updatedAt).toISOString(),
      severity: approved ? 'success' : 'info',
      metadata: { appealId: appeal.id, studentId: appeal.studentId, approved },
    });
  }

  return notifications;
}

// ============================================================
//  إشعارات المعلم
// ============================================================
async function buildTeacherNotifications(
  schoolId: string,
  teacherId: string,
  _teacherName: string
): Promise<AppNotification[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // آخر 3 أيام
  const endingSoon = new Date(now.getTime() + 24 * 60 * 60 * 1000); // خلال 24 ساعة

  const notifications: AppNotification[] = [];

  const [recentSubmissions, newAppeals, endingExams] = await Promise.all([
    // 1. تسليمات جديدة على امتحاناتي
    db.submission.findMany({
      where: {
        schoolId,
        exam: { teacherId },
        OR: [
          { submittedAt: { gte: windowStart } },
          { status: 'SUBMITTED', updatedAt: { gte: windowStart } },
        ],
      },
      include: {
        exam: { select: { id: true, title: true, subject: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }).catch(() => []),

    // 2. تظلمات جديدة بانتظار المراجعة
    db.examAppeal.findMany({
      where: {
        schoolId,
        status: 'PENDING',
        submission: { exam: { teacherId } },
        createdAt: { gte: windowStart },
      },
      include: {
        submission: { include: { exam: { select: { id: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => []),

    // 3. امتحاناتي التي تنتهي خلال 24 ساعة
    db.exam.findMany({
      where: {
        schoolId,
        teacherId,
        status: 'PUBLISHED',
        endDate: { gte: now, lte: endingSoon },
      },
      select: { id: true, title: true, subject: true, endDate: true },
      orderBy: { endDate: 'asc' },
      take: 10,
    }).catch(() => []),
  ]);

  for (const sub of recentSubmissions) {
    if (sub.submittedAt && new Date(sub.submittedAt) >= windowStart) {
      notifications.push({
        id: `teacher-sub:${sub.id}`,
        type: 'sub_submitted',
        title: 'تسليم جديد',
        message: `سلّم ${sub.studentName || 'طالب'} امتحان «${sub.exam?.title || ''}» — بانتظار التصحيح.`,
        timestamp: sub.submittedAt.toISOString(),
        severity: 'info',
        metadata: { submissionId: sub.id, examId: sub.examId },
      });
    }
  }

  for (const appeal of newAppeals) {
    notifications.push({
      id: `teacher-appeal:${appeal.id}`,
      type: 'appeal_new',
      title: 'تظلّم جديد على درجة',
      message: `تظلّم من ${appeal.studentName || 'طالب'} على درجة في امتحان «${appeal.submission?.exam?.title || ''}».`,
      timestamp: appeal.createdAt.toISOString(),
      severity: 'warning',
      metadata: { appealId: appeal.id },
    });
  }

  for (const exam of endingExams) {
    const hoursLeft = Math.round((new Date(exam.endDate).getTime() - now.getTime()) / (60 * 60 * 1000));
    notifications.push({
      id: `teacher-ending:${exam.id}`,
      type: 'exam_ending',
      title: 'امتحان ينتهي قريباً',
      message: `امتحان «${exam.title}» ينتهي خلال ${hoursLeft} ساعة. تأكد من تصحيح التسليمات.`,
      timestamp: now.toISOString(),
      severity: 'warning',
      metadata: { examId: exam.id, hoursLeft },
    });
  }

  return notifications;
}

// ============================================================
//  إشعارات الطالب
// ============================================================
async function buildStudentNotifications(
  schoolId: string,
  studentId: string,
  _studentName: string
): Promise<AppNotification[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const notifications: AppNotification[] = [];

  // جلب الطالب لمعرفة فصله
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, classroomId: true },
  }).catch(() => null);

  const classroomId = student?.classroomId || undefined;

  const [recentSubmissions, gradedSubs, upcomingExams] = await Promise.all([
    // 1. تسليماتي (بدأ/سلّم/إغلاق) في آخر 7 أيام
    db.submission.findMany({
      where: {
        schoolId,
        studentId,
        OR: [
          { startedAt: { gte: windowStart } },
          { submittedAt: { gte: windowStart } },
          { autoClosedAt: { gte: windowStart } },
        ],
      },
      include: { exam: { select: { id: true, title: true, subject: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }).catch(() => []),

    // 2. تسليماتي المُصحَّحة في آخر 7 أيام (منفصلة لأن gradedAt قد يكون قديماً)
    db.submission.findMany({
      where: {
        schoolId,
        studentId,
        status: 'GRADED',
        gradedAt: { gte: windowStart },
      },
      include: { exam: { select: { id: true, title: true, subject: true } } },
      orderBy: { gradedAt: 'desc' },
      take: 15,
    }).catch(() => []),

    // 3. امتحانات قادمة لفصلي خلال 24 ساعة
    db.exam.findMany({
      where: {
        schoolId,
        status: 'PUBLISHED',
        classroomId,
        startDate: { gte: now, lte: upcomingEnd },
      },
      select: { id: true, title: true, subject: true, startDate: true, endDate: true, durationMinutes: true },
      orderBy: { startDate: 'asc' },
      take: 10,
    }).catch(() => []),
  ]);

  // النتائج المصحَّحة أولاً (أهم إشعار للطالب)
  for (const sub of gradedSubs) {
    const pct = sub.percentage !== null && sub.percentage !== undefined ? Math.round(sub.percentage) : null;
    notifications.push({
      id: `student-graded:${sub.id}`,
      type: 'sub_graded',
      title: 'تم تصحيح نتيجتك',
      message: `امتحان «${sub.exam?.title || ''}»${sub.exam?.subject ? ` — ${sub.exam.subject}` : ''}${pct !== null ? ` — النتيجة: ${pct}%` : ''}${sub.passed === true ? ' 🎉 ناجح' : sub.passed === false ? ' (دور ثانٍ)' : ''}`,
      timestamp: (sub.gradedAt || sub.updatedAt).toISOString(),
      severity: sub.passed === false ? 'warning' : 'success',
      metadata: { submissionId: sub.id, percentage: pct, passed: sub.passed },
    });
  }

  // باقي التسليمات
  for (const sub of recentSubmissions) {
    if (sub.status === 'GRADED') continue; // عُولجت выше
    if (sub.status === 'AUTO_CLOSED' && sub.autoClosedAt) {
      notifications.push({
        id: `student-auto:${sub.id}`,
        type: 'sub_auto_closed',
        title: 'إغلاق تلقائي لامتحان',
        message: `تم إغلاق امتحان «${sub.exam?.title || ''}» تلقائياً.`,
        timestamp: sub.autoClosedAt.toISOString(),
        severity: 'error',
        metadata: { submissionId: sub.id },
      });
    } else if (sub.status === 'SUBMITTED' && sub.submittedAt) {
      notifications.push({
        id: `student-submitted:${sub.id}`,
        type: 'sub_submitted',
        title: 'تم تسليم امتحانك',
        message: `سلّمت امتحان «${sub.exam?.title || ''}» — بانتظار التصحيح.`,
        timestamp: sub.submittedAt.toISOString(),
        severity: 'info',
        metadata: { submissionId: sub.id },
      });
    } else if (sub.status === 'IN_PROGRESS' && sub.startedAt) {
      notifications.push({
        id: `student-started:${sub.id}`,
        type: 'sub_started',
        title: 'بدأت امتحاناً',
        message: `بدأت امتحان «${sub.exam?.title || ''}». لا تنسَ التسليم قبل انتهاء الوقت.`,
        timestamp: sub.startedAt.toISOString(),
        severity: 'info',
        metadata: { submissionId: sub.id },
      });
    }
  }

  // الامتحانات القادمة
  for (const exam of upcomingExams) {
    const startDate = new Date(exam.startDate);
    const hoursUntil = Math.round((startDate.getTime() - now.getTime()) / (60 * 60 * 1000));
    notifications.push({
      id: `student-upcoming:${exam.id}`,
      type: 'exam_upcoming',
      title: 'امتحان قادم قريباً',
      message: `امتحان «${exam.title}»${exam.subject ? ` — ${exam.subject}` : ''} يبدأ خلال ${hoursUntil} ساعة. استعد جيداً!`,
      timestamp: now.toISOString(),
      severity: 'warning',
      metadata: { examId: exam.id, hoursUntil },
    });
  }

  return notifications;
}
