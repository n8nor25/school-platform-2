/**
 * ============================================================
 *  Push Notifications — إعداد VAPID + web-push
 * ============================================================
 *  مفاتيح VAPID تُولَّد مرة واحدة وتُخزَّن في .env.
 *  المفتاح العام يُرسَل للعميل للاشتراك، والخاص يُستخدَم
 *  لتوقيع طلبات الإرسال إلى خدمات Push (FCM/APNS/Mozilla).
 *
 *  في بيئة التطوير: إذا لم تُضبط مفاتيح VAPID في .env،
 *  نستخدم مفاتيح احتياطية مثبّتة (للتطوير فقط).
 * ============================================================
 */

import webPush from 'web-push';

// مفاتيح VAPID احتياطية للبيئة التطويرية (مولّدة مسبقاً)
const FALLBACK_PUBLIC_KEY =
  'BOODV-GTssHxrIs3CJN919BQdVdNg7hD-VLOC35RDNsJYhRrU_K9-3_RP-2cZwNmVGkaRVx4T6MmXWI97D8iPYE';
const FALLBACK_PRIVATE_KEY = 'Eo-VEBewLRTEu4I5clqislDwm3el-qelDowu8tvc4Jc';

export const VAPID_PUBLIC_KEY: string =
  process.env.VAPID_PUBLIC_KEY || FALLBACK_PUBLIC_KEY;

export const VAPID_PRIVATE_KEY: string =
  process.env.VAPID_PRIVATE_KEY || FALLBACK_PRIVATE_KEY;

export const VAPID_SUBJECT: string =
  process.env.VAPID_SUBJECT || 'mailto:admin@school-platform.edu';

let configured = false;

/**
 * يُهيّئ web-push بمفاتيح VAPID (يُستدعى مرة واحدة).
 */
export function configureWebPush(): void {
  if (configured) return;
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

/**
 * يحوّل المفتاح العام من base64url إلى Uint8Array —
 * مطلوب لـ `pushManager.subscribe({ applicationServerKey })`.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = Buffer.from(base64, 'base64');
  return new Uint8Array(rawData);
}

export { webPush };
