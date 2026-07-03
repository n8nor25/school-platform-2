/**
 * ============================================================
 *  نظام الإشعارات — Helper Functions
 *  ============================================================
 *  يبني إشعارات مشتقة من البيانات الموجودة (بدون جدول إشعارات):
 *    • لأولياء الأمور: امتحانات منشورة لأبنائهم، نتائج مصححة، تسليمات، تظلمات
 *    • للمعلمين: تسليمات جديدة، تظلمات، امتحانات تنتهي قريباً
 *    • للطلاب: امتحانات متاحة، نتائج مصححة، امتحانات قادمة
 *
 *  ملاحظة: حالة "المقروء" تُحفظ في localStorage على جانب العميل
 *  (لا حاجة لتعديل قاعدة البيانات).
 * ============================================================
 */

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationType =
  | 'exam_published'      // امتحان جديد منشور
  | 'exam_upcoming'       // امتحان قادم خلال 24 ساعة
  | 'exam_ending'         // امتحان ينتهي قريباً
  | 'sub_started'         // بدأ الطالب امتحاناً
  | 'sub_submitted'       // سلّم الطالب امتحاناً
  | 'sub_graded'          // تم تصحيح نتيجة
  | 'sub_auto_closed'     // إغلاق تلقائي
  | 'appeal_new'          // تظلم جديد
  | 'appeal_resolved'     // تظلم تم حسمه
  | 'violation_flagged';  // انتهاك مراقبة

export interface AppNotification {
  /** معرّف deterministic (لتمييز المقروء في localStorage) */
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** ISO date string */
  timestamp: string;
  severity: NotificationSeverity;
  /** رابط اختياري للانتقال عند النقر */
  link?: string;
  /** بيانات إضافية للواجهة */
  metadata?: Record<string, any>;
}

/** أيقونة مقترحة لكل نوع (تُستخدم في الواجهة) */
export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  exam_published: 'FileCheck2',
  exam_upcoming: 'Clock',
  exam_ending: 'Timer',
  sub_started: 'PlayCircle',
  sub_submitted: 'Send',
  sub_graded: 'CheckCircle2',
  sub_auto_closed: 'Lock',
  appeal_new: 'AlertCircle',
  appeal_resolved: 'Scale',
  violation_flagged: 'ShieldAlert',
};

/** لون accent لكل نوع */
export const NOTIFICATION_COLOR: Record<NotificationType, string> = {
  exam_published: '#16a34a',  // green
  exam_upcoming: '#2563eb',   // blue
  exam_ending: '#dc2626',     // red
  sub_started: '#0891b2',     // cyan
  sub_submitted: '#7c3aed',   // violet
  sub_graded: '#16a34a',      // green
  sub_auto_closed: '#ea580c', // orange
  appeal_new: '#ca8a04',      // amber
  appeal_resolved: '#0891b2', // cyan
  violation_flagged: '#dc2626', // red
};

/** ينسّق التاريخ نسبياً بالعربية (منذ X) */
export function formatRelativeArabic(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  if (diffDay === 1) return 'أمس';
  if (diffDay < 7) return `منذ ${diffDay} أيام`;
  if (diffDay < 30) return `منذ ${Math.floor(diffDay / 7)} أسابيع`;
  return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

/** يبني نص النسبة المئوية بأمان */
export function pctText(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined || isNaN(percentage)) return '';
  return `${Math.round(percentage)}%`;
}

/** يبني نص حالة النجاح/الرسوب */
export function passText(passed: boolean | null | undefined): string {
  if (passed === null || passed === undefined) return '';
  return passed ? 'ناجح' : 'دور ثانٍ';
}
