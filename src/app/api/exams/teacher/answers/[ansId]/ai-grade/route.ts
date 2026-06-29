/**
 * ============================================================
 *  POST /api/exams/teacher/answers/[ansId]/ai-grade
 * ============================================================
 *  يطلب اقتراح درجة من الذكاء الاصطناعي لإجابة طالب.
 *
 *  - لا يحفظ الدرجة — يُرجع الاقتراح فقط ليراجعه المعلم.
 *  - يدعم: SHORT / ESSAY (LLM) و IMAGE_ANSWER (VLM).
 *  - يرفض MCQ / TRUE_FALSE (تصحيحها آلي).
 *  - الصلاحيات: نفس منطق /api/exams/teacher/answers/[ansId].
 *
 *  Query: schoolId, teacherId
 *  Body: (فارغ — يستخدم ansId من URL فقط)
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { db } from '@/lib/db';
import { extractTeacherContext } from '../../../../_teacher-helpers';
import {
  gradeAssistText,
  gradeAssistImage,
  type GradeAssistResult,
} from '@/lib/exam-security/grade-assist';

const SECURE_ROOT = path.join(process.cwd(), 'secure-storage', 'exam-answers');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ansId: string }> }
) {
  try {
    const { ansId } = await params;
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

    // نحمّل الإجابة + السؤال + المحاولة + الامتحان (للتحقق من الملكية)
    const answer = await db.answer.findFirst({
      where: {
        id: ansId,
        schoolId: teacher.schoolId,
        submission: { exam: { teacherId: teacher.teacherId } },
      },
      include: {
        submission: {
          select: {
            id: true,
            status: true,
            examId: true,
            studentName: true,
          },
        },
        question: {
          select: {
            id: true,
            type: true,
            text: true,
            correctText: true,
            rubric: true,
            points: true,
          },
        },
      },
    });

    if (!answer) {
      return NextResponse.json(
        { error: 'الإجابة غير موجودة أو لا تملك صلاحية عليها' },
        { status: 404 }
      );
    }

    const q = answer.question;
    const maxPoints = answer.maxScore || q.points || 1;

    // أنواع الأسئلة المدعومة
    if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') {
      return NextResponse.json(
        {
          error:
            'هذا نوع السؤال موضوعي ويُصحَّح آلياً — لا يحتاج مساعد AI',
          questionType: q.type,
        },
        { status: 400 }
      );
    }

    // إعداد rubric من JSON
    let rubric: unknown = null;
    if (q.rubric) {
      try {
        rubric = JSON.parse(q.rubric);
      } catch {
        rubric = q.rubric; // نص خام
      }
    }

    let result: GradeAssistResult;

    if (q.type === 'IMAGE_ANSWER') {
      // نقرأ الصورة من التخزين الآمن
      if (!answer.imageAnswerPath) {
        return NextResponse.json(
          { error: 'لا توجد صورة مرفوعة لهذه الإجابة' },
          { status: 400 }
        );
      }
      // نمنع path traversal ونربط المسار
      const safeRel = answer.imageAnswerPath.replace(/\.\./g, '').replace(/\\/g, '/');
      const fullPath = path.join(SECURE_ROOT, safeRel);
      if (!fullPath.startsWith(SECURE_ROOT)) {
        return NextResponse.json(
          { error: 'مسار الصورة غير صالح' },
          { status: 400 }
        );
      }
      const { promises: fs } = await import('node:fs');
      let imageBuffer: Buffer;
      try {
        imageBuffer = await fs.readFile(fullPath);
      } catch {
        return NextResponse.json(
          { error: 'تعذّر قراءة ملف الصورة من التخزين الآمن' },
          { status: 500 }
        );
      }

      result = await gradeAssistImage({
        questionText: q.text,
        rubric,
        maxPoints,
        imageBuffer,
      });
    } else if (q.type === 'SHORT' || q.type === 'ESSAY') {
      if (!answer.textAnswer || !answer.textAnswer.trim()) {
        // إجابة فارغة → 0 مباشرة
        result = {
          suggestedScore: 0,
          isCorrect: false,
          reasoning: 'إجابة الطالب فارغة — الدرجة 0',
          confidence: 1,
          rubricMatched: [],
          modelUsed: 'empty-detector',
          success: true,
        };
      } else {
        result = await gradeAssistText({
          questionText: q.text,
          rubric,
          correctText: q.correctText,
          studentAnswer: answer.textAnswer,
          maxPoints,
        });
      }
    } else if (q.type === 'FILE_PDF') {
      // ملف PDF — لا يدعم VLM قراءة PDF حالياً
      return NextResponse.json(
        {
          error:
            'مساعد AI لا يدعم حالياً ملفات PDF — يلزم التصحيح اليدوي',
          questionType: q.type,
        },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: `نوع السؤال غير مدعوم: ${q.type}`, questionType: q.type },
        { status: 400 }
      );
    }

    // نُخزّن الاقتراح في حقول الإجابة (للمراجعة لاحقاً) دون تطبيق الدرجة
    await db.answer
      .update({
        where: { id: ansId },
        data: {
          aiSuggestedScore: result.suggestedScore,
          aiConfidence: result.confidence,
          lastAiAssistAt: new Date(),
        },
      })
      .catch((e) => {
        console.error('[ai-grade] failed to persist AI suggestion:', e);
      });

    return NextResponse.json({
      success: true,
      suggestion: result,
      answer: {
        id: answer.id,
        questionType: q.type,
        maxScore: maxPoints,
        textAnswer:
          q.type === 'SHORT' || q.type === 'ESSAY' ? answer.textAnswer : null,
        hasImage: q.type === 'IMAGE_ANSWER' && !!answer.imageAnswerPath,
      },
      note: 'الاقتراح غير مُطبَّق — استدعِ /api/exams/teacher/answers/[ansId]/apply-ai-grade للتطبيق',
    });
  } catch (error) {
    console.error('[exams/teacher/answers/[ansId]/ai-grade] error:', error);
    return NextResponse.json(
      { error: 'فشل اقتراح الدرجة', details: (error as Error).message },
      { status: 500 }
    );
  }
}
