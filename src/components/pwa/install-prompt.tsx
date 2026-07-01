'use client';

/**
 * ============================================================
 *  PWA Install Prompt — زر تثبيت التطبيق
 * ============================================================
 *  يظهر زر "تثبيت التطبيق" عند توفّر حدث beforeinstallprompt
 *  (أي عندما يعتبر المتصفح التطبيق قابلاً للتثبيت).
 *
 *  بعد التثبيت، يختفي الزر تلقائياً.
 *  إذا رفض المستخدم، لا يظهر مجدداً لمدة 7 أيام.
 * ============================================================
 */

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 أيام

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // التحقق إن كان التطبيق مثبّتاً بالفعل
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkInstalled()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        if (Date.now() - dismissedTime < DISMISS_DURATION) {
          return;
        }
      }

      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      } else {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
      }
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
    } finally {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (isInstalled || !showBanner || !deferredPrompt) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9998] w-[min(94vw,420px)]"
      style={{ animation: 'pwaSlideUp 0.3s ease' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-l from-[#610000] to-[#8B0000]" />

        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#610000] to-[#8B0000] flex items-center justify-center shadow-lg">
              <Smartphone className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                ثبّت التطبيق على جهازك
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-relaxed">
                وصول سريع مباشرة من الشاشة الرئيسية، يعمل بدون إنترنت
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 bg-[#610000] hover:bg-[#7a0000] text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              تثبيت الآن
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
