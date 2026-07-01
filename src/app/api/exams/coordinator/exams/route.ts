/**
 * ============================================================
 *  GET /api/exams/coordinator/exams
 *  ============================================================
 *  قائمة كل امتحانات المدرسة مع فلترة + إحصائيات لكل امتحان.
 *
 *  Query: schoolId, coordinatorId, [coordinatorName],
 *         [status=all|DRAFT,PUBLISHED,...], [subject], [teacherId],
 *         [classroomId], [search], [dateFrom], [dateTo],
 *         [page=1], [pageSize=20], [sort=createdAt-desc|startDate|submissions|title]
 *
 *  يُرجع:
 *    { exams: [...], pagination: {page,pageSize,total,totalPages}, filters }
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractCoordinatorContext,
  buildExamFilter,
} from '../../_coordinator-helpers';

const GRADED_STATUSES = ['GRADED', 'AUTO_CLOSED', 'SUBMITTED'];

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
    const { searchParams } = new URL(request.url);

    const where = buildExamFilter(searchParams, schoolId);

    // الترقيم
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    );

    // الترتيب
    const sort = searchParams.get('sort') || 'createdAt-desc';
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sort === 'startDate-asc') orderBy.startDate = 'asc';
    else if (sort === 'startDate-desc') orderBy.startDate = 'desc';
    else if (sort === 'title-asc') orderBy.title = 'asc';
    else if (sort === 'submissions-desc') orderBy.submissions = 'desc';
    else orderBy.createdAt = 'desc';

    // الاستعلام
    const [total, exams] = await Promise.all([
      db.exam.count({ where }),
      db.exam.findMany({
        where,
        orderBy: sort === 'submissions-desc'
          ? { submissions: { _count: 'desc' } }
          : orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          subject: true,
          teacherId: true,
          teacherName: true,
          classroomId: true,
          classroomName: true,
          startDate: true,
          endDate: true,
          durationMinutes: true,
          status: true,
          totalPoints: true,
          passingScore: true,
          antiCheatEnabled: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { questions: true, submissions: true },
          },
        },
      }),
    ]);

    // إحصائيات إضافية لكل امتحان (تسليمات مصحّحة، نسبة نجاح، متوسط)
    const examIds = exams.map((e) => e.id);
    const subsAgg = await db.submission.groupBy({
      by: ['examId'],
      where: {
        examId: { in: examIds },
        schoolId,
        status: { in: GRADED_STATUSES },
        percentage: { not: null },
      },
      _count: { id: true },
      _avg: { percentage: true },
    });

    const passCounts = await db.submission.groupBy({
      by: ['examId'],
      where: {
        examId: { in: examIds },
        schoolId,
        passed: true,
      },
      _count: { id: true },
    });

    const pendingAppeals = await db.examAppeal.groupBy({
      by: ['submissionId'],
      where: {
        schoolId,
        status: 'PENDING',
        submission: { examId: { in: examIds } },
      },
      _count: { id: true },
    });

    // تجميع التظلّمات المعلّقة حسب examId
    const appealsByExamMap = new Map<string, number>();
    // نحتاج جلب submissionId -> examId
    if (pendingAppeals.length > 0) {
      const subIds = pendingAppeals.map((p) => p.submissionId);
      const subs = await db.submission.findMany({
        where: { id: { in: subIds } },
        select: { id: true, examId: true },
      });
      const subToExam = new Map(subs.map((s) => [s.id, s.examId]));
      for (const p of pendingAppeals) {
        const examId = subToExam.get(p.submissionId);
        if (examId) {
          appealsByExamMap.set(examId, (appealsByExamMap.get(examId) || 0) + p._count.id);
        }
      }
    }

    const subsByExam = new Map(subsAgg.map((s) => [s.examId, s]));
    const passByExam = new Map(passCounts.map((p) => [p.examId, p._count.id]));

    const formattedExams = exams.map((e) => {
      const agg = subsByExam.get(e.id);
      const gradedCount = agg?._count.id ?? 0;
      const avgPct = agg?._avg.percentage
        ? Math.round(agg._avg.percentage * 10) / 10
        : 0;
      const passCount = passByExam.get(e.id) ?? 0;
      const passRate =
        gradedCount > 0 ? Math.round((passCount / gradedCount) * 1000) / 10 : 0;
      const pendingAppealsCount = appealsByExamMap.get(e.id) ?? 0;

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        subject: e.subject,
        teacherId: e.teacherId,
        teacherName: e.teacherName || 'معلم',
        classroomId: e.classroomId,
        classroomName: e.classroomName,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        durationMinutes: e.durationMinutes,
        status: e.status,
        totalPoints: e.totalPoints,
        passingScore: e.passingScore,
        antiCheatEnabled: e.antiCheatEnabled,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        questionsCount: e._count.questions,
        submissionsCount: e._count.submissions,
        gradedCount,
        avgScore: avgPct,
        passRate,
        pendingAppealsCount,
      };
    });

    return NextResponse.json({
      success: true,
      exams: formattedExams,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filters: {
        status: searchParams.get('status') || 'all',
        subject: searchParams.get('subject') || 'all',
        teacherId: searchParams.get('teacherId') || 'all',
        classroomId: searchParams.get('classroomId') || 'all',
        search: searchParams.get('search') || '',
        dateFrom: searchParams.get('dateFrom') || null,
        dateTo: searchParams.get('dateTo') || null,
        sort,
      },
    });
  } catch (error) {
    console.error('[coordinator/exams] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب قائمة الامتحانات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
