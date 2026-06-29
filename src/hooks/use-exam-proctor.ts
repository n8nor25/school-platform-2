'use client';

/**
 * ============================================================
 *  useExamProctor — Hook للاتصال بخدمة المراقبة اللحظية
 *  ============================================================
 *  يُوفّر اتصال socket.io مع خدمة exam-proctor (المنفذ 3003).
 *
 *  الاستخدام للطالب:
 *    const proctor = useExamProctor({ role: 'student' });
 *    proctor.connect();
 *    proctor.joinExam({ examId, submissionId, studentId, studentName });
 *    proctor.sendViolation({ type: 'TAB_SWITCH', severity: 1, details: '' });
 *    proctor.sendAnswerProgress({ questionId, hasText, hasImage });
 *    proctor.heartbeat();  // يُستدعى تلقائياً كل 10 ثوان
 *
 *  الاستخدام للمعلم:
 *    const proctor = useExamProctor({ role: 'teacher' });
 *    proctor.connect();
 *    proctor.watchExam(examId);
 *    // الاستماع للأحداث:
 *    useEffect(() => {
 *      const off1 = proctor.on('proctor:student_joined', (data) => {...});
 *      const off2 = proctor.on('proctor:violation', (data) => {...});
 *      const off3 = proctor.on('proctor:stats', (data) => {...});
 *      return () => { off1(); off2(); off3(); };
 *    }, []);
 * ============================================================
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

type Role = 'student' | 'teacher';

interface UseExamProctorOptions {
  role: Role;
  autoConnect?: boolean;
}

interface StudentJoinPayload {
  examId: string;
  submissionId: string;
  studentId: string;
  studentName: string;
}

interface ViolationPayload {
  type: string;
  severity?: number;
  details?: string;
}

interface AnswerProgressPayload {
  questionId: string;
  hasText?: boolean;
  hasImage?: boolean;
}

interface ProctorStats {
  examId: string;
  activeCount: number;
  totalViolations: number;
  students: Array<{
    submissionId: string;
    studentId: string;
    studentName: string;
    joinedAt: number;
    lastSeen: number;
    violationsCount: number;
    answersAnswered: number;
    idleSeconds: number;
  }>;
  timestamp?: number;
}

export function useExamProctor(options: UseExamProctorOptions) {
  const { role, autoConnect = false } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSubmissionRef = useRef<string | null>(null);

  // الاتصال
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    // نستخدم المسار '/' + XTransformPort=3003 ليتعامل معه الـ gateway
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('reconnect', () => setConnected(true));
    socket.on('connect_error', (err) => {
      console.error('[proctor] connect error:', err.message);
      setConnected(false);
    });
  }, []);

  // قطع الاتصال
  const disconnect = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (role === 'student' && activeSubmissionRef.current) {
      socketRef.current?.emit('student:leave', { submissionId: activeSubmissionRef.current });
    }
    if (role === 'teacher' && activeExamId) {
      socketRef.current?.emit('teacher:unwatch', { examId: activeExamId });
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setActiveExamId(null);
    activeSubmissionRef.current = null;
  }, [role, activeExamId]);

  // --- دوال الطالب ---
  const joinExam = useCallback((payload: StudentJoinPayload) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('student:join', payload);
    activeSubmissionRef.current = payload.submissionId;
    setActiveExamId(payload.examId);

    // بدء نبضة القلب كل 10 ثوان
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (activeSubmissionRef.current && socketRef.current?.connected) {
        socketRef.current.emit('student:heartbeat', { submissionId: activeSubmissionRef.current });
      }
    }, 10000);
  }, []);

  const sendViolation = useCallback((payload: ViolationPayload) => {
    if (!socketRef.current?.connected || !activeSubmissionRef.current) return;
    socketRef.current.emit('student:violation', {
      submissionId: activeSubmissionRef.current,
      ...payload,
    });
  }, []);

  const sendAnswerProgress = useCallback((payload: AnswerProgressPayload) => {
    if (!socketRef.current?.connected || !activeSubmissionRef.current) return;
    socketRef.current.emit('student:answer_progress', {
      submissionId: activeSubmissionRef.current,
      ...payload,
    });
  }, []);

  const heartbeat = useCallback(() => {
    if (!socketRef.current?.connected || !activeSubmissionRef.current) return;
    socketRef.current.emit('student:heartbeat', { submissionId: activeSubmissionRef.current });
  }, []);

  // --- دوال المعلم ---
  const watchExam = useCallback((examId: string) => {
    if (!socketRef.current?.connected) return;
    if (activeExamId && activeExamId !== examId) {
      socketRef.current.emit('teacher:unwatch', { examId: activeExamId });
    }
    socketRef.current.emit('teacher:watch', { examId });
    setActiveExamId(examId);
  }, [activeExamId]);

  const unwatchExam = useCallback((examId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('teacher:unwatch', { examId });
    if (activeExamId === examId) setActiveExamId(null);
  }, [activeExamId]);

  // --- الاستماع للأحداث ---
  const on = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  // الاتصال التلقائي
  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // فحص دوري للجلسة الخاملة من جهة العميل
  useEffect(() => {
    if (role !== 'student') return;
    const onFocus = () => {
      // عند العودة للصفحة، أرسل نبضة
      heartbeat();
    };
    const onBlur = () => {
      // عند مغادرة الصفحة، أرسل انتهاك TAB_SWITCH
      sendViolation({ type: 'TAB_SWITCH', severity: 1, details: 'window_blur' });
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [role, heartbeat, sendViolation]);

  return {
    // الحالة
    connected,
    activeExamId,
    // عام
    connect,
    disconnect,
    on,
    // طالب
    joinExam,
    sendViolation,
    sendAnswerProgress,
    heartbeat,
    // معلم
    watchExam,
    unwatchExam,
  };
}

export type { ProctorStats, StudentJoinPayload, ViolationPayload, AnswerProgressPayload };
