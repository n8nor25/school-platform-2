/**
 * ============================================================
 *  GET /api/exams/teacher/[id]/submissions
 *  ============================================================
 *  يُرجع قائمة تسليمات الامتحان للتصحيح.
 *
 *  Query: schoolId, teacherId, status?, search?, page?, limit?
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../_teacher-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const ownership = await checkExamOwnership(examId, teacher, { allowDraft: true, allowClosed: true });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }

    const statusFilter = searchParams.get('status'); // IN_PROGRESS|SUBMITTED|GRADED|FLAGGED|AUTO_CLOSED
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { examId };
    if (statusFilter) where.status = statusFilter;
    if (search) {
      where.OR = [
        { studentName: { contains: search } },
        { studentId: { contains: search } },
      ];
    }

    const [submissions, total] = await Promise.all([
      db.submission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          studentId: true,
          studentName: true,
          attemptNumber: true,
          startedAt: true,
          submittedAt: true,
          autoClosedAt: true,
          status: true,
          totalScore: true,
          maxScore: true,
          percentage: true,
          passed: true,
          focusEvents: true,
          tabSwitches: true,
          copyAttempts: true,
          lastActivityAt: true,
          gradedAt: true,
          gradedByName: true,
          _count: {
            select: {
              answers: true,
              violations: true,
              appeals: true,
            },
          },
        },
      }),
      db.submission.count({ where }),
    ]);

    const result = submissions.map((s) => ({
      ...s,
      answersCount: s._count.answers,
      violationsCount: s._count.violations,
      appealsCount: s._count.appeals,
      suspicious: s.tabSwitches >= 5 || s.copyAttempts >= 3 || s.focusEvents >= 10,
      _count: undefined,
      needsGrading:
        s.status === 'SUBMITTED' ||
        (s.status === 'GRADED' && s._count.appeals > 0),
    }));

    // إحصاءات سريعة
    const stats = {
      total: total,
      inProgress: submissions.filter((s) => s.status === 'IN_PROGRESS').length,
      submitted: submissions.filter((s) => s.status === 'SUBMITTED').length,
      graded: submissions.filter((s) => s.status === 'GRADED').length,
      autoClosed: submissions.filter((s) => s.status === 'AUTO_CLOSED').length,
      needsGrading: result.filter((s) => s.needsGrading).length,
      suspiciousCount: result.filter((s) => s.suspicious).length,
      avgScore:
        total > 0
          ? submissions
              .filter((s) => s.percentage !== null)
              .reduce((sum, s) => sum + (s.percentage || 0), 0) /
            Math.max(1, submissions.filter((s) => s.percentage !== null).length)
          : 0,
    };

    return NextResponse.json({
      success: true,
      count: result.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
      submissions: result,
    });
  } catch (error) {
    console.error('[exams/teacher/[id]/submissions GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب التسليمات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
