/**
 * Helper لإطلاق حدث "تحديث الإشعارات" العالمي.
 * استدعِ هذه الدالة بعد أي إجراء ينشئ إشعاراً جديداً:
 *   - تسليم امتحان
 *   - تصحيح درجة
 *   - إنشاء/حسم تظلم
 *   - نشر امتحان
 *
 * كل مكوّنات NotificationCenter المركّبة ستسمع هذا الحدث وتُعيد جلب الإشعارات فوراً.
 */
export function refreshNotifications(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('notifications:refresh'));
}
