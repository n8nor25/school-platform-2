/**
 * GET /api/exams/parent/analytics/[studentId]
 * تحليلات أداء الابن عبر كل الامتحانات:
 *  - ملخص الأداء (متوسط النسبة، نسبة النجاح، عدد الامتحانات، أفضل/أدنى درجة)
 *  - أداء حسب المادة (متوسط النسبة لكل مادة)
 *  - أحدث 10 نتائج (للرسم البياني الزمني)
 *  - توزيع الحالات
 *  - مؤشرات الغش لكل تسليم
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractParentContext, hasParentStudentAccessFast,
  successResponse, errorResponse,
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
    // بالتوازي: بيانات الطالب (مع حقول الهاتف للتحقق السريع) + كل التسليمات
    const [student, submissions] = await Promise.all([
      db.student.findUnique({
        where: { id: studentId },
        select: {
          id: true, name: true, studentNumber: true, schoolId: true,
          parentPhone: true, parentPhone2: true, phone: true, parentNationalId: true,
        },
      }),
      db.submission.findMany({
        where: { studentId, schoolId: parent.schoolId },
        select: {
          id: true, status: true, percentage: true, passed: true,
          totalScore: true, maxScore: true, startedAt: true, submittedAt: true,
          tabSwitches: true, copyAttempts: true, focusEvents: true,
          attemptNumber: true,
          exam: {
            select: {
              id: true, title: true, subject: true, totalPoints: true,
              passingScore: true, durationMinutes: true,
              parentVisible: true, showResultImmediately: true,
            },
          },
        },
        orderBy: { startedAt: 'asc' },
      }),
    ]);

    // تحقق سريع من الصلاحية (بدون استعلام getChildren منفصل)
    if (!student) {
      return errorResponse('الطالب غير موجود', 404);
    }
    if (student.schoolId !== parent.schoolId || !hasParentStudentAccessFast(parent, student)) {
      return errorResponse('لا تملك صلاحية الوصول لهذا الطالب', 403);
    }

    // فلترة التسليمات المكشوفة النتائج لولي الأمر
    const finishedSubs = submissions.filter(
      (s) => s.status === 'SUBMITTED' || s.status === 'GRADED' || s.status === 'AUTO_CLOSED' || s.status === 'FLAGGED'
    );
    const revealedSubs = finishedSubs.filter((s) => {
      if (parent.isTestMode) return true;
      if (!s.exam.parentVisible) return false;
      return s.status === 'GRADED' || (s.status === 'SUBMITTED' && s.exam.showResultImmediately);
    });

    // الملخص العام
    const percentages = revealedSubs
      .map((s) => (typeof s.percentage === 'number' ? s.percentage : null))
      .filter((p): p is number => p !== null);
    const avgPercentage = percentages.length
      ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
      : 0;
    const maxPercentage = percentages.length ? Math.max(...percentages) : 0;
    const minPercentage = percentages.length ? Math.min(...percentages) : 0;
    const passedCount = revealedSubs.filter((s) => s.passed === true).length;
    const failedCount = revealedSubs.filter((s) => s.passed === false).length;
    const passRate = revealedSubs.length ? (passedCount / revealedSubs.length) * 100 : 0;

    // الأداء حسب المادة
    const subjectAgg: Record<string, { count: number; totalPct: number; passed: number; exams: Set<string> }> = {};
    for (const s of revealedSubs) {
      const subj = s.exam.subject || 'غير محدد';
      if (!subjectAgg[subj]) {
        subjectAgg[subj] = { count: 0, totalPct: 0, passed: 0, exams: new Set() };
      }
      subjectAgg[subj].count++;
      subjectAgg[subj].totalPct += (s.percentage || 0);
      if (s.passed === true) subjectAgg[subj].passed++;
      subjectAgg[subj].exams.add(s.exam.id);
    }
    const bySubject = Object.entries(subjectAgg).map(([subject, v]) => ({
      subject,
      attemptsCount: v.count,
      examsCount: v.exams.size,
      avgPercentage: Math.round((v.totalPct / v.count) * 100) / 100,
      passedCount: v.passed,
      failedCount: v.count - v.passed,
      passRate: Math.round((v.passed / v.count) * 100),
    })).sort((a, b) => b.avgPercentage - a.avgPercentage);

    // أحدث 10 نتائج (للرسم البياني الزمني)
    const recentResults = [...revealedSubs]
      .sort((a, b) => (b.submittedAt || b.startedAt).getTime() - (a.submittedAt || a.startedAt).getTime())
      .slice(0, 10)
      .reverse()
      .map((s) => ({
        date: s.submittedAt || s.startedAt,
        label: new Date(s.submittedAt || s.startedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
        examTitle: s.exam.title,
        subject: s.exam.subject,
        percentage: Math.round(s.percentage || 0),
        passed: s.passed,
      }));

    // توزيع الحالات (لجميع التسليمات — حتى غير المكشوفة)
    const statusGroups: Record<string, number> = {};
    for (const s of submissions) {
      statusGroups[s.status] = (statusGroups[s.status] || 0) + 1;
    }
    const statusBreakdown = Object.entries(statusGroups).map(([status, count]) => ({
      status,
      label: statusLabel(status),
      count,
    }));

    // مؤشرات الغش (لجميع التسليمات)
    const cheatingIndicators = {
      tabSwitches: submissions.reduce((s, x) => s + x.tabSwitches, 0),
      copyAttempts: submissions.reduce((s, x) => s + x.copyAttempts, 0),
      focusEvents: submissions.reduce((s, x) => s + x.focusEvents, 0),
      suspiciousSubmissions: submissions.filter(
        (s) => s.tabSwitches > 3 || s.copyAttempts > 0 || s.focusEvents > 5
      ).length,
    };

    // رؤى ذكية مُولّدة تلقائياً
    const insights: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; title: string; text: string }> = [];
    if (revealedSubs.length > 0) {
      if (passRate >= 70) {
        insights.push({ type: 'success', title: 'أداء ممتاز', text: `${Math.round(passRate)}% من الامتحانات ناجحة — استمرّ بالتشجيع!` });
      } else if (passRate >= 50) {
        insights.push({ type: 'warning', title: 'أداء متوسط', text: `${Math.round(passRate)}% نجاح — ${failedCount} امتحان يحتاج متابعة.` });
      } else {
        insights.push({ type: 'danger', title: 'أداء يحتاج دعم', text: `${failedCount} من ${revealedSubs.length} امتحان راسب — يُنصح بمتابعة المعلم.` });
      }

      if (bySubject.length >= 2) {
        const best = bySubject[0];
        const worst = bySubject[bySubject.length - 1];
        if (best.avgPercentage - worst.avgPercentage >= 25) {
          insights.push({
            type: 'info',
            title: 'فجوة في المواد',
            text: `أعلى مادة: ${best.subject} (${best.avgPercentage}%) • أضعف مادة: ${worst.subject} (${worst.avgPercentage}%).`,
          });
        }
      }

      if (recentResults.length >= 2) {
        // اتجاه الأداء (مقارنة آخر نتيجة بمتوسط السابق)
        const last = recentResults[recentResults.length - 1];
        const prevAvg = recentResults.slice(0, -1).reduce((s, r) => s + r.percentage, 0) / (recentResults.length - 1);
        const diff = last.percentage - prevAvg;
        if (diff > 10) {
          insights.push({ type: 'success', title: 'تحسّن ملحوظ', text: `آخر نتيجة (${last.percentage}%) أعلى من المتوسط السابق بـ ${Math.round(diff)}%.` });
        } else if (diff < -10) {
          insights.push({ type: 'warning', title: 'تراجع في الأداء', text: `آخر نتيجة (${last.percentage}%) أقل من المتوسط السابق بـ ${Math.abs(Math.round(diff))}%.` });
        }
      }

      if (cheatingIndicators.suspiciousSubmissions > 0) {
        insights.push({
          type: 'danger',
          title: 'تنبيه مراقبة',
          text: `${cheatingIndicators.suspiciousSubmissions} تسليم يحمل مؤشرات غش — يُنصح بمراجعة مع المعلم.`,
        });
      }

      if (maxPercentage === 100) {
        insights.push({ type: 'success', title: 'درجة كاملة', text: `حصل ابنتك/ابنك على 100% في أحد الامتحانات! 🎉` });
      }
    }

    return successResponse({
      student,
      parent: {
        parentId: parent.parentId,
        parentName: parent.parentName,
        isTestMode: parent.isTestMode,
      },
      summary: {
        totalSubmissions: submissions.length,
        finishedSubmissions: finishedSubs.length,
        revealedResults: revealedSubs.length,
        pendingResults: finishedSubs.length - revealedSubs.length,
        avgPercentage,
        maxPercentage,
        minPercentage,
        passedCount,
        failedCount,
        passRate: Math.round(passRate * 100) / 100,
      },
      bySubject,
      recentResults,
      statusBreakdown,
      cheatingIndicators,
      insights,
    });
  } catch (e) {
    console.error('[parent analytics GET] error:', e);
    return errorResponse('فشل جلب تحليلات الطالب', 500);
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
