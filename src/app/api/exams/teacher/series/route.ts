/**
 * ============================================================
 *  POST /api/exams/teacher/series
 *  ============================================================
 *  يُنشئ سلسلة امتحانات تدريبية دفعة واحدة (مثل Oracle Academy).
 *
 *  Body:
 *    نفس بيانات POST /api/exams/teacher +
 *    seriesCount: number        (2..12)  — عدد الامتحانات في السلسلة
 *    seriesIntervalDays: number (7|14|30) — فترة التكرار بين الامتحانات
 *    publish?: boolean          — إن true، يُنشئها منشورة بدل مسودة
 *
 *  Logic:
 *    لكل i ∈ [0, N):
 *      startDate_i = startDate + i * intervalDays
 *      endDate_i   = startDate_i + 7 أيام (نافذة أسبوع)
 *      title_i     = `${baseTitle} — حلقة ${i+1}/${N}`
 *
 *  Response:
 *    { success, created, published, message, exams: [{ id, title, startDate, endDate, status }] }
 *
 *  ملاحظات:
 *    - السلسلة متاحة فقط للامتحانات التدريبية (category = TRAINING).
 *    - يتم تعقيم نصوص الأسئلة مرة واحدة وإعادة استخدامها لكل امتحان.
 *    - العملية ذرية (transaction) — فشل واحد يلغي كل الإنشاء.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractTeacherContext,
  sanitizeQuestionText,
  validateQuestionData,
} from '../../_teacher-helpers';

const VALID_INTERVALS = new Set<number>([7, 14, 30]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { teacher, error, status } = await extractTeacherContext(
      request,
      searchParams.get('schoolId')
    );
    if (!teacher) {
      return NextResponse.json(
        { error: error || 'فشل المصادقة' },
        { status: status || 401 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      title?: string;
      description?: string;
      subject?: string;
      classroomId?: string;
      classroomName?: string;
      startDate?: string;
      endDate?: string; // يُتجاهل في وضع السلسلة (يُحسب تلقائياً)
      durationMinutes?: number;
      password?: string; // يُتجاهل للتدريبي
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
      category?: string;
      examPeriod?: string;
      showAnswersAfter?: boolean;
      allowRetakes?: boolean;
      seriesCount?: number;
      seriesIntervalDays?: number;
      publish?: boolean;
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

    // ===== Validations (نفس فحوصات POST الأساسي) =====
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'عنوان الامتحان مطلوب' }, { status: 400 });
    }
    if (!body.subject) {
      return NextResponse.json({ error: 'المادة مطلوبة' }, { status: 400 });
    }
    if (!body.startDate) {
      return NextResponse.json({ error: 'وقت البدء مطلوب' }, { status: 400 });
    }
    if (!body.durationMinutes || body.durationMinutes < 1) {
      return NextResponse.json(
        { error: 'مدة الامتحان يجب أن تكون دقيقة على الأقل' },
        { status: 400 }
      );
    }

    const baseStart = new Date(body.startDate);
    if (isNaN(baseStart.getTime())) {
      return NextResponse.json({ error: 'تاريخ بدء غير صالح' }, { status: 400 });
    }

    // ===== Series-specific validations =====
    const rawCount = Number(body.seriesCount);
    const seriesCount = Number.isFinite(rawCount)
      ? Math.min(12, Math.max(2, Math.floor(rawCount)))
      : 4;

    const rawInterval = Number(body.seriesIntervalDays);
    if (!Number.isFinite(rawInterval) || !VALID_INTERVALS.has(rawInterval)) {
      return NextResponse.json(
        { error: 'فترة التكرار غير صالحة (يجب أن تكون 7 أو 14 أو 30 يوم)' },
        { status: 400 }
      );
    }
    const seriesIntervalDays = rawInterval;

    // ===== Category validation: السلسلة متاحة فقط للامتحانات التدريبية =====
    const category = body.category === 'TRAINING' ? 'TRAINING' : 'OFFICIAL' as 'TRAINING' | 'OFFICIAL';
    if (category !== 'TRAINING') {
      return NextResponse.json(
        { error: 'سلسلة الامتحانات متاحة فقط للامتحانات التدريبية' },
        { status: 400 }
      );
    }

    const validPeriods = ['NONE', 'WEEKLY', 'MIDMONTH', 'MONTHLY', 'CUMULATIVE'] as const;
    const examPeriod =
      body.examPeriod && validPeriods.includes(body.examPeriod as typeof validPeriods[number])
        ? (body.examPeriod as typeof validPeriods[number])
        : 'NONE';

    // للتدريبي: تصحيح فوري + يعرض الإجابات + يسمح بإعادة المحاولة
    const showResultImmediately = true;
    const showAnswersAfter = body.showAnswersAfter ?? true;
    const allowRetakes = body.allowRetakes ?? true;
    const maxAttempts = allowRetakes ? 99 : Math.min(10, Math.max(1, body.maxAttempts ?? 1));

    // ===== التحقق من الأسئلة =====
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

    const titleBase = body.title.trim().slice(0, 180); // نترك مساحة لللاحقة
    const descClean = (body.description || '').trim().slice(0, 2000);
    const subjectClean = body.subject.trim().slice(0, 100);
    const durationMinutes = Math.min(600, body.durationMinutes);

    // ===== Pre-sanitize questions مرة واحدة (تُعاد لكل امتحان) =====
    type SanitizedQuestion = {
      type: string;
      text: string;
      options: string | null;
      correctAnswer: string | null;
      correctText: string | null;
      rubric: string | null;
      points: number;
      order: number;
      explanation: string | null;
      textModeration: 'SAFE' | 'FLAGGED';
      moderationNotes: string;
    };

    let sanitizedQuestions: SanitizedQuestion[] = [];
    if (questions.length > 0) {
      sanitizedQuestions = await Promise.all(
        questions.map(async (q, i) => {
          const sanitized = await sanitizeQuestionText(q.text, false);
          return {
            type: q.type,
            text: sanitized.cleanedText,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || null,
            correctText: q.correctText || null,
            rubric: q.rubric ? JSON.stringify(q.rubric) : null,
            points: q.points ?? 1,
            order: q.order ?? i + 1,
            explanation: q.explanation || null,
            textModeration:
              sanitized.moderation.decision === 'SAFE' ? 'SAFE' : 'FLAGGED',
            moderationNotes: JSON.stringify({
              reasons: sanitized.moderation.reasons,
              categories: sanitized.moderation.categories,
            }),
          };
        })
      );
    }
    const seriesTotalPoints = sanitizedQuestions.reduce((s, q) => s + q.points, 0);

    // ===== Create N exams في transaction ذرية =====
    const intervalMs = seriesIntervalDays * DAY_MS;
    const createdExams: Array<{
      id: string;
      title: string;
      startDate: Date;
      endDate: Date;
      status: string;
    }> = [];

    await db.$transaction(
      async (tx) => {
        for (let i = 0; i < seriesCount; i++) {
          const startDate = new Date(baseStart.getTime() + i * intervalMs);
          const endDate = new Date(startDate.getTime() + WEEK_MS);

          const titleWithSuffix = `${titleBase} — حلقة ${i + 1}/${seriesCount}`.slice(0, 200);

          const exam = await tx.exam.create({
            data: {
              schoolId: teacher.schoolId,
              title: titleWithSuffix,
              description: descClean,
              subject: subjectClean,
              teacherId: teacher.teacherId,
              teacherName: teacher.teacherName,
              classroomId: body.classroomId || null,
              classroomName: body.classroomName || '',
              startDate,
              endDate,
              durationMinutes,
              passwordHash: null, // التدريبي مفتوح بدون كلمة سر
              shuffleQuestions: body.shuffleQuestions ?? false,
              shuffleOptions: body.shuffleOptions ?? false,
              allowReview: body.allowReview ?? true,
              showResultImmediately,
              parentVisible: body.parentVisible ?? false,
              maxAttempts,
              maxFileSizeMb: Math.min(20, Math.max(1, body.maxFileSizeMb ?? 5)),
              allowTextAnswers: body.allowTextAnswers ?? true,
              allowImageAnswers: body.allowImageAnswers ?? true,
              allowPdfAnswers: body.allowPdfAnswers ?? false,
              antiCheatEnabled: body.antiCheatEnabled ?? true,
              ipRestriction: body.ipRestriction || null,
              passingScore: body.passingScore ?? null,
              status: 'DRAFT',
              totalPoints: seriesTotalPoints,
              category,
              examPeriod,
              showAnswersAfter,
              allowRetakes,
            },
          });

          // إنشاء الأسئلة (نفس الأسئلة لكل امتحان)
          if (sanitizedQuestions.length > 0) {
            await tx.question.createMany({
              data: sanitizedQuestions.map((q) => ({
                schoolId: teacher.schoolId,
                examId: exam.id,
                type: q.type as 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'ESSAY' | 'IMAGE_ANSWER' | 'FILE_PDF',
                text: q.text,
                options: q.options,
                correctAnswer: q.correctAnswer,
                correctText: q.correctText,
                rubric: q.rubric,
                points: q.points,
                order: q.order,
                explanation: q.explanation,
                textModeration: q.textModeration,
                moderationNotes: q.moderationNotes,
                moderatedAt: new Date(),
              })),
            });
          }

          createdExams.push({
            id: exam.id,
            title: titleWithSuffix,
            startDate,
            endDate,
            status: 'DRAFT',
          });
        }
      },
      { timeout: 30_000 }
    );

    // ===== Optional publish step (خارج الـ transaction) =====
    const publishRequested = body.publish === true;
    let published = 0;
    if (publishRequested && sanitizedQuestions.length > 0 && seriesTotalPoints > 0) {
      const now = new Date();
      for (const ex of createdExams) {
        if (ex.endDate > now) {
          try {
            await db.exam.update({
              where: { id: ex.id },
              data: { status: 'PUBLISHED' },
            });
            ex.status = 'PUBLISHED';
            published++;
          } catch (e) {
            console.error(`[series] failed to publish exam ${ex.id}:`, e);
          }
        }
      }
    }

    // ===== Update teacher profile (لا يوقف العملية عند الفشل) =====
    await db.examTeacherProfile
      .update({
        where: { teacherId: teacher.teacherId },
        data: { totalExamsCreated: { increment: seriesCount } },
      })
      .catch(() => {});

    const message = publishRequested
      ? published === createdExams.length
        ? `تم إنشاء ونشر ${createdExams.length} امتحانات في السلسلة بنجاح`
        : `تم إنشاء ${createdExams.length} امتحان (نُشر منها ${published})`
      : `تم إنشاء ${createdExams.length} امتحانات في السلسلة كمسودات`;

    return NextResponse.json(
      {
        success: true,
        created: createdExams.length,
        published,
        message,
        exams: createdExams.map((e) => ({
          id: e.id,
          title: e.title,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          status: e.status,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[exams/teacher/series POST] error:', error);
    return NextResponse.json(
      { error: 'فشل إنشاء سلسلة الامتحانات', details: (error as Error).message },
      { status: 500 }
    );
  }
}
