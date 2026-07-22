'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true
    setIsStandalone(standalone)

    if (standalone) return

    // Check for iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(ios)

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show prompt after a short delay so user sees the app first
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // If iOS, show the manual install instructions after a delay
    if (ios) {
      const timer = setTimeout(() => setShowPrompt(true), 5000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
    } catch (error) {
      console.error('Install prompt error:', error)
    }

    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    // Don't show again for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa-prompt-dismissed', 'true')
    }
  }, [])

  // Don't show if already in standalone mode or dismissed this session
  if (isStandalone) return null
  if (typeof window !== 'undefined' && sessionStorage.getItem('pwa-prompt-dismissed') === 'true') return null

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-96"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-l from-[#610000] to-[#8b1a1a] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">تثبيت التطبيق</h3>
                  <p className="text-white/70 text-xs">وصول سريع بدون متصفح</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {isIOS ? (
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    لإضافة التطبيق على جهازك:
                  </p>
                  <ol className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="bg-[#610000] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>اضغط على زر المشاركة <span className="inline-block">⬆️</span> في شريط المتصفح السفلي</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-[#610000] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>اختر &quot;إضافة إلى الشاشة الرئيسية&quot;</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-[#610000] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>اضغط &quot;إضافة&quot; لتأكيد التثبيت</span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    ثبّت التطبيق على جهازك للوصول السريع والعمل بدون اتصال بالإنترنت
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleInstallClick}
                      className="flex-1 bg-[#610000] hover:bg-[#8b1a1a] text-white gap-2"
                    >
                      <Download className="w-4 h-4" />
                      تثبيت التطبيق
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDismiss}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      لاحقاً
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
