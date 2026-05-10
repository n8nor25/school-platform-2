import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const SYSTEM_PROMPT = 'أنت مساعد ذكي للطلاب في مدرسة عربية. تساعد في شرح الدروس والإجابة على الأسئلة الدراسية بأسلوب بسيط وواضح. تجيب باللغة العربية. تكون إجاباتك منظمة وسهلة الفهم.';

const MAX_HISTORY = 28;

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let zaiInitPromise: Promise<Awaited<ReturnType<typeof ZAI.create>>> | null = null;

async function getZAI() {
  if (zaiInstance) return zaiInstance;
  if (zaiInitPromise) return zaiInitPromise;
  zaiInitPromise = ZAI.create().then((instance) => {
    zaiInstance = instance;
    zaiInitPromise = null;
    return instance;
  }).catch((err) => {
    zaiInitPromise = null;
    throw err;
  });
  return zaiInitPromise;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
    }

    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = [
      { role: 'assistant', content: SYSTEM_PROMPT },
    ];

    if (Array.isArray(history)) {
      const trimmedHistory = history.slice(-MAX_HISTORY);
      for (const msg of trimmedHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: String(msg.content) });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    let zai;
    try {
      zai = await getZAI();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Chat API] ZAI create failed:', errMsg);
      return NextResponse.json({ success: false, error: 'ZAI init failed', details: errMsg }, { status: 503 });
    }

    let completion;
    try {
      completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.constructor.name : 'Unknown';
      console.error('[Chat API] Completion failed:', errName, errMsg);
      zaiInstance = null;
      zaiInitPromise = null;
      return NextResponse.json({ success: false, error: 'Completion failed', errorName: errName, details: errMsg }, { status: 500 });
    }

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse || aiResponse.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Empty AI response' }, { status: 500 });
    }

    return NextResponse.json({ success: true, response: aiResponse });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
    console.error('[Chat API] Unexpected error:', errorName, errorMessage);
    return NextResponse.json({ success: false, error: 'Unexpected error', errorName, errorMessage }, { status: 500 });
  }
}