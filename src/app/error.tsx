'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-m3-surface" dir="rtl">
      <div className="text-center p-8">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-red-600 text-3xl">error</span>
        </div>
        <h2 className="text-xl font-bold text-m3-on-surface mb-2">حدث خطأ ما</h2>
        <p className="text-m3-on-surface-variant mb-6 text-sm">عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.</p>
        <Button
          onClick={reset}
          className="bg-m3-primary hover:bg-m3-primary-container text-m3-on-primary"
        >
          إعادة المحاولة
        </Button>
      </div>
    </div>
  )
}
