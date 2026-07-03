'use client';

/**
 * ============================================================
 *  PushNotificationsButton — زر تفعيل/إيقاف إشعارات Push
 * ============================================================
 *  زر يعرض حالة الإشعارات ويتيح للمستخدم:
 *    - تفعيل الإشعارات (طلب الإذن + الاشتراك)
 *    - إيقاف الإشعارات (إلغاء الاشتراك)
 *    - إرسال إشعار تجريبي (للتحقق)
 *
 *  الحالات:
 *    - غير مدعوم: زر معطّل مع tooltip
 *    - إذن غير ممنوح: زر "تفعيل الإشعارات"
 *    - مشترك: زر "الإشعارات مفعّلة" + قائمة (تجريبي/إيقاف)
 *    - تحميل: spinner
 *
 *  الاستخدام:
 *    <PushNotificationsButton
 *      schoolId={session.schoolId}
 *      parentPhone={session.parentPhone}
 *      studentNumbers={[selectedChild.studentNumber]}
 *    />
 * ============================================================
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Send, Check, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface PushNotificationsButtonProps {
  schoolId: string;
  parentPhone: string;
  studentNumbers?: string[];
  variant?: 'icon' | 'full';
}

export function PushNotificationsButton({
  schoolId,
  parentPhone,
  studentNumbers = [],
  variant = 'icon',
}: PushNotificationsButtonProps) {
  const push = usePushNotifications({ schoolId, parentPhone, studentNumbers });
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  // منع SSR mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-label="إشعارات"
      >
        <Bell className="w-4 h-4 text-gray-400" />
      </button>
    );
  }

  // غير مدعوم
  if (!push.supported) {
    return (
      <button
        type="button"
        disabled
        title="متصفحك لا يدعم الإشعارات"
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed"
        aria-label="الإشعارات غير مدعومة"
      >
        <BellOff className="w-4 h-4" />
      </button>
    );
  }

  // أثناء التحميل
  if (push.loading && !push.subscribed) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800"
        aria-label="جاري التحقق"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    );
  }

  // مشترك — قائمة منسدلة بخيارات
  if (push.subscribed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60 transition-colors"
            aria-label="الإشعارات مفعّلة"
            title="الإشعارات مفعّلة"
          >
            <BellRing className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Check className="w-4 h-4" />
            الإشعارات مفعّلة
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              toast.loading('جاري إرسال إشعار تجريبي...', { id: 'test-push' });
              const res = await push.sendTest();
              toast.dismiss('test-push');
              if (res.success) {
                toast.success('تم إرسال إشعار تجريبي! تحقق من جهازك.');
              } else {
                toast.error(res.error || 'لم يتم الإرسال — تأكد أن المتصفح في المقدمة');
              }
            }}
          >
            <Send className="w-4 h-4 ml-2" />
            <span>إرسال إشعار تجريبي</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-700 dark:text-red-400"
            onClick={async () => {
              const res = await push.unsubscribe();
              if (res.success) {
                toast.success('تم إيقاف الإشعارات');
              } else {
                toast.error(res.error || 'فشل إيقاف الإشعارات');
              }
            }}
          >
            <BellOff className="w-4 h-4 ml-2" />
            <span>إيقاف الإشعارات</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // غير مشترك — زر تفعيل
  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={async () => {
          toast.loading('جاري تفعيل الإشعارات...', { id: 'enable-push' });
          const res = await push.subscribe();
          toast.dismiss('enable-push');
          if (res.success) {
            toast.success('تم تفعيل الإشعارات بنجاح! ستصلك تنبيهات الحضور والغياب.');
          } else if ('error' in res && res.error === 'permission_denied') {
            toast.error('تم رفض إذن الإشعارات. فعّله من إعدادات المتصفح.');
          } else {
            toast.error('فشل تفعيل الإشعارات');
          }
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-l from-[#610000] to-[#8B0000] text-white text-sm font-bold hover:shadow-lg transition-shadow"
      >
        <Bell className="w-4 h-4" />
        تفعيل الإشعارات
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        toast.loading('جاري تفعيل الإشعارات...', { id: 'enable-push' });
        const res = await push.subscribe();
        toast.dismiss('enable-push');
        if (res.success) {
          toast.success('تم تفعيل الإشعارات بنجاح!');
        } else if ('error' in res && res.error === 'permission_denied') {
          toast.error('تم رفض إذن الإشعارات. فعّله من إعدادات المتصفح.');
        } else {
          toast.error('فشل تفعيل الإشعارات');
        }
      }}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors relative"
      aria-label="تفعيل الإشعارات"
      title="فعّل إشعارات Push"
    >
      <Bell className="w-4 h-4" />
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-gray-900 animate-pulse" />
    </button>
  );
}
