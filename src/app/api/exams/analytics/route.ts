/**
 * ============================================================
 *  GET /api/exams/analytics
 *  ============================================================
 *  تحليلات مقارنة لأداء الطالب — مُصمّمة لبوابة أولياء الأمور.
 *
 *  يُرجع:
 *    • معلومات الطالب + الفصل
 *    • مؤشرات الأداء (KPIs): المتوسط، الترتيب، عدد الامتحانات...
 *    • خط زمني لأداء الطالب مقابل متوسط الفصل عبر الامتحانات
 *    • تفصيل حسب المادة (أداء الطالب vs متوسط الفصل)
 *    • توزيع درجات الفصل (buckets) + موضع الطالب
 *
 *  Query:
 *    schoolId, studentId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';

/** درجات يعتبر فيها السؤال مصححاً وله نتيجة */
const GRADED_STATUSES = ['GRADED', 'AUTO_CLOSED', 'SUBMITTED'];

/** يُرجع أفضل محاولة للطالب في امتحان معيّن */
function bestAttempt(submissions: Array<{
  percentage: number | null;
  totalScore: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}>): { percentage: number; passed: boolean; submittedAt: Date | null } | null {
  const graded = submissions
    .filter((s) => s.submittedAt !== null && s.percentage !== null);
  if (graded.length === 0) return null;
  // أفضل محاولة = أعلى نسبة
  const best = graded.reduce((acc, cur) => {
    const curPct = cur.percentage ?? 0;
    const accPct = acc.percentage ?? 0;
    return curPct > accPct ? cur : acc;
  });
  return {
    percentage: best.percentage ?? 0,
    passed: best.passed ?? (best.percentage ?? 0) >= 50,
    submittedAt: best.submittedAt,
  };
}

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

    // 1) معلومات الطالب
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        id: true,
        name: true,
        classroomId: true,
      },
    });

    // في وضع الاختبار: نسمح بطالب وهمي يبدأ بـ test-
    const isTestMode = studentId.startsWith('test-');
    if (!student && !isTestMode) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
    }

    const studentName = student?.name || searchParams.get('studentName') || 'طالب';
    const classroomId = student?.classroomId || searchParams.get('classroomId') || undefined;

    // اسم الفصل (إن وُجد)
    let classroomName = '';
    if (classroomId) {
      const classroom = await db.classroom.findUnique({
        where: { id: classroomId },
        select: { name: true },
      });
      classroomName = classroom?.name || '';
    }

    // 2) جلب كل امتحانات الطالب المصحّحة (أو المُسلَّمة)
    //    نستخدم select لتفادي حقل gradedByName الذي قد يكون NULL في البيانات القديمة
    const studentSubmissions = await db.submission.findMany({
      where: {
        schoolId,
        studentId,
        status: { in: GRADED_STATUSES },
        submittedAt: { not: null },
        percentage: { not: null },
      },
      select: {
        id: true,
        examId: true,
        percentage: true,
        totalScore: true,
        passed: true,
        submittedAt: true,
        status: true,
        exam: {
          select: {
            id: true,
            title: true,
            subject: true,
            classroomId: true,
            classroomName: true,
            totalPoints: true,
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // تجميع المحاولات حسب examId (أفضل محاولة لكل امتحان)
    const byExam = new Map<string, {
      examId: string;
      examTitle: string;
      subject: string;
      classroomId: string | null;
      classroomName: string;
      attempts: typeof studentSubmissions;
    }>();
    for (const sub of studentSubmissions) {
      const entry = byExam.get(sub.examId) || {
        examId: sub.examId,
        examTitle: sub.exam.title,
        subject: sub.exam.subject,
        classroomId: sub.exam.classroomId,
        classroomName: sub.exam.classroomName,
        attempts: [],
      };
      entry.attempts.push(sub);
      byExam.set(sub.examId, entry);
    }

    // 3) لكل امتحان: حساب أداء الطالب + متوسط الفصل
    const timeline: Array<{
      examId: string;
      examTitle: string;
      subject: string;
      date: string | null;
      studentPct: number;
      classAvgPct: number;
      classSize: number;
    }> = [];
    const subjectAgg = new Map<string, { studentPcts: number[]; classPcts: number[]; examCount: number }>();

    for (const [, entry] of byExam) {
      const studentBest = bestAttempt(entry.attempts.map((a) => ({
        percentage: a.percentage,
        totalScore: a.totalScore,
        passed: a.passed,
        submittedAt: a.submittedAt,
      })));
      if (!studentBest) continue;

      // جلب كل محاولات الزملاء في نفس الامتحان
      const whereClassmates: Record<string, unknown> = {
        examId: entry.examId,
        schoolId,
        status: { in: GRADED_STATUSES },
        submittedAt: { not: null },
        percentage: { not: null },
      };

      const allSubs = await db.submission.findMany({
        where: whereClassmates,
        select: {
          studentId: true,
          percentage: true,
          passed: true,
          submittedAt: true,
        },
      });

      // إن كان للطالب فصل وللامتحان فصل، نُصفّي حسب فصل الطالب
      let filteredSubs = allSubs;
      if (classroomId && entry.classroomId) {
        // جلب أعضاء الفصل
        const classmates = await db.student.findMany({
          where: { classroomId },
          select: { id: true },
        });
        const classmateIds = new Set(classmates.map((c) => c.id));
        filteredSubs = allSubs.filter((s) => classmateIds.has(s.studentId));
      }

      // لكل طالب: أفضل محاولة
      const byStudent = new Map<string, Array<{ percentage: number | null; passed: boolean | null; submittedAt: Date | null }>>();
      for (const s of filteredSubs) {
        const arr = byStudent.get(s.studentId) || [];
        arr.push({ percentage: s.percentage, passed: s.passed, submittedAt: s.submittedAt });
        byStudent.set(s.studentId, arr);
      }

      const bests: Array<{ percentage: number; passed: boolean }> = [];
      for (const [, attempts] of byStudent) {
        const best = bestAttempt(attempts);
        if (best) bests.push({ percentage: best.percentage, passed: best.passed });
      }

      if (bests.length === 0) continue;

      const classAvg = bests.reduce((sum, b) => sum + b.percentage, 0) / bests.length;

      timeline.push({
        examId: entry.examId,
        examTitle: entry.examTitle,
        subject: entry.subject,
        date: studentBest.submittedAt ? studentBest.submittedAt.toISOString() : null,
        studentPct: Math.round(studentBest.percentage * 10) / 10,
        classAvgPct: Math.round(classAvg * 10) / 10,
        classSize: byStudent.size,
      });

      // تجميع حسب المادة
      const subj = entry.subject || 'عام';
      if (!subjectAgg.has(subj)) {
        subjectAgg.set(subj, { studentPcts: [], classPcts: [], examCount: 0 });
      }
      const agg = subjectAgg.get(subj)!;
      agg.studentPcts.push(studentBest.percentage);
      agg.classPcts.push(classAvg);
      agg.examCount += 1;
    }

    // 4) KPIs العامة
    const studentPcts = timeline.map((t) => t.studentPct);
    const classPcts = timeline.map((t) => t.classAvgPct);
    const avgStudent = studentPcts.length > 0 ? studentPcts.reduce((a, b) => a + b, 0) / studentPcts.length : 0;
    const avgClass = classPcts.length > 0 ? classPcts.reduce((a, b) => a + b, 0) / classPcts.length : 0;
    const passedCount = timeline.filter((t) => t.studentPct >= 50).length;

    // الترتيب العام: نحسب متوسط الطالب ونقارنه بمتوسطات الزملاء
    let overallRank = 0;
    let classSize = 0;
    if (classroomId && timeline.length > 0) {
      // جلب كل الطلاب في نفس الفصل
      const classmates = await db.student.findMany({
        where: { classroomId },
        select: { id: true },
      });
      const classmateIds = new Set(classmates.map((c) => c.id));

      // لكل زميل: متوسط أفضل محاولاته في نفس الامتحانات
      const examIds = timeline.map((t) => t.examId);
      const allClassSubs = await db.submission.findMany({
        where: {
          examId: { in: examIds },
          studentId: { in: Array.from(classmateIds) },
          status: { in: GRADED_STATUSES },
          submittedAt: { not: null },
          percentage: { not: null },
        },
        select: { studentId: true, examId: true, percentage: true, passed: true, submittedAt: true },
      });

      const byMate = new Map<string, Map<string, number>>();
      for (const s of allClassSubs) {
        const m = byMate.get(s.studentId) || new Map<string, number>();
        const cur = m.get(s.examId) ?? -1;
        if ((s.percentage ?? 0) > cur) m.set(s.examId, s.percentage ?? 0);
        byMate.set(s.studentId, m);
      }

      const mateAverages: Array<{ studentId: string; avg: number }> = [];
      for (const [mateId, exams] of byMate) {
        if (exams.size === 0) continue;
        const arr = Array.from(exams.values());
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        mateAverages.push({ studentId: mateId, avg });
      }

      mateAverages.sort((a, b) => b.avg - a.avg);
      classSize = mateAverages.length;
      const idx = mateAverages.findIndex((m) => m.studentId === studentId);
      overallRank = idx >= 0 ? idx + 1 : 0;
    }

    // اتجاه التحسّن: مقارنة آخر امتحان بأول امتحان
    let improvementTrend = 0;
    if (timeline.length >= 2) {
      const first = timeline[0].studentPct;
      const last = timeline[timeline.length - 1].studentPct;
      improvementTrend = Math.round((last - first) * 10) / 10;
    }

    // 5) تفصيل المواد
    const subjectBreakdown = Array.from(subjectAgg.entries()).map(([subject, agg]) => ({
      subject,
      studentPct: Math.round((agg.studentPcts.reduce((a, b) => a + b, 0) / agg.studentPcts.length) * 10) / 10,
      classAvgPct: Math.round((agg.classPcts.reduce((a, b) => a + b, 0) / agg.classPcts.length) * 10) / 10,
      examCount: agg.examCount,
    }));

    // 6) توزيع الدرجات على buckets
    const BUCKETS = [
      { range: '0-50', min: 0, max: 50, label: 'دون النجاح' },
      { range: '50-65', min: 50, max: 65, label: 'مقبول' },
      { range: '65-75', min: 65, max: 75, label: 'جيد' },
      { range: '75-85', min: 75, max: 85, label: 'جيد جداً' },
      { range: '85-100', min: 85, max: 101, label: 'ممتاز' },
    ];

    // متوسطات كل الزملاء (في كل الامتحانات المشتركة)
    let distribution = BUCKETS.map((b) => ({ range: b.range, label: b.label, count: 0, isStudent: false }));
    if (classroomId && timeline.length > 0) {
      const classmates = await db.student.findMany({
        where: { classroomId },
        select: { id: true },
      });
      const classmateIds = new Set(classmates.map((c) => c.id));
      const examIds = timeline.map((t) => t.examId);
      const allClassSubs = await db.submission.findMany({
        where: {
          examId: { in: examIds },
          studentId: { in: Array.from(classmateIds) },
          status: { in: GRADED_STATUSES },
          submittedAt: { not: null },
          percentage: { not: null },
        },
        select: { studentId: true, examId: true, percentage: true },
      });

      const byMate = new Map<string, Map<string, number>>();
      for (const s of allClassSubs) {
        const m = byMate.get(s.studentId) || new Map<string, number>();
        const cur = m.get(s.examId) ?? -1;
        if ((s.percentage ?? 0) > cur) m.set(s.examId, s.percentage ?? 0);
        byMate.set(s.studentId, m);
      }

      const mateAverages: number[] = [];
      for (const [, exams] of byMate) {
        if (exams.size === 0) continue;
        const arr = Array.from(exams.values());
        mateAverages.push(arr.reduce((a, b) => a + b, 0) / arr.length);
      }

      distribution = BUCKETS.map((b) => {
        const count = mateAverages.filter((avg) => avg >= b.min && avg < b.max).length;
        const isStudent = avgStudent >= b.min && avgStudent < b.max;
        return { range: b.range, label: b.label, count, isStudent };
      });
    }

    return NextResponse.json({
      success: true,
      student: {
        id: studentId,
        name: studentName,
        classroomId: classroomId || null,
        classroomName: classroomName || 'غير محدّد',
      },
      kpis: {
        avgScore: Math.round(avgStudent * 10) / 10,
        classAvgScore: Math.round(avgClass * 10) / 10,
        rank: overallRank,
        classSize,
        totalExams: timeline.length,
        passedCount,
        improvementTrend,
      },
      timeline,
      subjectBreakdown,
      distribution,
    });
  } catch (error) {
    console.error('[exams/analytics] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب التحليلات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
