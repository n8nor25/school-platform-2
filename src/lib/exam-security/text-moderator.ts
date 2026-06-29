/**
 * ============================================================
 *  مراجعة النصوص — الطبقة الثالثة (إشراف المحتوى)
 *  Text Moderator — Third Line (Content Moderation)
 * ============================================================
 *  Pipeline من طبقتين:
 *  ① فلتر محلي سريع (أنماط خطرة + روابط + HTML)
 *  ② LLM مراجعة سياقية عربية (يُحدّد: آمن/مُعلَّق/مرفوض)
 * ============================================================
 */

import ZAI from 'z-ai-web-dev-sdk';
import {
  DANGEROUS_PATTERNS,
  URL_PATTERN,
  MAX_TEXT_LENGTH,
  DEFAULT_BLOCKED_WORDS,
  type TextModerationResult,
  type ModerationDecision,
} from './types';

/** يستبدل الروابط الخارجية بنص آمن */
function stripUrls(text: string): { text: string; count: number } {
  let count = 0;
  const cleaned = text.replace(URL_PATTERN, (m) => {
    count++;
    return '[رابط محذوف]';
  });
  return { text: cleaned, count };
}

/** ينظّف الأنماط الخطرة (HTML/JS) */
function stripDangerousPatterns(text: string): { text: string; cleaned: string[] } {
  const cleaned: string[] = [];
  let result = text;
  for (const pattern of DANGEROUS_PATTERNS) {
    const before = result;
    result = result.replace(pattern, '');
    if (before !== result) {
      cleaned.push(`حذف نمط خطير: ${pattern.source.slice(0, 40)}`);
    }
  }
  return { text: result, cleaned };
}

/** ينظّف الأحرف الخفية (zero-width chars, RTL embed) */
function stripHiddenChars(text: string): { text: string; removed: boolean } {
  const before = text.length;
  // Zero-width: U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM)
  // RTL/LTR embeds: U+202A-U+202E, U+2066-U+2069
  // Control chars: U+0000-U+0008, U+000B, U+000C, U+000E-U+001F
  const cleaned = text.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return { text: cleaned, removed: before !== cleaned.length };
}

/** فحص القائمة السوداء للكلمات */
function checkBlockedWords(text: string): { found: string[] } {
  const found: string[] = [];
  if (DEFAULT_BLOCKED_WORDS.length === 0) return { found };
  const lower = text.toLowerCase();
  for (const word of DEFAULT_BLOCKED_WORDS) {
    const w = word.toLowerCase();
    if (w && lower.includes(w)) found.push(word);
  }
  return { found };
}

/**
 * الفلتر المحلي السريع (بدون AI)
 */
export function localFilterText(input: string): {
  cleanedText: string;
  notes: string[];
  blockedWords: string[];
  urlCount: number;
} {
  const notes: string[] = [];
  let text = input;

  // 1) تحديد الطول
  if (text.length > MAX_TEXT_LENGTH) {
    notes.push(`اقتطاع النص من ${text.length} إلى ${MAX_TEXT_LENGTH} حرف`);
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  // 2) تنظيف الأحرف الخفية
  const hidden = stripHiddenChars(text);
  if (hidden.removed) {
    notes.push('حذف أحرف خفية (zero-width/control)');
    text = hidden.text;
  }

  // 3) تنظيف الأنماط الخطرة
  const danger = stripDangerousPatterns(text);
  notes.push(...danger.cleaned);
  text = danger.text;

  // 4) استبدال الروابط
  const urls = stripUrls(text);
  if (urls.count > 0) {
    notes.push(`حذف ${urls.count} رابط خارجي`);
    text = urls.text;
  }

  // 5) فحص القائمة السوداء
  const blocked = checkBlockedWords(text);

  // 6) توحيد المسافات الزائدة (يمنع تجاوز الفلاتر بالمسافات)
  text = text.replace(/[ \t]{3,}/g, '  ').replace(/\n{4,}/g, '\n\n\n');

  return {
    cleanedText: text,
    notes,
    blockedWords: blocked.found,
    urlCount: urls.count,
  };
}

/**
 * مراجعة النص بالـ LLM (طبقة AI)
 * يعيد قراراً: SAFE / FLAGGED / BLOCKED + أسباب + فئات
 */
export async function moderateTextWithAI(
  text: string,
  context: string = 'إجابة طالب في امتحان'
): Promise<TextModerationResult> {
  const originalLength = text.length;

  // 1) الفلتر المحلي أولاً
  const local = localFilterText(text);
  let cleanedText = local.cleanedText;

  // إذا كان النص فارغاً بعد التنظيف، لا حاجة لـ AI
  if (!cleanedText.trim()) {
    return {
      decision: 'SAFE',
      cleanedText,
      originalLength,
      cleanedLength: cleanedText.length,
      reasons: ['النص فارغ بعد التنظيف'],
      categories: [],
      confidence: 1.0,
      modelUsed: 'local-filter',
    };
  }

  // إذا وُجدت كلمات ممنوعة محلياً → BLOCKED مباشرة
  if (local.blockedWords.length > 0) {
    return {
      decision: 'BLOCKED',
      cleanedText,
      originalLength,
      cleanedLength: cleanedText.length,
      reasons: [`كلمات ممنوعة محلياً: ${local.blockedWords.join(', ')}`],
      categories: ['blocked-words'],
      confidence: 1.0,
      modelUsed: 'local-filter',
    };
  }

  // 2) مراجعة LLM
  try {
    const zai = await ZAI.create();

    const systemPrompt = `أنت مدقّق محتوى تعليمي عربي متخصص في مراجعة إجابات الطلاب في الامتحانات.
مهمتك فحص النص والتأكد من خلوه من:
- الإساءة اللفظية أو البذاءة
- المحتوى غير اللائق (عنف، إباحية، مخدرات)
- رموز الكراهية أو التمييز
- محاولات غش (إخفاء إجابات، أكواد، إشارات لاستلام إجابات)
- معلومات شخصية حساسة (أرقام هواتف، عناوين، حسابات بنكية)
- محتوى يهدف لاختراق أو تضليل المعلم

أعد JSON فقط بالصيغة التالية (بدون markdown، بدون شرح إضافي):
{
  "decision": "SAFE" | "FLAGGED" | "BLOCKED",
  "reasons": ["سبب 1", "سبب 2"],
  "categories": ["profanity" | "violence" | "nudity" | "hate" | "cheating" | "personal_info" | "inappropriate" | "other"],
  "confidence": 0.0 إلى 1.0
}

قواعد القرار:
- SAFE: نص تعليمي طبيعي، إجابة عادية، لا مخالفات
- FLAGGED: يُشتبه في محتوى مُريب لكن غير قطعي، يحتاج مراجعة بشرية
- BLOCKED: مخالفة صريحة لا تقبل التفسير، يجب رفضها`;

    const userPrompt = `سياق النص: ${context}\n\nالنص للفحص:\n"""\n${cleanedText.slice(0, 3000)}\n"""`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const modelUsed = completion.model ?? 'zai-llm-unknown';

    // محاولة استخراج JSON
    let parsed: {
      decision?: string;
      reasons?: string[];
      categories?: string[];
      confidence?: number;
    } = {};

    try {
      // نزيل markdown fences إن وُجدت
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      // إذا فشل التحليل، نعتبر النص مُعلَّقاً للمراجعة البشرية
      return {
        decision: 'FLAGGED',
        cleanedText,
        originalLength,
        cleanedLength: cleanedText.length,
        reasons: ['فشل تحليل استجابة الـ AI — يلزم مراجعة بشرية', `الاستجابة الخام: ${content.slice(0, 200)}`],
        categories: ['parse-error'],
        confidence: 0.0,
        modelUsed,
      };
    }

    const decision = (
      ['SAFE', 'FLAGGED', 'BLOCKED'].includes(parsed.decision ?? '')
        ? (parsed.decision as ModerationDecision)
        : 'FLAGGED'
    );

    return {
      decision,
      cleanedText,
      originalLength,
      cleanedLength: cleanedText.length,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 10) : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 10) : [],
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      modelUsed,
    };
  } catch (e) {
    // في حال فشل الـ AI، نعتمد على الفلتر المحلي فقط
    return {
      decision: 'SAFE',
      cleanedText,
      originalLength,
      cleanedLength: cleanedText.length,
      reasons: [
        'مراجعة AI غير متاحة حالياً — تم الاعتماد على الفلتر المحلي فقط',
        `الخطأ: ${(e as Error).message}`,
      ],
      categories: ['ai-error'],
      confidence: 0.3,
      modelUsed: 'local-fallback',
    };
  }
}

/**
 * مراجعة سريعة محلية فقط (بدون AI) — للاستخدام في الحفظ التلقائي
 */
export function moderateTextLocal(text: string): TextModerationResult {
  const originalLength = text.length;
  const local = localFilterText(text);

  let decision: ModerationDecision = 'SAFE';
  const reasons: string[] = [...local.notes];
  const categories: string[] = [];

  if (local.blockedWords.length > 0) {
    decision = 'BLOCKED';
    reasons.push(`كلمات ممنوعة: ${local.blockedWords.join(', ')}`);
    categories.push('blocked-words');
  } else if (local.urlCount > 0) {
    decision = 'FLAGGED';
    reasons.push(`يحتوي على ${local.urlCount} رابط خارجي`);
    categories.push('external-links');
  }

  return {
    decision,
    cleanedText: local.cleanedText,
    originalLength,
    cleanedLength: local.cleanedText.length,
    reasons,
    categories,
    confidence: 0.7,
    modelUsed: 'local-only',
  };
}
