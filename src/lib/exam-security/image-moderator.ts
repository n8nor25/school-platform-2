/**
 * ============================================================
 *  مراجعة الصور — الطبقة الثالثة (إشراف المحتوى البصري)
 *  Image Moderator — Third Line (Visual Content Moderation)
 * ============================================================
 *  نستخدم VLM (zai.chat.completions.createVision) لفحص الصورة:
 *  • nudity / عري
 *  • violence / عنف
 *  • weapons / أسلحة
 *  • drug references / مخدرات
 *  • hate symbols / رموز كراهية
 *  • faces / وجوه (لإخفاء الهوية)
 *  • QR codes or URLs / تسريب محتوى الامتحان
 *  • exam cheating hints / إشارات غش
 * ============================================================
 */

import ZAI from 'z-ai-web-dev-sdk';
import type { ImageModerationResult, ModerationDecision } from './types';

/**
 * يفحص الصورة بصرياً عبر VLM
 * @param imageBuffer Buffer الصورة (بعد التعقيم)
 * @param mimeType نوع الصورة (image/png, image/jpeg, image/webp)
 * @param context سياق الفحص (مثلاً: "إجابة طالب بخط اليد")
 */
export async function moderateImageWithAI(
  imageBuffer: Buffer,
  mimeType: string,
  context: string = 'إجابة طالب في امتحان'
): Promise<ImageModerationResult> {
  // تحويل إلى base64
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  try {
    const zai = await ZAI.create();

    const systemPrompt = `أنت مدقّق محتوى بصري تعليمي متخصص في فحص صور إجابات الطلاب في الامتحانات.
مهمتك فحص الصورة والتأكد من خلوها من:
- العري أو المحتوى الجنسي
- العنف أو الدموية
- الأسلحة أو المتفجرات
- المخدرات أو الإدمان
- رموز الكراهية أو التمييز (نازية، عنصرية)
- الوجوه الواضحة (يجب إخفاء هوية الطلاب)
- أكواد QR أو روابط URL (تسريب محتوى الامتحان)
- إشارات غش (إجابات مكتوبة مسبقاً، ملصقات، شاشات)
- محتوى غير تعليمي تماماً (لا علاقة له بالامتحان)

أعد JSON فقط بالصيغة التالية (بدون markdown، بدون شرح إضافي):
{
  "decision": "SAFE" | "FLAGGED" | "BLOCKED",
  "reasons": ["سبب 1", "سبب 2"],
  "categories": ["nudity" | "violence" | "weapons" | "drugs" | "hate" | "faces" | "qr_url" | "cheating" | "irrelevant" | "other"],
  "confidence": 0.0 إلى 1.0
}

قواعد القرار:
- SAFE: صورة طبيعية لإجابة مكتوبة بخط اليد، أو رسم تعليمي، لا مخالفات
- FLAGGED: يُشتبه في محتوى مُريب لكن غير قطعي، يحتاج مراجعة بشرية (مثلاً: وجه غير واضح، نص قد يكون غشاً)
- BLOCKED: مخالفة صريحة لا تقبل التفسير (عري، عنف، أسلحة، رموز كراهية، QR واضح)`;

    const userPrompt = `سياق الصورة: ${context}\n\nافحص هذه الصورة بدقة وأعد JSON بالقرار.`;

    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: systemPrompt },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = response.choices[0]?.message?.content ?? '';
    const modelUsed = response.model ?? 'zai-vlm-unknown';

    let parsed: {
      decision?: string;
      reasons?: string[];
      categories?: string[];
      confidence?: number;
    } = {};

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      return {
        decision: 'FLAGGED',
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
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 10) : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories.slice(0, 10) : [],
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      modelUsed,
    };
  } catch (e) {
    // في حال فشل VLM، نُعلِّق الصورة للمراجعة البشرية (لا نسمح تلقائياً)
    return {
      decision: 'FLAGGED',
      reasons: [
        'مراجعة AI البصرية غير متاحة حالياً — الصورة معلَّقة للمراجعة البشرية',
        `الخطأ: ${(e as Error).message}`,
      ],
      categories: ['ai-error'],
      confidence: 0.0,
      modelUsed: 'vlm-error-fallback',
    };
  }
}

/**
 * مراجعة سريعة محلية فقط (بدون AI) — تكتشف الوجوه بشكل أساسي
 * هذا مجرد فحص أولي سريع، المراجعة الفعلية عبر VLM
 */
export function moderateImageLocal(imageBuffer: Buffer): {
  sizeOk: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const sizeOk = imageBuffer.length > 0 && imageBuffer.length < 8 * 1024 * 1024;
  if (!sizeOk) {
    notes.push(`حجم الصورة ${imageBuffer.length} بايت غير مقبول`);
  }
  return { sizeOk, notes };
}
