/**
 * ============================================================
 *  PATCH  /api/download-folders/[id]   — تعديل الاسم/الوصف/الترتيب/الحالة
 *  DELETE /api/download-folders/[id]   — حذف المجلد (الملفات تنتقل لجذر التصنيف)
 *  ============================================================
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";
import { DOWNLOAD_CATEGORY_VALUES } from "@/lib/downloads";

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

    const existing = await db.downloadFolder.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "المجلد غير موجود" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      const newName = body.name.trim().slice(0, 100);
      // تحقق من عدم تكرار الاسم (في حال تغييره)
      if (newName !== existing.name) {
        const dup = await db.downloadFolder.findFirst({
          where: { schoolId, category: existing.category, name: newName },
        });
        if (dup) {
          return NextResponse.json(
            { error: "يوجد مجلد بنفس الاسم في هذا التصنيف" },
            { status: 409 }
          );
        }
        data.name = newName;
      }
    }
    if (typeof body.description === "string") {
      data.description = body.description.trim().slice(0, 500);
    }
    if (typeof body.category === "string") {
      const cat = body.category.toUpperCase();
      if (DOWNLOAD_CATEGORY_VALUES.includes(cat as never)) {
        data.category = cat;
      }
    }
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await db.downloadFolder.update({ where: { id }, data });
    return NextResponse.json({ success: true, folder: updated });
  } catch (error) {
    console.error("[download-folders PATCH] error:", error);
    return NextResponse.json({ error: "فشل تعديل المجلد" }, { status: 500 });
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

    const existing = await db.downloadFolder.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "المجلد غير موجود" }, { status: 404 });
    }

    // ارفع الملفات المرتبطة إلى جذر التصنيف (folderId = null) بدل حذفها
    await db.downloadableFile.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });

    await db.downloadFolder.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      message: "تم حذف المجلد. انتقلت ملفاته إلى جذر التصنيف.",
    });
  } catch (error) {
    console.error("[download-folders DELETE] error:", error);
    return NextResponse.json({ error: "فشل حذف المجلد" }, { status: 500 });
  }
}
