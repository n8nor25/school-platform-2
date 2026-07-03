/**
 * POST /api/exams/student/submissions/[subId]/violation?schoolId&studentId
 * يستقبل بلاغاً من عميل المراقبة في المتصفح (proctor) عن انتهاك أثناء الأداء.
 * - يسجّل ExamViolation
 *  - يحدّث عدّادات التسليم (focusEvents / tabSwitches / copyAttempts)
 *  - للانتهاكات الخطيرة قد يُغلق التسليم تلقائياً
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractStudentContext, errorResponse, successResponse } from '../../../../_student-helpers';

interface ViolationBody {
  type: 'TAB_SWITCH' | 'COPY_ATTEMPT' | 'PASTE_ATTEMPT' | 'MULTIPLE_DEVICES' | 'SUSPICIOUS_FILE' | 'RATE_LIMIT_EXCEEDED' | 'FOCUS_LOSS' | 'RIGHT_CLICK' | 'SHORTCUT_KEY';
  severity?: 'low' | 'medium' | 'high';
  details?: string;
}

const HIGH_SEVERITY_MAP: Record<string, 'high' | 'medium'> = {
  COPY_ATTEMPT: 'high',
  PASTE_ATTEMPT: 'high',
  MULTIPLE_DEVICES: 'high',
  SUSPICIOUS_FILE: 'high',
  RATE_LIMIT_EXCEEDED: 'high',
};

const COUNTER_MAP: Record<string, 'focusEvents' | 'tabSwitches' | 'copyAttempts'> = {
  FOCUS_LOSS: 'focusEvents',
  TAB_SWITCH: 'tabSwitches',
  RIGHT_CLICK: 'tabSwitches',
  SHORTCUT_KEY: 'tabSwitches',
  COPY_ATTEMPT: 'copyAttempts',
  PASTE_ATTEMPT: 'copyAttempts',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const { subId } = await params;
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  let body: ViolationBody;
  try { body = await req.json(); } catch {
    return errorResponse('جسم الطلب غير صالح', 400);
  }

  if (!body.type) return errorResponse('نوع الانتهاك مطلوب', 400);

  const submission = await db.submission.findUnique({
    where: { id: subId },
    select: { id: true, studentId: true, status: true, examId: true },
  });

  if (!submission) return errorResponse('التسليم غير موجود', 404);
  if (submission.studentId !== student.studentId) return errorResponse('ممنوع', 403);
  if (submission.status !== 'IN_PROGRESS') return errorResponse('التسليم منتهٍ', 400);

  const severity = body.severity || HIGH_SEVERITY_MAP[body.type] || 'low';

  await db.examViolation.create({
    data: {
      schoolId: student.schoolId,
      submissionId: subId,
      type: body.type,
      severity,
      details: (body.details || '').slice(0, 1000),
    },
  });

  // Update counter
  const counter = COUNTER_MAP[body.type];
  if (counter) {
    await db.submission.update({
      where: { id: subId },
      data: { [counter]: { increment: 1 }, lastActivityAt: new Date() },
    });
  }

  // Auto-close on severe violations (multiple high violations)
  let autoClosed = false;
  if (severity === 'high') {
    const highCount = await db.examViolation.count({
      where: { submissionId: subId, severity: 'high' },
    });
    if (highCount >= 3) {
      await db.submission.update({
        where: { id: subId },
        data: { status: 'AUTO_CLOSED', autoClosedAt: new Date() },
      });
      autoClosed = true;
    }
  }

  return successResponse({
    recorded: true,
    severity,
    autoClosed,
    message: autoClosed ? 'تم إغلاق التسليم تلقائياً بسبب تكرار الانتهاكات الخطيرة' : 'تم تسجيل الانتهاك',
  });
}
