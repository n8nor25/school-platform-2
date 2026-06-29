/**
 * ============================================================
 *  POST /api/exams/[id]/proctor
 *  ============================================================
 *  يستقبل أحداث المراقبة اللحظية من العميل:
 *    - TAB_SWITCH (مغادرة الصفحة)
 *    - COPY_ATTEMPT (نسخ)
 *    - PASTE_ATTEMPT (لصق)
 *    - FOCUS_LOSS (فقدان التركيز)
 *    - RIGHT_CLICK (زر الفأرة الأيمن)
 *    - SHORTCUT_KEY (اختصار لوحة المفاتيح)
 *
 *  Body: {
 *    submissionId: string,
 *    events: Array<{ type: string, severity?: number, details?: string, timestamp?: string }>
 *  }
 *  Query: schoolId, studentId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext,
  autoCloseExpiredSubmission,
} from '../../_helpers';
import type { ViolationType } from '@prisma/client';

const VALID_TYPES: ViolationType[] = [
  'TAB_SWITCH',
  'COPY_ATTEMPT',
  'PASTE_ATTEMPT',
  'FOCUS_LOSS',
  'RIGHT_CLICK',
  'SHORTCUT_KEY',
  'MULTIPLE_DEVICES',
  'SUSPICIOUS_FILE',
  'RATE_LIMIT_EXCEEDED',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);

    const { student, error, status } = await extractStudentContext(request, searchParams.get('schoolId'));
    if (!student) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      submissionId?: string;
      events?: Array<{
        type: string;
        severity?: number;
        details?: string;
        timestamp?: string;
      }>;
    };

    if (!body.submissionId) {
      return NextResponse.json({ error: 'معرف المحاولة (submissionId) مطلوب' }, { status: 400 });
    }

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ error: 'الأحداد مطلوبة (events array)' }, { status: 400 });
    }

    // الحد الأقصى للأحداث لكل طلب (يمنع إغراق السيرفر)
    if (body.events.length > 50) {
      return NextResponse.json({ error: 'تجاوز الحد (50 حدث/طلب)' }, { status: 429 });
    }

    // التحقق من المحاولة
    const submission = await db.submission.findFirst({
      where: {
        id: body.submissionId,
        examId,
        studentId: student.studentId,
        schoolId: student.schoolId,
      },
      select: { id: true, status: true, focusEvents: true, tabSwitches: true, copyAttempts: true },
    });
    if (!submission) {
      return NextResponse.json({ error: 'المحاولة غير موجودة' }, { status: 404 });
    }

    // فحص الإغلاق التلقائي
    const { closed } = await autoCloseExpiredSubmission(body.submissionId);
    if (closed || submission.status !== 'IN_PROGRESS') {
      return NextResponse.json({
        success: false,
        message: 'انتهى وقت الامتحان',
        autoClosed: true,
      }, { status: 403 });
    }

    // فلترة الأحداث الصالحة
    const validEvents = body.events.filter(e => VALID_TYPES.includes(e.type as ViolationType));
    if (validEvents.length === 0) {
      return NextResponse.json({ success: true, saved: 0, message: 'لا أحداث صالحة' });
    }

    // ① إنشاء سجلات Violations
    const violations = validEvents.map(e => ({
      schoolId: student.schoolId,
      submissionId: body.submissionId!,
      examId,
      studentId: student.studentId,
      type: e.type as ViolationType,
      severity: Math.max(1, Math.min(3, e.severity || 1)),
      details: (e.details || '').slice(0, 500),
      ipHash: student.ipHash,
      userAgent: student.userAgent,
      createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    await db.examViolation.createMany({ data: violations });

    // ② تحديث عدّادات المحاولة
    const tabSwitches = validEvents.filter(e => e.type === 'TAB_SWITCH').length;
    const copyAttempts = validEvents.filter(e => e.type === 'COPY_ATTEMPT' || e.type === 'PASTE_ATTEMPT').length;
    const focusEvents = validEvents.filter(e => e.type === 'FOCUS_LOSS').length;

    await db.submission.update({
      where: { id: body.submissionId },
      data: {
        tabSwitches: { increment: tabSwitches },
        copyAttempts: { increment: copyAttempts },
        focusEvents: { increment: focusEvents },
        lastActivityAt: new Date(),
      },
    });

    // ③ تحديد مستوى التحذير
    const totalTabSwitches = submission.tabSwitches + tabSwitches;
    const totalCopyAttempts = submission.copyAttempts + copyAttempts;
    const totalFocusEvents = submission.focusEvents + focusEvents;

    let warningLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    let warningMessage: string | null = null;

    if (totalTabSwitches >= 5 || totalCopyAttempts >= 3 || totalFocusEvents >= 10) {
      warningLevel = 'high';
      warningMessage = 'تحذير شديد: تم تسجيل نشاط مشبوه متكرر. قد يُلغي هذا الامتحان.';
    } else if (totalTabSwitches >= 3 || totalCopyAttempts >= 1 || totalFocusEvents >= 5) {
      warningLevel = 'medium';
      warningMessage = 'تحذير: تم تسجيل بعض المخالفات. تجنب مغادرة الصفحة أو استخدام النسخ.';
    } else if (totalTabSwitches >= 1 || totalFocusEvents >= 1) {
      warningLevel = 'low';
      warningMessage = 'تنبيه: يُرجى البقاء في صفحة الامتحان.';
    }

    return NextResponse.json({
      success: true,
      saved: violations.length,
      counts: {
        tabSwitches: totalTabSwitches,
        copyAttempts: totalCopyAttempts,
        focusEvents: totalFocusEvents,
      },
      warningLevel,
      warningMessage,
    });
  } catch (error) {
    console.error('[exams/[id]/proctor] error:', error);
    return NextResponse.json(
      { error: 'فشل تسجيل الأحداث', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exams/[id]/proctor
 * يجلب حالة المراقبة الحالية (للمعلم)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'));
    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 });
    }

    const submissions = await db.submission.findMany({
      where: { examId, schoolId },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        status: true,
        startedAt: true,
        lastActivityAt: true,
        focusEvents: true,
        tabSwitches: true,
        copyAttempts: true,
        _count: { select: { answers: true, violations: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const result = submissions.map(s => ({
      id: s.id,
      studentId: s.studentId,
      studentName: s.studentName,
      status: s.status,
      startedAt: s.startedAt,
      lastActivityAt: s.lastActivityAt,
      focusEvents: s.focusEvents,
      tabSwitches: s.tabSwitches,
      copyAttempts: s.copyAttempts,
      answersCount: s._count.answers,
      violationsCount: s._count.violations,
      suspicious: s.tabSwitches >= 5 || s.copyAttempts >= 3 || s.focusEvents >= 10,
    }));

    return NextResponse.json({
      success: true,
      count: result.length,
      submissions: result,
    });
  } catch (error) {
    console.error('[exams/[id]/proctor GET] error:', error);
    return NextResponse.json({ error: 'فشل جلب حالة المراقبة' }, { status: 500 });
  }
}

async function resolveSchoolId(schoolIdParam: string | null) {
  if (schoolIdParam) return schoolIdParam;
  const { db } = await import('@/lib/db');
  const firstSchool = await db.school.findFirst({ where: { isActive: true } });
  return firstSchool?.id || null;
}
