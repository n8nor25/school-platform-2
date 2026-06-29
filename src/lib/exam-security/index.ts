/**
 * ============================================================
 *  Pipeline الأمان الموحّد — Unified Security Pipeline
 *  ============================================================
 *  يجمع كل الطبقات في تدفق واحد:
 *    رفع الملف
 *       │
 *       ▼
 *    ① validateUploadedFile  (MIME + magic bytes + حجم + امتداد)
 *       │
 *       ▼
 *    ② sanitizeImage / sanitizePdf  (إعادة ترميز + إزالة EXIF + إزالة JS)
 *       │
 *       ▼
 *    ③ moderateImageWithAI / moderateTextWithAI  (VLM / LLM)
 *       │
 *       ▼
 *    ④ storeSecureFile  (UUID + مجلد معزول + بصمة)
 *       │
 *       ▼
 *    ⑤ buildSecureFileUrl  (URL مؤقت عبر API)
 * ============================================================
 */

import { validateUploadedFile, computeFileHash } from './file-validator';
import { sanitizeImage } from './image-sanitizer';
import { sanitizePdf } from './pdf-sanitizer';
import { moderateImageWithAI, moderateImageLocal } from './image-moderator';
import { moderateTextWithAI, moderateTextLocal } from './text-moderator';
import { storeSecureFile, readSecureFile, deleteSecureFile, buildSecureFileUrl, buildAnswerFileUrl } from './storage';
import {
  gradeAssistText,
  gradeAssistImage,
  suggestQuestionImprovement,
  type GradeAssistResult,
  type GradeAssistTextParams,
  type GradeAssistImageParams,
  type QuestionImprovementParams,
  type QuestionImprovementResult,
} from './grade-assist';
import type {
  AllowedFileKind,
  SecureUploadResult,
  SecureUploadOptions,
  ImageSanitizeResult,
  PdfSanitizeResult,
  TextModerationResult,
  ImageModerationResult,
} from './types';

/**
 * Pipeline كامل لمعالجة ملف مرفوع (صورة أو PDF)
 */
export async function processSecureUpload(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  options: SecureUploadOptions
): Promise<SecureUploadResult> {
  const maxFileSizeMb = options.maxFileSizeMb ?? 5;

  // ① فحص الملف
  const validation = await validateUploadedFile(buffer, mimeType, originalName, maxFileSizeMb);
  if (!validation.valid || !validation.kind) {
    return {
      success: false,
      kind: validation.kind,
      storedPath: null,
      publicUrl: null,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
      validation,
      sanitize: null,
      moderation: null,
      hash: null,
      error: `رفض الملف: ${validation.reasons.join(' | ')}`,
    };
  }

  // التحقق من النوع المتوقع
  if (options.expectedKind && validation.kind !== options.expectedKind) {
    return {
      success: false,
      kind: validation.kind,
      storedPath: null,
      publicUrl: null,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
      validation,
      sanitize: null,
      moderation: null,
      hash: null,
      error: `النوع المتوقع "${options.expectedKind}" لكن الملف من نوع "${validation.kind}"`,
    };
  }

  // ② تعقيم الملف
  let sanitizeResult: ImageSanitizeResult | PdfSanitizeResult | null = null;
  let cleanBuffer: Buffer = buffer;

  if (validation.kind === 'image') {
    sanitizeResult = await sanitizeImage(buffer, validation.mimeType);
    if (!sanitizeResult.ok || !sanitizeResult.buffer) {
      return {
        success: false,
        kind: validation.kind,
        storedPath: null,
        publicUrl: null,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
        validation,
        sanitize: sanitizeResult,
        moderation: null,
        hash: null,
        error: `فشل تعقيم الصورة: ${sanitizeResult.error}`,
      };
    }
    cleanBuffer = sanitizeResult.buffer;
  } else if (validation.kind === 'pdf') {
    sanitizeResult = await sanitizePdf(buffer);
    if (!sanitizeResult.ok || !sanitizeResult.buffer) {
      return {
        success: false,
        kind: validation.kind,
        storedPath: null,
        publicUrl: null,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
        validation,
        sanitize: sanitizeResult,
        moderation: null,
        hash: null,
        error: `فشل تعقيم PDF: ${sanitizeResult.error}`,
      };
    }
    cleanBuffer = sanitizeResult.buffer;
  }

  // ③ مراجعة المحتوى بالـ AI
  let moderation: ImageModerationResult | TextModerationResult | null = null;

  if (validation.kind === 'image' && options.enableImageAI !== false) {
    moderation = await moderateImageWithAI(
      cleanBuffer,
      (sanitizeResult as ImageSanitizeResult).mimeType,
      'إجابة طالب في امتحان — صورة'
    );
  } else if (validation.kind === 'image') {
    // فحص محلي فقط
    const local = moderateImageLocal(cleanBuffer);
    moderation = {
      decision: local.sizeOk ? 'SAFE' : 'FLAGGED',
      reasons: local.notes,
      categories: local.sizeOk ? [] : ['size-issue'],
      confidence: 0.5,
      modelUsed: 'local-only',
    };
  }

  // ④ تخزين آمن
  const stored = await storeSecureFile(
    cleanBuffer,
    options.schoolId,
    options.examId,
    options.submissionId,
    options.studentId
  );

  // ⑤ URL مؤقت
  const publicUrl = buildSecureFileUrl(stored.relativePath);

  return {
    success: true,
    kind: validation.kind,
    storedPath: stored.relativePath,
    publicUrl,
    mimeType: validation.kind === 'image'
      ? (sanitizeResult as ImageSanitizeResult).mimeType
      : 'application/pdf',
    sizeBytes: cleanBuffer.length,
    validation,
    sanitize: sanitizeResult,
    moderation,
    hash: stored.hash,
  };
}

/**
 * Pipeline مبسّط لمعالجة نص فقط (لإجابات الأسئلة النصية)
 */
export async function processSecureText(
  text: string,
  options: Pick<SecureUploadOptions, 'enableTextAI'> = {}
): Promise<TextModerationResult> {
  if (options.enableTextAI === false) {
    return moderateTextLocal(text);
  }
  return moderateTextWithAI(text, 'إجابة طالب في امتحان — نص');
}

// إعادة تصدير كل الأدوات للاستخدام الفردي
export {
  validateUploadedFile,
  computeFileHash,
  sanitizeImage,
  sanitizePdf,
  moderateImageWithAI,
  moderateImageLocal,
  moderateTextWithAI,
  moderateTextLocal,
  storeSecureFile,
  readSecureFile,
  deleteSecureFile,
  buildSecureFileUrl,
  buildAnswerFileUrl,
  gradeAssistText,
  gradeAssistImage,
  suggestQuestionImprovement,
};

// إعادة تصدير الأنواع
export type {
  AllowedFileKind,
  FileValidationResult,
  ImageSanitizeResult,
  PdfSanitizeResult,
  TextModerationResult,
  ImageModerationResult,
  ModerationDecision,
  SecureUploadResult,
  SecureUploadOptions,
} from './types';

export type {
  GradeAssistResult,
  GradeAssistTextParams,
  GradeAssistImageParams,
  QuestionImprovementParams,
  QuestionImprovementResult,
} from './grade-assist';
