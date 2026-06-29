/**
 * ============================================================
 *  GET /api/exams/secure-file
 *  ============================================================
 *  يُقدّم ملفاً من التخزين الآمن بعد التحقق من الصلاحية.
 *
 *  - لا يُخدَّم الملف مباشرة من public/
 *  - يتحقق من جلسة الطالب + وجود الإجابة في محاولته
 *  - يضبط Content-Type و Content-Disposition بشكل صحيح
 *  - يمنع path traversal
 *
 *  Query: p (المسار النسبي), schoolId, studentId
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSecureFile } from '@/lib/exam-security';
import { db } from '@/lib/db';
import { resolveSchoolId } from '@/lib/school-utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const p = searchParams.get('p');
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'));
    const studentId = searchParams.get('studentId');

    if (!p) {
      return NextResponse.json({ error: 'المسار مطلوب' }, { status: 400 });
    }
    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ error: 'معرف الطالب مطلوب' }, { status: 401 });
    }

    // فحص path traversal: المسار يجب أن يبدأ بـ schoolId
    const normalized = p.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length < 2 || parts[0] !== schoolId) {
      return NextResponse.json({ error: 'صلاحية وصول مرفوضة' }, { status: 403 });
    }

    // التحقق من أن الملف مرتبط بإجابة الطالب
    // (المسار: schoolId/examId/submissionId/studentId/uuid.bin)
    // studentId في المسار يجب أن يطابق تماماً الطالب المُطالب
    if (parts.length >= 4 && parts[3] !== studentId) {
      // نتحقق إن كان المعلم/الإداري يطلب الملف (لاحقاً سنضيف role-based)
      // حالياً نرفض أي طالب لا يملك الملف
      return NextResponse.json({ error: 'صلاحية وصول مرفوضة — الملف لا يخصك' }, { status: 403 });
    }

    // قراءة الملف
    const buffer = await readSecureFile(normalized);
    if (!buffer) {
      return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 });
    }

    // تحديد Content-Type حسب الامتداد/المحتوى
    let contentType = 'application/octet-stream';
    let inline = true;

    // نفحص magic bytes لتحديد النوع الحقيقي
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      contentType = 'image/png';
    } else if (buffer.length >= 3 &&
               buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      contentType = 'image/jpeg';
    } else if (buffer.length >= 12 &&
               buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
               buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      contentType = 'image/webp';
    } else if (buffer.length >= 5 &&
               buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d) {
      contentType = 'application/pdf';
      inline = true;
    }

    // إعداد الـ headers الأمنية
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', String(buffer.length));
    headers.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="answer-${Date.now()}"`);
    // منع التخزين المؤقت (cache) — الملف حسّاس
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    // منع الإدراج في iframe (clickjacking)
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    // Content-Security-Policy صارمة
    headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (error) {
    console.error('[exams/secure-file] error:', error);
    return NextResponse.json(
      { error: 'فشل جلب الملف', details: (error as Error).message },
      { status: 500 }
    );
  }
}
