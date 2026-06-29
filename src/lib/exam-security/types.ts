/**
 * ============================================================
 *  وحدة أمان الامتحانات — الأنواع المشتركة
 *  Exam Security Module — Shared Types
 * ============================================================
 *  كل العمليات في الباك إند. لا يُصدَّر منها شيء للعميل.
 * ============================================================
 */

/** أنواع الملفات المسموح بها في إجابات الامتحان */
export type AllowedFileKind = 'image' | 'pdf';

/** نتيجة فحص الملف (التوقيع السحري + MIME) */
export interface FileValidationResult {
  valid: boolean;
  kind: AllowedFileKind | null;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  /** الأسباب في حال الرفض */
  reasons: string[];
  /** مستوى الخطورة إن كان ملفاً مشبوهاً */
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
}

/** نتيجة تعقيم الصورة */
export interface ImageSanitizeResult {
  ok: boolean;
  buffer: Buffer | null;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  /** ما الذي تم تنظيفه */
  cleaned: string[];
  error?: string;
}

/** نتيجة تعقيم PDF */
export interface PdfSanitizeResult {
  ok: boolean;
  buffer: Buffer | null;
  pageCount: number;
  sizeBytes: number;
  cleaned: string[];
  error?: string;
}

/** قرار الإشراف على المحتوى */
export type ModerationDecision = 'SAFE' | 'FLAGGED' | 'BLOCKED' | 'ERROR';

/** نتيجة مراجعة النص */
export interface TextModerationResult {
  decision: ModerationDecision;
  cleanedText: string;
  originalLength: number;
  cleanedLength: number;
  reasons: string[];
  categories: string[];
  confidence: number; // 0..1
  modelUsed: string;
}

/** نتيجة مراجعة الصورة */
export interface ImageModerationResult {
  decision: ModerationDecision;
  reasons: string[];
  categories: string[];
  confidence: number;
  modelUsed: string;
}

/** ناتج Pipeline الكامل لملف مرفوع */
export interface SecureUploadResult {
  success: boolean;
  kind: AllowedFileKind | null;
  storedPath: string | null;   // المسار الداخلي الآمن (لا يُخدَم مباشرة)
  publicUrl: string | null;    // URL مؤقت للعرض عبر API
  mimeType: string;
  sizeBytes: number;
  validation: FileValidationResult;
  sanitize: ImageSanitizeResult | PdfSanitizeResult | null;
  moderation: TextModerationResult | ImageModerationResult | null;
  hash: string | null;         // بصمة الملف
  error?: string;
}

/** خيارات Pipeline */
export interface SecureUploadOptions {
  schoolId: string;
  examId: string;
  submissionId?: string;
  studentId?: string;
  /** الحد الأقصى للحجم بالميجابايت */
  maxFileSizeMb?: number;
  /** تفعيل مراجعة AI للنصوص */
  enableTextAI?: boolean;
  /** تفعيل مراجعة AI للصور */
  enableImageAI?: boolean;
  /** نوع المحتوى المتوقع */
  expectedKind?: AllowedFileKind;
}

/** القائمة السوداء للكلمات (يمكن تحديثها من لوحة الإدارة مستقبلاً) */
export const DEFAULT_BLOCKED_WORDS: string[] = [
  // مصطلحات عامة مرفوضة في سياق تعليمي
  // (تُترك فارغة افتراضياً ويُعتمد على LLM للمراجعة السياقية)
];

/** أنماط خطرة تُنقّى من النصوص */
export const DANGEROUS_PATTERNS: RegExp[] = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<\/?script[^>]*>/gi,
  /javascript:\s*[^\s"']+/gi,
  /on\w+\s*=\s*"[^"]*"/gi,    // onerror="...", onclick="..."
  /on\w+\s*=\s*'[^']*'/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /<\/?iframe[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<object[^>]*>[\s\S]*?<\/object>/gi,
  /data:\s*text\/html/gi,
  /vbscript:/gi,
];

/** أنماط الروابط الخارجية */
export const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

/** حد طول النص الافتراضي */
export const MAX_TEXT_LENGTH = 5000;

/** حد معدل الإرسال */
export const RATE_LIMIT_PER_MINUTE = 30;
