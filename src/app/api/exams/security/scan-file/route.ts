/**
 * ============================================================
 *  مسار: POST /api/exams/security/scan-file
 *  ============================================================
 *  يختبر Pipeline الأمان على ملف مرفوع.
 *  لا يُخزّن الملف فعلياً — يُرجع تقرير الفحص فقط.
 *
 *  الاستخدام: اختبار المكتبة قبل ربطها بالواجهة.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateUploadedFile, sanitizeImage, sanitizePdf, moderateImageWithAI, computeFileHash } from '@/lib/exam-security';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const enableAI = formData.get('ai') !== 'false'; // افتراضياً true

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'لم يتم إرسال ملف. استخدم field name = "file"' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    const originalName = file.name;
    const maxSizeMb = 10;

    // ① فحص الملف
    const validation = await validateUploadedFile(buffer, mimeType, originalName, maxSizeMb);

    // ② تعقيم (إن كان مسموحاً)
    let sanitizeResult: Record<string, unknown> | null = null;
    let moderatedBuffer = buffer;

    if (validation.valid && validation.kind === 'image') {
      const r = await sanitizeImage(buffer, validation.mimeType);
      sanitizeResult = {
        ok: r.ok,
        mimeType: r.mimeType,
        width: r.width,
        height: r.height,
        sizeBytes: r.sizeBytes,
        cleaned: r.cleaned,
        error: r.error,
      };
      if (r.ok && r.buffer) moderatedBuffer = r.buffer;
    } else if (validation.valid && validation.kind === 'pdf') {
      const r = await sanitizePdf(buffer);
      sanitizeResult = {
        ok: r.ok,
        pageCount: r.pageCount,
        sizeBytes: r.sizeBytes,
        cleaned: r.cleaned,
        error: r.error,
      };
      if (r.ok && r.buffer) moderatedBuffer = r.buffer;
    }

    // ③ مراجعة AI للصور (اختياري)
    let moderationResult: Record<string, unknown> | null = null;
    if (validation.valid && validation.kind === 'image' && sanitizeResult && (sanitizeResult as { ok: boolean }).ok && enableAI) {
      try {
        const m = await moderateImageWithAI(
          moderatedBuffer,
          (sanitizeResult as { mimeType: string }).mimeType,
          'اختبار فحص صورة'
        );
        moderationResult = {
          decision: m.decision,
          reasons: m.reasons,
          categories: m.categories,
          confidence: m.confidence,
          modelUsed: m.modelUsed,
        };
      } catch (e) {
        moderationResult = {
          error: `فشل VLM: ${(e as Error).message}`,
        };
      }
    }

    // ④ بصمة الملف
    const hash = computeFileHash(buffer);

    return NextResponse.json({
      success: validation.valid,
      file: {
        name: originalName,
        sizeBytes: buffer.length,
        declaredMime: mimeType,
        hash,
      },
      validation: {
        valid: validation.valid,
        kind: validation.kind,
        detectedMime: validation.mimeType,
        reasons: validation.reasons,
        severity: validation.severity,
      },
      sanitize: sanitizeResult,
      moderation: moderationResult,
      pipeline: [
        '① file-validation',
        validation.valid ? '② sanitize' : '② skipped (invalid)',
        validation.valid && validation.kind === 'image' && enableAI ? '③ AI moderation' : '③ skipped',
        validation.valid ? '④ ready for storage' : '④ rejected',
      ],
    });
  } catch (e) {
    console.error('[exams/security/scan-file] error:', e);
    return NextResponse.json(
      { error: 'فشل فحص الملف', details: (e as Error).message },
      { status: 500 }
    );
  }
}

/** GET يعيد توثيقاً مختصراً للمسار */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/exams/security/scan-file',
    description: 'يختبر Pipeline أمان الامتحانات على ملف مرفوع (لا يُخزّن)',
    usage: {
      method: 'POST',
      contentType: 'multipart/form-data',
      fields: {
        file: 'الملف (مطلوب)',
        ai: '"false" لتعطيل VLM (اختياري، افتراضي true)',
      },
    },
    allowedKinds: ['image (png/jpg/jpeg/webp)', 'pdf'],
    blockedExtensions: ['exe', 'bat', 'sh', 'js', 'html', 'svg', 'docx', 'zip', 'rar'],
    pipeline: [
      '① file-validation (MIME + magic bytes + size + extension)',
      '② sanitize (sharp for images / pdf-lib for PDF)',
      '③ AI moderation (VLM for images / LLM for text)',
      '④ (in production) secure storage with UUID + hash',
    ],
  });
}
