/**
 * GET /api/exams/teacher/[id]/analytics
 * تحليلات امتحان شاملة للمعلم:
 *  - إحصاءات عامة (عدد، متوسط، وسيط، أعلى، أدنى، انحراف معياري، نسبة نجاح)
 *  - توزيع الدرجات (histogram bins)
 *  - توزيع الحالات (IN_PROGRESS / SUBMITTED / GRADED / ...)
 *  - صعوبة كل سؤال (نسبة الإجابة الصحيحة + متوسط الدرجة)
 *  - مؤشرات الغش (tab switches / copy / focus loss)
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../_teacher-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await extractTeacherContext(req);
  if (!ctx.teacher) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
  }
  const { id } = await params;
  const own = await checkExamOwnership(id, ctx.teacher, { allowDraft: true, allowClosed: true });
  if (!own.ok) {
    return NextResponse.json({ error: own.error }, { status: own.status || 403 });
  }

  try {
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true, title: true, subject: true, totalPoints: true, passingScore: true,
        status: true, startDate: true, endDate: true, durationMinutes: true,
        questions: {
          select: { id: true, text: true, type: true, points: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    // كل التسليمات المُسلَّمة (لها نتيجة)
    const submissions = await db.submission.findMany({
      where: { examId: id, status: { in: ['SUBMITTED', 'GRADED', 'AUTO_CLOSED', 'FLAGGED'] } },
      select: {
        id: true, totalScore: true, maxScore: true, percentage: true, passed: true,
        status: true, tabSwitches: true, copyAttempts: true, focusEvents: true,
        startedAt: true, submittedAt: true, autoClosedAt: true,
      },
    });

    const total = submissions.length;
    const percentages = submissions
      .map(s => (typeof s.percentage === 'number' ? s.percentage : null))
      .filter((p): p is number => p !== null);

    // إحصاءات عامة
    const avg = percentages.length ? percentages.reduce((a, b) => a + b, 0) / percentages.length : 0;
    const sorted = [...percentages].sort((a, b) => a - b);
    const median = sorted.length
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const max = sorted.length ? sorted[sorted.length - 1] : 0;
    const min = sorted.length ? sorted[0] : 0;
    const variance = percentages.length
      ? percentages.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / percentages.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const passedCount = submissions.filter(s => s.passed === true).length;
    const passRate = total ? (passedCount / total) * 100 : 0;

    // توزيع الدرجات (bins of 10%)
    const bins = [
      { label: '0-10%', min: 0, max: 10, count: 0 },
      { label: '10-20%', min: 10, max: 20, count: 0 },
      { label: '20-30%', min: 20, max: 30, count: 0 },
      { label: '30-40%', min: 30, max: 40, count: 0 },
      { label: '40-50%', min: 40, max: 50, count: 0 },
      { label: '50-60%', min: 50, max: 60, count: 0 },
      { label: '60-70%', min: 60, max: 70, count: 0 },
      { label: '70-80%', min: 70, max: 80, count: 0 },
      { label: '80-90%', min: 80, max: 90, count: 0 },
      { label: '90-100%', min: 90, max: 101, count: 0 },
    ];
    for (const p of percentages) {
      const bin = bins.find(b => p >= b.min && p < b.max);
      if (bin) bin.count++;
    }

    // توزيع الحالات
    const statusGroups = await db.submission.groupBy({
      by: ['status'],
      where: { examId: id },
      _count: { id: true },
    });
    const statusBreakdown = statusGroups.map(g => ({
      status: g.status,
      label: statusLabel(g.status),
      count: g._count.id,
    }));

    // صعوبة كل سؤال
    const questionStats = await Promise.all(
      exam.questions.map(async (q) => {
        const answers = await db.answer.findMany({
          where: { questionId: q.id, score: { not: null } },
          select: { score: true, isCorrect: true, maxScore: true },
        });
        const graded = answers.length;
        const correctCount = answers.filter(a => a.isCorrect === true).length;
        const avgScore = graded
          ? answers.reduce((s, a) => s + (a.score || 0), 0) / graded
          : 0;
        const correctRate = graded ? (correctCount / graded) * 100 : 0;
        const difficulty: 'easy' | 'medium' | 'hard' =
          correctRate >= 70 ? 'easy' : correctRate >= 40 ? 'medium' : 'hard';
        return {
          id: q.id,
          order: q.order,
          type: q.type,
          text: q.text.length > 60 ? q.text.slice(0, 60) + '…' : q.text,
          points: q.points,
          gradedCount: graded,
          correctCount,
          correctRate: Math.round(correctRate),
          avgScore: Math.round(avgScore * 100) / 100,
          maxScore: q.points,
          difficulty,
        };
      })
    );

    // مؤشرات الغش
    const cheatingIndicators = {
      tabSwitches: submissions.reduce((s, x) => s + x.tabSwitches, 0),
      copyAttempts: submissions.reduce((s, x) => s + x.copyAttempts, 0),
      focusEvents: submissions.reduce((s, x) => s + x.focusEvents, 0),
      suspiciousSubmissions: submissions.filter(
        s => s.tabSwitches > 3 || s.copyAttempts > 0 || s.focusEvents > 5
      ).length,
    };

    // مدة الإنجاز (دقائق)
    const durations: number[] = [];
    for (const s of submissions) {
      const end = s.submittedAt || s.autoClosedAt;
      if (end && s.startedAt) {
        const mins = (end.getTime() - s.startedAt.getTime()) / 60000;
        if (mins > 0 && mins < exam.durationMinutes * 2) durations.push(mins);
      }
    }
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        totalPoints: exam.totalPoints,
        passingScore: exam.passingScore,
        status: exam.status,
        durationMinutes: exam.durationMinutes,
      },
      summary: {
        totalSubmissions: total,
        avgScore: Math.round(avg * 100) / 100,
        medianScore: Math.round(median * 100) / 100,
        maxScore: Math.round(max * 100) / 100,
        minScore: Math.round(min * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        passedCount,
        failedCount: total - passedCount,
        passRate: Math.round(passRate * 100) / 100,
        avgDurationMinutes: Math.round(avgDuration * 10) / 10,
      },
      distribution: bins.map(b => ({ label: b.label, count: b.count })),
      statusBreakdown,
      questionStats,
      cheatingIndicators,
    });
  } catch (e) {
    console.error('[teacher analytics] error:', e);
    return NextResponse.json(
      { error: 'فشل جلب التحليلات', details: (e as Error).message },
      { status: 500 }
    );
  }
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    IN_PROGRESS: 'جاري',
    SUBMITTED: 'بانتظار التصحيح',
    GRADED: 'مُصحَّح',
    AUTO_CLOSED: 'إغلاق تلقائي',
    FLAGGED: 'مُعلَّق',
  };
  return map[s] || s;
}
