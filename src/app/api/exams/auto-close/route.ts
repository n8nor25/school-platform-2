/**
 * ============================================================
 *  POST /api/exams/auto-close
 *  ============================================================
 *  يُغلق تلقائياً كل المحاولات الجارية التي انتهى وقتها.
 *  يُستدعى دورياً (cron / setInterval في العميل) كل دقيقة.
 *
 *  Query: schoolId (اختياري)
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'));

    const now = new Date();

    // نبحث عن المحاولات الجارية التي انتهى وقت امتحانها
    const where: Record<string, unknown> = {
      status: 'IN_PROGRESS',
    };
    if (schoolId) where.schoolId = schoolId;

    // نختار المحاولات حيث exam.endDate < now
    const submissions = await db.submission.findMany({
      where: {
        ...where,
        exam: { endDate: { lt: now } },
      },
      include: { exam: { select: { durationMinutes: true, endDate: true } } },
      take: 100, // حد أقصى للدفعة الواحدة
    });

    let closedCount = 0;
    const updates: Promise<unknown>[] = [];

    for (const s of submissions) {
      const startedAt = new Date(s.startedAt);
      const elapsedMs = now.getTime() - startedAt.getTime();
      const allowedMs = s.exam.durationMinutes * 60 * 1000;

      if (now > s.exam.endDate || elapsedMs > allowedMs) {
        updates.push(
          db.submission.update({
            where: { id: s.id },
            data: {
              status: 'AUTO_CLOSED',
              autoClosedAt: now,
              submittedAt: now,
            },
          })
        );
        closedCount++;
      }
    }

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      checked: submissions.length,
      closed: closedCount,
      now: now.toISOString(),
    });
  } catch (error) {
    console.error('[exams/auto-close] error:', error);
    return NextResponse.json(
      { error: 'فشل الإغلاق التلقائي', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exams/auto-close
 * توثيق
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/exams/auto-close',
    description: 'يُغلق تلقائياً المحاولات الجارية التي انتهى وقتها',
    suggestedSchedule: 'كل 60 ثانية',
    query: { schoolId: 'اختياري — لتحديد مدرسة معينة' },
  });
}
