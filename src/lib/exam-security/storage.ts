/**
 * ============================================================
 *  التخزين الآمن المعزول — Secure Isolated Storage
 * ============================================================
 *  • يُخزَّن الملف باسم UUID عشوائي بلا امتداد أصلي
 *  • في مجلد خارج public/ لا يُخدَّم مباشرة
 *  • يُخدَّم فقط عبر API بفحص جلسة + صلاحية
 *  • يُسجَّل في قاعدة البيانات مع البصمة (hash)
 * ============================================================
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';

/** المسار الجذري للتخزين الآمن (خارج public) */
const SECURE_ROOT = path.join(process.cwd(), 'secure-storage', 'exam-answers');

/**
 * يتأكد من وجود مجلد التخزين
 */
export async function ensureSecureStorage(): Promise<void> {
  await fs.mkdir(SECURE_ROOT, { recursive: true });
}

/**
 * يُخزّن ملفاً بشكل آمن
 * @param buffer محتوى الملف
 * @param schoolId معرف المدرسة
 * @param examId معرف الامتحان
 * @param submissionId معرف المحاولة (اختياري)
 * @param studentId معرف الطالب (اختياري)
 * @returns المسار النسبي والـ URL المؤقت
 */
export async function storeSecureFile(
  buffer: Buffer,
  schoolId: string,
  examId: string,
  submissionId?: string,
  studentId?: string
): Promise<{ storedPath: string; relativePath: string; hash: string }> {
  await ensureSecureStorage();

  // إنشاء مسار هرمي: schoolId/examId/submissionId/uuid
  const parts = [schoolId, examId];
  if (submissionId) parts.push(submissionId);
  if (studentId) parts.push(studentId);

  const dir = path.join(SECURE_ROOT, ...parts);
  await fs.mkdir(dir, { recursive: true });

  // اسم عشوائي UUID بدون امتداد (لمنع التخمين بالامتداد)
  const filename = randomUUID().replace(/-/g, '') + '.bin';
  const fullPath = path.join(dir, filename);

  // كتابة الملف
  await fs.writeFile(fullPath, buffer, { mode: 0o600 }); // صلاحية قراءة/كتابة للمالك فقط

  // البصمة
  const hash = createHash('sha256').update(buffer).digest('hex');

  // المسار النسبي (يُخزَّن في DB)
  const relativePath = path.relative(SECURE_ROOT, fullPath);
  // نُوحّد الفواصل لـ /
  const normalized = relativePath.split(path.sep).join('/');

  return {
    storedPath: fullPath,
    relativePath: normalized,
    hash,
  };
}

/**
 * يقرأ ملفاً آمناً للمسار النسبي
 */
export async function readSecureFile(relativePath: string): Promise<Buffer | null> {
  try {
    // نمنع path traversal
    const safe = relativePath.replace(/\.\./g, '').replace(/\\/g, '/');
    const fullPath = path.join(SECURE_ROOT, safe);
    // تأكيد أن المسار النهائي داخل SECURE_ROOT
    if (!fullPath.startsWith(SECURE_ROOT)) return null;
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

/**
 * يحذف ملفاً آمناً
 */
export async function deleteSecureFile(relativePath: string): Promise<boolean> {
  try {
    const safe = relativePath.replace(/\.\./g, '').replace(/\\/g, '/');
    const fullPath = path.join(SECURE_ROOT, safe);
    if (!fullPath.startsWith(SECURE_ROOT)) return false;
    await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * يبني URL مؤقتاً للعرض عبر API
 * @param relativePath المسار النسبي المخزَّن في DB
 * @returns URL مثل /api/exams/secure-file?p=xxxxx (مع طلب توكن)
 */
export function buildSecureFileUrl(relativePath: string): string {
  // نرمّز المسار بأمان
  const encoded = encodeURIComponent(relativePath);
  return `/api/exams/secure-file?p=${encoded}`;
}

/**
 * يبني URL لملف مرتبط بإجابة محددة
 */
export function buildAnswerFileUrl(answerId: string, kind: 'image' | 'pdf'): string {
  return `/api/exams/answers/${answerId}/file?kind=${kind}`;
}
