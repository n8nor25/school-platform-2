/**
 * ============================================================
 *  GET /api/exams/coordinator/violations
 *  ============================================================
 *  قائمة كل المخالفات على مستوى المدرسة مع فلترة.
 *
 *  Query: schoolId, coordinatorId,
 *         [examId], [studentId], [type], [severity], [dateFrom], [dateTo],
 *         [page=1], [pageSize=20]
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractCoordinatorContext } from '../../_coordinator-helpers';

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

    // ملاحظة: حقل severity في قاعدة البيانات يحتوي على قيم نصية متباينة
    // (لا تتطابق مع schema الحالي Int) — تجنّبنا استخدامه في الاستعلام.
    const where: {
      schoolId: string;
      examId?: string;
      studentId?: string;
      type?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = { schoolId };

    const examId = searchParams.get('examId');
    if (examId) where.examId = examId;

    const studentId = searchParams.get('studentId');
    if (studentId) where.studentId = studentId;

    const type = searchParams.get('type');
    if (type && type !== 'all') where.type = type;

    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    );

    const [total, violations] = await Promise.all([
      db.examViolation.count({ where }),
      db.examViolation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          details: true,
          createdAt: true,
          submission: {
            select: {
              id: true,
              studentName: true,
              exam: {
                select: { id: true, title: true, subject: true, teacherName: true },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      violations: violations.map((v) => ({
        id: v.id,
        type: v.type,
        details: v.details,
        createdAt: v.createdAt.toISOString(),
        submissionId: v.submission.id,
        studentName: v.submission.studentName || 'طالب',
        examId: v.submission.exam.id,
        examTitle: v.submission.exam.title,
        subject: v.submission.exam.subject,
        teacherName: v.submission.exam.teacherName,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[coordinator/violations] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب المخالفات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
