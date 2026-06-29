/**
 * ============================================================
 *  تعقيم الصور — الطبقة الثانية من الدفاع
 *  Image Sanitizer — Second Line of Defense
 * ============================================================
 *  نستخدم sharp لإعادة ترميز الصورة بشكل نظيف:
 *  • يُعيد كتابة الـ chunks كاملةً → يُبطِل أي حمولة مخفية
 *  • يحذف بيانات EXIF (GPS، الكاميرا، التوقيت)
 *  • يحوّل GIF المتحركة لأول إطار فقط (يمنع payloads)
 *  • يفرض حد أقصى للأبعاد (يمنع DoS بالصور العملاقة)
 *  • يرفض الصور التالفة أو المشفّرة
 * ============================================================
 */

import sharp from 'sharp';
import type { ImageSanitizeResult } from './types';

/** الحد الأقصى للأبعاد */
const MAX_WIDTH = 2400;
const MAX_HEIGHT = 3200;
/** حد الحجم الناتج (8MB) */
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * يعقّم صورة من Buffer
 * @param input Buffer الصورة الأصلية
 * @param sourceMime الموعود من الفاحص (image/png, image/jpeg, image/webp)
 */
export async function sanitizeImage(
  input: Buffer,
  sourceMime: string
): Promise<ImageSanitizeResult> {
  const cleaned: string[] = [];

  try {
    // نقرأ metadata أولاً (للتعرف على الأبعاد والنوع)
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, { animated: false }).metadata();
    } catch (e) {
      return {
        ok: false, buffer: null, mimeType: sourceMime,
        width: 0, height: 0, sizeBytes: 0,
        cleaned: [],
        error: `فشل قراءة metadata الصورة: ${(e as Error).message}`,
      };
    }

    // إذا كانت الصورة GIF متحركة، نأخذ أول إطار فقط
    let pipeline = sharp(input, { animated: false, pages: 1 });
    if (metadata.hasProfile || metadata.icc) {
      cleaned.push('حذف ملف تعريف اللون ICC المدمج');
    }
    if (metadata.exif) {
      cleaned.push('حذف بيانات EXIF (GPS/الكاميرا/التوقيت)');
    }

    // تحديد صيغة الإخراج: نُبقي الصيغة الأصلية لكن نعيد ترميزها
    let outputBuffer: Buffer;
    let outputMime = sourceMime;
    let width = metadata.width ?? 0;
    let height = metadata.height ?? 0;

    // تقليل الأبعاد إن لزم
    const needsResize = width > MAX_WIDTH || height > MAX_HEIGHT;
    if (needsResize) {
      pipeline = pipeline.resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      });
      cleaned.push(`تقليل الأبعاد من ${width}x${height} إلى الحد الأقصى ${MAX_WIDTH}x${MAX_HEIGHT}`);
    }

    // إعادة الترميز حسب الصيغة (هذا يُبطِل payloads الـ chunks)
    if (sourceMime === 'image/png') {
      outputBuffer = await pipeline
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          force: true,
        })
        .toBuffer();
      outputMime = 'image/png';
    } else if (sourceMime === 'image/jpeg' || sourceMime === 'image/jpg') {
      outputBuffer = await pipeline
        .flatten({ background: '#ffffff' }) // إزالة الشفافية (JPEG لا يدعمها)
        .jpeg({
          quality: 85,
          progressive: false,
          mozjpeg: true,
          force: true,
        })
        .toBuffer();
      outputMime = 'image/jpeg';
    } else if (sourceMime === 'image/webp') {
      outputBuffer = await pipeline
        .webp({
          quality: 85,
          force: true,
        })
        .toBuffer();
      outputMime = 'image/webp';
    } else {
      // افتراضياً نحوّل لـ PNG (آمنة وبدون فقدان)
      outputBuffer = await pipeline
        .png({ compressionLevel: 9, force: true })
        .toBuffer();
      outputMime = 'image/png';
      cleaned.push(`تحويل من ${sourceMime} إلى image/png (الصيغة الافتراضية الآمنة)`);
    }

    // قراءة الأبعاد النهائية
    const finalMeta = await sharp(outputBuffer).metadata();
    width = finalMeta.width ?? width;
    height = finalMeta.height ?? height;

    // فحص الحجم الناتج
    if (outputBuffer.length > MAX_OUTPUT_BYTES) {
      if (outputMime === 'image/jpeg') {
        outputBuffer = await sharp(outputBuffer)
          .jpeg({ quality: 60, force: true })
          .toBuffer();
        cleaned.push('إعادة ضغط JPEG بجودة أقل لتقليل الحجم');
      } else if (outputMime === 'image/webp') {
        outputBuffer = await sharp(outputBuffer)
          .webp({ quality: 60, force: true })
          .toBuffer();
        cleaned.push('إعادة ضغط WebP بجودة أقل لتقليل الحجم');
      }
      if (outputBuffer.length > MAX_OUTPUT_BYTES) {
        return {
          ok: false, buffer: null, mimeType: outputMime,
          width, height, sizeBytes: outputBuffer.length,
          cleaned,
          error: `حجم الصورة بعد التعقيم (${outputBuffer.length} بايت) لا يزال يتجاوز ${MAX_OUTPUT_BYTES} بايت`,
        };
      }
    }

    // تحقق نهائي: الصورة النظيفة يجب أن تُقرأ بنجاح
    try {
      await sharp(outputBuffer).metadata();
    } catch {
      return {
        ok: false, buffer: null, mimeType: outputMime,
        width, height, sizeBytes: 0,
        cleaned,
        error: 'الصورة الناتجة تالفة بعد إعادة الترميز',
      };
    }

    if (cleaned.length === 0) cleaned.push('إعادة ترميز الصورة (تعقيم افتراضي)');

    return {
      ok: true,
      buffer: outputBuffer,
      mimeType: outputMime,
      width,
      height,
      sizeBytes: outputBuffer.length,
      cleaned,
    };
  } catch (e) {
    return {
      ok: false, buffer: null, mimeType: sourceMime,
      width: 0, height: 0, sizeBytes: 0,
      cleaned,
      error: `خطأ أثناء تعقيم الصورة: ${(e as Error).message}`,
    };
  }
}

/** يستخرج أبعاد الصورة بدون تعقيم كامل (للمعاينة السريعة) */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const m = await sharp(buffer).metadata();
    return { width: m.width ?? 0, height: m.height ?? 0 };
  } catch {
    return null;
  }
}
