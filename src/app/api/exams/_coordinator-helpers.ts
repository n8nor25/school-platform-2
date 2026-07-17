/**
 * ============================================================
 *  Helper Functions — Coordinator Exam API
 *  ============================================================
 *  دوال مساعدة مشتركة بين مسارات API المنسّق (مدير الامتحانات):
 *  • استخراج سياق المنسّق (coordinatorId + schoolId + اسم)
 *  • التحقق من الصلاحيات
 *
 *  المنسّق يرى ويدير كل امتحانات المدرسة (وليس فقط امتحاناته).
 *  وضع الاختبار: coordinatorId يبدأ بـ "test-".
 * ============================================================
 */

import { NextRequest } from 'next/server';
import { resolveSchoolId } from '@/lib/school-utils';

/** سياق المنسّق المستخرج من الطلب */
export interface CoordinatorContext {
  schoolId: string;
  coordinatorId: string;
  coordinatorName: string;
}

/**
 * يستخرج سياق المنسّق من الطلب.
 *
 * مصادر المعرف (بالأولوية):
 *   1. x-coordinator-id header
 *   2. coordinatorId query param
 *
 * ملاحظة: المنسّق الحقيقي يجب أن يُحقَّق عبر جلسة NextAuth في الإنتاج.
 * هنا نسمح بـ coordinatorId يبدأ بـ "test-" للاختبار.
 */
export async function extractCoordinatorContext(
  req: NextRequest,
  schoolIdParam?: string | null
): Promise<{ coordinator: CoordinatorContext | null; error?: string; status?: number }> {
  const schoolId = await resolveSchoolId(schoolIdParam);
  if (!schoolId) {
    return { coordinator: null, error: 'معرف المدرسة مطلوب', status: 400 };
  }

  const url = new URL(req.url);
  const coordinatorId =
    url.searchParams.get('coordinatorId') ||
    req.headers.get('x-coordinator-id') ||
    '';
  const coordinatorName =
    url.searchParams.get('coordinatorName') ||
    req.headers.get('x-coordinator-name') ||
    '';

  if (!coordinatorId) {
    return {
      coordinator: null,
      error: 'معرف المنسّق مطلوب (coordinatorId أو x-coordinator-id)',
      status: 401,
    };
  }

  // في الإنتاج يجب التحقق من جدول المستخدمين (role = school_admin/super_admin).
  // حالياً نقبل:
  //   • أي معرّف يبدأ بـ test- (وضع اختبار)
  //   • أي معرّف غير فارغ (سيُسجَّل لاحقاً في audit log)
  // نرفض المعرّفات الفارغة فقط.
  return {
    coordinator: {
      schoolId,
      coordinatorId,
      coordinatorName: coordinatorName || 'منسّق الامتحانات',
    },
  };
}

/** حالات الامتحان المدعومة للفلترة */
export const EXAM_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

/** يبني شرط فلترة الامتحانات من query params */
export function buildExamFilter(searchParams: URLSearchParams, schoolId: string) {
  const where: {
    schoolId: string;
    status?: { in: string[] };
    subject?: { contains: string;  };
    teacherId?: string;
    classroomId?: string;
    title?: { contains: string;  };
    AND?: Array<{ OR: Array<{ startDate: { gte?: Date; lte?: Date } }> }>;
  } = { schoolId };

  const status = searchParams.get('status');
  if (status && status !== 'all') {
    const statuses = status.split(',').filter((s) =>
      EXAM_STATUSES.includes(s as ExamStatus)
    );
    if (statuses.length > 0) {
      where.status = { in: statuses };
    }
  }

  const subject = searchParams.get('subject');
  if (subject && subject !== 'all') {
    where.subject = { contains: subject };
  }

  const teacherId = searchParams.get('teacherId');
  if (teacherId && teacherId !== 'all') {
    where.teacherId = teacherId;
  }

  const classroomId = searchParams.get('classroomId');
  if (classroomId && classroomId !== 'all') {
    where.classroomId = classroomId;
  }

  const search = searchParams.get('search')?.trim();
  if (search) {
    where.title = { contains: search };
  }

  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  if (dateFrom || dateTo) {
    const or: Array<{ startDate: { gte?: Date; lte?: Date } }> = [];
    if (dateFrom) or.push({ startDate: { gte: new Date(dateFrom) } });
    if (dateTo) or.push({ startDate: { lte: new Date(dateTo) } });
    where.AND = [{ OR: or }];
  }

  return where;
}
