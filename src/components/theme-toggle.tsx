'use client';

/**
 * ThemeToggle — زر تبديل الوضع الفاتح/الداكن
 * يستخدم next-themes ويظهر الأيقونة المناسبة.
 * متجاوب: يظهر على كل الأحجام.
 */

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // تجنّب عدم تطابق SSR: لا نُظهر الأيقونة الفعلية إلا بعد التحميل
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 ${className || ''}`}
    >
      {/* الشمس (يظهر في الوضع الفاتح) */}
      <Sun
        className={`h-5 w-5 transition-all duration-300 ${
          mounted && !isDark
            ? 'rotate-0 scale-100 opacity-100 text-amber-500'
            : 'rotate-90 scale-0 opacity-0'
        } absolute`}
      />
      {/* القمر (يظهر في الوضع الداكن) */}
      <Moon
        className={`h-5 w-5 transition-all duration-300 ${
          isDark
            ? 'rotate-0 scale-100 opacity-100 text-sky-300'
            : '-rotate-90 scale-0 opacity-0'
        } absolute`}
      />
      {/* placeholder قبل التحميل لمنع الاختلاف */}
      {!mounted && <span className="h-5 w-5" />}
    </Button>
  );
}
