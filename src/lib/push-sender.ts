/**
 * ============================================================
 *  Push Sender — إرسال إشعارات Push فعلية
 * ============================================================
 *  يُغلّف web-push.sendNotification مع:
 *    - معالجة الأخطاء (404/410 = اشتراك منتهٍ → نحذفه)
 *    - إرسال جماعي متوازي (مع حد لتجنّب إرهاق الشبكة)
 *    - payload موحّد (title, body, icon, badge, tag, data, url)
 * ============================================================
 */

import { webPush, configureWebPush } from './push-config';
import {
  getSubscriptionsByParentPhone,
  getSubscriptionsByStudentNumber,
  getSubscriptionsBySchool,
  purgeInvalidEndpoint,
  type PushSubscriptionRecord,
} from './push-store';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  url?: string; // يُفتح عند النقر على الإشعار
  requireInteraction?: boolean;
  silent?: boolean;
}

interface SendResult {
  sent: number;
  failed: number;
  purged: number;
}

/**
 * يرسل إشعاراً واحداً لاشتراك واحد. يرجع true عند النجاح.
 * يحذف الاشتراكات المنتهية تلقائياً.
 */
async function sendToOne(rec: PushSubscriptionRecord, payload: PushPayload): Promise<'ok' | 'failed' | 'purged'> {
  configureWebPush();
  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || 'school-notification',
    data: {
      url: payload.url || '/',
      ...payload.data,
    },
    requireInteraction: payload.requireInteraction ?? false,
    silent: payload.silent ?? false,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
  });

  try {
    await webPush.sendNotification(rec.subscription, notificationPayload, {
      TTL: 60 * 60 * 24, // يوم واحد
      urgency: payload.silent ? 'normal' : 'high',
      topic: payload.tag,
    });
    return 'ok';
  } catch (err: unknown) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404 || e.statusCode === 410) {
      // الاشتراك لم يعد صالحاً
      await purgeInvalidEndpoint(rec.subscription.endpoint);
      return 'purged';
    }
    console.warn('[push-sender] Send failed:', e.statusCode, (err as Error)?.message);
    return 'failed';
  }
}

/**
 * يرسل إشعاراً لكل اشتراكات ولي أمر معيّن.
 */
export async function sendToParent(
  schoolId: string,
  parentPhone: string,
  payload: PushPayload,
): Promise<SendResult> {
  const subs = await getSubscriptionsByParentPhone(schoolId, parentPhone);
  return sendToAll(subs, payload);
}

/**
 * يرسل إشعاراً لكل الاشتراكات المرتبطة برقم طالب (أولياء أموره).
 */
export async function sendToStudentParents(
  schoolId: string,
  studentNumber: string,
  payload: PushPayload,
): Promise<SendResult> {
  const subs = await getSubscriptionsByStudentNumber(schoolId, studentNumber);
  return sendToAll(subs, payload);
}

/**
 * يرسل إشعاراً لكل مشتركي مدرسة (بث عام).
 */
export async function sendToSchool(schoolId: string, payload: PushPayload): Promise<SendResult> {
  const subs = await getSubscriptionsBySchool(schoolId);
  return sendToAll(subs, payload);
}

/**
 * إرسال جماعي متوازي (مع حد تزامن = 10).
 */
async function sendToAll(subs: PushSubscriptionRecord[], payload: PushPayload): Promise<SendResult> {
  if (subs.length === 0) return { sent: 0, failed: 0, purged: 0 };

  let sent = 0;
  let failed = 0;
  let purged = 0;

  const CONCURRENCY = 10;
  for (let i = 0; i < subs.length; i += CONCURRENCY) {
    const batch = subs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((s) => sendToOne(s, payload)));
    for (const r of results) {
      if (r === 'ok') sent++;
      else if (r === 'purged') purged++;
      else failed++;
    }
  }

  return { sent, failed, purged };
}
