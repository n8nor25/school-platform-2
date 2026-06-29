import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// Arabic system prompts per content field
const SYSTEM_PROMPTS: Record<string, string> = {
  description:
    'أنت كاتب محتوى احترافي للمدارس. اكتب وصفاً جذاباً ومحفزاً للفعالية المدرسية باللغة العربية، 3-4 فقرات قصيرة.',
  program:
    'أنت منظم فعاليات مدرسية. اقترح برنامجاً زمنياً للفعالية. أعد JSON array فقط، كل عنصر يحتوي {time, title, description}. مثال: [{"time":"09:00","title":"الافتتاح","description":"كلمة ترحيبية"}]',
  invitation:
    'أنت كاتب رسائل دعوة رسمية. اكتب نص دعوة لولي الأمر لحضور الفعالية، رسمي ودافئ، 150-200 كلمة بالعربية.',
  requirements:
    'أنت منسق فعاليات. اكتب قائمة بالمتطلبات للفعالية (ملابس، أدوات، مستندات) كقائمة نقطية بالعربية.',
}

// Strip markdown code fences and try to parse JSON; fall back to raw string
function extractProgram(content: string): unknown {
  let cleaned = content.trim()
  // Strip ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  try {
    const parsed = JSON.parse(cleaned)
    return parsed
  } catch {
    return content
  }
}

// POST /api/events/generate-content - Generate event content via LLM
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, type, startDate, location, field } = body as {
      title?: string
      type?: string
      location?: string
      startDate?: string
      field?: string
    }

    if (!title || !field) {
      return NextResponse.json(
        { error: 'العنوان والحقل (field) مطلوبان' },
        { status: 400 }
      )
    }

    const allowedFields = ['description', 'program', 'invitation', 'requirements']
    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { error: `الحقل يجب أن يكون أحد: ${allowedFields.join(', ')}` },
        { status: 400 }
      )
    }

    const systemPrompt = SYSTEM_PROMPTS[field]
    const userPromptParts: string[] = [
      `عنوان الفعالية: ${title}`,
      type ? `نوع الفعالية: ${type}` : '',
      startDate ? `تاريخ البداية: ${startDate}` : '',
      location ? `الموقع: ${location}` : '',
    ].filter(Boolean)

    const userPrompt =
      userPromptParts.join('\n') +
      `\n\nاكتب المحتوى المناسب للحقل "${field}" الآن.`

    let zai
    try {
      zai = await ZAI.create()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[events/generate-content] ZAI create failed:', errMsg)
      return NextResponse.json(
        { error: 'تعذر تهيئة خدمة الذكاء الاصطناعي', details: errMsg },
        { status: 503 }
      )
    }

    let completion
    try {
      completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[events/generate-content] Completion failed:', errMsg)
      return NextResponse.json(
        { error: 'تعذر توليد المحتوى', details: errMsg },
        { status: 500 }
      )
    }

    const rawContent = completion.choices[0]?.message?.content || ''
    if (!rawContent.trim()) {
      return NextResponse.json(
        { error: 'استجابة الذكاء الاصطناعي فارغة' },
        { status: 500 }
      )
    }

    // For program field: attempt to parse JSON; fall back to raw string
    const content =
      field === 'program' ? extractProgram(rawContent) : rawContent

    return NextResponse.json({ content, field })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error generating event content:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر توليد المحتوى' },
      { status: 500 }
    )
  }
}
