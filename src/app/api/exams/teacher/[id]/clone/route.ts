/**
 * POST /api/exams/teacher/[id]/clone
 * استنساخ امتحان كامل (العنوان + الإعدادات + جميع الأسئلة) كمسودة جديدة.
 * - يُنشئ امتحاناً جديداً بنفس البيانات لكن status=DRAFT وبدون passwordHash
 * - ينسخ جميع الأسئلة بنفس الترتيب والنقاط
 * - يعيد معرف الامتحان الجديد
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractTeacherContext, checkExamOwnership, updateTeacherProfile } from '../../../_teacher-helpers';

export async function POST(
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
    const source = await db.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: {
            type: true, text: true, options: true, correctAnswer: true,
            correctText: true, rubric: true, points: true, order: true,
            explanation: true, attachmentPath: true, attachmentUrl: true,
          },
        },
      },
    });
    if (!source) {
      return NextResponse.json({ error: 'الامتحان الأصلي غير موجود' }, { status: 404 });
    }

    let body: { title?: string; copyPassword?: boolean } = {};
    try { body = await req.json(); } catch { /* empty ok */ }

    const newTitle = body.title?.trim() || `${source.title} (نسخة)`;

    // تواريخ افتراضية: أسبوع من الآن، نفس المدة
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + source.durationMinutes * 60 * 1000);

    const cloned = await db.exam.create({
      data: {
        schoolId: ctx.teacher!.schoolId,
        teacherId: ctx.teacher!.teacherId,
        teacherName: ctx.teacher!.teacherName,
        title: newTitle,
        description: source.description,
        subject: source.subject,
        subjectId: source.subjectId,
        classroomId: source.classroomId,
        classroomName: source.classroomName,
        academicYearId: source.academicYearId,
        startDate,
        endDate,
        durationMinutes: source.durationMinutes,
        // لا ننسخ كلمة المرور افتراضياً (الأمان)
        passwordHash: body.copyPassword ? source.passwordHash : null,
        shuffleQuestions: source.shuffleQuestions,
        shuffleOptions: source.shuffleOptions,
        allowReview: source.allowReview,
        showResultImmediately: source.showResultImmediately,
        parentVisible: source.parentVisible,
        maxAttempts: source.maxAttempts,
        maxFileSizeMb: source.maxFileSizeMb,
        allowTextAnswers: source.allowTextAnswers,
        allowImageAnswers: source.allowImageAnswers,
        allowPdfAnswers: source.allowPdfAnswers,
        ipRestriction: source.ipRestriction,
        antiCheatEnabled: source.antiCheatEnabled,
        passingScore: source.passingScore,
        totalPoints: source.totalPoints,
        status: 'DRAFT',
        questions: source.questions.length > 0
          ? {
              create: source.questions.map((q, i) => ({
                schoolId: ctx.teacher!.schoolId,
                type: q.type,
                text: q.text,
                options: q.options,
                correctAnswer: q.correctAnswer,
                correctText: q.correctText,
                rubric: q.rubric,
                points: q.points,
                order: q.order != null ? q.order : i,
                explanation: q.explanation,
                attachmentPath: q.attachmentPath,
                attachmentUrl: q.attachmentUrl,
                textModeration: 'SAFE',
                imageModeration: 'SAFE',
              })),
            }
          : undefined,
      },
      include: { questions: { select: { id: true } } },
    });

    await updateTeacherProfile(ctx.teacher!, { examsCreatedDelta: 1 });

    return NextResponse.json({
      success: true,
      message: `تم استنساخ الامتحان "${newTitle}" بنجاح (${cloned.questions.length} سؤال)`,
      newExamId: cloned.id,
      newTitle,
      questionsCount: cloned.questions.length,
      status: 'DRAFT',
    }, { status: 201 });
  } catch (e) {
    console.error('[teacher clone exam] error:', e);
    return NextResponse.json(
      { error: 'فشل استنساخ الامتحان', details: (e as Error).message },
      { status: 500 }
    );
  }
}
