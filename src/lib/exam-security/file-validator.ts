/**
 * ============================================================
 *  فاحص الملفات — الطبقة الأولى من الدفاع
 *  File Validator — First Line of Defense
 * ============================================================
 *  نفحص:
 *  1) الاسم والامتداد
 *  2) نوع MIME المُعلَن
 *  3) Magic Bytes (التوقيع السحري) — لا نثق بالامتداد
 *  4) حجم الملف
 *  5) القائمة البيضاء الصارمة
 * ============================================================
 */

import { fileTypeFromBuffer } from 'file-type';
import { createHash } from 'node:crypto';
import type { AllowedFileKind, FileValidationResult } from './types';

/** الامتدادات المسموح بها */
const ALLOWED_EXTENSIONS: Record<AllowedFileKind, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'webp'],
  pdf: ['pdf'],
};

/** MIME المسموح به */
const ALLOWED_MIME: Record<AllowedFileKind, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  pdf: ['application/pdf'],
};

/** امتدادات خطرة مرفوضة قاطعة */
const FORBIDDEN_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'bash', 'ps1', 'vbs', 'js', 'mjs', 'cjs',
  'jar', 'class', 'dll', 'so', 'dylib', 'app', 'deb', 'rpm', 'msi',
  'html', 'htm', 'svg', 'xml', 'xhtml',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',  // تطلب PDF بدلاً منها
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv',
  'sql', 'db', 'sqlite', 'mdb',
  'py', 'rb', 'php', 'asp', 'jsp', 'go', 'rs', 'c', 'cpp', 'cs',
  'rtf', 'odt', 'ods', 'odp',
];

/** Magic bytes للأنواع المسموح بها */
const MAGIC_BYTES: Array<{ bytes: number[]; mime: string; kind: AllowedFileKind }> = [
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png', kind: 'image' },
  // JPEG: FF D8 FF
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg', kind: 'image' },
  // PDF: %PDF-
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], mime: 'application/pdf', kind: 'pdf' },
];

/** Magic bytes لملفات خطرة (كشف مبكر للرفض) */
const DANGEROUS_MAGIC: Array<{ bytes: number[]; name: string; severity: FileValidationResult['severity'] }> = [
  // PE (Windows executable): 4D 5A
  { bytes: [0x4d, 0x5a], name: 'Windows Executable (PE)', severity: 'critical' },
  // ELF (Linux executable): 7F 45 4C 46
  { bytes: [0x7f, 0x45, 0x4c, 0x46], name: 'Linux Executable (ELF)', severity: 'critical' },
  // Mach-O (macOS executable): CF FA ED FE
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], name: 'macOS Executable (Mach-O)', severity: 'critical' },
  // ZIP/JAR: 50 4B 03 04 (كذلك ملفات Office OOXML)
  { bytes: [0x50, 0x4b, 0x03, 0x04], name: 'Archive (ZIP/JAR/OOXML)', severity: 'high' },
  // RAR: 52 61 72 21 1A 07
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], name: 'Archive (RAR)', severity: 'high' },
  // 7z: 37 7A BC AF 27 1C
  { bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], name: 'Archive (7z)', severity: 'high' },
  // RTF: 7B 5C 72 74 66
  { bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66], name: 'Rich Text Format (RTF)', severity: 'high' },
  // OLE2 (old Office): D0 CF 11 E0 A1 B1 1A E1
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], name: 'OLE2 (Office legacy)', severity: 'high' },
  // SVG (XML): 3C 3F 78 6D 6C  or  3C 73 76 67
  { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c], name: 'XML/SVG (scriptable)', severity: 'high' },
  { bytes: [0x3c, 0x73, 0x76, 0x67], name: 'SVG (scriptable)', severity: 'high' },
  // HTML: 3C 21 44 4F 43 54 59 50 45  or  3C 68 74 6D 6C
  { bytes: [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45], name: 'HTML document', severity: 'medium' },
  { bytes: [0x3c, 0x68, 0x74, 0x6d, 0x6c], name: 'HTML document', severity: 'medium' },
];

/** يستخرج الامتداد من اسم الملف (بأمان) */
function extractExtension(filename: string): string {
  const cleanName = filename.replace(/[^\w.\-]/g, '_');
  const lastDot = cleanName.lastIndexOf('.');
  if (lastDot < 0 || lastDot === cleanName.length - 1) return '';
  return cleanName.slice(lastDot + 1).toLowerCase();
}

/** يفحص تضارب Double Extension (مثال: file.pdf.exe) */
function detectDoubleExtension(filename: string): boolean {
  const cleanName = filename.replace(/[^\w.\-]/g, '_');
  const parts = cleanName.split('.');
  if (parts.length > 2) {
    const last = parts[parts.length - 1].toLowerCase();
    const beforeLast = parts[parts.length - 2].toLowerCase();
    if (ALLOWED_EXTENSIONS.image.includes(beforeLast) || ALLOWED_EXTENSIONS.pdf.includes(beforeLast)) {
      return true;
    }
    if (FORBIDDEN_EXTENSIONS.includes(last)) return true;
  }
  return false;
}

/** يفحص التوقيع السحري للملف */
function checkMagicBytes(buffer: Buffer): {
  matched: typeof MAGIC_BYTES[number] | null;
  dangerous: typeof DANGEROUS_MAGIC[number] | null;
} {
  // أولاً نبحث عن تواقيع خطرة
  for (const sig of DANGEROUS_MAGIC) {
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[i] !== sig.bytes[i]) { match = false; break; }
    }
    if (match) return { matched: null, dangerous: sig };
  }
  // ثم نبحث عن تواقيع مسموحة
  for (const sig of MAGIC_BYTES) {
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[i] !== sig.bytes[i]) { match = false; break; }
    }
    if (match) return { matched: sig, dangerous: null };
  }
  // فحص خاص لـ WebP: "RIFF"...."WEBP"
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { matched: { bytes: [], mime: 'image/webp', kind: 'image' }, dangerous: null };
  }
  return { matched: null, dangerous: null };
}

/**
 * الفحص الشامل للملف
 * @param buffer محتوى الملف
 * @param mimeType الـ MIME المُعلَن من العميل
 * @param originalName الاسم الأصلي
 * @param maxFileSizeMb الحد الأقصى للحجم بالميجابايت
 */
export async function validateUploadedFile(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  maxFileSizeMb: number = 5
): Promise<FileValidationResult> {
  const reasons: string[] = [];
  let severity: FileValidationResult['severity'] = 'info';
  const sizeBytes = buffer.length;
  const ext = extractExtension(originalName);

  // 1) فحص الحجم
  const maxBytes = maxFileSizeMb * 1024 * 1024;
  if (sizeBytes === 0) {
    return {
      valid: false, kind: null, mimeType, originalName, sizeBytes,
      reasons: ['الملف فارغ'], severity: 'low',
    };
  }
  if (sizeBytes > maxBytes) {
    return {
      valid: false, kind: null, mimeType, originalName, sizeBytes,
      reasons: [`حجم الملف ${sizeBytes} بايت يتجاوز الحد المسموح ${maxBytes} بايت (${maxFileSizeMb}MB)`],
      severity: 'low',
    };
  }

  // 2) فحص الاسم — Double Extension
  if (detectDoubleExtension(originalName)) {
    return {
      valid: false, kind: null, mimeType, originalName, sizeBytes,
      reasons: [`الاسم يحتوي امتداداً مزدوجاً مشبوهاً: ${originalName}`],
      severity: 'high',
    };
  }

  // 3) فحص الامتداد ضد القائمة السوداء
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return {
      valid: false, kind: null, mimeType, originalName, sizeBytes,
      reasons: [`الامتداد ".${ext}" ممنوع تماماً في الامتحانات`],
      severity: 'high',
    };
  }

  // 4) فحص Magic Bytes
  const magic = checkMagicBytes(buffer);
  if (magic.dangerous) {
    return {
      valid: false, kind: null, mimeType, originalName, sizeBytes,
      reasons: [
        `التوقيع السحري يطابق ملفاً خطيراً: ${magic.dangerous.name}`,
        `محاولة رفع ملف تنفيذي/أرشيفي ممنوعة`,
      ],
      severity: magic.dangerous.severity,
    };
  }

  // 5) مطابقة Magic Bytes مع المسموح
  if (!magic.matched) {
    reasons.push('التوقيع السحري للملف لا يطابق أي نوع مسموح به');
    return {
      valid: false, kind: null, mimeType, originalName, sizeBytes,
      reasons, severity: 'medium',
    };
  }

  // 6) التحقق من file-type library (طبقة إضافية)
  let detectedMime = magic.matched.mime;
  try {
    const ft = await fileTypeFromBuffer(buffer);
    if (ft) {
      detectedMime = ft.mime;
      if (!ALLOWED_MIME[magic.matched.kind].includes(ft.mime)) {
        return {
          valid: false, kind: null, mimeType: ft.mime, originalName, sizeBytes,
          reasons: [
            `file-type اكتشف MIME="${ft.mime}" لكنه غير مسموح`,
            `النوع المسموح للصور: ${ALLOWED_MIME.image.join(', ')}`,
            `النوع المسموح لـ PDF: ${ALLOWED_MIME.pdf.join(', ')}`,
          ],
          severity: 'medium',
        };
      }
    }
  } catch {
    // نعتمد على magic bytes في حال فشل file-type
  }

  // 7) مطابقة MIME المُعلَن مع المكتشف
  if (mimeType && mimeType !== detectedMime) {
    reasons.push(`تنبيه: MIME المُعلَن "${mimeType}" يختلف عن المكتشف "${detectedMime}" — سنثق بالمكتشف`);
  }

  return {
    valid: reasons.length === 0,
    kind: magic.matched.kind,
    mimeType: detectedMime,
    originalName,
    sizeBytes,
    reasons,
    severity,
  };
}

/** يولّد بصمة (hash) بسيطة للملف باستخدام crypto */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
