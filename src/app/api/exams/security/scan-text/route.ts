/**
 * ============================================================
 *  مسار: POST /api/exams/security/scan-text
 * ============================================================
 *  يختبر Pipeline مراجعة النصوص على نص مُرسَل.
 *
 *  Body: { "text": "إجابة الطالب هنا", "useAI"?: boolean, "ai"?: boolean }
 *  Query: ?useAI=true|false
 *  - أولوية التفعيل: body.useAI > body.ai > query.useAI > افتراضي (false)
 *  - الافتراضي: محلي فقط (local) للسرعة. مرّر useAI=true لتفعيل LLM.
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { moderateTextWithAI, moderateTextLocal } from '@/lib/exam-security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text: string = typeof body.text === 'string' ? body.text : '';

    // مصادر التفعيل (بالأولوية): body.useAI > body.ai > query.useAI > false
    const url = new URL(req.url);
    const useAIFromQuery = url.searchParams.get('useAI');
    const useAIFromBody = body.useAI;
    const legacyAIFromBody = body.ai;

    let enableAI: boolean;
    if (typeof useAIFromBody === 'boolean') {
      enableAI = useAIFromBody;
    } else if (typeof legacyAIFromBody === 'boolean') {
      enableAI = legacyAIFromBody;
    } else if (useAIFromQuery !== null) {
      enableAI = useAIFromQuery === 'true' || useAIFromQuery === '1';
    } else {
      enableAI = false; // افتراضي: محلي فقط للسرعة
    }

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
      mode: enableAI ? 'ai' : 'local',
      originalLength: result.originalLength,
      cleanedLength: result.cleanedLength,
      decision: result.decision,
      cleanedText: result.cleanedText,
      reasons: result.reasons,
      categories: result.categories,
      confidence: result.confidence,
      modelUsed: result.modelUsed,
      moderationDetails: {
        categories: result.categories,
        confidence: result.confidence,
        decision: result.decision,
        modelUsed: result.modelUsed,
        reasons: result.reasons,
      },
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
    description: 'يختبر Pipeline مراجعة النصوص (فلتر محلي + LLM اختياري)',
    usage: {
      method: 'POST',
      contentType: 'application/json',
      body: {
        text: 'النص للفحص (مطلوب)',
        useAI: 'true لتفعيل LLM (اختياري، افتراضي false — محلي فقط)',
        ai: '(مهجور) نفس useAI',
      },
      query: {
        useAI: 'true|false — يضبط تفعيل LLM',
      },
    },
    decisions: ['SAFE', 'FLAGGED', 'BLOCKED', 'ERROR'],
    categories: [
      'profanity',
      'violence',
      'nudity',
      'hate',
      'cheating',
      'personal_info',
      'inappropriate',
      'external-links',
      'blocked-words',
      'other',
    ],
  });
}
