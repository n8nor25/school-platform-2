/**
 * ============================================================
 *  /api/exams/coordinator/exams/[id]
 *  ============================================================
 *  إجراءات إدارية للمنسّق على امتحان معيّن (على مستوى المدرسة):
 *
 *  GET    — تفاصيل الامتحان + إحصائيات تفصيلية + قائمة التسليمات
 *  PATCH  — إجراء إداري (action: publish|close|force-close|archive|unarchive|delete|reassign)
 *
 *  Query: schoolId, coordinatorId, [coordinatorName]
 *  Body (PATCH): { action, ...payload }
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractCoordinatorContext } from '../../../_coordinator-helpers';

/** نوع الإجراء الإداري */
type AdminAction =
  | 'publish'
  | 'close'
  | 'force-close'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'reassign';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await extractCoordinatorContext(request);
    if (!ctxResult.coordinator) {
      return NextResponse.json(
        { error: ctxResult.error || 'غير مصرّح' },
        { status: ctxResult.status || 401 }
      );
    }
    const { schoolId } = ctxResult.coordinator;
    const { id: examId } = await params;

    const exam = await db.exam.findFirst({
      where: { id: examId, schoolId },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        teacherId: true,
        teacherName: true,
        classroomId: true,
        classroomName: true,
        academicYearId: true,
        startDate: true,
        endDate: true,
        durationMinutes: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        allowReview: true,
        showResultImmediately: true,
        parentVisible: true,
        maxAttempts: true,
        maxFileSizeMb: true,
        allowTextAnswers: true,
        allowImageAnswers: true,
        allowPdfAnswers: true,
        ipRestriction: true,
        antiCheatEnabled: true,
        status: true,
        totalPoints: true,
        passingScore: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { questions: true, submissions: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    // إحصائيات تفصيلية
    // ملاحظة: some violation fields (severity, userAgent, ipHash) قد لا تتطابق مع
    // الـ schema الحالي في قاعدة البيانات، لذا نلفّ استعلامات المخالفات في try/catch.
    const [
      submissionsByStatus,
      gradeStats,
      appealsCount,
      recentSubmissions,
    ] = await Promise.all([
      db.submission.groupBy({
        by: ['status'],
        where: { examId, schoolId },
        _count: { id: true },
      }),
      db.submission.aggregate({
        where: {
          examId,
          schoolId,
          percentage: { not: null },
        },
        _avg: { percentage: true },
        _min: { percentage: true },
        _max: { percentage: true },
        _count: { id: true },
      }),
      db.examAppeal.count({
        where: { schoolId, submission: { examId } },
      }),
      db.submission.findMany({
        where: { examId, schoolId },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          studentName: true,
          status: true,
          percentage: true,
          totalScore: true,
          passed: true,
          submittedAt: true,
          tabSwitches: true,
          copyAttempts: true,
          focusEvents: true,
          _count: { select: { appeals: true } },
        },
      }),
    ]);

    let violationsCount = 0;
    try {
      violationsCount = await db.examViolation.count({ where: { examId, schoolId } });
    } catch {
      // some legacy rows have severity as string instead of Int — ignore count failure
      violationsCount = 0;
    }

    const statusCounts: Record<string, number> = {};
    for (const row of submissionsByStatus) {
      statusCounts[row.status] = row._count.id;
    }

    const passCount = await db.submission.count({
      where: { examId, schoolId, passed: true, percentage: { not: null } },
    });

    return NextResponse.json({
      success: true,
      exam: {
        ...exam,
        startDate: exam.startDate.toISOString(),
        endDate: exam.endDate.toISOString(),
        createdAt: exam.createdAt.toISOString(),
        updatedAt: exam.updatedAt.toISOString(),
        questionsCount: exam._count.questions,
        submissionsCount: exam._count.submissions,
        _count: undefined,
      },
      stats: {
        submissionsByStatus: statusCounts,
        gradedCount: gradeStats._count.id,
        avgScore: gradeStats._avg.percentage
          ? Math.round(gradeStats._avg.percentage * 10) / 10
          : 0,
        minScore: gradeStats._min.percentage
          ? Math.round(gradeStats._min.percentage * 10) / 10
          : 0,
        maxScore: gradeStats._max.percentage
          ? Math.round(gradeStats._max.percentage * 10) / 10
          : 0,
        passCount,
        passRate:
          gradeStats._count.id > 0
            ? Math.round((passCount / gradeStats._count.id) * 1000) / 10
            : 0,
        violationsCount,
        appealsCount,
      },
      recentSubmissions: recentSubmissions.map((s) => ({
        ...s,
        submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      })),
    });
  } catch (error) {
    console.error('[coordinator/exams/[id] GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب تفاصيل الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await extractCoordinatorContext(request);
    if (!ctxResult.coordinator) {
      return NextResponse.json(
        { error: ctxResult.error || 'غير مصرّح' },
        { status: ctxResult.status || 401 }
      );
    }
    const { schoolId, coordinatorId, coordinatorName } = ctxResult.coordinator;
    const { id: examId } = await params;

    const body = await request.json().catch(() => ({}));
    const action: AdminAction = body.action;
    if (!action) {
      return NextResponse.json({ error: 'الإجراء (action) مطلوب' }, { status: 400 });
    }

    // جلب الامتحان
    const exam = await db.exam.findFirst({
      where: { id: examId, schoolId },
      select: { id: true, status: true, title: true, teacherId: true, teacherName: true },
    });
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    let newStatus: string | null = null;
    let message = '';

    switch (action) {
      case 'publish': {
        if (exam.status === 'PUBLISHED') {
          return NextResponse.json({ error: 'الامتحان منشور بالفعل' }, { status: 400 });
        }
        // التحقق من وجود أسئلة
        const qCount = await db.question.count({ where: { examId } });
        if (qCount === 0) {
          return NextResponse.json(
            { error: 'لا يمكن نشر امتحان بدون أسئلة' },
            { status: 400 }
          );
        }
        newStatus = 'PUBLISHED';
        message = 'تم نشر الامتحان بنجاح';
        break;
      }
      case 'close':
      case 'force-close': {
        if (exam.status !== 'PUBLISHED') {
          return NextResponse.json(
            { error: 'لا يمكن إغلاق امتحان غير منشور' },
            { status: 400 }
          );
        }
        // force-close يُغلق أيضاً التسليمات النشطة
        if (action === 'force-close') {
          const activeCount = await db.submission.updateMany({
            where: { examId, schoolId, status: 'IN_PROGRESS' },
            data: {
              status: 'AUTO_CLOSED',
              autoClosedAt: new Date(),
              notes: `أُغلق إجبارياً بواسطة المنسّق ${coordinatorName}`,
            },
          });
          message = `تم الإغلاق الإجباري للامتحان + ${activeCount.count} تسليم نشط`;
        } else {
          message = 'تم إغلاق الامتحان';
        }
        newStatus = 'CLOSED';
        break;
      }
      case 'archive': {
        if (exam.status === 'ARCHIVED') {
          return NextResponse.json({ error: 'الامتحان مؤرشف بالفعل' }, { status: 400 });
        }
        newStatus = 'ARCHIVED';
        message = 'تمت أرشفة الامتحان';
        break;
      }
      case 'unarchive': {
        if (exam.status !== 'ARCHIVED') {
          return NextResponse.json(
            { error: 'الامتحان غير مؤرشف' },
            { status: 400 }
          );
        }
        // نُعيده لحالة CLOSED بعد فك الأرشفة
        newStatus = 'CLOSED';
        message = 'تمت إزالة الأرشفة';
        break;
      }
      case 'delete': {
        // حذف نهائي (مع كل التبعيات بفضل onDelete: Cascade)
        await db.exam.delete({ where: { id: examId } });
        return NextResponse.json({
          success: true,
          message: 'تم حذف الامتحان نهائياً',
          action: 'delete',
          coordinator: { id: coordinatorId, name: coordinatorName },
        });
      }
      case 'reassign': {
        // إعادة تعيين الامتحان لمعلم آخر
        const newTeacherId = body.teacherId;
        const newTeacherName = body.teacherName || 'معلم';
        if (!newTeacherId) {
          return NextResponse.json(
            { error: 'معرف المعلم الجديد (teacherId) مطلوب لإعادة التعيين' },
            { status: 400 }
          );
        }
        await db.exam.update({
          where: { id: examId },
          data: { teacherId: newTeacherId, teacherName: newTeacherName },
        });
        return NextResponse.json({
          success: true,
          message: `تمت إعادة تعيين الامتحان إلى ${newTeacherName}`,
          action: 'reassign',
          coordinator: { id: coordinatorId, name: coordinatorName },
        });
      }
      default:
        return NextResponse.json(
          { error: `إجراء غير معروف: ${action}` },
          { status: 400 }
        );
    }

    if (newStatus) {
      await db.exam.update({
        where: { id: examId },
        data: { status: newStatus as 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED' },
      });
    }

    return NextResponse.json({
      success: true,
      message,
      action,
      previousStatus: exam.status,
      newStatus,
      coordinator: { id: coordinatorId, name: coordinatorName },
    });
  } catch (error) {
    console.error('[coordinator/exams/[id] PATCH] error:', error);
    return NextResponse.json(
      { error: 'فشل تنفيذ الإجراء', details: (error as Error).message },
      { status: 500 }
    );
  }
}
