/**
 * ============================================================
 *  POST /api/exams/[id]/submit
 *  ============================================================
 *  التسليم النهائي للامتحان.
 *
 *  الخطوات:
 *    ① فحص المحاولة النشطة + الإغلاق التلقائي
 *    ② مراجعة AI نهائية لكل الإجابات النصية (إن لم تُفحص بالـ AI)
 *    ③ التصحيح الآلي للأسئلة الموضوعية (MCQ / TRUE_FALSE)
 *    ④ تحديث حالة المحاولة إلى SUBMITTED
 *    ⑤ حساب النتيجة الأولية (بدون المقال)
 *
 *  Body: { force?: boolean }  (للتسليم الإجباري عند الإغلاق التلقائي)
 *  Query: schoolId, studentId, submissionId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext,
  autoCloseExpiredSubmission,
} from '../../_helpers';
import { moderateTextWithAI } from '@/lib/exam-security';

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

    const submissionId = searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json({ error: 'معرف المحاولة (submissionId) مطلوب' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as { force?: boolean };

    // ② التحقق من المحاولة
    const submission = await db.submission.findFirst({
      where: {
        id: submissionId,
        examId,
        studentId: student.studentId,
        schoolId: student.schoolId,
      },
      include: {
        exam: { select: { id: true, totalPoints: true, durationMinutes: true, endDate: true, passingScore: true, showResultImmediately: true } },
      },
    });
    if (!submission) {
      return NextResponse.json({ error: 'المحاولة غير موجودة' }, { status: 404 });
    }

    if (submission.status === 'SUBMITTED' || submission.status === 'GRADED') {
      return NextResponse.json({ error: 'تم تسليم هذه المحاولة بالفعل' }, { status: 403 });
    }

    // ③ فحص الإغلاق التلقائي
    const { closed } = await autoCloseExpiredSubmission(submissionId);
    if (closed && !body.force) {
      return NextResponse.json({
        error: 'انتهى وقت الامتحان وتم إغلاق محاولتك تلقائياً',
        autoClosed: true,
      }, { status: 403 });
    }

    // ④ جلب كل الأسئلة وكل الإجابات
    const [questions, answers] = await Promise.all([
      db.question.findMany({
        where: { examId },
        select: { id: true, type: true, correctAnswer: true, options: true, points: true },
      }),
      db.answer.findMany({
        where: { submissionId },
      }),
    ]);

    // ⑤ مراجعة AI نهائية للإجابات النصية التي لم تُفحص بالـ AI
    const textAnswers = answers.filter(a => a.textAnswer && a.textModeration === 'PENDING');
    if (textAnswers.length > 0) {
      await Promise.all(textAnswers.slice(0, 10).map(async (a) => {
        try {
          const mod = await moderateTextWithAI(a.textAnswer!, 'إجابة طالب في امتحان — تسليم نهائي');
          await db.answer.update({
            where: { id: a.id },
            data: {
              textAnswer: mod.cleanedText,
              textOriginalLength: mod.originalLength,
              textModeration: mod.decision === 'SAFE' ? 'SAFE' : (mod.decision === 'BLOCKED' ? 'BLOCKED' : 'FLAGGED'),
              moderationNotes: JSON.stringify({
                reasons: mod.reasons,
                categories: mod.categories,
                confidence: mod.confidence,
                modelUsed: mod.modelUsed,
              }),
              moderatedAt: new Date(),
            },
          });
        } catch (e) {
          console.error('[submit] AI moderation failed for answer:', a.id, e);
        }
      }));
    }

    // ⑥ التصحيح الآلي للأسئلة الموضوعية
    let autoScore = 0;
    let autoGradedCount = 0;
    const updates: Promise<unknown>[] = [];

    for (const q of questions) {
      if (q.type !== 'MCQ' && q.type !== 'TRUE_FALSE') continue;
      const answer = answers.find(a => a.questionId === q.id);
      if (!answer) continue;

      let isCorrect = false;
      if (q.correctAnswer) {
        const studentAnswer = (answer.textAnswer ?? '').trim();
        const correct = q.correctAnswer.trim();

        if (q.type === 'MCQ' && q.options) {
          // MCQ: ندعم طريقتين لتخزين الإجابة الصحيحة:
          //   ① قيمة الخيار نفسه (مثل "8")
          //   ② فهرس الخيار (مثل "2")
          // نقارن بالإجابة النصية للطالب (القيمة أو الفهرس)
          let options: string[] = [];
          try { options = JSON.parse(q.options) as string[]; } catch { /* ignore */ }

          const correctIdx = parseInt(correct, 10);
          const correctByIndex = !isNaN(correctIdx) && correctIdx >= 0 && correctIdx < options.length
            ? options[correctIdx].trim()
            : null;

          // مطابقة مباشرة (قيمة) أو مطابقة بالفهرس
          isCorrect =
            studentAnswer.toLowerCase() === correct.toLowerCase() ||
            (correctByIndex !== null && studentAnswer.toLowerCase() === correctByIndex.toLowerCase()) ||
            // أيضاً: إن كان جواب الطالب رقماً يطابق فهرس الخيار الصحيح
            (correctByIndex !== null && studentAnswer === String(correctIdx) && correct === String(correctIdx));
        } else {
          // TRUE_FALSE: قارن نصياً (case-insensitive)
          isCorrect = studentAnswer.toLowerCase() === correct.toLowerCase();
        }
      }

      const score = isCorrect ? q.points : 0;
      autoScore += score;
      autoGradedCount++;

      updates.push(
        db.answer.update({
          where: { id: answer.id },
          data: {
            score,
            isCorrect,
            maxScore: q.points,
            gradedAt: new Date(),
            gradedById: 'system',
          },
        })
      );
    }

    await Promise.all(updates);

    // ⑦ حساب النتيجة الإجمالية الأولية
    const totalAutoGradedPoints = questions
      .filter(q => q.type === 'MCQ' || q.type === 'TRUE_FALSE')
      .reduce((sum, q) => sum + q.points, 0);

    const hasManualGrading = questions.some(q => ['SHORT', 'ESSAY', 'IMAGE_ANSWER'].includes(q.type));

    const maxScore = submission.exam.totalPoints;
    const initialScore = autoScore;
    const initialPercentage = maxScore > 0 ? (initialScore / maxScore) * 100 : 0;
    const passingScore = submission.exam.passingScore ?? 0;
    const passed = !hasManualGrading && initialScore >= passingScore;

    // ⑧ تحديث المحاولة
    const updatedSubmission = await db.submission.update({
      where: { id: submissionId },
      data: {
        status: hasManualGrading ? 'SUBMITTED' : 'GRADED',
        submittedAt: new Date(),
        totalScore: initialScore,
        maxScore,
        percentage: initialPercentage,
        passed: hasManualGrading ? null : passed,
        gradedAt: hasManualGrading ? null : new Date(),
        gradedById: hasManualGrading ? null : 'system',
        gradedByName: hasManualGrading ? '' : 'التصحيح الآلي',
      },
    });

    // ⑨ إعداد النتيجة
    const result = {
      submissionId,
      status: updatedSubmission.status,
      submittedAt: updatedSubmission.submittedAt,
      totalScore: updatedSubmission.totalScore,
      maxScore: updatedSubmission.maxScore,
      percentage: updatedSubmission.percentage,
      passed: updatedSubmission.passed,
      autoGradedCount,
      hasManualGrading,
      questionsCount: questions.length,
      answeredCount: answers.length,
      unansweredCount: questions.length - answers.length,
      showResult: submission.exam.showResultImmediately || !hasManualGrading,
    };

    return NextResponse.json({
      success: true,
      message: hasManualGrading
        ? 'تم تسليم الامتحان بنجاح. سيتم تصحيح الأسئلة المقالية يدوياً من قبل المعلم.'
        : 'تم تسليم الامتحان وتصحيحه تلقائياً.',
      result,
    });
  } catch (error) {
    console.error('[exams/[id]/submit] error:', error);
    return NextResponse.json(
      { error: 'فشل تسليم الامتحان', details: (error as Error).message },
      { status: 500 }
    );
  }
}
