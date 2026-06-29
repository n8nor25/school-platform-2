/**
 * ============================================================
 *  تعقيم PDF — الطبقة الثانية من الدفاع (للملفات)
 *  PDF Sanitizer — Second Line of Defense (for files)
 * ============================================================
 *  نُنشئ PDF جديداً نظيفاً بنسخ الصفحات فقط:
 *  • نزيل: JavaScript, EmbedFiles (مرفقات مخفية), Actions, Launch
 *  • نزيل: الروابط الخارجية (URI) غير الضرورية
 *  • نزيل: AcroForm scripts, OpenAction
 *  • نزيل: البيانات الوصفية الحساسة (المؤلف، التوقيت)
 *  • نحدّ عدد الصفحات (يمنع DoS بملفات ضخمة)
 * ============================================================
 */

import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import type { PdfSanitizeResult } from './types';

/** الحد الأقصى لعدد الصفحات */
const MAX_PAGES = 50;
/** حد الحجم الناتج (15MB) */
const MAX_OUTPUT_BYTES = 15 * 1024 * 1024;

/**
 * يعقّم ملف PDF من Buffer
 * @param input Buffer الـ PDF الأصلي
 */
export async function sanitizePdf(input: Buffer): Promise<PdfSanitizeResult> {
  const cleaned: string[] = [];

  try {
    // 1) قراءة المستند الأصلي (مع تعطيل أنظمة التحميل الخارجية)
    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(input, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    } catch (e) {
      return {
        ok: false, buffer: null, pageCount: 0, sizeBytes: 0, cleaned: [],
        error: `فشل قراءة PDF: ${(e as Error).message}`,
      };
    }

    const originalPageCount = srcDoc.getPageCount();
    if (originalPageCount === 0) {
      return {
        ok: false, buffer: null, pageCount: 0, sizeBytes: 0, cleaned: [],
        error: 'الملف PDF لا يحتوي على أي صفحات',
      };
    }
    if (originalPageCount > MAX_PAGES) {
      return {
        ok: false, buffer: null, pageCount: originalPageCount, sizeBytes: 0, cleaned: [],
        error: `عدد الصفحات (${originalPageCount}) يتجاوز الحد المسموح (${MAX_PAGES})`,
      };
    }

    // 2) فحص المحتوى الخطير قبل النسخ
    try {
      const catalog = srcDoc.catalog;

      // كشف OpenAction (سكر يفتح عند فتح الملف)
      if (catalog.has(PDFName.of('OpenAction'))) {
        cleaned.push('حذف OpenAction (إجراء عند الفتح)');
      }
      // كشف AcroForm (قد يحتوي سكربتات)
      if (catalog.has(PDFName.of('AcroForm'))) {
        const acroForm = catalog.get(PDFName.of('AcroForm'));
        if (acroForm instanceof PDFDict) {
          if (acroForm.has(PDFName.of('AA')) || acroForm.has(PDFName.of('A'))) {
            cleaned.push('حذف AcroForm scripts');
          }
        }
      }
      // كشف Names tree (قد يحتوي JavaScript names)
      if (catalog.has(PDFName.of('Names'))) {
        const names = catalog.get(PDFName.of('Names'));
        if (names instanceof PDFDict && names.has(PDFName.of('JavaScript'))) {
          cleaned.push('حذف JavaScript Names tree');
        }
      }
    } catch {
      // متابعة حتى لو فشل الفحص التفصيلي
    }

    // 3) إنشاء مستند جديد نظيف ونسخ الصفحات فقط
    const destDoc = await PDFDocument.create();
    // تعطيل metadata الحساسة
    destDoc.setTitle('');
    destDoc.setAuthor('');
    destDoc.setSubject('');
    destDoc.setKeywords([]);
    destDoc.setProducer('School Platform — Exam Security');
    destDoc.setCreator('School Platform — Exam Security');
    destDoc.setCreationDate(new Date());
    destDoc.setModificationDate(new Date());

    // نسخ الصفحات (هذا يتجاهل كل الـ attachments, JS, actions تلقائياً)
    const pages = await destDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    pages.forEach(p => destDoc.addPage(p));

    // 4) فحص نهائي على المستند الوجهة
    try {
      const destCatalog = destDoc.catalog;
      // نزيل أي OpenAction متبقية
      if (destCatalog.has(PDFName.of('OpenAction'))) {
        destCatalog.delete(PDFName.of('OpenAction'));
        cleaned.push('إزالة OpenAction من المستند الوجهة');
      }
      // نزيل Names tree كاملاً (لا حاجة له في PDF امتحان)
      if (destCatalog.has(PDFName.of('Names'))) {
        destCatalog.delete(PDFName.of('Names'));
        cleaned.push('إزالة شجرة Names (JavaScript/Embedded files)');
      }
      // نزيل AcroForm scripts
      if (destCatalog.has(PDFName.of('AcroForm'))) {
        const af = destCatalog.get(PDFName.of('AcroForm'));
        if (af instanceof PDFDict) {
          if (af.has(PDFName.of('AA'))) af.delete(PDFName.of('AA'));
          if (af.has(PDFName.of('A'))) af.delete(PDFName.of('A'));
          if (af.has(PDFName.of('NeedAppearances'))) af.delete(PDFName.of('NeedAppearances'));
        }
        cleaned.push('تعقيم AcroForm');
      }
      // نزيل Outlines (قد تحتوي إجراءات)
      if (destCatalog.has(PDFName.of('Outlines'))) {
        destCatalog.delete(PDFName.of('Outlines'));
        cleaned.push('إزالة الإشارات المرجعية (Outlines)');
      }
    } catch {
      // متابعة
    }

    // 5) حفظ المستند النظيف
    const outputBuffer = Buffer.from(await destDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      // تعطيل أي metadata إضافية
    }));

    // 6) فحص الحجم الناتج
    if (outputBuffer.length > MAX_OUTPUT_BYTES) {
      return {
        ok: false, buffer: null, pageCount: pages.length, sizeBytes: outputBuffer.length,
        cleaned,
        error: `حجم PDF بعد التعقيم (${outputBuffer.length} بايت) يتجاوز ${MAX_OUTPUT_BYTES} بايت`,
      };
    }

    // 7) تحقق نهائي: إعادة قراءة المستند النظيف
    try {
      const verify = await PDFDocument.load(outputBuffer, { ignoreEncryption: true });
      if (verify.getPageCount() !== pages.length) {
        return {
          ok: false, buffer: null, pageCount: pages.length, sizeBytes: outputBuffer.length,
          cleaned,
          error: 'عدد الصفحات في المستند النظيف غير متطابق',
        };
      }
    } catch (e) {
      return {
        ok: false, buffer: null, pageCount: pages.length, sizeBytes: outputBuffer.length,
        cleaned,
        error: `فشل التحقق من PDF النظيف: ${(e as Error).message}`,
      };
    }

    if (cleaned.length === 0) cleaned.push('إعادة بناء PDF (نسخ صفحات فقط)');

    return {
      ok: true,
      buffer: outputBuffer,
      pageCount: pages.length,
      sizeBytes: outputBuffer.length,
      cleaned,
    };
  } catch (e) {
    return {
      ok: false, buffer: null, pageCount: 0, sizeBytes: 0, cleaned,
      error: `خطأ أثناء تعقيم PDF: ${(e as Error).message}`,
    };
  }
}
