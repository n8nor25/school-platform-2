'use client';

/**
 * ============================================================
 *  PWA Service Worker Registration
 * ============================================================
 *  يسجّل service worker عند تحميل الصفحة لإتاحة:
 *    - التخزين المؤقت (offline support)
 *    - التثبيت كتطبيق (installable)
 *    - الإشعارات push (مستقبلاً)
 *
 *  كما يتعامل مع تحديث SW:
 *    - عند توفّر نسخة جديدة، يُظهر رسالة للمستخدم
 *    - المستخدم يختار التحديث الآن أو لاحقاً
 * ============================================================
 */

import { useEffect, useState } from 'react';

export function RegisterSW() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        setRegistration(reg);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        // فحص تحديثات كل ساعة
        setInterval(() => {
          reg.update().catch(() => {});
        }, 60 * 60 * 1000);
      } catch (err) {
        console.warn('[PWA] SW registration failed:', err);
      }
    };

    register();

    const handleOnline = () => {
      navigator.serviceWorker.getRegistration()?.then((reg) => reg?.update().catch(() => {}));
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const applyUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  useEffect(() => {
    if (!updateAvailable) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes pwaSlideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(styleEl);

    const toast = document.createElement('div');
    toast.dir = 'rtl';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a2e;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: 'Cairo', sans-serif;
      font-size: 14px;
      max-width: 90vw;
      animation: pwaSlideUp 0.3s ease;
    `;

    toast.innerHTML = `
      <span>✨ يتوفر إصدار جديد من التطبيق</span>
      <button id="pwa-update-btn" style="
        background: #610000;
        color: white;
        border: none;
        padding: 8px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        font-weight: 700;
        font-size: 13px;
        white-space: nowrap;
      ">تحديث</button>
      <button id="pwa-dismiss-btn" style="
        background: transparent;
        color: #aaa;
        border: none;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
      ">×</button>
    `;

    document.body.appendChild(toast);

    document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
      toast.remove();
      styleEl.remove();
      applyUpdate();
    });
    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
      toast.remove();
      styleEl.remove();
      setUpdateAvailable(false);
    });

    return () => {
      toast.remove();
      styleEl.remove();
    };
  }, [updateAvailable, registration]);

  return null;
}
