/**
 * ============================================================
 *  GET /api/exams/student/performance?schoolId=X&studentId=Y
 *  ============================================================
 *  منحنى أداء الطالب عبر الزمن — يُغذّي LineChart في صفحة الطالب.
 *
 *  الاستجابة:
 *    • timeline: سلسلة زمنية لكل محاولة مُسلَّمة (SUBMITTED/GRADED)
 *                مرتَّبة تصاعدياً حسب تاريخ التسليم (مثالية لـ LineChart).
 *                كل عنصر يحوي percentage (درجة الطالب) و classAverage
 *                (متوسط كل الطلاب في نفس الامتحان — خط المقارنة في الـ chart).
 *    • byPeriod: متوسط الأداء حسب الفئة الزمنية (WEEKLY/MIDMONTH/...)
 *                مع count و trend (مقارنة بين أول وآخر تسليم في الفئة).
 *    • bySubject: متوسط الأداء حسب المادة + آخر درجة.
 *    • stats: إجماليات + متوسطات + أفضل درجة + التحسّن (improvement)
 *             + avgClassScore (متوسط الفصل العام) + classRank (ترتيب الطالب)
 *             + classSize (عدد طلاب الفصل).
 *
 *  المصادقة: عبر extractStudentContext (query: schoolId + studentId،
 *  أو headers x-student-id). نفس pattern المستخدم في
 *  `src/app/api/exams/student/route.ts` و `[id]/start/route.ts`.
 * ============================================================
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext,
  errorResponse,
  successResponse,
} from '../../_student-helpers';

/** تسميات عربية للفئات الزمنية */
const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: 'أسبوعي',
  MIDMONTH: 'نصف شهري',
  MONTHLY: 'شهري',
  CUMULATIVE: 'تراكمي',
  NONE: 'بدون',
};

/** تقريب إلى منزلة عشرية واحدة */
const round1 = (n: number): number => Math.round(n * 10) / 10;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { student, error, status } = await extractStudentContext(
      req,
      searchParams.get('schoolId')
    );
    if (!student) return errorResponse(error!, status);

    // ============================================================
    // 1) جلب التسليمات المُسلَّمة/المُصحَّحة مرتَّبة تصاعدياً حسب تاريخ التسليم
    // ============================================================
    const submissions = await db.submission.findMany({
      where: {
        studentId: student.studentId,
        status: { in: ['SUBMITTED', 'GRADED'] },
        exam: { schoolId: student.schoolId },
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            category: true,
            examPeriod: true,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // ============================================================
    // 2) Timeline — كل تسليم صالح (submittedAt + percentage)
    // ============================================================
    const rawTimeline = submissions
      .filter((s) => s.submittedAt !== null && s.percentage !== null)
      .map((s) => ({
        date: (s.submittedAt as Date).toISOString(),
        examId: s.exam.id,
        examTitle: s.exam.title,
        subject: s.exam.subject,
        category: s.exam.category, // 'TRAINING' | 'OFFICIAL'
        examPeriod: s.exam.examPeriod, // 'WEEKLY' | 'MIDMONTH' | 'MONTHLY' | 'CUMULATIVE' | 'NONE'
        percentage: round1(s.percentage as number),
        passed: !!s.passed,
        attemptNumber: s.attemptNumber,
      }));

    // ============================================================
    // 2b) classAverage — لكل امتحان في timeline، احسب متوسط كل
    //     الـ submissions (كل الطلاب) لنفس الامتحان. يُستخدم كخط
    //     مقارنة في الـ LineChart. إذا لا يوجد سوى تسليم الطالب
    //     نفسه، classAverage = percentage (نفس درجة الطالب).
    //     كما نحسب avgClassScore و classRank و classSize للـ stats.
    // ============================================================
    const examIds = Array.from(new Set(rawTimeline.map((t) => t.examId)));

    // كل التسليمات الصالحة لهذه الامتحانات (كل الطلاب)
    const classSubmissions =
      examIds.length > 0
        ? await db.submission.findMany({
            where: {
              examId: { in: examIds },
              status: { in: ['SUBMITTED', 'GRADED'] },
              percentage: { not: null },
            },
            select: {
              examId: true,
              studentId: true,
              percentage: true,
            },
          })
        : [];

    // متوسط كل امتحان (يضمّ تسليم الطالب نفسه → line class avg)
    const examAvgMap = new Map<string, number[]>();
    for (const cs of classSubmissions) {
      if (cs.percentage == null) continue;
      const arr = examAvgMap.get(cs.examId) || [];
      arr.push(cs.percentage);
      examAvgMap.set(cs.examId, arr);
    }

    // متوسط كل طالب عبر كل الامتحانات (لحساب الترتيب)
    const studentAvgMap = new Map<string, number[]>();
    for (const cs of classSubmissions) {
      if (cs.percentage == null) continue;
      const arr = studentAvgMap.get(cs.studentId) || [];
      arr.push(cs.percentage);
      studentAvgMap.set(cs.studentId, arr);
    }

    const timeline = rawTimeline.map((t) => {
      const arr = examAvgMap.get(t.examId);
      // لا يوجد آخرون → classAverage = percentage (نفس درجة الطالب)
      if (!arr || arr.length === 0) {
        return { ...t, classAverage: t.percentage };
      }
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return { ...t, classAverage: round1(avg) };
    });

    // ============================================================
    // 3) byPeriod — group by examPeriod مع avg + count + trend
    // ============================================================
    const periodMap = new Map<
      string,
      { pcts: number[]; dates: { pct: number; date: string }[] }
    >();
    for (const t of timeline) {
      const entry =
        periodMap.get(t.examPeriod) || { pcts: [], dates: [] };
      entry.pcts.push(t.percentage);
      entry.dates.push({ pct: t.percentage, date: t.date });
      periodMap.set(t.examPeriod, entry);
    }

    const byPeriod = Array.from(periodMap.entries())
      .map(([period, e]) => {
        const avg = e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length;
        // trend: مقارنة بين أول وآخر تسليم في هذه الفئة (مرتَّبة تصاعدياً)
        const sorted = [...e.dates].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const first = sorted[0]?.pct ?? 0;
        const last = sorted[sorted.length - 1]?.pct ?? 0;
        const diff = last - first;
        // هامش 0.5 لتجنّب الضجيج العددي الصغير
        const trend: 'up' | 'down' | 'stable' =
          diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'stable';
        return {
          period,
          label: PERIOD_LABELS[period] || period,
          avgScore: round1(avg),
          count: e.pcts.length,
          trend,
        };
      })
      .sort((a, b) => b.count - a.count);

    // ============================================================
    // 4) bySubject — group by subject مع avg + count + lastScore
    //    timeline مرتَّب تصاعدياً حسب التاريخ، فالآخر المُعالَج هو الأحدث
    // ============================================================
    const subjectMap = new Map<string, { pcts: number[]; last: number }>();
    for (const t of timeline) {
      const entry = subjectMap.get(t.subject) || { pcts: [], last: 0 };
      entry.pcts.push(t.percentage);
      entry.last = t.percentage;
      subjectMap.set(t.subject, entry);
    }

    const bySubject = Array.from(subjectMap.entries())
      .map(([subject, e]) => ({
        subject,
        avgScore: round1(
          e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length
        ),
        count: e.pcts.length,
        lastScore: round1(e.last),
      }))
      .sort((a, b) => b.count - a.count);

    // ============================================================
    // 5) Stats — إجماليات + متوسطات + أفضل درجة + التحسّن
    // ============================================================
    const totalAttempts = timeline.length;
    const training = timeline.filter((t) => t.category === 'TRAINING');
    const official = timeline.filter((t) => t.category === 'OFFICIAL');

    const avgTraining: number | null =
      training.length > 0
        ? round1(
            training.reduce((a, t) => a + t.percentage, 0) / training.length
          )
        : null;
    const avgOfficial: number | null =
      official.length > 0
        ? round1(
            official.reduce((a, t) => a + t.percentage, 0) / official.length
          )
        : null;
    const bestScore: number | null =
      totalAttempts > 0
        ? round1(Math.max(...timeline.map((t) => t.percentage)))
        : null;

    // improvement = avg(last3) - avg(first3)
    // يتطلب 6 محاولات على الأقل لتفادي تداخل أول 3 وآخر 3
    let improvement: number | null = null;
    if (totalAttempts >= 6) {
      const first3 = timeline.slice(0, 3);
      const last3 = timeline.slice(-3);
      const avgFirst3 =
        first3.reduce((a, t) => a + t.percentage, 0) / first3.length;
      const avgLast3 =
        last3.reduce((a, t) => a + t.percentage, 0) / last3.length;
      improvement = round1(avgLast3 - avgFirst3);
    }

    // ============================================================
    // 5b) إحصائيات الفصل — avgClassScore + classRank + classSize
    //     - classSize: عدد الطلاب الذين سلّموا في أي من امتحانات
    //       الطالب (يضمّ الطالب نفسه).
    //     - avgClassScore: المتوسط العام لكل التسليمات (كل الطلاب)
    //       في هذه الامتحانات — خط مقارنة عام للطالب.
    //     - classRank: ترتيب الطالب حسب متوسطه مقابل بقية الطلاب
    //       (1 = الأفضل، تنازلياً حسب المتوسط). null إذا الطالب
    //       غير موجود (نادر، احتياطي).
    // ============================================================
    const classSize = studentAvgMap.size;

    const allClassPcts = classSubmissions
      .map((c) => c.percentage)
      .filter((p): p is number => p != null);
    const avgClassScore: number | null =
      allClassPcts.length > 0
        ? round1(
            allClassPcts.reduce((a, b) => a + b, 0) / allClassPcts.length
          )
        : null;

    // رتّب الطلاب تنازلياً حسب متوسطهم → rank 1 = الأفضل
    const studentRanking = Array.from(studentAvgMap.entries())
      .map(([sid, arr]) => ({
        studentId: sid,
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
      }))
      .sort((a, b) => b.avg - a.avg);
    const rankIdx = studentRanking.findIndex(
      (r) => r.studentId === student.studentId
    );
    const classRank: number | null = rankIdx >= 0 ? rankIdx + 1 : null;

    // ============================================================
    // 6) الاستجابة
    // ============================================================
    return successResponse({
      data: {
        studentName: student.studentName,
        timeline,
        byPeriod,
        bySubject,
        stats: {
          totalAttempts,
          totalTraining: training.length,
          totalOfficial: official.length,
          avgTraining,
          avgOfficial,
          bestScore,
          improvement,
          avgClassScore,
          classRank,
          classSize,
        },
      },
    });
  } catch (err) {
    console.error('[student/performance] error:', err);
    return errorResponse('فشل جلب منحنى أداء الطالب', 500);
  }
}
