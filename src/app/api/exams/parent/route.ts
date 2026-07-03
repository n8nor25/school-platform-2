/**
 * GET /api/exams/parent
 * قائمة أبناء ولي الأمر مع إحصاءات سريعة لكل ابن:
 *  - عدد الامتحانات المتاحة (PUBLISHED + OPEN)
 *  - عدد التسليمات المنتهية (SUBMITTED/GRADED)
 *  - عدد النتائج المكشوفة لولي الأمر
 *  - متوسط النسبة
 *  - آخر تسليم
 *
 * تحسينات الأداء:
 *  - استعلامات الامتحانات المنشورة (مستوى المدرسة) تُنفَّذ مرة واحدة خارج حلقة الأبناء
 *  - دمج count + findMany في استعلام findMany واحد (نحسب العدد في JS)
 *  - استعلامات التسليم لكل ابن تُنفَّذ بالتوازي (Promise.all)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractParentContext, getChildren, getExamTimeStatus, successResponse, errorResponse } from '../_parent-helpers';

export async function GET(req: NextRequest) {
  const ctx = await extractParentContext(req);
  if (!ctx.parent) {
    return errorResponse(ctx.error || 'غير مصرّح', ctx.status || 401);
  }
  const parent = ctx.parent;

  try {
    // نجلب الأبناء + كل الامتحانات المنشورة في المدرسة بالتوازي (مستوى المدرسة = مرة واحدة)
    const [children, allPublishedExams] = await Promise.all([
      getChildren(parent),
      db.exam.findMany({
        where: { schoolId: parent.schoolId, status: 'PUBLISHED' },
        select: { id: true, startDate: true, endDate: true },
      }),
    ]);

    // نحسب حالات الامتحانات على مستوى المدرسة مرة واحدة (لا تعتمد على الابن)
    const now = new Date();
    const activeExamIds = new Set<string>();
    const upcomingExamIds = new Set<string>();
    const endedExamIds = new Set<string>();
    for (const e of allPublishedExams) {
      const st = getExamTimeStatus(e);
      if (st === 'OPEN') activeExamIds.add(e.id);
      else if (st === 'UPCOMING') upcomingExamIds.add(e.id);
      else endedExamIds.add(e.id);
    }
    const publishedExamsCount = allPublishedExams.length;
    const activeExamsCount = activeExamIds.size;
    const upcomingExamsCount = upcomingExamIds.size;

    // لكل ابن، نجلب التسليمات فقط (بالتوازي بين الأبناء)
    const childrenWithStats = await Promise.all(
      children.map(async (child) => {
        const submissions = await db.submission.findMany({
          where: { studentId: child.id, schoolId: parent.schoolId },
          select: {
            id: true, status: true, percentage: true, passed: true,
            examId: true,
            submittedAt: true, startedAt: true,
            exam: {
              select: {
                id: true, title: true, subject: true, status: true,
                parentVisible: true, showResultImmediately: true,
                startDate: true, endDate: true,
              },
            },
          },
          orderBy: { startedAt: 'desc' },
        });

        const totalSubs = submissions.length;
        const finishedSubs = submissions.filter(
          (s) => s.status === 'SUBMITTED' || s.status === 'GRADED' || s.status === 'AUTO_CLOSED' || s.status === 'FLAGGED'
        );
        const gradedSubs = submissions.filter((s) => s.status === 'GRADED');
        const passedSubs = gradedSubs.filter((s) => s.passed === true);

        // النتائج المكشوفة لولي الأمر
        const revealedSubs = finishedSubs.filter((s) => {
          if (parent.isTestMode) return true;
          if (!s.exam.parentVisible) return false;
          return s.status === 'GRADED' || (s.status === 'SUBMITTED' && s.exam.showResultImmediately);
        });

        // متوسط النسبة (للمكشوفين فقط)
        const percentages = revealedSubs
          .map((s) => (typeof s.percentage === 'number' ? s.percentage : null))
          .filter((p): p is number => p !== null);
        const avgPercentage = percentages.length
          ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
          : null;

        // آخر تسليم
        const lastSubmission = submissions[0] || null;

        // محاولات الطالب لكل امتحان
        const examIdsAttempted = new Set(submissions.map((s) => s.examId));

        return {
          id: child.id,
          name: child.name,
          studentNumber: child.studentNumber,
          classroomId: child.classroomId,
          parentName: child.parentName,
          stats: {
            totalSubmissions: totalSubs,
            finishedSubmissions: finishedSubs.length,
            gradedSubmissions: gradedSubs.length,
            passedSubmissions: passedSubs.length,
            revealedResults: revealedSubs.length,
            pendingResults: finishedSubs.length - revealedSubs.length,
            avgPercentage,
            publishedExams: publishedExamsCount,
            activeExams: activeExamsCount,
            upcomingExams: upcomingExamsCount,
            attemptedExams: examIdsAttempted.size,
          },
          lastSubmission: lastSubmission
            ? {
                id: lastSubmission.id,
                examTitle: lastSubmission.exam.title,
                subject: lastSubmission.exam.subject,
                status: lastSubmission.status,
                percentage: lastSubmission.percentage,
                passed: lastSubmission.passed,
                submittedAt: lastSubmission.submittedAt,
                startedAt: lastSubmission.startedAt,
              }
            : null,
        };
      })
    );

    return successResponse({
      parent: {
        parentId: parent.parentId,
        parentName: parent.parentName,
        isTestMode: parent.isTestMode,
      },
      children: childrenWithStats,
      childrenCount: childrenWithStats.length,
    });
  } catch (e) {
    console.error('[parent GET] error:', e);
    return errorResponse('فشل جلب بيانات أولياء الأمور', 500);
  }
}
