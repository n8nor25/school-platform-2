import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

// Map Arabic event types to English for the image prompt (avoids content filter)
const TYPE_TO_ENGLISH: Record<string, string> = {
  حفل: 'ceremony',
  رحلة: 'field trip',
  مسابقة: 'competition',
  ندوة: 'seminar',
  اجتماع: 'meeting',
  رياضي: 'sports',
  ثقافي: 'cultural',
  ديني: 'religious',
  نشاط: 'activity',
}

// POST /api/events/generate-poster - Generate event poster via Image Generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, type, description } = body as {
      title?: string
      type?: string
      description?: string
    }

    if (!title) {
      return NextResponse.json(
        { error: 'عنوان الفعالية مطلوب' },
        { status: 400 }
      )
    }

    const englishType =
      (type && TYPE_TO_ENGLISH[type]) || 'school activity'

    // CRITICAL: Use a clean generic English prompt to avoid content filter rejection.
    // Do NOT embed the Arabic title or description.
    const builtPrompt = `A colorful illustrated poster for a school ${englishType}. Bright cheerful colors, students, books, stars, modern flat design. Clean composition, no text, suitable as a background for event announcement. High quality, professional digital art.`

    let zai
    try {
      zai = await ZAI.create()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[events/generate-poster] ZAI create failed:', errMsg)
      return NextResponse.json(
        { error: 'تعذر تهيئة خدمة الذكاء الاصطناعي', details: errMsg },
        { status: 503 }
      )
    }

    let response
    try {
      response = await zai.images.generations.create({
        prompt: builtPrompt,
        size: '1344x768',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[events/generate-poster] Image generation failed:', errMsg)
      return NextResponse.json(
        { error: 'تعذر توليد صورة البوستر', details: errMsg },
        { status: 500 }
      )
    }

    const imageBase64 = response.data?.[0]?.base64
    if (!imageBase64) {
      return NextResponse.json(
        { error: 'استجابة الصورة فارغة من الخدمة' },
        { status: 500 }
      )
    }

    // Persist image to /public/uploads/events/
    const buffer = Buffer.from(imageBase64, 'base64')
    const filename = `event-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.png`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'events')
    fs.mkdirSync(uploadDir, { recursive: true })
    fs.writeFileSync(path.join(uploadDir, filename), buffer)

    return NextResponse.json({
      imageUrl: `/uploads/events/${filename}`,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error generating event poster:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر توليد بوستر الفعالية' },
      { status: 500 }
    )
  }
}
