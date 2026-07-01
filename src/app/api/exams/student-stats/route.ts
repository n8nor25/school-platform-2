/**
 * ============================================================
 *  GET /api/exams/student-stats
 *  ============================================================
 *  إحصائيات أداء الطالب لعرضها في رأس واجهة الامتحانات:
 *
 *  • KPIs: عدد الامتحانات المنجزة، المتوسط، نسبة النجاح، أعلى نتيجة
 *  • مخطط الأداء الزمني (آخر 10 نتائج)
 *  • تفصيل حسب المادة (متوسط + عدد)
 *  • قائمة آخر النتائج (5 الأحدث) مع الحالة
 *  • إجمالي التظلّمات المقدّمة
 *
 *  Query: schoolId, studentId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';

const GRADED_STATUSES = ['GRADED', 'AUTO_CLOSED', 'SUBMITTED'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'));
    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 });
    }

    const studentId = searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'معرف الطالب مطلوب' }, { status: 400 });
    }

    // جلب كل تسليمات الطالب المصحّحة/المُسلَّمة
    const submissions = await db.submission.findMany({
      where: {
        schoolId,
        studentId,
        status: { in: GRADED_STATUSES },
        submittedAt: { not: null },
      },
      select: {
        id: true,
        percentage: true,
        totalScore: true,
        maxScore: true,
        passed: true,
        status: true,
        submittedAt: true,
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            totalPoints: true,
            passingScore: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // في وضع الاختبار قد لا تكون هناك بيانات حقيقية
    const isTestMode = studentId.startsWith('test-');
    if (submissions.length === 0) {
      return NextResponse.json({
        success: true,
        isEmpty: true,
        kpis: {
          totalExams: 0,
          avgScore: 0,
          passRate: 0,
          bestScore: 0,
          totalAppeals: 0,
        },
        timeline: [],
        subjectBreakdown: [],
        recentResults: [],
        isTestMode,
      });
    }

    // KPIs
    const withPct = submissions.filter((s) => s.percentage !== null);
    const pcts = withPct.map((s) => s.percentage as number);
    const passedCount = withPct.filter((s) => s.passed).length;
    const avgScore =
      pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
    const bestScore = pcts.length > 0 ? Math.max(...pcts) : 0;
    const passRate =
      withPct.length > 0 ? (passedCount / withPct.length) * 100 : 0;

    // التظلّمات الإجمالية
    const totalAppeals = await db.examAppeal.count({
      where: { schoolId, studentId },
    });

    // مخطط الأداء الزمني (آخر 10، مرتّبة تصاعدياً حسب التاريخ)
    const timelineRaw = withPct
      .slice(0, 10)
      .reverse()
      .map((s) => ({
        examTitle: s.exam.title,
        subject: s.exam.subject,
        score: Math.round((s.percentage as number) * 10) / 10,
        passed: s.passed,
        date: (s.submittedAt as Date).toISOString(),
      }));

    // تفصيل حسب المادة
    const subjectMap = new Map<
      string,
      { pcts: number[]; passedCount: number; count: number }
    >();
    for (const s of withPct) {
      const subject = s.exam.subject || 'عام';
      const entry = subjectMap.get(subject) || {
        pcts: [],
        passedCount: 0,
        count: 0,
      };
      entry.pcts.push(s.percentage as number);
      entry.count += 1;
      if (s.passed) entry.passedCount += 1;
      subjectMap.set(subject, entry);
    }
    const subjectBreakdown = Array.from(subjectMap.entries())
      .map(([subject, e]) => ({
        subject,
        avgScore: Math.round((e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length) * 10) / 10,
        examCount: e.count,
        passRate: Math.round((e.passedCount / e.count) * 1000) / 10,
      }))
      .sort((a, b) => b.examCount - a.examCount);

    // آخر 5 نتائج
    const recentResults = withPct.slice(0, 5).map((s) => ({
      submissionId: s.id,
      examId: s.exam.id,
      examTitle: s.exam.title,
      subject: s.exam.subject,
      percentage: Math.round((s.percentage as number) * 10) / 10,
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      passed: s.passed,
      status: s.status,
      submittedAt: (s.submittedAt as Date).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      isEmpty: false,
      kpis: {
        totalExams: withPct.length,
        avgScore: Math.round(avgScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        bestScore: Math.round(bestScore * 10) / 10,
        totalAppeals,
      },
      timeline: timelineRaw,
      subjectBreakdown,
      recentResults,
      isTestMode,
    });
  } catch (error) {
    console.error('[student-stats] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب إحصائيات الطالب', details: (error as Error).message },
      { status: 500 }
    );
  }
}
