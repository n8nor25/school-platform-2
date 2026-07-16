/**
 * ============================================================
 *  مركز التحميل — ثوابت مشتركة
 *  ============================================================
 *  • قائمة التصنيفات المدعومة (مع التسمية العربية + المجلد)
 *  • أنواع الملفات المسموح بها + الحد الأقصى للحجم
 *  • دالة لتحويل الـ category إلى slug المجلد
 *  • دالة لتنظيف أسماء الملفات
 * ============================================================
 */

export const DOWNLOAD_CATEGORIES = [
  { value: "STUDENT_AFFAIRS", label: "شئون الطلاب", folder: "student-affairs", color: "#047857" },
  { value: "STAFF_AFFAIRS", label: "شئون العاملين", folder: "staff-affairs", color: "#1d4ed8" },
  { value: "FINANCIAL", label: "الشئون المالية", folder: "financial", color: "#b45309" },
  { value: "ADMINISTRATIVE", label: "إدارية", folder: "administrative", color: "#7c3aed" },
  { value: "GENERAL", label: "عام", folder: "general", color: "#475569" },
] as const;

export type DownloadCategory = (typeof DOWNLOAD_CATEGORIES)[number]["value"];

export const DOWNLOAD_CATEGORY_VALUES = DOWNLOAD_CATEGORIES.map((c) => c.value);

/** يُرجع معلومات التصنيف أو null */
export function getCategoryInfo(cat: string) {
  return DOWNLOAD_CATEGORIES.find((c) => c.value === cat) || null;
}

/** يُرجع label التصنيف أو القيمة كما هي */
export function getCategoryLabel(cat: string): string {
  return getCategoryInfo(cat)?.label || cat;
}

/** أنواع MIME المسموح بها + امتداداتها المقابلة */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/zip": [".zip"],
};

/** قائمة الامتدادات المسموح بها (للعرض) */
export const ALLOWED_EXTENSIONS = Array.from(
  new Set(Object.values(ALLOWED_MIME_TYPES).flat())
).sort();

/** الحد الأقصى لحجم الملف: 20 ميجابايت */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** التحقق من أن نوع الملف مسموح */
export function isAllowedMimeType(mime: string): boolean {
  return mime in ALLOWED_MIME_TYPES;
}

/** تنظيف اسم الملف: إزالة المسارات + الحروف الخطرة */
export function sanitizeFileName(name: string): string {
  // خذ الاسم الأخير فقط (لو فيه مسار)
  const base = name.split(/[/\\]/).pop() || name;
  // استبدل الحروف الخطرة
  return base
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** إنشاء اسم فريد للملف على القرص: timestamp + اسم نظيف */
export function generateUniqueFileName(originalName: string): string {
  const clean = sanitizeFileName(originalName);
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  // ابحث عن آخر نقطة لتحديد الامتداد
  const lastDot = clean.lastIndexOf(".");
  if (lastDot <= 0) return `${ts}_${rnd}_${clean}`;
  const name = clean.slice(0, lastDot);
  const ext = clean.slice(lastDot);
  return `${ts}_${rnd}_${name}${ext}`;
}

/** تحويل البايتات إلى نص عربي مقروء */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 بايت";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} جيجابايت`;
}

/** تحديد أيقونة نوع الملف (للعرض في الـ UI) */
export function getFileTypeIcon(fileName: string): "pdf" | "word" | "excel" | "powerpoint" | "image" | "archive" | "text" | "file" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "excel";
  if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "powerpoint";
  if (/\.(png|jpe?g|gif|webp)$/.test(lower)) return "image";
  if (lower.endsWith(".zip")) return "archive";
  if (lower.endsWith(".txt")) return "text";
  return "file";
}
