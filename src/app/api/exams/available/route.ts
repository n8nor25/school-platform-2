/**
 * ============================================================
 *  GET /api/exams/available
 *  ============================================================
 *  يُرجع قائمة الامتحانات المتاحة للطالب.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';
import { getStudentSubmissions } from '../_helpers';

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

    const classroomId = searchParams.get('classroomId') || undefined;
    const includeUpcoming = searchParams.get('includeUpcoming') !== 'false';

    const now = new Date();

    const dateCondition: Record<string, unknown> = {};
    if (includeUpcoming) {
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      dateCondition.lte = sevenDaysLater;
    } else {
      dateCondition.lte = now;
    }

    const where: Record<string, unknown> = {
      schoolId,
      status: 'PUBLISHED',
      startDate: dateCondition,
      endDate: { gte: now },
    };

    if (classroomId) {
      where.OR = [
        { classroomId },
        { classroomId: null },
      ];
    }

    const exams = await db.exam.findMany({
      where,
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        teacherName: true,
        classroomName: true,
        startDate: true,
        endDate: true,
        durationMinutes: true,
        maxAttempts: true,
        allowReview: true,
        parentVisible: true,
        allowTextAnswers: true,
        allowImageAnswers: true,
        allowPdfAnswers: true,
        antiCheatEnabled: true,
        passwordHash: true,
        _count: { select: { questions: true } },
      },
    });

    const visible: Array<{
      id: string;
      title: string;
      description: string;
      subject: string;
      teacherName: string;
      classroomName: string;
      startDate: Date;
      endDate: Date;
      durationMinutes: number;
      maxAttempts: number;
      attemptsUsed: number;
      attemptsLeft: number;
      hasActiveSubmission: boolean;
      activeSubmissionId: string | null;
      allowReview: boolean;
      parentVisible: boolean;
      allowTextAnswers: boolean;
      allowImageAnswers: boolean;
      allowPdfAnswers: boolean;
      antiCheatEnabled: boolean;
      hasPassword: boolean;
      questionsCount: number;
      timeStatus: string;
    }> = [];
    for (const e of exams) {
      const { totalAttempts, activeSubmission } = await getStudentSubmissions(e.id, studentId);
      const attemptsLeft = Math.max(0, e.maxAttempts - totalAttempts);
      const isActive = !!activeSubmission;

      if (attemptsLeft === 0 && !isActive) continue;

      visible.push({
        id: e.id,
        title: e.title,
        description: e.description,
        subject: e.subject,
        teacherName: e.teacherName,
        classroomName: e.classroomName,
        startDate: e.startDate,
        endDate: e.endDate,
        durationMinutes: e.durationMinutes,
        maxAttempts: e.maxAttempts,
        attemptsUsed: totalAttempts,
        attemptsLeft,
        hasActiveSubmission: isActive,
        activeSubmissionId: activeSubmission?.id || null,
        allowReview: e.allowReview,
        parentVisible: e.parentVisible,
        allowTextAnswers: e.allowTextAnswers,
        allowImageAnswers: e.allowImageAnswers,
        allowPdfAnswers: e.allowPdfAnswers,
        antiCheatEnabled: e.antiCheatEnabled,
        hasPassword: !!e.passwordHash,
        questionsCount: e._count.questions,
        timeStatus: now < e.startDate ? 'UPCOMING' : (now > e.endDate ? 'ENDED' : 'OPEN'),
      });
    }

    return NextResponse.json({
      success: true,
      count: visible.length,
      now: now.toISOString(),
      exams: visible,
    });
  } catch (error) {
    console.error('[exams/available] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب الامتحانات المتاحة', details: (error as Error).message },
      { status: 500 }
    );
  }
}
