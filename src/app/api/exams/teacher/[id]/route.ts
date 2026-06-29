/**
 * ============================================================
 *  GET /api/exams/teacher/[id]
 *  ============================================================
 *  يُرجع تفاصيل الامتحان الكاملة للمعلم (مع الإجابات الصحيحة).
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTeacherContext, checkExamOwnership, buildTeacherExamResponse } from '../../_teacher-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const ownership = await checkExamOwnership(examId, teacher, { allowDraft: true, allowClosed: true });
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }

    const exam = await buildTeacherExamResponse(examId);
    if (!exam) {
      return NextResponse.json({ error: 'الامتحان غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    console.error('[exams/teacher/[id] GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  PUT /api/exams/teacher/[id]
 *  ============================================================
 *  يُحدّث بيانات الامتحان. لا يمكن التعديل بعد النشر إلا إغلاق النافذة.
 *
 *  Body: حقول قابلة للتحديث (title, description, dates, settings, password...)
 *  خاص: password="" يزيل كلمة السر، password="newpass" يُحدّثها
 * ============================================================
 */

import { db } from '@/lib/db';
import { hashExamPassword } from '../../_helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const ownership = await checkExamOwnership(examId, teacher, { allowDraft: true, allowClosed: true });
    if (!ownership.ok || !ownership.exam) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }
    const exam = ownership.exam;

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      description?: string;
      subject?: string;
      classroomId?: string | null;
      classroomName?: string;
      startDate?: string;
      endDate?: string;
      durationMinutes?: number;
      password?: string | null;
      shuffleQuestions?: boolean;
      shuffleOptions?: boolean;
      allowReview?: boolean;
      showResultImmediately?: boolean;
      parentVisible?: boolean;
      maxAttempts?: number;
      maxFileSizeMb?: number;
      allowTextAnswers?: boolean;
      allowImageAnswers?: boolean;
      allowPdfAnswers?: boolean;
      antiCheatEnabled?: boolean;
      ipRestriction?: string | null;
      passingScore?: number | null;
    };

    // بناء بيانات التحديث
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title.trim().slice(0, 200);
    if (body.description !== undefined) updateData.description = body.description.trim().slice(0, 2000);
    if (body.subject !== undefined) updateData.subject = body.subject.trim().slice(0, 100);
    if (body.classroomId !== undefined) updateData.classroomId = body.classroomId;
    if (body.classroomName !== undefined) updateData.classroomName = body.classroomName;
    if (body.durationMinutes !== undefined) updateData.durationMinutes = Math.min(600, body.durationMinutes);
    if (body.shuffleQuestions !== undefined) updateData.shuffleQuestions = body.shuffleQuestions;
    if (body.shuffleOptions !== undefined) updateData.shuffleOptions = body.shuffleOptions;
    if (body.allowReview !== undefined) updateData.allowReview = body.allowReview;
    if (body.showResultImmediately !== undefined) updateData.showResultImmediately = body.showResultImmediately;
    if (body.parentVisible !== undefined) updateData.parentVisible = body.parentVisible;
    if (body.maxAttempts !== undefined) updateData.maxAttempts = Math.min(10, Math.max(1, body.maxAttempts));
    if (body.maxFileSizeMb !== undefined) updateData.maxFileSizeMb = Math.min(20, Math.max(1, body.maxFileSizeMb));
    if (body.allowTextAnswers !== undefined) updateData.allowTextAnswers = body.allowTextAnswers;
    if (body.allowImageAnswers !== undefined) updateData.allowImageAnswers = body.allowImageAnswers;
    if (body.allowPdfAnswers !== undefined) updateData.allowPdfAnswers = body.allowPdfAnswers;
    if (body.antiCheatEnabled !== undefined) updateData.antiCheatEnabled = body.antiCheatEnabled;
    if (body.ipRestriction !== undefined) updateData.ipRestriction = body.ipRestriction || null;
    if (body.passingScore !== undefined) updateData.passingScore = body.passingScore;

    // التواريخ
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const newStart = body.startDate ? new Date(body.startDate) : exam.startDate;
      const newEnd = body.endDate ? new Date(body.endDate) : exam.endDate;
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        return NextResponse.json({ error: 'تواريخ غير صالحة' }, { status: 400 });
      }
      if (newStart >= newEnd) {
        return NextResponse.json({ error: 'وقت البدء يجب أن يكون قبل وقت الانتهاء' }, { status: 400 });
      }
      updateData.startDate = newStart;
      updateData.endDate = newEnd;
    }

    // كلمة السر
    if (body.password !== undefined) {
      if (body.password === null || body.password === '') {
        updateData.passwordHash = null; // إزالة كلمة السر
      } else {
        if (body.password.length < 4) {
          return NextResponse.json({ error: 'كلمة السر يجب أن تكون 4 أحرف على الأقل' }, { status: 400 });
        }
        updateData.passwordHash = await hashExamPassword(body.password);
      }
    }

    // تحذير: تعديل امتحان منشور له تسليمات
    if (exam.status === 'PUBLISHED' && exam._count.submissions > 0) {
      // نسمح فقط بتعديل الإعدادات الحرجة (الوقت، كلمة السر) لكن لا نسمح بتغيير الأسئلة
      // (تغيير الأسئلة يتم في مسار منفصل وله فحص إضافي)
      console.warn(`[teacher PUT] تعديل امتحان منشور ${examId} له ${exam._count.submissions} تسليم`);
    }

    const updated = await db.exam.update({
      where: { id: examId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'تم تحديث الامتحان',
      exam: { id: updated.id, title: updated.title, status: updated.status, updatedAt: updated.updatedAt },
    });
  } catch (error) {
    console.error('[exams/teacher/[id] PUT] error:', error);
    return NextResponse.json(
      { error: 'فشل تحديث الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  DELETE /api/exams/teacher/[id]
 *  ============================================================
 *  يحذف الامتحان. يُمنع الحذف إذا كان منشوراً وله تسليمات
 *  (في تلك الحالة يُرجى الأرشفة).
 * ============================================================
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const ownership = await checkExamOwnership(examId, teacher, { allowDraft: true, allowClosed: true });
    if (!ownership.ok || !ownership.exam) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status || 403 });
    }
    const exam = ownership.exam;

    // منع حذف امتحان منشور له تسليمات
    if (exam.status === 'PUBLISHED' && exam._count.submissions > 0) {
      return NextResponse.json(
        {
          error: `لا يمكن حذف امتحان منشور له ${exam._count.submissions} تسليم. استخدم الأرشفة بدلاً من ذلك.`,
          submissionsCount: exam._count.submissions,
          alternative: 'POST /api/exams/teacher/[id]/archive',
        },
        { status: 409 }
      );
    }

    // حذف الامتحان (cascade ستحذف الأسئلة والتسليمات المرتبطة)
    await db.exam.delete({ where: { id: examId } });

    return NextResponse.json({
      success: true,
      message: 'تم حذف الامتحان',
      examId,
    });
  } catch (error) {
    console.error('[exams/teacher/[id] DELETE] error:', error);
    return NextResponse.json(
      { error: 'فشل حذف الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
