'use client';

/**
 * ============================================================
 *  usePushNotifications — إدارة اشتراك Push Notifications
 * ============================================================
 *  Hook يعمل مع Service Worker لإدارة:
 *    - فحص دعم المتصفح للإشعارات
 *    - طلب إذن الإشعارات من المستخدم
 *    - الاشتراك في Push (pushManager.subscribe)
 *    - إرسال الاشتراك للخادم (POST /api/push/subscribe)
 *    - إلغاء الاشتراك (POST /api/push/unsubscribe)
 *    - فحص حالة الاشتراك الحالية
 *    - إرسال إشعار تجريبي للتحقق
 *
 *  الاستخدام:
 *    const push = usePushNotifications({ schoolId, parentPhone, studentNumbers })
 *    <button onClick={push.subscribe} disabled={!push.supported}>...</button>
 * ============================================================
 */

import { useCallback, useEffect, useState } from 'react';

interface UsePushOptions {
  schoolId?: string;
  parentPhone?: string;
  studentNumbers?: string[];
}

interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  subscriptionEndpoint: string | null;
  loading: boolean;
  error: string | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications({
  schoolId,
  parentPhone,
  studentNumbers = [],
}: UsePushOptions) {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: 'unsupported',
    subscribed: false,
    subscriptionEndpoint: null,
    loading: true,
    error: null,
  });

  // فحص الدعم + الإذن الحالي (مؤجَّل لتجنّب تحذير set-state-in-effect)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!supported) {
      setTimeout(() => {
        setState({
          supported: false,
          permission: 'unsupported',
          subscribed: false,
          subscriptionEndpoint: null,
          loading: false,
          error: null,
        });
      }, 0);
      return;
    }

    setTimeout(() => {
      setState((s) => ({ ...s, supported: true, permission: Notification.permission }));
    }, 0);
  }, []);

  // فحص حالة الاشتراك الحالية عند تحميل المكوّن
  const checkSubscription = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      // نؤجّل setState لتجنّب تحذير set-state-in-effect
      setTimeout(() => {
        setState((s) => ({
          ...s,
          loading: false,
          subscribed: !!existing,
          subscriptionEndpoint: existing ? existing.endpoint : null,
          permission: Notification.permission,
        }));
      }, 0);
    } catch {
      setTimeout(() => {
        setState((s) => ({
          ...s,
          loading: false,
          error: 'فشل فحص حالة الاشتراك',
        }));
      }, 0);
    }
  }, []);

  useEffect(() => {
    // checkSubscription دالة async، setState داخلها غير متزامن في الـ effect
    void checkSubscription();
  }, [checkSubscription]);

  // الاشتراك في Push
  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!schoolId || !parentPhone) {
      setState((s) => ({ ...s, error: 'بيانات المدرسة وولي الأمر مطلوبة' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // 1. طلب إذن الإشعارات
      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        setState((s) => ({
          ...s,
          loading: false,
          permission,
          error: 'تم رفض إذن الإشعارات. فعّله من إعدادات المتصفح.',
        }));
        return { success: false, error: 'permission_denied' as const };
      }

      // 2. جلب مفتاح VAPID العام
      const vapidRes = await fetch('/api/push/vapid-public');
      if (!vapidRes.ok) throw new Error('فشل جلب مفتاح VAPID');
      const { publicKey } = await vapidRes.json();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 3. الاشتراك عبر pushManager
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 4. إرسال الاشتراك للخادم
      const subObj = subscription.toJSON();
      const subscribeRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subObj,
          schoolId,
          parentPhone,
          studentNumbers,
        }),
      });

      if (!subscribeRes.ok) throw new Error('فشل حفظ الاشتراك في الخادم');

      setState((s) => ({
        ...s,
        loading: false,
        subscribed: true,
        subscriptionEndpoint: subscription.endpoint,
        permission: 'granted',
        error: null,
      }));

      return { success: true as const, endpoint: subscription.endpoint };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل الاشتراك';
      setState((s) => ({ ...s, loading: false, error: message }));
      return { success: false as const, error: message };
    }
  }, [schoolId, parentPhone, studentNumbers]);

  // إلغاء الاشتراك
  const unsubscribe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        // إعلام الخادم
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState((s) => ({
        ...s,
        loading: false,
        subscribed: false,
        subscriptionEndpoint: null,
      }));
      return { success: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل إلغاء الاشتراك';
      setState((s) => ({ ...s, loading: false, error: message }));
      return { success: false as const, error: message };
    }
  }, []);

  // إرسال إشعار تجريبي
  const sendTest = useCallback(async () => {
    if (!schoolId || !parentPhone) return;
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, parentPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false as const, error: data.error || 'فشل الإرسال' };
      }
      return { success: true as const, result: data.result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'فشل الإرسال';
      return { success: false as const, error: message };
    }
  }, [schoolId, parentPhone]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendTest,
    refresh: checkSubscription,
  };
}
