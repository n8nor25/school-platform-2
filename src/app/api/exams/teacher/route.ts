/**
 * ============================================================
 *  GET /api/exams/teacher
 *  ============================================================
 *  يُرجع قائمة امتحانات المعلم.
 *
 *  Query: schoolId, teacherId, status?, subject?, search?, page?, limit?
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext } from '../_teacher-helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const statusFilter = searchParams.get('status');
    const subject = searchParams.get('subject');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      schoolId: teacher.schoolId,
      teacherId: teacher.teacherId,
    };
    if (statusFilter) where.status = statusFilter;
    if (subject) where.subject = subject;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [exams, total] = await Promise.all([
      db.exam.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          subject: true,
          classroomName: true,
          startDate: true,
          endDate: true,
          durationMinutes: true,
          status: true,
          totalPoints: true,
          passingScore: true,
          maxAttempts: true,
          passwordHash: true,
          _count: {
            select: { questions: true, submissions: true },
          },
        },
      }),
      db.exam.count({ where }),
    ]);

    const now = new Date();
    const result = exams.map((e) => ({
      id: e.id,
      title: e.title,
      subject: e.subject,
      classroomName: e.classroomName,
      startDate: e.startDate,
      endDate: e.endDate,
      durationMinutes: e.durationMinutes,
      status: e.status,
      totalPoints: e.totalPoints,
      passingScore: e.passingScore,
      maxAttempts: e.maxAttempts,
      hasPassword: !!e.passwordHash,
      timeStatus:
        now < e.startDate ? 'UPCOMING' : now > e.endDate ? 'ENDED' : 'OPEN',
      submissionsCount: e._count.submissions,
      questionsCount: e._count.questions,
    }));

    return NextResponse.json({
      success: true,
      count: result.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      exams: result,
    });
  } catch (error) {
    console.error('[exams/teacher GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب الامتحانات', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * ============================================================
 *  POST /api/exams/teacher
 *  ============================================================
 *  يُنشئ امتحاناً جديداً (حالة DRAFT افتراضياً).
 * ============================================================
 */

import { hashExamPassword } from '../_helpers';
import { sanitizeQuestionText, validateQuestionData, recomputeExamTotalPoints } from '../_teacher-helpers';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(request, searchParams.get('schoolId'));
    if (!teacher) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      description?: string;
      subject?: string;
      classroomId?: string;
      classroomName?: string;
      startDate?: string;
      endDate?: string;
      durationMinutes?: number;
      password?: string;
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
      ipRestriction?: string;
      passingScore?: number;
      questions?: Array<{
        type: string;
        text: string;
        options?: string[] | null;
        correctAnswer?: string | null;
        correctText?: string | null;
        rubric?: Record<string, unknown> | null;
        points?: number;
        order?: number;
        explanation?: string;
      }>;
    };

    // التحقق من الحقول المطلوبة
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'عنوان الامتحان مطلوب' }, { status: 400 });
    }
    if (!body.subject) {
      return NextResponse.json({ error: 'المادة مطلوبة' }, { status: 400 });
    }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: 'وقت البدء والانتهاء مطلوبان' }, { status: 400 });
    }
    if (!body.durationMinutes || body.durationMinutes < 1) {
      return NextResponse.json({ error: 'مدة الامتحان يجب أن تكون دقيقة على الأقل' }, { status: 400 });
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'تواريخ غير صالحة' }, { status: 400 });
    }
    if (startDate >= endDate) {
      return NextResponse.json({ error: 'وقت البدء يجب أن يكون قبل وقت الانتهاء' }, { status: 400 });
    }

    // كلمة السر
    let passwordHash: string | null = null;
    if (body.password) {
      if (body.password.length < 4) {
        return NextResponse.json({ error: 'كلمة السر يجب أن تكون 4 أحرف على الأقل' }, { status: 400 });
      }
      passwordHash = await hashExamPassword(body.password);
    }

    // التحقق من الأسئلة
    const questions = body.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const validation = validateQuestionData(q.type, {
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        correctText: q.correctText,
        points: q.points,
      });
      if (!validation.ok) {
        return NextResponse.json(
          { error: `السؤال ${i + 1}: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    const titleClean = body.title.trim().slice(0, 200);
    const descClean = (body.description || '').trim().slice(0, 2000);

    // إنشاء الامتحان (DRAFT)
    const exam = await db.exam.create({
      data: {
        schoolId: teacher.schoolId,
        title: titleClean,
        description: descClean,
        subject: body.subject.trim().slice(0, 100),
        teacherId: teacher.teacherId,
        teacherName: teacher.teacherName,
        classroomId: body.classroomId || null,
        classroomName: body.classroomName || '',
        startDate,
        endDate,
        durationMinutes: Math.min(600, body.durationMinutes),
        passwordHash,
        shuffleQuestions: body.shuffleQuestions ?? false,
        shuffleOptions: body.shuffleOptions ?? false,
        allowReview: body.allowReview ?? true,
        showResultImmediately: body.showResultImmediately ?? false,
        parentVisible: body.parentVisible ?? false,
        maxAttempts: Math.min(10, Math.max(1, body.maxAttempts ?? 1)),
        maxFileSizeMb: Math.min(20, Math.max(1, body.maxFileSizeMb ?? 5)),
        allowTextAnswers: body.allowTextAnswers ?? true,
        allowImageAnswers: body.allowImageAnswers ?? true,
        allowPdfAnswers: body.allowPdfAnswers ?? false,
        antiCheatEnabled: body.antiCheatEnabled ?? true,
        ipRestriction: body.ipRestriction || null,
        passingScore: body.passingScore ?? null,
        status: 'DRAFT',
        totalPoints: 0,
      },
    });

    // إنشاء الأسئلة إن أُرسلت
    if (questions.length > 0) {
      const sanitizedQuestions = await Promise.all(
        questions.map(async (q, i) => {
          const sanitized = await sanitizeQuestionText(q.text, false);
          return {
            schoolId: teacher.schoolId,
            examId: exam.id,
            type: q.type as 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF',
            text: sanitized.cleanedText,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || null,
            correctText: q.correctText || null,
            rubric: q.rubric ? JSON.stringify(q.rubric) : null,
            points: q.points ?? 1,
            order: q.order ?? i + 1,
            explanation: q.explanation || null,
            textModeration: (sanitized.moderation.decision === 'SAFE' ? 'SAFE' : 'FLAGGED') as 'SAFE' | 'FLAGGED',
            moderationNotes: JSON.stringify({
              reasons: sanitized.moderation.reasons,
              categories: sanitized.moderation.categories,
            }),
            moderatedAt: new Date(),
          };
        })
      );
      await db.question.createMany({ data: sanitizedQuestions });
      await recomputeExamTotalPoints(exam.id);
    }

    // تحديث ملف المعلم
    await db.examTeacherProfile.update({
      where: { teacherId: teacher.teacherId },
      data: { totalExamsCreated: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء الامتحان كمسودة. أضف الأسئلة ثم انشره.',
      examId: exam.id,
      status: 'DRAFT',
    }, { status: 201 });
  } catch (error) {
    console.error('[exams/teacher POST] error:', error);
    return NextResponse.json(
      { error: 'فشل إنشاء الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
