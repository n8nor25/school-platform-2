/**
 * ============================================================
 *  PATCH /api/downloads/[id]   — تعديل العنوان/الوصف/التصنيف/الحالة
 *  DELETE /api/downloads/[id]  — حذف الملف من القرص + من DB
 *  ============================================================
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";
import { DOWNLOAD_CATEGORY_VALUES, DOWNLOAD_VISIBILITY_VALUES } from "@/lib/downloads";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "downloads");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const schoolIdParam = body.schoolId as string | undefined;

    const schoolId = await resolveSchoolId(schoolIdParam);
    if (!schoolId) {
      return NextResponse.json({ error: "معرف المدرسة مطلوب" }, { status: 400 });
    }

    const existing = await db.downloadableFile.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim().slice(0, 200);
    }
    if (typeof body.description === "string") {
      data.description = body.description.trim().slice(0, 2000);
    }
    if (typeof body.category === "string") {
      const cat = body.category.toUpperCase();
      if (DOWNLOAD_CATEGORY_VALUES.includes(cat as never)) {
        data.category = cat;
        // عند تغيير التصنيف، ارفع الملف إلى جذر التصنيف الجديد
        data.folderId = null;
      }
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }
    if (typeof body.visibility === "string") {
      const vis = body.visibility.toUpperCase();
      if (DOWNLOAD_VISIBILITY_VALUES.includes(vis as never)) {
        data.visibility = vis;
      }
    }
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }
    // المجلد: null = جذر التصنيف | معرّف = مجلد محدد | undefined = لا تغيير
    if (body.folderId !== undefined) {
      const newFolderId = body.folderId === null || body.folderId === "" ? null : body.folderId;
      if (newFolderId) {
        const folder = await db.downloadFolder.findUnique({ where: { id: newFolderId } });
        const targetCategory = (data.category as string) || existing.category;
        if (!folder || folder.schoolId !== schoolId || folder.category !== targetCategory) {
          return NextResponse.json(
            { error: "المجلد غير صالح أو لا ينتمي لتصنيف الملف" },
            { status: 400 }
          );
        }
      }
      data.folderId = newFolderId;
    }

    const updated = await db.downloadableFile.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, file: updated });
  } catch (error) {
    console.error("[downloads PATCH] error:", error);
    return NextResponse.json({ error: "فشل تعديل الملف" }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await db.downloadableFile.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    // احذف الملف من القرص (تجاهل الأخطاء لو الملف محذوف سابقاً)
    const fullPath = path.join(UPLOAD_ROOT, existing.filePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // لا يهم لو الملف غير موجود على القرص
    }

    await db.downloadableFile.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "تم حذف الملف" });
  } catch (error) {
    console.error("[downloads DELETE] error:", error);
    return NextResponse.json({ error: "فشل حذف الملف" }, { status: 500 });
  }
}
