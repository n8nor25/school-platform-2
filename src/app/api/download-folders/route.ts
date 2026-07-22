/**
 * ============================================================
 *  GET  /api/download-folders?schoolId=X&category=Y&includeInactive=0|1
 *  POST /api/download-folders  (JSON: schoolId, category, name, description?, sortOrder?)
 *  ============================================================
 *  • GET: قائمة المجلدات لمدرسة + تصنيف اختياري.
 *  • POST: إنشاء مجلد فرعي جديد داخل تصنيف.
 * ============================================================
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";
import { DOWNLOAD_CATEGORY_VALUES } from "@/lib/downloads";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get("schoolId"));
    if (!schoolId) {
      return NextResponse.json({ error: "معرف المدرسة مطلوب" }, { status: 400 });
    }

    const category = searchParams.get("category");
    const includeInactive =
      searchParams.get("includeInactive") === "1" ||
      searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = { schoolId };
    if (category && DOWNLOAD_CATEGORY_VALUES.includes(category as never)) {
      where.category = category;
    }
    if (!includeInactive) where.isActive = true;

    const folders = await db.downloadFolder.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    // عدّ الملفات في كل مجلد (للعرض)
    const foldersWithCount = await Promise.all(
      folders.map(async (f) => {
        const count = await db.downloadableFile.count({
          where: { folderId: f.id, isActive: true },
        });
        return { ...f, filesCount: count };
      })
    );

    return NextResponse.json({ success: true, folders: foldersWithCount });
  } catch (error) {
    console.error("[download-folders GET] error:", error);
    return NextResponse.json({ error: "فشل جلب المجلدات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const schoolIdParam = (body.schoolId as string) || "";
    const schoolId = await resolveSchoolId(schoolIdParam);
    if (!schoolId) {
      return NextResponse.json({ error: "معرف المدرسة مطلوب" }, { status: 400 });
    }

    const category = ((body.category as string) || "GENERAL").toUpperCase();
    const name = ((body.name as string) || "").trim();
    const description = ((body.description as string) || "").trim();
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

    if (!name) {
      return NextResponse.json({ error: "اسم المجلد مطلوب" }, { status: 400 });
    }
    if (!DOWNLOAD_CATEGORY_VALUES.includes(category as never)) {
      return NextResponse.json({ error: "التصنيف غير صالح" }, { status: 400 });
    }

    // تحقق من عدم تكرار الاسم في نفس التصنيف والمدرسة
    const existing = await db.downloadFolder.findFirst({
      where: { schoolId, category, name },
    });
    if (existing) {
      return NextResponse.json(
        { error: "يوجد مجلد بنفس الاسم في هذا التصنيف" },
        { status: 409 }
      );
    }

    const folder = await db.downloadFolder.create({
      data: {
        schoolId,
        category,
        name: name.slice(0, 100),
        description: description.slice(0, 500),
        sortOrder,
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, folder, message: "تم إنشاء المجلد بنجاح" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[download-folders POST] error:", error);
    return NextResponse.json(
      { error: "فشل إنشاء المجلد", details: (error as Error).message },
      { status: 500 }
    );
  }
}
