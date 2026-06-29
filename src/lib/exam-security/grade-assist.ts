/**
 * ============================================================
 *  مساعد التصحيح بالذكاء الاصطناعي — AI Grade Assist
 * ============================================================
 *  يُقدّم اقتراحات درجات للأسئلة المقالية (SHORT / ESSAY)
 *  ولأسئلة الصور (IMAGE_ANSWER) باستخدام LLM / VLM.
 *
 *  المبادئ:
 *    • الإنصاف: لا يُعطي الدرجة الكاملة إلا عند الاستحقاق الواضح
 *    • التحفّظ: في الشك يمنح درجة جزئية لا كاملة
 *    • الشفافية: يُرجع تبريراً عربياً مختصراً + معايير محقَّقة
 *    • المرونة: لا يُعطّل الطلب عند فشل AI
 *
 *  الاستخدام:
 *    const result = await gradeAssistText({...});
 *    if (result.success) { // استخدم result.suggestedScore }
 * ============================================================
 */

import ZAI from 'z-ai-web-dev-sdk';

/** ناتج مساعد التصحيح */
export interface GradeAssistResult {
  /** الدرجة المقترحة (0 إلى maxPoints) */
  suggestedScore: number;
  /** هل الإجابة صحيحة (>= 50% من الدرجة العظمى) */
  isCorrect: boolean;
  /** تبرير عربي مختصر (≤ 300 حرف) */
  reasoning: string;
  /** مستوى الثقة 0..1 */
  confidence: number;
  /** المعايير المُحقَّقة من rubric */
  rubricMatched: string[];
  /** اسم النموذج المستخدم */
  modelUsed: string;
  /** هل نجح الـ AI في إنتاج اقتراح؟ */
  success: boolean;
  /** رسالة خطأ إن فشل */
  error?: string;
}

/** نتيجة غير ناجحة موحَّدة */
function failResult(error: string): GradeAssistResult {
  return {
    suggestedScore: 0,
    isCorrect: false,
    reasoning: 'فشل اقتراح الدرجة — يلزم التصحيح اليدوي',
    confidence: 0,
    rubricMatched: [],
    modelUsed: 'none',
    success: false,
    error,
  };
}

/** يحصر قيمة بين حدّين */
function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/** يقصّ النص لحدّ معين مع إزالة الفراغات الزائدة */
function trimTo(text: string, max: number): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * يبني توجيه النظام (system prompt) العربي لمساعد التصحيح.
 * نفس التوجيه يُستخدم للنصوص والصور (مع تعديل بسيط).
 */
function buildSystemPrompt(kind: 'text' | 'image', maxPoints: number): string {
  const base = `أنت مساعد تصحيح تعليمي عربي متخصص في تقييم إجابات الطلاب في الامتحانات.
مهمتك اقتراح درجة عادلة ومحافظة لإجابة الطالب بناءً على:
  1) نص السؤال الأصلي
  2) معايير التصحيح (rubric) إن وُجدت
  3) الإجابة النموذجية إن وُجدت
  4) ${kind === 'text' ? 'إجابة الطالب النصية' : 'صورة إجابة الطالب المرفوعة'}

مبادئ التقييم (إلزامية):
  • الإنصاف: قارن بموضوعية دون انحياز.
  • التحفّظ: لا تمنح الدرجة الكاملة (${maxPoints}) إلا عند الاستحقاق الواضح.
  • التدرّج: عند الشك في نقطة، امنح درجة جزئية لا كاملة.
  • عند غياب الإجابة أو كونها فارغة/غير متعلقة بالسؤال، اقترح الدرجة 0.
  • عند الإجابة الخاطئة تماماً، اقترح الدرجة 0.

عليك إرجاع JSON فقط (بدون markdown، بدون شرح إضافي) بالصيغة:
{
  "suggestedScore": <number من 0 إلى ${maxPoints}>,
  "isCorrect": <boolean>,
  "reasoning": "<نص عربي ≤ 300 حرف يبرّر الدرجة>",
  "confidence": <number من 0.0 إلى 1.0>,
  "rubricMatched": [<string>... معايير مُحقَّقة من rubric، أو مصفوفة فارغة]
}

قواعد الحقول:
  • suggestedScore: رقم بين 0 و ${maxPoints} (يسمح بالكسور العشرية مثل 2.5).
  • isCorrect: true إذا كانت الإجابة صحيحة بدرجة كبيرة (≥ 50% من الدرجة العظمى).
  • reasoning: عربي واضح ومختصر، يذكر أهم نقاط القوة والضعف.
  • confidence: ثقتك في الاقتراح (1.0 = واثق تماماً، 0.0 = غير واثق).
  • rubricMatched: مصفوفة معرفات/نصوص قصيرة للمعايير المُحقَّقة.`;
  return base;
}

/** يحاول استخراج JSON من استجابة الـ AI مع التسامح مع markdown fences */
function extractJson(content: string): Record<string, unknown> | null {
  if (!content) return null;
  // نحاول أولاً مطابقة JSON object كامل
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // نُحاول إزالة التعليقات/الفواصل الزائدة
    }
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** يبني GradeAssistResult من parsed JSON مع التحقق من الحدود */
function buildResultFromParsed(
  parsed: Record<string, unknown>,
  maxPoints: number,
  modelUsed: string
): GradeAssistResult {
  const suggestedScore = clamp(
    typeof parsed.suggestedScore === 'number' ? parsed.suggestedScore : 0,
    0,
    maxPoints
  );

  const isCorrect =
    typeof parsed.isCorrect === 'boolean'
      ? parsed.isCorrect
      : suggestedScore >= maxPoints * 0.5;

  const reasoning = trimTo(
    typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    300
  ) || 'لا يوجد تبرير متاح';

  const confidence = clamp(
    typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    0,
    1
  );

  const rubricMatched = Array.isArray(parsed.rubricMatched)
    ? parsed.rubricMatched
        .filter((r): r is string => typeof r === 'string')
        .map((r) => trimTo(r, 200))
        .slice(0, 20)
    : [];

  return {
    suggestedScore,
    isCorrect,
    reasoning,
    confidence,
    rubricMatched,
    modelUsed,
    success: true,
  };
}

/**
 * ============================================================
 *  gradeAssistText — تقييم إجابة نصية (SHORT / ESSAY)
 * ============================================================
 */
export interface GradeAssistTextParams {
  /** نص السؤال */
  questionText: string;
  /** معايير التصحيح (JSON object أو نص) — اختياري */
  rubric?: unknown;
  /** الإجابة النموذجية — اختياري */
  correctText?: string | null;
  /** إجابة الطالب */
  studentAnswer: string;
  /** الدرجة العظمى */
  maxPoints: number;
}

export async function gradeAssistText(
  params: GradeAssistTextParams
): Promise<GradeAssistResult> {
  const { questionText, correctText, studentAnswer, maxPoints } = params;
  const max = clamp(maxPoints, 0.5, 100);

  // تحقق أولي: إجابة فارغة → 0 مباشرة (لا حاجة لـ AI)
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      suggestedScore: 0,
      isCorrect: false,
      reasoning: 'إجابة الطالب فارغة — الدرجة 0',
      confidence: 1,
      rubricMatched: [],
      modelUsed: 'empty-detector',
      success: true,
    };
  }

  try {
    const zai = await ZAI.create();

    const rubricStr =
      params.rubric != null
        ? typeof params.rubric === 'string'
          ? params.rubric
          : JSON.stringify(params.rubric)
        : 'لا توجد معايير تصحيح مفصّلة — استخدم حكمك التربوي';

    const systemPrompt = buildSystemPrompt('text', max);
    const userPrompt = `# نص السؤال
${trimTo(questionText, 2000)}

# معايير التصحيح (rubric)
${trimTo(rubricStr, 2000)}

# الإجابة النموذجية (إن وُجدت)
${correctText ? trimTo(correctText, 2000) : 'لا توجد إجابة نموذجية'}

# إجابة الطالب
"""
${trimTo(studentAnswer, 4000)}
"""

أعد الآن JSON فقط بالصيغة المطلوبة.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const modelUsed = completion.model ?? 'zai-llm-unknown';

    const parsed = extractJson(content);
    if (!parsed) {
      return failResult(`فشل تحليل استجابة الـ AI: ${content.slice(0, 200)}`);
    }

    return buildResultFromParsed(parsed, max, modelUsed);
  } catch (e) {
    return failResult(`خطأ LLM: ${(e as Error).message}`);
  }
}

/**
 * ============================================================
 *  gradeAssistImage — تقييم إجابة صورة (IMAGE_ANSWER)
 * ============================================================
 */
export interface GradeAssistImageParams {
  /** نص السؤال */
  questionText: string;
  /** معايير التصحيح — اختياري */
  rubric?: unknown;
  /** الدرجة العظمى */
  maxPoints: number;
  /** صورة إجابة الطالب (Buffer) */
  imageBuffer: Buffer;
  /** نوع MIME للصورة (اختياري — يُكتشف تلقائياً) */
  mimeType?: string;
}

export async function gradeAssistImage(
  params: GradeAssistImageParams
): Promise<GradeAssistResult> {
  const { questionText, maxPoints, imageBuffer } = params;
  const max = clamp(maxPoints, 0.5, 100);

  try {
    if (!imageBuffer || imageBuffer.length === 0) {
      return failResult('ملف الصورة فارغ أو غير قابل للقراءة');
    }

    // استنتاج MIME إن لم يُمرّر صراحة
    let mimeType = params.mimeType || '';
    if (!mimeType) {
      if (
        imageBuffer.length >= 3 &&
        imageBuffer[0] === 0xff &&
        imageBuffer[1] === 0xd8 &&
        imageBuffer[2] === 0xff
      ) {
        mimeType = 'image/jpeg';
      } else if (
        imageBuffer.length >= 12 &&
        imageBuffer[0] === 0x52 &&
        imageBuffer[1] === 0x49 &&
        imageBuffer[2] === 0x46 &&
        imageBuffer[3] === 0x46 &&
        imageBuffer[8] === 0x57 &&
        imageBuffer[9] === 0x45 &&
        imageBuffer[10] === 0x42 &&
        imageBuffer[11] === 0x50
      ) {
        mimeType = 'image/webp';
      } else {
        mimeType = 'image/png'; // افتراضي (يغطي PNG و WEBP المُعاد ترميزه)
      }
    }

    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const zai = await ZAI.create();

    const rubricStr =
      params.rubric != null
        ? typeof params.rubric === 'string'
          ? params.rubric
          : JSON.stringify(params.rubric)
        : 'لا توجد معايير تصحيح مفصّلة — استخدم حكمك التربوي';

    const systemPrompt = buildSystemPrompt('image', max);
    const userPrompt = `# نص السؤال
${trimTo(questionText, 2000)}

# معايير التصحيح (rubric)
${trimTo(rubricStr, 2000)}

# ملاحظة
الصورة المرفقة هي إجابة الطالب (مكتوبة بخط اليد غالباً أو رسم). اقرأها بعناية،
حلِّل مدى استيفائها لمتطلبات السؤال، ثم اقترح درجة عادلة ومحافظة.

أعد الآن JSON فقط بالصيغة المطلوبة.`;

    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: systemPrompt }],
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
    const modelUsed = response.model ?? 'glm-4.6v';

    const parsed = extractJson(content);
    if (!parsed) {
      return failResult(`فشل تحليل استجابة الـ VLM: ${content.slice(0, 200)}`);
    }

    return buildResultFromParsed(parsed, max, modelUsed);
  } catch (e) {
    return failResult(`خطأ VLM: ${(e as Error).message}`);
  }
}

/**
 * ============================================================
 *  suggestQuestionImprovement — اقتراح تحسين سؤال
 * ============================================================
 *  يستخدم LLM لاقتراح تحسينات على نص السؤال + المعايير + التفسير.
 */
export interface QuestionImprovementParams {
  /** نوع السؤال (MCQ / TRUE_FALSE / SHORT / ESSAY / IMAGE_ANSWER / FILE_PDF) */
  type: string;
  /** نص السؤال الحالي */
  text: string;
  /** الخيارات (لـ MCQ) — اختياري */
  options?: string[] | null;
  /** الإجابة الصحيحة الحالية — اختياري */
  correctAnswer?: string | null;
  /** الإجابة النمطية الحالية — اختياري */
  correctText?: string | null;
  /** المعايير الحالية — اختياري */
  rubric?: unknown;
  /** الدرجة */
  points?: number;
}

export interface QuestionImprovementResult {
  suggestedQuestionText: string;
  suggestedRubric: string[];
  suggestedExplanation: string;
  reasoning: string;
  modelUsed: string;
  success: boolean;
  error?: string;
}

export async function suggestQuestionImprovement(
  params: QuestionImprovementParams
): Promise<QuestionImprovementResult> {
  try {
    const zai = await ZAI.create();

    const systemPrompt = `أنت خبير تربوي عربي متخصص في تصميم أسئلة الامتحانات وتحسينها.
مهمتك تحسين السؤال المُعطى لتحقيق:
  • الوضوح: لا لبس في الصياغة
  • الإنصاف: لا تحيّز، لا إحراج
  • المواءمة مع تصنيف بلوم (Bloom's Taxonomy) للمستوى المعرفي المناسب
  • التغطية الشاملة لمعايير التصحيح

عليك إرجاع JSON فقط (بدون markdown) بالصيغة:
{
  "suggestedQuestionText": "<نص السؤال المُحسَّن عربياً>",
  "suggestedRubric": ["<معيار 1>", "<معيار 2>", ...],
  "suggestedExplanation": "<تفسير إجابة نموذجي موجز>",
  "reasoning": "<تبرير موجز للتحسينات>"
}

قواعد:
  • حافظ على نوع السؤال الأصلي (${params.type}) والمستوى الدراسي.
  • إن كان السؤال موضوعياً (MCQ/TRUE_FALSE)، حافظ على بنية الخيارات.
  • لا تضِف معلومات تخترق الإجابة، فقط حسّن الصياغة والوضوح.
  • suggestedRubric: 3-6 معايير تصحيح واضحة.
  • اللغة عربية فصحى مبسّطة.`;

    const userPrompt = `# بيانات السؤال الحالي
- النوع: ${params.type}
- الدرجة: ${params.points ?? 1}
- النص: ${trimTo(params.text, 2000)}
${params.options ? `- الخيارات: ${JSON.stringify(params.options)}` : ''}
${params.correctAnswer ? `- الإجابة الصحيحة: ${params.correctAnswer}` : ''}
${params.correctText ? `- الإجابة النمطية: ${trimTo(params.correctText, 1000)}` : ''}
${params.rubric ? `- المعايير: ${typeof params.rubric === 'string' ? params.rubric : JSON.stringify(params.rubric)}` : ''}

أعد الآن JSON بالتحسينات المقترحة.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const modelUsed = completion.model ?? 'zai-llm-unknown';

    const parsed = extractJson(content);
    if (!parsed) {
      return {
        suggestedQuestionText: params.text,
        suggestedRubric: [],
        suggestedExplanation: '',
        reasoning: 'فشل تحليل استجابة الـ AI',
        modelUsed,
        success: false,
        error: `فشل التحليل: ${content.slice(0, 200)}`,
      };
    }

    return {
      suggestedQuestionText:
        typeof parsed.suggestedQuestionText === 'string'
          ? trimTo(parsed.suggestedQuestionText, 5000)
          : params.text,
      suggestedRubric: Array.isArray(parsed.suggestedRubric)
        ? parsed.suggestedRubric
            .filter((r): r is string => typeof r === 'string')
            .map((r) => trimTo(r, 300))
            .slice(0, 10)
        : [],
      suggestedExplanation:
        typeof parsed.suggestedExplanation === 'string'
          ? trimTo(parsed.suggestedExplanation, 2000)
          : '',
      reasoning:
        typeof parsed.reasoning === 'string'
          ? trimTo(parsed.reasoning, 1000)
          : '',
      modelUsed,
      success: true,
    };
  } catch (e) {
    return {
      suggestedQuestionText: params.text,
      suggestedRubric: [],
      suggestedExplanation: '',
      reasoning: 'فشل الاتصال بنموذج الذكاء الاصطناعي',
      modelUsed: 'none',
      success: false,
      error: `خطأ LLM: ${(e as Error).message}`,
    };
  }
}
