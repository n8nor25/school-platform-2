/**
 * ============================================================
 *  Push Subscriptions Store — تخزين اشتراكات Push
 * ============================================================
 *  لأننا مقيّدون بعدم تعديل schema قاعدة البيانات،
 *  نخزّن اشتراكات Push في الذاكرة (Map) معpersist إلى ملف JSON
 *  للاحتفاظ بها عبر إعادة تشغيل خادم التطوير.
 *
 *  البنية:
 *    key = subscription.endpoint (فريد لكل جهاز/متصفح)
 *    value = {
 *      subscription,        // كائن PushSubscription الكامل
 *      schoolId,            // المدرسة
 *      parentPhone,         // هاتف ولي الأمر (للربط)
 *      studentNumbers,      // أرقام الطلاب المرتبطين
 *      createdAt,
 *      lastSeenAt,
 *    }
 * ============================================================
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface PushSubscriptionRecord {
  subscription: {
    endpoint: string;
    expirationTime: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  schoolId: string;
  parentPhone: string;
  studentNumbers: string[];
  createdAt: string;
  lastSeenAt: string;
}

const STORE_FILE = path.join(process.cwd(), '.push-subscriptions.json');

// Map في الذاكرة: key = endpoint
const store = new Map<string, PushSubscriptionRecord>();
let loaded = false;

/**
 * يحمّل الاشتراكات من ملف JSON (مرة واحدة عند أول استخدام).
 */
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf-8');
    const arr: PushSubscriptionRecord[] = JSON.parse(raw);
    for (const rec of arr) {
      store.set(rec.subscription.endpoint, rec);
    }
    console.log(`[push-store] Loaded ${store.size} subscription(s) from disk`);
  } catch {
    // الملف غير موجود أو تالف — نبدأ بذاكرة فارغة
  }
}

/**
 * يحفظ الذاكرة إلى ملف JSON (debounced بشكل ضمني — نكتب فوراً).
 */
async function persist(): Promise<void> {
  try {
    const arr = Array.from(store.values());
    await fs.writeFile(STORE_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[push-store] Failed to persist subscriptions:', err);
  }
}

/**
 * يضيف/يحدّث اشتراكاً.
 */
export async function addSubscription(rec: Omit<PushSubscriptionRecord, 'createdAt' | 'lastSeenAt'>): Promise<void> {
  await ensureLoaded();
  const now = new Date().toISOString();
  const existing = store.get(rec.subscription.endpoint);
  store.set(rec.subscription.endpoint, {
    ...rec,
    createdAt: existing?.createdAt || now,
    lastSeenAt: now,
  });
  await persist();
}

/**
 * يزيل اشتراكاً (عند إلغاء الاشتراك أو انتهاء صلاحيته).
 */
export async function removeSubscription(endpoint: string): Promise<void> {
  await ensureLoaded();
  if (store.delete(endpoint)) {
    await persist();
  }
}

/**
 * يرجع كل الاشتراكات لمدرسة معيّنة.
 */
export async function getSubscriptionsBySchool(schoolId: string): Promise<PushSubscriptionRecord[]> {
  await ensureLoaded();
  return Array.from(store.values()).filter((r) => r.schoolId === schoolId);
}

/**
 * يرجع اشتراكات ولي أمر معيّن (عبر هاتفه) — لإرسال إشعارات مستهدفة.
 */
export async function getSubscriptionsByParentPhone(
  schoolId: string,
  parentPhone: string,
): Promise<PushSubscriptionRecord[]> {
  await ensureLoaded();
  // في وضع الاختبار (هاتف يبدأ بـ test-) نرجع كل اشتراكات المدرسة
  if (parentPhone.startsWith('test-')) {
    return getSubscriptionsBySchool(schoolId);
  }
  return Array.from(store.values()).filter(
    (r) => r.schoolId === schoolId && r.parentPhone === parentPhone,
  );
}

/**
 * يرجع اشتراكات مرتبطة برقم طالب معيّن.
 */
export async function getSubscriptionsByStudentNumber(
  schoolId: string,
  studentNumber: string,
): Promise<PushSubscriptionRecord[]> {
  await ensureLoaded();
  return Array.from(store.values()).filter(
    (r) => r.schoolId === schoolId && r.studentNumbers.includes(studentNumber),
  );
}

/**
 * ينظّف الاشتراكات المنتهية الصلاحية (endpoint يعيد 404/410).
 */
export async function purgeInvalidEndpoint(endpoint: string): Promise<void> {
  await removeSubscription(endpoint);
}

/**
 * إحصائيات سريعة (للتشخيص).
 */
export async function getStoreStats(): Promise<{ total: number; bySchool: Record<string, number> }> {
  await ensureLoaded();
  const bySchool: Record<string, number> = {};
  for (const rec of store.values()) {
    bySchool[rec.schoolId] = (bySchool[rec.schoolId] || 0) + 1;
  }
  return { total: store.size, bySchool };
}
