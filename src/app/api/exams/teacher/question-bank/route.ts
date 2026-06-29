/**
 * ============================================================
 *  GET /api/exams/teacher/question-bank
 *  ============================================================
 *  يُرجع أسئلة بنك الأسئلة (خاصة بالمعلم + عامة في المدرسة).
 *
 *  Query: schoolId, teacherId, subject?, type?, difficulty?, search?, public?, page?, limit?
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext } from '../../_teacher-helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const subject = searchParams.get('subject');
    const type = searchParams.get('type');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');
    const onlyPublic = searchParams.get('public') === 'true';
    const onlyMine = searchParams.get('mine') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      schoolId: teacher.schoolId,
    };
    if (onlyMine) {
      where.teacherId = teacher.teacherId;
    } else if (onlyPublic) {
      where.isPublic = true;
    } else {
      // افتراضياً: أسئلة المعلم + الأسئلة العامة في المدرسة
      where.OR = [
        { teacherId: teacher.teacherId },
        { isPublic: true },
      ];
    }
    if (subject) where.subject = subject;
    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where.text = { contains: search, mode: 'insensitive' };
    }

    const [questions, total] = await Promise.all([
      db.questionBank.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.questionBank.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      count: questions.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      questions: questions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        rubric: q.rubric ? JSON.parse(q.rubric) : null,
        tags: q.tags ? JSON.parse(q.tags) : [],
        isMine: q.teacherId === teacher.teacherId,
      })),
    });
  } catch (error) {
    console.error('[question-bank GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب بنك الأسئلة', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  POST /api/exams/teacher/question-bank
 *  ============================================================
 *  يُضيف سؤالاً لبنك الأسئلة.
 *
 *  Body: {
 *    type, text, subject?, classroomName?,
 *    options?, correctAnswer?, correctText?, rubric?,
 *    points?, explanation?, tags?, difficulty?, isPublic?
 *  }
 * ============================================================
 */

import {
  sanitizeQuestionText,
  sanitizeCorrectText,
  validateQuestionData,
  updateTeacherProfile,
} from '../../_teacher-helpers';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
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
      explanation?: string;
      tags?: string[];
      difficulty?: string;
      isPublic?: boolean;
    };

    if (!body.type) {
      return NextResponse.json({ error: 'نوع السؤال مطلوب' }, { status: 400 });
    }

    const validation = validateQuestionData(body.type, {
      text: body.text,
      options: body.options,
      correctAnswer: body.correctAnswer,
      correctText: body.correctText,
      points: body.points,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // تعقيم النص
    const sanitized = await sanitizeQuestionText(body.text!, false);
    const correctTextSanitized = body.correctText ? sanitizeCorrectText(body.correctText) : null;

    // التحقق من difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    const difficulty = validDifficulties.includes(body.difficulty || '')
      ? body.difficulty!
      : 'medium';

    const question = await db.questionBank.create({
      data: {
        schoolId: teacher.schoolId,
        teacherId: teacher.teacherId,
        teacherName: teacher.teacherName,
        subject: (body.subject || '').slice(0, 100),
        classroomName: (body.classroomName || '').slice(0, 100),
        type: body.type as 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF',
        text: sanitized.cleanedText,
        options: body.options ? JSON.stringify(body.options) : null,
        correctAnswer: body.correctAnswer || null,
        correctText: correctTextSanitized?.cleanedText || null,
        rubric: body.rubric ? JSON.stringify(body.rubric) : null,
        points: body.points ?? 1,
        explanation: body.explanation || null,
        tags: JSON.stringify(body.tags || []),
        difficulty,
        isPublic: body.isPublic ?? false,
        textModeration: (sanitized.moderation.decision === 'SAFE' ? 'SAFE' : 'FLAGGED') as 'SAFE' | 'FLAGGED',
        moderationNotes: JSON.stringify({
          reasons: sanitized.moderation.reasons,
          categories: sanitized.moderation.categories,
        }),
        moderatedAt: new Date(),
      },
    });

    // تحديث عدّاد ملف المعلم
    await updateTeacherProfile(teacher, { questionsInBankDelta: 1 });

    return NextResponse.json({
      success: true,
      message: 'تمت إضافة السؤال لبنك الأسئلة',
      question: { ...question, options: question.options ? JSON.parse(question.options) : null, tags: JSON.parse(question.tags) },
    }, { status: 201 });
  } catch (error) {
    console.error('[question-bank POST] error:', error);
    return NextResponse.json(
      { error: 'فشل إضافة السؤال', details: (error as Error).message },
      { status: 500 }
    );
  }
}
