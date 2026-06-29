/**
 * ============================================================
 *  مسار: POST /api/exams/security/scan-text
 *  ============================================================
 *  يختبر Pipeline مراجعة النصوص على نص مُرسَل.
 *
 *  Body: { "text": "إجابة الطالب هنا", "ai": true }
 *  ai اختياري (افتراضي true) — يفعّل مراجعة LLM
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { moderateTextWithAI, moderateTextLocal } from '@/lib/exam-security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text: string = typeof body.text === 'string' ? body.text : '';
    const enableAI: boolean = body.ai !== false;

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'لم يتم إرسال نص. استخدم field "text"' },
        { status: 400 }
      );
    }

    if (text.length > 10000) {
      return NextResponse.json(
        { error: 'النص يتجاوز 10000 حرف (حد الاختبار)' },
        { status: 400 }
      );
    }

    const result = enableAI
      ? await moderateTextWithAI(text, 'اختبار فحص نص إجابة امتحان')
      : moderateTextLocal(text);

    return NextResponse.json({
      success: true,
      originalLength: result.originalLength,
      cleanedLength: result.cleanedLength,
      decision: result.decision,
      cleanedText: result.cleanedText,
      reasons: result.reasons,
      categories: result.categories,
      confidence: result.confidence,
      modelUsed: result.modelUsed,
    });
  } catch (e) {
    console.error('[exams/security/scan-text] error:', e);
    return NextResponse.json(
      { error: 'فشل فحص النص', details: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/exams/security/scan-text',
    description: 'يختبر Pipeline مراجعة النصوص (فلتر محلي + LLM)',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        text: 'النص للفحص (مطلوب)',
        ai: 'false لتعطيل LLM (اختياري، افتراضي true)',
      },
    },
    decisions: ['SAFE', 'FLAGGED', 'BLOCKED', 'ERROR'],
    categories: ['profanity', 'violence', 'nudity', 'hate', 'cheating', 'personal_info', 'inappropriate', 'external-links', 'blocked-words', 'other'],
  });
}
