/**
 * GET /api/exams/teacher/[id]/export?format=csv
 * تصدير نتائج التسليمات كملف CSV (UTF-8 BOM لدعم Excel العربي).
 * - يشمل: اسم الطالب، رقم الطالب، المحاولة، الحالة، الدرجة، النسبة، ناجح/راسب،
 *   درجة كل سؤال، عدّادات الغش، تاريخ التسليم، المُصحِّح
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership } from '../../../_teacher-helpers';

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await extractTeacherContext(req);
  if (!ctx.teacher) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
  }
  const { id } = await params;
  const own = await checkExamOwnership(id, ctx.teacher!, { allowDraft: true, allowClosed: true });
  if (!own.ok) {
    return NextResponse.json({ error: own.error }, { status: own.status || 403 });
  }

  try {
    const exam = await db.exam.findUnique({
      where: { id },
      select: {
        id: true, title: true, subject: true, totalPoints: true,
        questions: { select: { id: true, order: true, type: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    const submissions = await db.submission.findMany({
      where: { examId: id },
      orderBy: [{ studentName: 'asc' }, { attemptNumber: 'asc' }],
      include: {
        answers: {
          include: { question: { select: { id: true, order: true } } },
        },
      },
    });

    // بناء الترويسة
    const headers: string[] = [
      'اسم الطالب',
      'رقم الطالب',
      'المحاولة',
      'الحالة',
      'الدرجة',
      'الدرجة الكبرى',
      'النسبة %',
      'النتيجة',
      'تبديل التبويب',
      'محاولات النسخ',
      'فقدان التركيز',
      'تاريخ البدء',
      'تاريخ التسليم',
      'المُصحِّح',
    ];
    for (const q of exam.questions) {
      headers.push(`س${q.order + 1} (${q.type})`);
    }

    const statusMap: Record<string, string> = {
      IN_PROGRESS: 'جاري',
      SUBMITTED: 'بانتظار التصحيح',
      GRADED: 'مُصحَّح',
      AUTO_CLOSED: 'إغلاق تلقائي',
      FLAGGED: 'مُعلَّق',
    };

    const rows: string[] = [];
    for (const s of submissions) {
      const cells: string[] = [
        s.studentName,
        s.studentId,
        String(s.attemptNumber),
        statusMap[s.status] || s.status,
        s.totalScore != null ? String(s.totalScore) : '',
        s.maxScore != null ? String(s.maxScore) : '',
        s.percentage != null ? String(s.percentage) : '',
        s.passed === true ? 'ناجح' : s.passed === false ? 'راسب' : '',
        String(s.tabSwitches),
        String(s.copyAttempts),
        String(s.focusEvents),
        s.startedAt ? new Date(s.startedAt).toLocaleString('ar-EG') : '',
        s.submittedAt ? new Date(s.submittedAt).toLocaleString('ar-EG') : '',
        s.gradedByName || '',
      ];
      // درجة كل سؤال
      const ansByQ = new Map(s.answers.map(a => [a.questionId, a]));
      for (const q of exam.questions) {
        const a = ansByQ.get(q.id);
        cells.push(a?.score != null ? String(a.score) : '-');
      }
      rows.push(cells.map(csvEscape).join(','));
    }

    const csv = '\uFEFF' + headers.map(csvEscape).join(',') + '\n' + rows.join('\n');

    const safeTitle = exam.title.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').slice(0, 50);
    const filename = `نتائج_${safeTitle}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (e) {
    console.error('[teacher export csv] error:', e);
    return NextResponse.json(
      { error: 'فشل تصدير النتائج', details: (e as Error).message },
      { status: 500 }
    );
  }
}
