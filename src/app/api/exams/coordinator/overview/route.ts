/**
 * ============================================================
 *  GET /api/exams/coordinator/overview
 *  ============================================================
 *  لوحة معلومات شاملة للمنسّق — إحصائيات على مستوى المدرسة:
 *
 *  • KPIs رئيسية: إجمالي الامتحانات، المنشورة، المسودات، المغلقة، المؤرشفة
 *  • إجمالي التسليمات + المصحّحة + المعلّقة + نسبة النجاح العامة
 *  • إجمالي التظلّمات + المعلّقة
 *  • إجمالي المخالفات + حسب النوع
 *  • توزيع حسب المادة (عدد الامتحانات + متوسط الدرجات)
 *  • أكثر المعلمين نشاطاً (عدد الامتحانات + التسليمات)
 *  • آخر الامتحانات (5 الأحدث)
 *  • امتحانات تحتاج انتباهاً (مفتوحة منتهية قريباً + تظلّمات معلّقة)
 *
 *  Query: schoolId, coordinatorId, [coordinatorName]
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractCoordinatorContext } from '../../_coordinator-helpers';

const EXAM_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const;

export async function GET(request: NextRequest) {
  try {
    const ctxResult = await extractCoordinatorContext(request);
    if (!ctxResult.coordinator) {
      return NextResponse.json(
        { error: ctxResult.error || 'غير مصرّح' },
        { status: ctxResult.status || 401 }
      );
    }
    const { schoolId } = ctxResult.coordinator;

    // 1) تجميع كل الإحصائيات في استعلامات متوازية
    const [
      examsByStatus,
      totalSubmissions,
      submissionsByStatus,
      appealsByStatus,
      violationsByType,
      examsBySubject,
      topTeachers,
      recentExams,
      upcomingExams,
      pendingAppealExams,
    ] = await Promise.all([
      db.exam.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: { id: true },
      }),
      db.submission.count({ where: { schoolId } }),
      db.submission.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: { id: true },
      }),
      db.examAppeal.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: { id: true },
      }),
      db.examViolation.groupBy({
        by: ['type'],
        where: { schoolId },
        _count: { id: true },
      }),
      db.exam.findMany({
        where: { schoolId },
        select: {
          subject: true,
          submissions: {
            where: { percentage: { not: null } },
            select: { percentage: true, passed: true },
          },
        },
      }),
      db.exam.groupBy({
        by: ['teacherId', 'teacherName'],
        where: { schoolId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      db.exam.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          subject: true,
          teacherName: true,
          classroomName: true,
          status: true,
          startDate: true,
          endDate: true,
          _count: { select: { submissions: true, questions: true } },
        },
      }),
      db.exam.findMany({
        where: {
          schoolId,
          status: 'PUBLISHED',
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { endDate: 'asc' },
        take: 10,
        select: {
          id: true,
          title: true,
          teacherName: true,
          endDate: true,
          _count: { select: { submissions: true } },
        },
      }),
      db.examAppeal.findMany({
        where: { schoolId, status: 'PENDING' },
        distinct: ['submissionId'],
        select: {
          submission: {
            select: {
              exam: {
                select: { id: true, title: true, teacherName: true, subject: true },
              },
            },
          },
        },
        take: 10,
      }),
    ]);

    // 2) تجميع نتائج توزيع المواد
    const subjectMap = new Map<
      string,
      { exams: number; pcts: number[]; passedCount: number; totalGraded: number }
    >();
    for (const exam of examsBySubject) {
      const subject = exam.subject || 'عام';
      const entry = subjectMap.get(subject) || {
        exams: 0,
        pcts: [],
        passedCount: 0,
        totalGraded: 0,
      };
      entry.exams += 1;
      for (const sub of exam.submissions) {
        if (sub.percentage !== null) {
          entry.pcts.push(sub.percentage);
          entry.totalGraded += 1;
          if (sub.passed) entry.passedCount += 1;
        }
      }
      subjectMap.set(subject, entry);
    }
    const subjectStats = Array.from(subjectMap.entries())
      .map(([subject, e]) => ({
        subject,
        examCount: e.exams,
        avgScore:
          e.pcts.length > 0
            ? Math.round((e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length) * 10) / 10
            : 0,
        passRate:
          e.totalGraded > 0
            ? Math.round((e.passedCount / e.totalGraded) * 1000) / 10
            : 0,
        gradedCount: e.totalGraded,
      }))
      .sort((a, b) => b.examCount - a.examCount)
      .slice(0, 12);

    // 3) تنسيق KPIs
    const statusCounts = Object.fromEntries(
      EXAM_STATUSES.map((s) => [s, 0])
    ) as Record<string, number>;
    for (const row of examsByStatus) {
      statusCounts[row.status] = row._count.id;
    }

    let gradedSubs = 0;
    let inProgressSubs = 0;
    for (const row of submissionsByStatus) {
      if (['GRADED', 'AUTO_CLOSED', 'SUBMITTED'].includes(row.status)) {
        gradedSubs += row._count.id;
      }
      if (row.status === 'IN_PROGRESS') inProgressSubs = row._count.id;
    }

    const passRateSubs = await db.submission.count({
      where: { schoolId, passed: true, percentage: { not: null } },
    });
    const overallPassRate =
      gradedSubs > 0 ? Math.round((passRateSubs / gradedSubs) * 1000) / 10 : 0;

    // 4) تنسيق التظلّمات
    const appealCounts: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of appealsByStatus) {
      appealCounts[row.status] = row._count.id;
    }

    // 5) تنسيق المخالفات
    const violationCounts: Record<string, number> = {};
    let totalViolations = 0;
    for (const row of violationsByType) {
      violationCounts[row.type] = row._count.id;
      totalViolations += row._count.id;
    }

    // 6) تنسيق المعلمين
    const topTeachersList = topTeachers.map((t) => ({
      teacherId: t.teacherId,
      teacherName: t.teacherName || 'معلم',
      examsCount: t._count.id,
    }));

    // 7) امتحانات تحتاج انتباهاً
    const pendingAppealsExams = pendingAppealExams.map((a) => ({
      examId: a.submission.exam.id,
      examTitle: a.submission.exam.title,
      teacherName: a.submission.exam.teacherName,
      subject: a.submission.exam.subject,
    }));

    return NextResponse.json({
      success: true,
      kpis: {
        exams: {
          total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
          draft: statusCounts['DRAFT'],
          published: statusCounts['PUBLISHED'],
          closed: statusCounts['CLOSED'],
          archived: statusCounts['ARCHIVED'],
        },
        submissions: {
          total: totalSubmissions,
          graded: gradedSubs,
          inProgress: inProgressSubs,
          passRate: overallPassRate,
        },
        appeals: {
          total: appealCounts.PENDING + appealCounts.APPROVED + appealCounts.REJECTED,
          pending: appealCounts.PENDING,
          approved: appealCounts.APPROVED,
          rejected: appealCounts.REJECTED,
        },
        violations: {
          total: totalViolations,
          byType: violationCounts,
        },
      },
      subjectStats,
      topTeachers: topTeachersList,
      recentExams: recentExams.map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.subject,
        teacherName: e.teacherName,
        classroomName: e.classroomName,
        status: e.status,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        submissionsCount: e._count.submissions,
        questionsCount: e._count.questions,
      })),
      upcomingExams: upcomingExams.map((e) => ({
        id: e.id,
        title: e.title,
        teacherName: e.teacherName,
        endDate: e.endDate.toISOString(),
        submissionsCount: e._count.submissions,
      })),
      pendingAppealsExams,
    });
  } catch (error) {
    console.error('[coordinator/overview] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب نظرة عامة', details: (error as Error).message },
      { status: 500 }
    );
  }
}
