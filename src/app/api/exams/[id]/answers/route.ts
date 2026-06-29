/**
 * ============================================================
 *  POST /api/exams/[id]/answers
 *  ============================================================
 *  يحفظ إجابة نصية لسؤال (حفظ تلقائي كل 15 ثانية).
 *
 *  Pipeline الأمان:
 *    ① localFilterText (فلتر محلي سريع)
 *    ② moderateTextWithAI (LLM مراجعة سياقية) — إن فُعِّل
 *    ③ تخزين النص المنقّى + حالة الإشراف
 *
 *  Body: { questionId: string, text: string }
 *  Query: schoolId, studentId, submissionId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext,
  checkExamAccess,
  autoCloseExpiredSubmission,
} from '../../_helpers';
import { moderateTextWithAI, moderateTextLocal } from '@/lib/exam-security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: examId } = await params;
    const { searchParams } = new URL(request.url);

    // ① سياق الطالب
    const { student, error, status } = await extractStudentContext(request, searchParams.get('schoolId'));
    if (!student) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    // ② فحص الوصول
    const access = await checkExamAccess(examId, student.schoolId);
    if (!access.ok || !access.exam) {
      return NextResponse.json({ error: access.error }, { status: access.status || 403 });
    }
    const exam = access.exam;

    if (!exam.allowTextAnswers) {
      return NextResponse.json({ error: 'الإجابات النصية غير مفعّلة في هذا الامتحان' }, { status: 403 });
    }

    // ③ استخراج الإجابة
    const body = await request.json().catch(() => ({}));
    const { questionId, text } = body as { questionId?: string; text?: string };

    if (!questionId) {
      return NextResponse.json({ error: 'معرف السؤال مطلوب' }, { status: 400 });
    }
    if (typeof text !== 'string') {
      return NextResponse.json({ error: 'النص يجب أن يكون سلسلة' }, { status: 400 });
    }

    // ④ التحقق من السؤال
    const question = await db.question.findFirst({
      where: { id: questionId, examId, schoolId: student.schoolId },
      select: { id: true, type: true, points: true },
    });
    if (!question) {
      return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });
    }

    // أنواع الأسئلة التي تقبل نصاً (إجابة مختارة أو مكتوبة)
    // MCQ: نُخزن index الخيار المختار كنص ("0".."n")
    // TRUE_FALSE: نُخزن "true" أو "false"
    // SHORT/ESSAY: نُخزن نص الإجابة
    const TEXT_QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'SHORT', 'ESSAY'];
    if (!TEXT_QUESTION_TYPES.includes(question.type)) {
      return NextResponse.json(
        { error: `هذا السؤال من نوع ${question.type} ولا يقبل إجابة نصية` },
        { status: 400 }
      );
    }

    // للأسئلة الموضوعية نقبل قيمة الخيار فقط (بدون مراجعة AI ثقيلة)
    const isObjective = question.type === 'MCQ' || question.type === 'TRUE_FALSE';
    if (isObjective) {
      // تحقق بسيط من طول الإجابة (يمنع إساءة الاستخدام)
      if (text.length > 50) {
        return NextResponse.json(
          { error: 'إجابة السؤال الموضوعي طويلة جداً' },
          { status: 400 }
        );
      }
    }

    // ⑤ التحقق من المحاولة النشطة
    const submissionId = searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json({ error: 'معرف المحاولة (submissionId) مطلوب' }, { status: 400 });
    }

    const submission = await db.submission.findFirst({
      where: {
        id: submissionId,
        examId,
        studentId: student.studentId,
        schoolId: student.schoolId,
      },
      include: { exam: true },
    });

    if (!submission) {
      return NextResponse.json({ error: 'المحاولة غير موجودة أو لا تخصك' }, { status: 404 });
    }

    // ⑥ فحص الإغلاق التلقائي
    const { closed } = await autoCloseExpiredSubmission(submissionId);
    if (closed || submission.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'انتهى وقت الامتحان — تم إغلاق محاولتك تلقائياً', autoClosed: true },
        { status: 403 }
      );
    }

    // ⑦ Pipeline مراجعة النص
    // للأسئلة الموضوعية (MCQ/TRUE_FALSE) نستخدم الفلتر المحلي فقط (الإجابة قصيرة جداً)
    // لأسئلة SHORT/ESSAY: في الحفظ التلقائي نستخدم الفلتر المحلي (سريع)، ونُفعّل AI عند التسليم النهائي
    const useAI = !isObjective && searchParams.get('ai') === 'true';
    const moderation = useAI
      ? await moderateTextWithAI(text, 'إجابة طالب في امتحان — نص')
      : moderateTextLocal(text);

    // ⑧ تحديث/إنشاء الإجابة
    const existingAnswer = await db.answer.findFirst({
      where: { submissionId, questionId },
    });

    let answer;
    if (existingAnswer) {
      answer = await db.answer.update({
        where: { id: existingAnswer.id },
        data: {
          textAnswer: moderation.cleanedText,
          textOriginalLength: moderation.originalLength,
          textModeration: moderation.decision === 'SAFE' ? 'SAFE' : (moderation.decision === 'BLOCKED' ? 'BLOCKED' : 'FLAGGED'),
          moderationNotes: JSON.stringify({
            reasons: moderation.reasons,
            categories: moderation.categories,
            confidence: moderation.confidence,
            modelUsed: moderation.modelUsed,
          }),
          moderatedAt: new Date(),
        },
      });
    } else {
      answer = await db.answer.create({
        data: {
          schoolId: student.schoolId,
          submissionId,
          questionId,
          textAnswer: moderation.cleanedText,
          textOriginalLength: moderation.originalLength,
          maxScore: question.points,
          textModeration: moderation.decision === 'SAFE' ? 'SAFE' : (moderation.decision === 'BLOCKED' ? 'BLOCKED' : 'FLAGGED'),
          moderationNotes: JSON.stringify({
            reasons: moderation.reasons,
            categories: moderation.categories,
            confidence: moderation.confidence,
            modelUsed: moderation.modelUsed,
          }),
          moderatedAt: new Date(),
        },
      });
    }

    // ⑨ تحديث آخر نشاط في المحاولة
    await db.submission.update({
      where: { id: submissionId },
      data: { lastActivityAt: new Date() },
    });

    // ⑩ تسجيل مراقبة إن كان BLOCKED
    if (moderation.decision === 'BLOCKED') {
      await db.examViolation.create({
        data: {
          schoolId: student.schoolId,
          submissionId,
          examId,
          studentId: student.studentId,
          type: 'SUSPICIOUS_FILE',
          severity: 3,
          details: `إجابة محظورة: ${moderation.reasons.join(' | ').slice(0, 500)}`,
          ipHash: student.ipHash,
          userAgent: student.userAgent,
        },
      }).catch(() => {});
    }

    // ⑪ تسجيل في سجل الإشراف
    await db.examModerationLog.create({
      data: {
        schoolId: student.schoolId,
        answerId: answer.id,
        action: moderation.decision === 'SAFE' ? 'AUTO_ALLOWED' : (moderation.decision === 'BLOCKED' ? 'AUTO_BLOCKED' : 'AUTO_FLAGGED'),
        targetType: 'text',
        reason: moderation.reasons.join(' | ').slice(0, 500),
        aiConfidence: moderation.confidence,
        metadata: JSON.stringify({ modelUsed: moderation.modelUsed, categories: moderation.categories }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      saved: true,
      answer: {
        id: answer.id,
        questionId,
        textLength: moderation.cleanedLength,
        moderation: {
          decision: moderation.decision,
          reasons: moderation.reasons,
          categories: moderation.categories,
          confidence: moderation.confidence,
        },
      },
      warning: moderation.decision === 'BLOCKED'
        ? 'تم رفض إجابتك لأنها تحتوي على محتوى مخالف. يرجى إعادة كتابتها.'
        : (moderation.decision === 'FLAGGED' ? 'تم حفظ الإجابة لكنها ستخضع لمراجعة المعلم.' : null),
    });
  } catch (error) {
    console.error('[exams/[id]/answers] error:', error);
    return NextResponse.json(
      { error: 'فشل حفظ الإجابة', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exams/[id]/answers
 * يجلب إجابات الطالب المحفوظة (للاسترجاع)
 */
export async function GET(
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

    const submissionId = searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json({ error: 'معرف المحاولة مطلوب' }, { status: 400 });
    }

    // التحقق من ملكية المحاولة
    const submission = await db.submission.findFirst({
      where: {
        id: submissionId,
        examId,
        studentId: student.studentId,
        schoolId: student.schoolId,
      },
      select: { id: true, status: true },
    });
    if (!submission) {
      return NextResponse.json({ error: 'المحاولة غير موجودة' }, { status: 404 });
    }

    const answers = await db.answer.findMany({
      where: { submissionId },
      select: {
        id: true,
        questionId: true,
        textAnswer: true,
        imageAnswerUrl: true,
        fileAnswerUrl: true,
        textModeration: true,
        imageModeration: true,
        fileModeration: true,
        score: true,
        isCorrect: true,
        teacherNote: true,
      },
    });

    return NextResponse.json({
      success: true,
      answers,
      count: answers.length,
    });
  } catch (error) {
    console.error('[exams/[id]/answers GET] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب الإجابات' },
      { status: 500 }
    );
  }
}
