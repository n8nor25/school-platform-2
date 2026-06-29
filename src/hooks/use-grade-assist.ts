'use client';

/**
 * ============================================================
 *  useGradeAssist — Hook لمساعد التصحيح بالذكاء الاصطناعي
 * ============================================================
 *  يُوفّر واجهة للمعلم لطلب اقتراح درجة من AI ثم تطبيقها بعد المراجعة.
 *
 *  الاستخدام:
 *    const { suggestGrade, applyGrade, isLoading, error, lastSuggestion } = useGradeAssist();
 *
 *    // 1) طلب اقتراح
 *    const suggestion = await suggestGrade(answerId);
 *    if (suggestion?.success) {
 *      // اعرض suggestion.suggestedScore + suggestion.reasoning
 *    }
 *
 *    // 2) تطبيق الدرجة (بعد موافقة المعلم)
 *    await applyGrade(answerId, suggestion.suggestedScore, 'ملاحظة المعلم');
 * ============================================================
 */

import { useState, useCallback } from 'react';

/** ناتج اقتراح التصحيح (موافق لـ GradeAssistResult في الباك إند) */
export interface GradeAssistResult {
  suggestedScore: number;
  isCorrect: boolean;
  reasoning: string;
  confidence: number;
  rubricMatched: string[];
  modelUsed: string;
  success: boolean;
  error?: string;
}

export interface UseGradeAssistResult {
  suggestGrade: (answerId: string) => Promise<GradeAssistResult | null>;
  applyGrade: (
    answerId: string,
    score: number,
    teacherNote?: string
  ) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  lastSuggestion: GradeAssistResult | null;
}

/**
 * يبني URL طلب API مع إضافة بارامترات المدرسة والمعلم من query string الحالي.
 */
function buildUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const params = new URLSearchParams(window.location.search);
  const schoolId = params.get('schoolId');
  const teacherId = params.get('teacherId');
  const qs = new URLSearchParams();
  if (schoolId) qs.set('schoolId', schoolId);
  if (teacherId) qs.set('teacherId', teacherId);
  const sep = path.includes('?') ? '&' : '?';
  return qs.toString() ? `${path}${sep}${qs.toString()}` : path;
}

export function useGradeAssist(): UseGradeAssistResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuggestion, setLastSuggestion] = useState<GradeAssistResult | null>(
    null
  );

  const suggestGrade = useCallback(
    async (answerId: string): Promise<GradeAssistResult | null> => {
      if (!answerId) {
        setError('معرّف الإجابة مطلوب');
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          buildUrl(`/api/exams/teacher/answers/${answerId}/ai-grade`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }
        );
        const data = (await res.json()) as {
          success?: boolean;
          suggestion?: GradeAssistResult;
          error?: string;
        };
        if (!res.ok || !data.success || !data.suggestion) {
          const msg = data.error || `فشل الطلب (${res.status})`;
          setError(msg);
          return null;
        }
        setLastSuggestion(data.suggestion);
        return data.suggestion;
      } catch (e) {
        const msg = (e as Error).message || 'خطأ غير متوقع';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const applyGrade = useCallback(
    async (
      answerId: string,
      score: number,
      teacherNote?: string
    ): Promise<boolean> => {
      if (!answerId) {
        setError('معرّف الإجابة مطلوب');
        return false;
      }
      if (typeof score !== 'number' || Number.isNaN(score)) {
        setError('الدرجة غير صالحة');
        return false;
      }
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          buildUrl(`/api/exams/teacher/answers/${answerId}/apply-ai-grade`),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score, teacherNote }),
          }
        );
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !data.success) {
          setError(data.error || `فشل تطبيق الدرجة (${res.status})`);
          return false;
        }
        return true;
      } catch (e) {
        setError((e as Error).message || 'خطأ غير متوقع');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    suggestGrade,
    applyGrade,
    isLoading,
    error,
    lastSuggestion,
  };
}
