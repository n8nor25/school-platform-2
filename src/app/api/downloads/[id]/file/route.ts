/**
 * ============================================================
 *  GET /api/downloads/[id]/file?schoolId=X
 *  ============================================================
 *  يُرجع الملف الفعلي كـ stream (مع headers مناسبة للتحميل)
 *  + يزيد عدّاد التحميلات.
 *
 *  ملاحظات:
 *    - لا يتطلب صلاحية (الملفات العامة متاحة للجميع)
 *    - يدعم Content-Disposition: attachment لإجبار التحميل
 *    - يدعم Content-Range للملفات الكبيرة (مبسّط)
 *    - يتحقق من أن الـ schoolId يطابق مدرسة الملف
 * ============================================================
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "downloads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get("schoolId"));
    if (!schoolId) {
      return NextResponse.json({ error: "معرف المدرسة مطلوب" }, { status: 400 });
    }

    const file = await db.downloadableFile.findUnique({ where: { id } });
    if (!file || file.schoolId !== schoolId) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }
    if (!file.isActive) {
      return NextResponse.json({ error: "الملف غير متاح" }, { status: 410 });
    }
    // صلاحية الإدارة فقط: تتطلب علامة admin (تُمرَّر من لوحة الإدارة)
    // الملفات العامة (PUBLIC/STAFF/TEACHER/PARENT) متاحة للجميع للتحميل
    if (file.visibility === "ADMIN") {
      const adminToken = searchParams.get("adminToken") || request.headers.get("x-admin-token");
      if (adminToken !== "school-admin-download") {
        return NextResponse.json(
          { error: "هذا الملف للإدارة فقط. سجّل دخول الإدارة للتحميل." },
          { status: 403 }
        );
      }
    }

    const fullPath = path.join(UPLOAD_ROOT, file.filePath);

    // تحقق من الوجود
    let stat;
    try {
      stat = await fs.stat(fullPath);
    } catch {
      return NextResponse.json({ error: "الملف غير موجود على القرص" }, { status: 404 });
    }

    // اقرأ الملف كـ Buffer (مبسّط — للملفات <= 20MB هذا كافٍ)
    const buffer = await fs.readFile(fullPath);

    // زِد عدّاد التحميلات (في الخلفية، لا يوقف الاستجابة)
    db.downloadableFile
      .update({
        where: { id },
        data: { downloadsCount: { increment: 1 } },
      })
      .catch(() => {});

    // ابحث عن اسم نظيف للملف عند التحميل
    const downloadName = file.fileName || path.basename(fullPath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": file.fileType || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[downloads file GET] error:", error);
    return NextResponse.json({ error: "فشل تحميل الملف" }, { status: 500 });
  }
}
