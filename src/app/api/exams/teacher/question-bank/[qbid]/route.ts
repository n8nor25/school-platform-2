/**
 * ============================================================
 *  PUT /api/exams/teacher/question-bank/[qbid]
 *  ============================================================
 *  يُحدّث سؤالاً في بنك الأسئلة.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractTeacherContext,
  sanitizeQuestionText,
  sanitizeCorrectText,
  validateQuestionData,
} from '../../../_teacher-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ qbid: string }> }
) {
  try {
    const { qbid } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const existing = await db.questionBank.findFirst({
      where: { id: qbid, schoolId: teacher.schoolId, teacherId: teacher.teacherId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'السؤال غير موجود أو لا تملك صلاحية عليه' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      type?: string;
      text?: string;
      subject?: string;
      classroomName?: string;
      options?: string[] | null;
      correctAnswer?: string | null;
      correctText?: string | null;
      rubric?: Record<string, unknown> | null;
      points?: number;
      explanation?: string | null;
      tags?: string[];
      difficulty?: string;
      isPublic?: boolean;
    };

    const updateData: Record<string, unknown> = {};

    if (body.type !== undefined) {
      const validation = validateQuestionData(body.type, {
        text: body.text ?? existing.text,
        options: body.options ?? (existing.options ? JSON.parse(existing.options) : null),
        correctAnswer: body.correctAnswer ?? existing.correctAnswer,
        correctText: body.correctText ?? existing.correctText,
        points: body.points ?? existing.points,
      });
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      updateData.type = body.type as 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF';
    }

    if (body.text !== undefined) {
      const sanitized = await sanitizeQuestionText(body.text, false);
      updateData.text = sanitized.cleanedText;
      updateData.textModeration = sanitized.moderation.decision === 'SAFE' ? 'SAFE' : 'FLAGGED';
      updateData.moderationNotes = JSON.stringify({
        reasons: sanitized.moderation.reasons,
        categories: sanitized.moderation.categories,
      });
      updateData.moderatedAt = new Date();
    }

    if (body.subject !== undefined) updateData.subject = body.subject.slice(0, 100);
    if (body.classroomName !== undefined) updateData.classroomName = body.classroomName.slice(0, 100);
    if (body.options !== undefined) updateData.options = body.options ? JSON.stringify(body.options) : null;
    if (body.correctAnswer !== undefined) updateData.correctAnswer = body.correctAnswer || null;
    if (body.correctText !== undefined) {
      const s = sanitizeCorrectText(body.correctText);
      updateData.correctText = s.cleanedText || null;
    }
    if (body.rubric !== undefined) updateData.rubric = body.rubric ? JSON.stringify(body.rubric) : null;
    if (body.points !== undefined) {
      if (body.points < 0 || body.points > 100) {
        return NextResponse.json({ error: 'الدرجة يجب أن تكون بين 0 و 100' }, { status: 400 });
      }
      updateData.points = body.points;
    }
    if (body.explanation !== undefined) updateData.explanation = body.explanation || null;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.difficulty !== undefined) {
      if (!['easy', 'medium', 'hard'].includes(body.difficulty)) {
        return NextResponse.json({ error: 'مستوى الصعوبة غير صالح' }, { status: 400 });
      }
      updateData.difficulty = body.difficulty;
    }
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;

    const updated = await db.questionBank.update({
      where: { id: qbid },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'تم تحديث السؤال في بنك الأسئلة',
      question: { ...updated, options: updated.options ? JSON.parse(updated.options) : null, tags: JSON.parse(updated.tags) },
    });
  } catch (error) {
    console.error('[question-bank/[qbid] PUT] error:', error);
    return NextResponse.json(
      { error: 'فشل تحديث السؤال', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  DELETE /api/exams/teacher/question-bank/[qbid]
 *  ============================================================
 *  يحذف سؤالاً من بنك الأسئلة.
 * ============================================================
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ qbid: string }> }
) {
  try {
    const { qbid } = await params;
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const existing = await db.questionBank.findFirst({
      where: { id: qbid, schoolId: teacher.schoolId, teacherId: teacher.teacherId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'السؤال غير موجود أو لا تملك صلاحية عليه' },
        { status: 404 }
      );
    }

    await db.questionBank.delete({ where: { id: qbid } });

    // تحديث عدّاد ملف المعلم
    await db.examTeacherProfile.update({
      where: { teacherId: teacher.teacherId },
      data: { totalQuestionsInBank: { decrement: 1 } },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'تم حذف السؤال من بنك الأسئلة',
    });
  } catch (error) {
    console.error('[question-bank/[qbid] DELETE] error:', error);
    return NextResponse.json(
      { error: 'فشل حذف السؤال', details: (error as Error).message },
      { status: 500 }
    );
  }
}
