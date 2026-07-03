'use client';

/**
 * ============================================================
 *  NotificationCenter — مركز الإشعارات
 *  ============================================================
 *  جرس بنقطة حمراء (badge) + لوحة منسدلة تعرض الإشعارات.
 *
 *  المميزات:
 *    • badge يعرض عدد الإشعارات غير المقروءة
 *    • لوحة منسدلة مع قائمة الإشعارات (max-h مع scroll)
 *    • تمييز المقروء/غير المقروء عبر localStorage (by notification.id)
 *    • زر "تعليم الكل كمقروء"
 *    • تحديث تلقائي كل 60 ثانية + زر تحديث يدوي
 *    • حالات: loading skeleton, empty, error, list
 *    • ألوان accent لكل نوع إشعار
 *
 *  الاستخدام:
 *    <NotificationCenter
 *      role="parent"
 *      schoolId={schoolId}
 *      authParams={{ parentId, parentName }}
 *      accentColor="#047857"
 *    />
 * ============================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, X, Check, CheckCheck, RefreshCw, BellOff, AlertCircle,
  FileCheck2, Clock, Timer, PlayCircle, Send, CheckCircle2,
  Lock, Scale, ShieldAlert, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type AppNotification,
  type NotificationType,
  formatRelativeArabic,
} from '@/app/api/notifications/_helpers';

interface NotificationCenterProps {
  role: 'parent' | 'teacher' | 'student';
  schoolId: string;
  /** معاملات المصادقة الإضافية (parentId/parentName, teacherId/teacherName, studentId/studentName) */
  authParams: Record<string, string>;
  /** لون الـ accent للجرس والـ badge */
  accentColor?: string;
  /** حجم الأيقونة */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// خريطة الأيقونات
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileCheck2, Clock, Timer, PlayCircle, Send, CheckCircle2,
  Lock, AlertCircle, Scale, ShieldAlert,
  BellOff,
};

// خريطة الألوان
const COLOR_MAP: Record<NotificationType, string> = {
  exam_published: '#16a34a',
  exam_upcoming: '#2563eb',
  exam_ending: '#dc2626',
  sub_started: '#0891b2',
  sub_submitted: '#7c3aed',
  sub_graded: '#16a34a',
  sub_auto_closed: '#ea580c',
  appeal_new: '#ca8a04',
  appeal_resolved: '#0891b2',
  violation_flagged: '#dc2626',
};

const SEVERITY_BG: Record<string, string> = {
  info: 'bg-blue-50',
  success: 'bg-green-50',
  warning: 'bg-amber-50',
  error: 'bg-red-50',
};

const REFRESH_INTERVAL_MS = 30_000; // 30 ثانية — تحديث أسرع
const POLL_INTERVAL_OPEN_MS = 15_000; // 15 ثانية عندما اللوحة مفتوحة

export default function NotificationCenter({
  role,
  schoolId,
  authParams,
  accentColor = '#047857',
  size = 'md',
  className,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const storageKey = `notifications:read:${role}:${authParams.parentId || authParams.teacherId || authParams.studentId || 'anon'}`;

  // تحميل المقروء من localStorage — عبر lazy initializer (يتجدد عند remount عبر key prop)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      // تجاهل
    }
    return new Set();
  });

  // حفظ المقروء في localStorage
  const persistReadIds = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(ids).slice(-200)));
    } catch {
      // تجاهل (قد يكون localStorage ممتلئاً)
    }
  }, [storageKey]);

  // جلب الإشعارات
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // كل المعاملات في query string (تجنّب أحرف عربية في HTTP headers)
      const params = new URLSearchParams({
        role,
        schoolId,
        ...authParams,
      });
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success) {
        setNotifications(json.notifications || []);
        setLastFetchAt(new Date());
      } else {
        setError(json.error || 'فشل جلب الإشعارات');
      }
    } catch (e: any) {
      // في حالة الخطأ لا نعرض رسالة مزعجة — نحافظ على الإشعارات السابقة
      setError('تعذّر تحديث الإشعارات');
    } finally {
      setLoading(false);
    }
  }, [role, schoolId, authParams]);

  // جلب أولي + تحديث دوري — يجلب دائماً (سواء اللوحة مفتوحة أم لا)
  // الفاصل: 30s عند الإغلاق، 15s عند الفتح (لعرض الإشعارات الجديدة فوراً)
  useEffect(() => {
    // جلب أولي (مجدول خارج effect body لتجنّب تحذير setState-in-effect)
    const t = setTimeout(() => fetchNotifications(), 0);
    const interval = setInterval(() => {
      fetchNotifications();
    }, open ? POLL_INTERVAL_OPEN_MS : REFRESH_INTERVAL_MS);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // إعادة الجلب فوراً عند فتح اللوحة (لعرض أحدث إشعارات)
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // الاستماع لأحداث "تحديث الإشعارات" العالمية — تُطلق بعد إجراءات مثل:
  // تسليم امتحان، تصحيح، تظلم، إلخ.
  useEffect(() => {
    const handler = () => fetchNotifications();
    window.addEventListener('notifications:refresh', handler);
    return () => window.removeEventListener('notifications:refresh', handler);
  }, [fetchNotifications]);

  // إغلاق اللوحة عند النقر خارجها
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  // عدد غير المقروء
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  // تعليم إشعار كمقروء
  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, [persistReadIds]);

  // تعليم الكل كمقروء
  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      persistReadIds(next);
      return next;
    });
  }, [notifications, persistReadIds]);

  // النقر على إشعار
  const handleNotificationClick = useCallback((n: AppNotification) => {
    markAsRead(n.id);
    // لا نغلق اللوحة تلقائياً — قد يريد المستخدم رؤية إشعارات أخرى
  }, [markAsRead]);

  const sizeClasses = {
    sm: { bell: 'w-4 h-4', btn: 'w-8 h-8', badge: 'w-4 h-4 text-[9px]' },
    md: { bell: 'w-5 h-5', btn: 'w-10 h-10', badge: 'w-5 h-5 text-[10px]' },
    lg: { bell: 'w-6 h-6', btn: 'w-12 h-12', badge: 'w-6 h-6 text-[11px]' },
  }[size];

  return (
    <div className={cn('relative', className)}>
      {/* زر الجرس */}
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative rounded-full flex items-center justify-center transition-all',
          'hover:bg-black/5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1',
          sizeClasses.btn
        )}
        style={{ color: accentColor }}
        aria-label="الإشعارات"
        aria-expanded={open}
      >
        <Bell className={sizeClasses.bell} />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 rounded-full bg-red-500 text-white font-bold flex items-center justify-center ring-2 ring-white',
              sizeClasses.badge
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {unreadCount > 0 && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-400/30 pointer-events-none" />
        )}
      </button>

      {/* اللوحة المنسدلة */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            'absolute left-0 mt-2 w-[min(92vw,380px)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50',
            'flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150'
          )}
          role="dialog"
          aria-label="لوحة الإشعارات"
        >
          {/* رأس اللوحة */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-l from-gray-50 to-white">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="text-sm font-bold text-gray-900">الإشعارات</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 hover:bg-red-100">
                  {unreadCount} جديد
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchNotifications}
                disabled={loading}
                className="h-7 w-7 p-0"
                title="تحديث"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-7 w-7 p-0"
                title="إغلاق"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* شريط أدوات */}
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-50 bg-gray-50/50">
              <span className="text-[11px] text-gray-500">
                {lastFetchAt && `آخر تحديث: ${formatRelativeArabic(lastFetchAt)}`}
              </span>
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-medium hover:underline flex items-center gap-1"
                style={{ color: accentColor }}
              >
                <CheckCheck className="w-3 h-3" />
                تعليم الكل كمقروء
              </button>
            </div>
          )}

          {/* المحتوى */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Loading */}
            {loading && notifications.length === 0 && (
              <div className="p-6 text-center">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-gray-400" />
                <p className="text-xs text-gray-500">جارٍ تحميل الإشعارات...</p>
              </div>
            )}

            {/* Error مع بيانات سابقة */}
            {error && notifications.length === 0 && !loading && (
              <div className="p-6 text-center">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-400" />
                <p className="text-xs text-gray-600 mb-3">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchNotifications}>
                  <RefreshCw className="w-3 h-3 ml-1" />
                  إعادة المحاولة
                </Button>
              </div>
            )}

            {/* Empty */}
            {!loading && notifications.length === 0 && !error && (
              <div className="p-8 text-center">
                <BellOff className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium text-gray-700 mb-1">لا توجد إشعارات</p>
                <p className="text-xs text-gray-400">ستظهر هنا آخر التحديثات على امتحاناتك</p>
              </div>
            )}

            {/* List */}
            {notifications.length > 0 && (
              <ul className="divide-y divide-gray-50">
                {notifications.map((n) => {
                  const isUnread = !readIds.has(n.id);
                  const Icon = ICON_MAP[n.type] || Bell;
                  const color = COLOR_MAP[n.type] || accentColor;
                  return (
                    <li
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        'px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors relative',
                        isUnread && SEVERITY_BG[n.severity]
                      )}
                    >
                      {/* شريط جانبي ملوّن للإشعارات غير المقروءة */}
                      {isUnread && (
                        <span
                          className="absolute right-0 top-0 bottom-0 w-1"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <div className="flex items-start gap-2.5">
                        {/* أيقونة */}
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        {/* المحتوى */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-[13px] leading-snug', isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700')}>
                              {n.title}
                            </p>
                            {isUnread && (
                              <span className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: color }} />
                            )}
                          </div>
                          <p className={cn('text-xs leading-relaxed mt-0.5', isUnread ? 'text-gray-700' : 'text-gray-500')}>
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-gray-400">
                              {formatRelativeArabic(n.timestamp)}
                            </span>
                            {isUnread && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n.id);
                                }}
                                className="text-[10px] font-medium hover:underline flex items-center gap-0.5"
                                style={{ color: accentColor }}
                              >
                                <Check className="w-3 h-3" />
                                تعليم كمقروء
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* تذييل */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50 text-center">
              <p className="text-[10px] text-gray-400">
                تُحدَّث الإشعارات تلقائياً كل دقيقة
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
