/**
 * ============================================================
 *  POST /api/exams/[id]/answers/[qid]/upload
 *  ============================================================
 *  يرفع صورة أو PDF كإجابة لسؤال.
 *
 *  Pipeline الأمان الكامل (من lib/exam-security):
 *    ① validateUploadedFile (MIME + magic bytes + حجم + امتداد)
 *    ② sanitizeImage / sanitizePdf (إعادة ترميز + إزالة EXIF/JS)
 *    ③ moderateImageWithAI (VLM فحص بصري)
 *    ④ storeSecureFile (UUID + مجلد معزول + hash)
 *    ⑤ buildSecureFileUrl (URL مؤقت)
 *
 *  Body: multipart/form-data
 *    - file: الملف (مطلوب)
 *    - ai: "false" لتعطيل VLM (اختياري)
 *
 *  Query: schoolId, studentId, submissionId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  extractStudentContext,
  checkExamAccess,
  autoCloseExpiredSubmission,
} from '../../../../_helpers';
import {
  processSecureUpload,
  type AllowedFileKind,
} from '@/lib/exam-security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  try {
    const { id: examId, qid: questionId } = await params;
    const { searchParams } = new URL(request.url);

    // ① سياق الطالب
    const { student, error, status } = await extractStudentContext(request, searchParams.get('schoolId'));
    if (!student) {
      return NextResponse.json({ error: error || 'فشل المصادقة' }, { status: status || 401 });
    }

    // ② فحص الوصول للامتحان
    const access = await checkExamAccess(examId, student.schoolId);
    if (!access.ok || !access.exam) {
      return NextResponse.json({ error: access.error }, { status: access.status || 403 });
    }
    const exam = access.exam;

    // ③ التحقق من السؤال
    const question = await db.question.findFirst({
      where: { id: questionId, examId, schoolId: student.schoolId },
      select: { id: true, type: true, points: true },
    });
    if (!question) {
      return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });
    }

    // ④ التحقق من نوع السؤال (IMAGE_ANSWER أو FILE_PDF)
    let expectedKind: AllowedFileKind | undefined;
    if (question.type === 'IMAGE_ANSWER') {
      if (!exam.allowImageAnswers) {
        return NextResponse.json({ error: 'رفع الصور غير مفعّل في هذا الامتحان' }, { status: 403 });
      }
      expectedKind = 'image';
    } else if (question.type === 'FILE_PDF') {
      if (!exam.allowPdfAnswers) {
        return NextResponse.json({ error: 'رفع ملفات PDF غير مفعّل في هذا الامتحان' }, { status: 403 });
      }
      expectedKind = 'pdf';
    } else {
      return NextResponse.json(
        { error: `هذا السؤال من نوع ${question.type} ولا يقبل رفع ملفات` },
        { status: 400 }
      );
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
      select: { id: true, status: true, exam: { select: { durationMinutes: true, endDate: true } } },
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

    // ⑦ استلام الملف
    const formData = await request.formData();
    const file = formData.get('file');
    const enableAI = formData.get('ai') !== 'false';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرسال ملف (field name="file")' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    const originalName = file.name;

    // ⑧ Pipeline الأمان الكامل
    const result = await processSecureUpload(buffer, mimeType, originalName, {
      schoolId: student.schoolId,
      examId,
      submissionId,
      studentId: student.studentId,
      maxFileSizeMb: exam.maxFileSizeMb,
      enableImageAI: enableAI,
      expectedKind,
    });

    if (!result.success) {
      // تسجيل محاولة رفع ملف مشبوه
      if (result.validation.severity === 'high' || result.validation.severity === 'critical') {
        await db.examViolation.create({
          data: {
            schoolId: student.schoolId,
            submissionId,
            examId,
            studentId: student.studentId,
            type: 'SUSPICIOUS_FILE',
            severity: result.validation.severity === 'critical' ? 3 : 2,
            details: `محاولة رفع ملف خطر: ${result.validation.reasons.join(' | ').slice(0, 500)}`,
            ipHash: student.ipHash,
            userAgent: student.userAgent,
          },
        }).catch(() => {});
      }
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'تم رفض الملف',
          validation: result.validation,
        },
        { status: 400 }
      );
    }

    // ⑨ حفظ معلومات الإجابة في DB
    const isImage = result.kind === 'image';
    const imageModeration = (isImage && result.moderation) ? result.moderation : null;
    const moderationDecision = imageModeration?.decision || 'PENDING';

    const existingAnswer = await db.answer.findFirst({
      where: { submissionId, questionId },
    });

    let answer;
    const answerData = {
      imageAnswerPath: isImage ? result.storedPath : existingAnswer?.imageAnswerPath,
      imageAnswerUrl: isImage ? result.publicUrl : existingAnswer?.imageAnswerUrl,
      fileAnswerPath: !isImage ? result.storedPath : existingAnswer?.fileAnswerPath,
      fileAnswerUrl: !isImage ? result.publicUrl : existingAnswer?.fileAnswerUrl,
      imageHash: result.hash,
      imageModeration: isImage ? moderationDecision as 'PENDING' | 'SAFE' | 'FLAGGED' | 'BLOCKED' | 'ERROR' : (existingAnswer?.imageModeration || 'PENDING'),
      fileModeration: !isImage ? 'SAFE' as const : (existingAnswer?.fileModeration || 'PENDING'),
      moderationNotes: imageModeration ? JSON.stringify({
        reasons: imageModeration.reasons,
        categories: imageModeration.categories,
        confidence: imageModeration.confidence,
        modelUsed: imageModeration.modelUsed,
      }) : existingAnswer?.moderationNotes,
      moderatedAt: new Date(),
    };

    if (existingAnswer) {
      answer = await db.answer.update({
        where: { id: existingAnswer.id },
        data: answerData,
      });
    } else {
      answer = await db.answer.create({
        data: {
          schoolId: student.schoolId,
          submissionId,
          questionId,
          maxScore: question.points,
          ...answerData,
        } as Parameters<typeof db.answer.create>[0]['data'],
      });
    }

    // ⑩ تحديث آخر نشاط
    await db.submission.update({
      where: { id: submissionId },
      data: { lastActivityAt: new Date() },
    });

    // ⑪ تسجيل في سجل الإشراف
    await db.examModerationLog.create({
      data: {
        schoolId: student.schoolId,
        answerId: answer.id,
        action: moderationDecision === 'SAFE' ? 'AUTO_ALLOWED' : (moderationDecision === 'BLOCKED' ? 'AUTO_BLOCKED' : 'AUTO_FLAGGED'),
        targetType: isImage ? 'image' : 'pdf',
        reason: imageModeration?.reasons.join(' | ').slice(0, 500) || 'تم الرفع والتعقيم',
        aiConfidence: imageModeration?.confidence,
        metadata: JSON.stringify({
          modelUsed: imageModeration?.modelUsed,
          categories: imageModeration?.categories,
          fileHash: result.hash,
        }),
      },
    }).catch(() => {});

    // ⑫ تسجيل violation إن كان BLOCKED
    if (moderationDecision === 'BLOCKED') {
      await db.examViolation.create({
        data: {
          schoolId: student.schoolId,
          submissionId,
          examId,
          studentId: student.studentId,
          type: 'SUSPICIOUS_FILE',
          severity: 3,
          details: `صورة محظورة: ${imageModeration?.reasons.join(' | ').slice(0, 500)}`,
          ipHash: student.ipHash,
          userAgent: student.userAgent,
        },
      }).catch(() => {});

      // نحذف الملف من التخزين الآمن (لا نحتفظ بصور محظورة)
      // لكن نُبقي hash في DB لمنع إعادة الرفع
      // (ملاحظة: نتركه مؤقتاً لمراجعة المعلم، يُحذف يدوياً بعد التأكيد)
    }

    return NextResponse.json({
      success: true,
      saved: true,
      answer: {
        id: answer.id,
        questionId,
        kind: result.kind,
        url: result.publicUrl,
        sizeBytes: result.sizeBytes,
        hash: result.hash?.slice(0, 16) + '...',
        moderation: {
          decision: moderationDecision,
          reasons: imageModeration?.reasons || [],
          categories: imageModeration?.categories || [],
          confidence: imageModeration?.confidence ?? 1.0,
        },
        sanitize: result.sanitize ? {
          cleaned: (result.sanitize as { cleaned: string[] }).cleaned,
        } : null,
      },
      warning: moderationDecision === 'BLOCKED'
        ? 'تم رفض صورتك لأنها تحتوي على محتوى مخالف. يرجى رفع صورة أخرى.'
        : (moderationDecision === 'FLAGGED' ? 'تم حفظ الصورة لكنها ستخضع لمراجعة المعلم قبل التصحيح.' : null),
    });
  } catch (error) {
    console.error('[exams/[id]/answers/[qid]/upload] error:', error);
    return NextResponse.json(
      { error: 'فشل رفع الملف', details: (error as Error).message },
      { status: 500 }
    );
  }
}
