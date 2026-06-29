/**
 * ============================================================
 *  test-stage-e.ts — اختبارات المرحلة ه حيّة (end-to-end)
 * ============================================================
 *  يختبر المسارات الجديدة للمرحلة هـ:
 *    1) POST /api/exams/teacher/answers/[ansId]/ai-grade (نص/صورة)
 *    2) POST /api/exams/teacher/answers/[ansId]/apply-ai-grade
 *    3) POST /api/exams/teacher/questions/[qid]/improve
 *    4) POST /api/exams/security/scan-text?useAI=true
 *    5) POST /api/exams/security/scan-file (moderationDetails)
 *
 *  ملاحظات:
 *    - يفترض أن السيرفر يعمل على http://localhost:3000
 *    - ينشئ امتحاناً + تسليماً + إجابات حقيقية للاختبار.
 *    - لا يستخدم auth — يعتمد على test-mode (x-teacher-id/x-student-id).
 * ============================================================
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const SCHOOL_ID = 'cmqu1mqhq0000mj5fuoui57sz';
const TEACHER_ID = 'test-teacher-stage-e';
const STUDENT_ID = 'test-student-stage-e';
const TEACHER_NAME = 'معلم المرحلة ه';
const STUDENT_NAME = 'طالب المرحلة ه';

// عدّاد النتائج
let pass = 0;
let fail = 0;
const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string = ''): void {
  if (ok) pass++;
  else fail++;
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail.slice(0, 180)}` : ''}`);
}

/** يبني URL مع بارامترات المدرسة والمعلم/الطالب */
function url(
  pathname: string,
  role: 'teacher' | 'student' = 'teacher',
  extra?: { submissionId?: string }
): string {
  const params = new URLSearchParams();
  params.set('schoolId', SCHOOL_ID);
  if (role === 'teacher') {
    params.set('teacherId', TEACHER_ID);
    params.set('teacherName', TEACHER_NAME);
  } else {
    params.set('studentId', STUDENT_ID);
    params.set('studentName', STUDENT_NAME);
  }
  if (extra?.submissionId) params.set('submissionId', extra.submissionId);
  return `${BASE}${pathname}${pathname.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** ينفّذ fetch JSON */
async function callJson(
  urlStr: string,
  options: RequestInit = {},
  role: 'teacher' | 'student' = 'teacher'
): Promise<{ status: number; data: any }> {
  // نتجنّب إرسال اسم عربي في headers (ByteString restriction)
  // الاسم يُمرَّر عبر query params في دالة url()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (role === 'teacher') {
    headers['x-teacher-id'] = TEACHER_ID;
  } else {
    headers['x-student-id'] = STUDENT_ID;
  }
  const res = await fetch(urlStr, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

/** ينشئ امتحاناً مع 5 أسئلة منوعة */
async function setupExam(): Promise<{
  examId: string;
  submissionId: string;
  questions: { id: string; type: string; text: string }[];
}> {
  console.log('\n[setup] إنشاء امتحان المرحلة ه...');
  const createBody = {
    title: 'امتحان المرحلة ه — التصحيح المساعد',
    description: 'اختبار شامل لتكامل LLM/VLM في التصحيح',
    subject: 'الرياضيات',
    classroomName: 'الصف التاسع',
    durationMinutes: 60,
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2030-12-31T23:59:59.000Z',
    maxAttempts: 1,
    antiCheatEnabled: true,
    questions: [
      {
        type: 'ESSAY',
        text: 'اشرح خصائص المعين في الهندسة، واذكر الفرق بينه وبين المربع.',
        rubric: ['تعريف المعين', 'ذكر الخصائص الأربع', 'الفرق عن المربع'],
        points: 5,
      },
      {
        type: 'SHORT',
        text: 'ما هي مساحة دائرة نصف قطرها 5 سم؟ اذكر القانون والنتيجة.',
        correctText: 'القانون: ط × نق² = 78.5 سم² تقريباً',
        points: 3,
      },
      {
        type: 'ESSAY',
        text: 'اكتب مقالاً قصيراً عن أهمية الماء في حياة الإنسان.',
        rubric: ['المقدمة', 'الأفكار الرئيسية', 'الخاتمة'],
        points: 4,
      },
      {
        type: 'IMAGE_ANSWER',
        text: 'ارسم مثلثاً قائم الزاوية وحدد فيه الوتر والضلعين القائمين.',
        rubric: ['رسم المثلث', 'تحديد الوتر', 'تحديد الضلعين'],
        points: 3,
      },
      {
        type: 'MCQ',
        text: 'كم يساوي 7 × 8؟',
        options: ['54', '56', '58', '64'],
        correctAnswer: '56',
        points: 1,
      },
    ],
  };
  const r = await callJson(url('/api/exams/teacher'), {
    method: 'POST',
    body: JSON.stringify(createBody),
  });
  if (r.status !== 201 && r.status !== 200) {
    throw new Error(`فشل إنشاء الامتحان: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  }
  const examId = r.data.examId;
  console.log(`  examId = ${examId}`);

  // نشر الامتحان
  const pub = await callJson(url(`/api/exams/teacher/${examId}/publish`), {
    method: 'POST',
  });
  if (pub.status !== 200) {
    throw new Error(`فشل نشر الامتحان: ${pub.status} ${JSON.stringify(pub.data).slice(0, 300)}`);
  }

  // بدء المحاولة كطالب
  const start = await callJson(
    url(`/api/exams/${examId}/start`, 'student'),
    { method: 'POST', body: JSON.stringify({}) },
    'student'
  );
  void start;
  if (start.status !== 200) {
    throw new Error(`فشل بدء المحاولة: ${start.status} ${JSON.stringify(start.data).slice(0, 300)}`);
  }
  const submissionId = start.data.submission.id;
  const questions = (start.data.questions as any[]).map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
  }));
  console.log(`  submissionId = ${submissionId}`);
  console.log(`  questions = ${questions.length}`);

  return { examId, submissionId, questions };
}

/** ينشئ صورة PNG بسيطة (مثلث مرسوم يدوياً بشكل أساسي) للاختبار */
function createTestPng(): string {
  // نولّد PNG بسيط 200x200 بضربة مثلث (لا نحتاج صورة حقيقية — VLM سيقرأ ما يقدر)
  // نستخدم مكتبة sharp في dev server عند الرفع، لكن هنا نبني PNG خام.
  // PNG 1x1 كافٍ للاختبار — VLM سيُرجع "image too small" أو سيُحاول قراءته.
  // نبني PNG 8x8 أبيض بسيط لتأكيد عمل الـ pipeline.
  const PNG_HEADER = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  // IHDR chunk
  const width = 200;
  const height = 200;
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  function crc32(buf: Buffer): number {
    let c: number;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // IDAT — نُنشئ بيانات خام ثم نُصرّفها (نستخدم تخزين بدون ضغط عبر chunk type "zTXT" غير صحيح...
  // بدلاً من ذلك، نستخدم تنفيذ Node المدمج zlib)
  const zlib = require('node:zlib');
  // raw image data: for each scanline, 1 byte filter (0) + width*3 bytes RGB
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0; // filter none
    for (let x = 0; x < width; x++) {
      // رسم مثلث قائم الزاوية بسيط (أبيض على رمادي)
      const offset = y * rowBytes + 1 + x * 3;
      // رسم خط قطري
      const onHypotenuse = Math.abs(x + y - width) < 4;
      const onLegX = x < 4 && y > height - 8;
      const onLegY = y > height - 4 && x < 8;
      if (onHypotenuse || onLegX || onLegY) {
        raw[offset] = 0;
        raw[offset + 1] = 0;
        raw[offset + 2] = 0; // أسود
      } else {
        raw[offset] = 240;
        raw[offset + 1] = 240;
        raw[offset + 2] = 240; // رمادي فاتح
      }
    }
  }
  const compressed = zlib.deflateSync(raw);
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));
  const ihdr = chunk('IHDR', ihdrData);

  const png = Buffer.concat([PNG_HEADER, ihdr, idat, iend]);
  const tmpPath = path.join('/tmp', `stage-e-test-${Date.now()}.png`);
  writeFileSync(tmpPath, png);
  return tmpPath;
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  اختبارات المرحلة ه — مساعد التصحيح بالذكاء الاصطناعي');
  console.log('═══════════════════════════════════════════════════════════');

  // ===== Setup =====
  let ctx: { examId: string; submissionId: string; questions: any[] };
  try {
    ctx = await setupExam();
  } catch (e) {
    console.error('فشل الإعداد:', (e as Error).message);
    process.exit(1);
  }

  // ===== احفظ إجابات الطلاب =====
  console.log('\n[1] حفظ إجابات الطالب...');
  const essayCorrect = ctx.questions.find((q) => q.type === 'ESSAY' && q.text.includes('المعين'))!;
  const shortPartial = ctx.questions.find((q) => q.type === 'SHORT')!;
  const essayWrong = ctx.questions.find((q) => q.type === 'ESSAY' && q.text.includes('الماء'))!;
  const imageQ = ctx.questions.find((q) => q.type === 'IMAGE_ANSWER')!;
  const mcqQ = ctx.questions.find((q) => q.type === 'MCQ')!;

  // إجابة ESSAY صحيحة (كاملة عن المعين)
  const saveEssayCorrect = await callJson(
    url(`/api/exams/${ctx.examId}/answers`, 'student', { submissionId: ctx.submissionId }),
    {
      method: 'POST',
      body: JSON.stringify({
        questionId: essayCorrect.id,
        text:
          'المعين هو متوازي أضلاع أضلاعه الأربعة متساوية في الطول. ' +
          'من خصائصه: (1) أضلاعه الأربعة متساوية، (2) أقطاره متعامدة وتنصف بعضها، ' +
          '(3) كل قطر ينصف زاويتين متقابلتين، (4) محيطه = 4 × طول الضلع. ' +
          'الفرق بينه وبين المربع: المربع له أقطار متساوية وزوايا قائمة، بينما المعين له أقطار غير متساوية وزوايا غير قائمة غالباً.',
      }),
    },
    'student'
  );
  record(
    'حفظ إجابة ESSAY صحيحة عن المعين',
    saveEssayCorrect.status === 200,
    saveEssayCorrect.data?.moderation?.decision || saveEssayCorrect.data?.error
  );

  // إجابة SHORT جزئية (تذكر القانون لكن نتيجة خاطئة)
  const saveShortPartial = await callJson(
    url(`/api/exams/${ctx.examId}/answers`, 'student', { submissionId: ctx.submissionId }),
    {
      method: 'POST',
      body: JSON.stringify({
        questionId: shortPartial.id,
        text: 'القانون: ط × نق². لكن لا أذكر النتيجة بدقة، أعتقد أنها 70 سم².',
      }),
    },
    'student'
  );
  record(
    'حفظ إجابة SHORT جزئية الصحة',
    saveShortPartial.status === 200,
    saveShortPartial.data?.moderation?.decision
  );

  // إجابة ESSAY خاطئة (لا علاقة لها بالسؤال)
  const saveEssayWrong = await callJson(
    url(`/api/exams/${ctx.examId}/answers`, 'student', { submissionId: ctx.submissionId }),
    {
      method: 'POST',
      body: JSON.stringify({
        questionId: essayWrong.id,
        text: 'لا أعرف الإجابة. ربما الماء بارد.',
      }),
    },
    'student'
  );
  record(
    'حفظ إجابة ESSAY خاطئة (لا علاقة)',
    saveEssayWrong.status === 200,
    saveEssayWrong.data?.moderation?.decision
  );

  // حفظ إجابة MCQ (للاتيان باختيار نصي)
  const saveMcq = await callJson(
    url(`/api/exams/${ctx.examId}/answers`, 'student', { submissionId: ctx.submissionId }),
    {
      method: 'POST',
      body: JSON.stringify({
        questionId: mcqQ.id,
        text: '56',
      }),
    },
    'student'
  );
  record(
    'حفظ إجابة MCQ صحيحة (56)',
    saveMcq.status === 200,
    saveMcq.data?.moderation?.decision || saveMcq.data?.error
  );

  // رفع صورة كإجابة IMAGE_ANSWER
  const pngPath = createTestPng();
  const pngBuffer = readFileSync(pngPath);
  const pngBlob = new Blob([pngBuffer], { type: 'image/png' });
  const formData = new FormData();
  formData.append('file', pngBlob, 'triangle.png');

  const uploadRes = await fetch(
    url(`/api/exams/${ctx.examId}/answers/${imageQ.id}/upload`, 'student', { submissionId: ctx.submissionId }),
    {
      method: 'POST',
      headers: {
        'x-student-id': STUDENT_ID,
      },
      body: formData,
    }
  );
  const uploadData = await uploadRes.json().catch(() => ({}));
  record(
    'رفع صورة كإجابة IMAGE_ANSWER',
    uploadRes.status === 200 && uploadData?.success === true,
    uploadData?.moderation?.decision || uploadData?.error
  );

  // تسليم المحاولة
  console.log('\n[2] تسليم المحاولة...');
  const submitRes = await callJson(
    url(`/api/exams/${ctx.examId}/submit`, 'student', { submissionId: ctx.submissionId }),
    { method: 'POST', body: JSON.stringify({}) },
    'student'
  );
  record(
    'تسليم المحاولة',
    submitRes.status === 200,
    `score=${submitRes.data?.totalScore}/${submitRes.data?.maxScore}`
  );

  // ===== احصل على تفاصيل التسليم لمعرفة answerIds =====
  console.log('\n[3] جلب تفاصيل التسليم (لإيجاد answerIds)...');
  const subDetail = await callJson(
    url(`/api/exams/teacher/submissions/${ctx.submissionId}`)
  );
  if (subDetail.status !== 200) {
    console.error('فشل جلب التسليم:', subDetail.status, subDetail.data);
    process.exit(1);
  }
  const answers = (subDetail.data.submission?.answers || subDetail.data.answers || []) as any[];
  const essayCorrectAns = answers.find((a: any) => a.questionId === essayCorrect.id);
  const shortPartialAns = answers.find((a: any) => a.questionId === shortPartial.id);
  const essayWrongAns = answers.find((a: any) => a.questionId === essayWrong.id);
  const imageAns = answers.find((a: any) => a.questionId === imageQ.id);
  const mcqAns = answers.find((a: any) => a.questionId === mcqQ.id);

  console.log(`  answerIds: essayCorrect=${essayCorrectAns?.id} shortPartial=${shortPartialAns?.id} essayWrong=${essayWrongAns?.id} image=${imageAns?.id} mcq=${mcqAns?.id}`);

  // ===== [E1] AI Grade-Assist — ESSAY صحيحة =====
  console.log('\n[4/E1] AI Grade-Assist على ESSAY صحيحة (المعين)...');
  const e1 = await callJson(url(`/api/exams/teacher/answers/${essayCorrectAns.id}/ai-grade`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const e1sugg = e1.data?.suggestion;
  record(
    'E1: ESSAY صحيحة → اقتراح درجة مرتفعة',
    e1.status === 200 &&
      e1sugg?.success === true &&
      typeof e1sugg?.suggestedScore === 'number' &&
      e1sugg.suggestedScore >= 3, // من 5 — عتبة معقولة لإجابة جيدة
    `score=${e1sugg?.suggestedScore}/5 confidence=${e1sugg?.confidence?.toFixed(2)} model=${e1sugg?.modelUsed} reasoning=${e1sugg?.reasoning?.slice(0, 100)}`
  );

  // ===== [E2] AI Grade-Assist — SHORT جزئية =====
  console.log('\n[5/E2] AI Grade-Assist على SHORT جزئية الصحة (مساحة الدائرة)...');
  const e2 = await callJson(url(`/api/exams/teacher/answers/${shortPartialAns.id}/ai-grade`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const e2sugg = e2.data?.suggestion;
  record(
    'E2: SHORT جزئية → اقتراح درجة متوسطة (ليست كاملة)',
    e2.status === 200 &&
      e2sugg?.success === true &&
      typeof e2sugg?.suggestedScore === 'number' &&
      e2sugg.suggestedScore < 3, // أقل من الدرجة الكاملة 3
    `score=${e2sugg?.suggestedScore}/3 confidence=${e2sugg?.confidence?.toFixed(2)} reasoning=${e2sugg?.reasoning?.slice(0, 100)}`
  );

  // ===== [E3] AI Grade-Assist — ESSAY خاطئة =====
  console.log('\n[6/E3] AI Grade-Assist على ESSAY خاطئة (لا علاقة بالموضوع)...');
  const e3 = await callJson(url(`/api/exams/teacher/answers/${essayWrongAns.id}/ai-grade`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const e3sugg = e3.data?.suggestion;
  record(
    'E3: ESSAY خاطئة → اقتراح درجة منخفضة (0 أو 1)',
    e3.status === 200 &&
      e3sugg?.success === true &&
      typeof e3sugg?.suggestedScore === 'number' &&
      e3sugg.suggestedScore <= 1, // من 4 — عتبة منخفضة
    `score=${e3sugg?.suggestedScore}/4 reasoning=${e3sugg?.reasoning?.slice(0, 100)}`
  );

  // ===== [E4] AI Grade-Assist — MCQ يجب أن يُرفض =====
  console.log('\n[7/E4] AI Grade-Assist على MCQ يجب أن يُرفض (400)...');
  const e4 = await callJson(url(`/api/exams/teacher/answers/${mcqAns.id}/ai-grade`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  record(
    'E4: MCQ يُرفض (400)',
    e4.status === 400 && !!e4.data?.error,
    `status=${e4.status} error=${e4.data?.error}`
  );

  // ===== [E5] AI Grade-Assist — IMAGE_ANSWER =====
  console.log('\n[8/E5] AI Grade-Assist على IMAGE_ANSWER (مثلث)...');
  const e5 = await callJson(url(`/api/exams/teacher/answers/${imageAns.id}/ai-grade`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const e5sugg = e5.data?.suggestion;
  record(
    'E5: IMAGE_ANSWER → VLM يقرأ الصورة ويُرجع اقتراحاً',
    e5.status === 200 &&
      e5sugg?.success === true &&
      typeof e5sugg?.suggestedScore === 'number' &&
      (e5sugg.modelUsed || '').includes('glm-4.6v') === true ||
      (e5sugg.modelUsed || '').includes('vision') === true,
    `score=${e5sugg?.suggestedScore}/3 model=${e5sugg?.modelUsed} reasoning=${e5sugg?.reasoning?.slice(0, 100)}`
  );

  // ===== [E6] Apply AI Grade =====
  console.log('\n[9/E6] تطبيق درجة بمساعدة AI (apply-ai-grade)...');
  const applyScore = e1sugg?.suggestedScore ?? 4;
  const e6 = await callJson(url(`/api/exams/teacher/answers/${essayCorrectAns.id}/apply-ai-grade`), {
    method: 'POST',
    body: JSON.stringify({
      score: applyScore,
      teacherNote: 'تم التصحيح بمساعدة الذكاء الاصطناعي بعد المراجعة.',
    }),
  });
  record(
    'E6: apply-ai-grade يطبّق الدرجة + aiAssisted=true',
    e6.status === 200 &&
      e6.data?.success === true &&
      e6.data?.answer?.aiAssisted === true,
    `score=${e6.data?.answer?.score} aiAssisted=${e6.data?.answer?.aiAssisted}`
  );

  // ===== [E7] AI Grade-Assist على إجابة غير موجودة =====
  console.log('\n[10/E7] AI Grade-Assist على إجابة غير موجودة (404)...');
  const e7 = await callJson(url(`/api/exams/teacher/answers/nonexistent-id/ai-grade`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  record('E7: 404 لإجابة غير موجودة', e7.status === 404, `status=${e7.status}`);

  // ===== [E8] سؤال تحسين (improve question) =====
  console.log('\n[11/E8] تحسين سؤال ESSAY (improve)...');
  const e8 = await callJson(url(`/api/exams/teacher/questions/${essayCorrect.id}/improve`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const e8sugg = e8.data?.suggestion;
  record(
    'E8: improve يُرجع صياغة محسّنة + معايير + تفسير',
    e8.status === 200 &&
      e8sugg?.suggestedQuestionText &&
      Array.isArray(e8sugg?.suggestedRubric) &&
      typeof e8sugg?.reasoning === 'string',
    `model=${e8sugg?.modelUsed} text=${e8sugg?.suggestedQuestionText?.slice(0, 100)} rubricCount=${e8sugg?.suggestedRubric?.length}`
  );

  // ===== [E9] تحسين MCQ (improve) =====
  console.log('\n[12/E9] تحسين سؤال MCQ (improve)...');
  const e9 = await callJson(url(`/api/exams/teacher/questions/${mcqQ.id}/improve`), {
    method: 'POST',
    body: JSON.stringify({}),
  });
  record(
    'E9: improve على MCQ يُرجع اقتراحاً',
    e9.status === 200 && e9.data?.success === true,
    e9.data?.suggestion?.suggestedQuestionText?.slice(0, 80) || e9.data?.error
  );

  // ===== [E10] scan-text محلي (افتراضي) =====
  console.log('\n[13/E10] scan-text افتراضي (محلي فقط)...');
  const e10 = await callJson(url(`/api/exams/security/scan-text`), {
    method: 'POST',
    body: JSON.stringify({ text: 'إجابة تعليمية عادية بدون أي محتوى مريب.' }),
  });
  record(
    'E10: scan-text محلي يُرجع mode=local + moderationDetails',
    e10.status === 200 &&
      e10.data?.mode === 'local' &&
      !!e10.data?.moderationDetails,
    `decision=${e10.data?.decision} modelUsed=${e10.data?.modelUsed}`
  );

  // ===== [E11] scan-text useAI=true =====
  console.log('\n[14/E11] scan-text useAI=true (LLM)...');
  const e11 = await callJson(`${url('/api/exams/security/scan-text')}&useAI=true`, {
    method: 'POST',
    body: JSON.stringify({
      text: 'أرجو مساعدتي في حل المسألة: اتصل بي على 0501234567',
    }),
  });
  record(
    'E11: scan-text useAI=true يُرجع mode=ai + modelUsed LLM',
    e11.status === 200 &&
      e11.data?.mode === 'ai' &&
      !!e11.data?.moderationDetails?.modelUsed,
    `decision=${e11.data?.decision} categories=${JSON.stringify(e11.data?.categories)} modelUsed=${e11.data?.modelUsed}`
  );

  // ===== [E12] scan-file مع moderationDetails =====
  console.log('\n[15/E12] scan-file مع moderationDetails...');
  const fBlob = new Blob([pngBuffer], { type: 'image/png' });
  const fForm = new FormData();
  fForm.append('file', fBlob, 'triangle.png');
  const e12Res = await fetch(`${url('/api/exams/security/scan-file')}&ai=true`, {
    method: 'POST',
    body: fForm,
  });
  const e12 = { status: e12Res.status, data: await e12Res.json().catch(() => ({})) };
  record(
    'E12: scan-file يُرجع moderationDetails + modelUsed VLM',
    e12.status === 200 &&
      !!e12.data?.moderationDetails &&
      typeof e12.data?.moderationDetails?.modelUsed === 'string',
    `decision=${e12.data?.moderation?.decision} modelUsed=${e12.data?.moderationDetails?.modelUsed}`
  );

  // ===== [E13] scan-file محلي (ai=false) =====
  console.log('\n[16/E13] scan-file محلي (ai=false) — moderationDetails محلية...');
  const fForm2 = new FormData();
  fForm2.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'triangle.png');
  const e13Res = await fetch(`${url('/api/exams/security/scan-file')}&ai=false`, {
    method: 'POST',
    body: fForm2,
  });
  const e13 = { status: e13Res.status, data: await e13Res.json().catch(() => ({})) };
  record(
    'E13: scan-file ai=false يُرجع moderationDetails محلية',
    e13.status === 200 &&
      !!e13.data?.moderationDetails &&
      (e13.data?.moderationDetails?.modelUsed || '').includes('local'),
    `modelUsed=${e13.data?.moderationDetails?.modelUsed}`
  );

  // ===== التقرير النهائي =====
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  النتيجة: ${pass}/${pass + fail} سيناريو ناجح`);
  console.log('═══════════════════════════════════════════════════════════');
  if (fail > 0) {
    console.log('\nالسيناريوهات الفاشلة:');
    results.filter((r) => !r.ok).forEach((r) => {
      console.log(`  ✗ ${r.name}: ${r.detail}`);
    });
    process.exit(2);
  } else {
    console.log('\nجميع السيناريوهات نجحت!');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('خطأ قاتل:', e);
  process.exit(1);
});
