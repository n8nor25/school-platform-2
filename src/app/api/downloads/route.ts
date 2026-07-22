/**
 * ============================================================
 *  GET  /api/downloads?schoolId=X&category=Y&includeInactive=0|1
 *  POST /api/downloads  (multipart/form-data)
 *  ============================================================
 *  • GET: قائمة الملفات لمدرسة + تصنيف اختياري. عام (لا يحتاج صلاحية).
 *  • POST: رفع ملف جديد (admin). يقبل FormData بحقول:
 *    - file: الملف (مطلوب)
 *    - schoolId: مطلوب
 *    - category: STUDENT_AFFAIRS | STAFF_AFFAIRS | FINANCIAL | ADMINISTRATIVE | GENERAL
 *    - title: مطلوب (عنوان عربي)
 *    - description: اختياري
 *    - uploadedById: اختياري
 *    - uploadedByName: اختياري
 * ============================================================
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";
import {
  DOWNLOAD_CATEGORY_VALUES,
  DOWNLOAD_VISIBILITY_VALUES,
  MAX_FILE_SIZE,
  isAllowedMimeType,
  generateUniqueFileName,
  getCategoryInfo,
} from "@/lib/downloads";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "downloads");

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = await resolveSchoolId(searchParams.get("schoolId"));
    if (!schoolId) {
      return NextResponse.json({ error: "معرف المدرسة مطلوب" }, { status: 400 });
    }

    const category = searchParams.get("category");
    const includeInactive = searchParams.get("includeInactive") === "1" || searchParams.get("includeInactive") === "true";
    const search = searchParams.get("search")?.trim() || "";
    const folderId = searchParams.get("folderId");
    const visibility = searchParams.get("visibility");
    const publicOnly = searchParams.get("publicOnly") === "1" || searchParams.get("publicOnly") === "true";

    const where: Record<string, unknown> = { schoolId };
    if (category && DOWNLOAD_CATEGORY_VALUES.includes(category as never)) {
      where.category = category;
    }
    if (!includeInactive) where.isActive = true;
    // فلتر المجلد: "root" = جذر التصنيف (folderId = null) | معرّف = مجلد محدد | بدون = الكل
    if (folderId === "root") {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }
    // فلتر الصلاحية
    if (visibility && DOWNLOAD_VISIBILITY_VALUES.includes(visibility as never)) {
      where.visibility = visibility;
    }
    // الصفحة العامة ترى الصلاحيات العامة فقط (PUBLIC/STAFF/TEACHER/PARENT)
    if (publicOnly) {
      where.visibility = { not: "ADMIN" };
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { fileName: { contains: search } },
      ];
    }

    const files = await db.downloadableFile.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 500,
    });

    return NextResponse.json({ success: true, files });
  } catch (error) {
    console.error("[downloads GET] error:", error);
    return NextResponse.json({ error: "فشل جلب الملفات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const schoolIdParam = (form.get("schoolId") as string) || "";
    const category = ((form.get("category") as string) || "GENERAL").toUpperCase();
    const title = (form.get("title") as string) || "";
    const description = (form.get("description") as string) || "";
    const uploadedById = (form.get("uploadedById") as string) || null;
    const uploadedByName = (form.get("uploadedByName") as string) || "";
    const folderId = (form.get("folderId") as string) || null;
    const visibility = ((form.get("visibility") as string) || "PUBLIC").toUpperCase();
    const sortOrderRaw = form.get("sortOrder");
    const sortOrder = sortOrderRaw !== null && sortOrderRaw !== "" && Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : 0;

    const schoolId = await resolveSchoolId(schoolIdParam);
    if (!schoolId) {
      return NextResponse.json({ error: "معرف المدرسة مطلوب" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `حجم الملف يتجاوز الحد المسموح (20 ميجابايت)` },
        { status: 400 }
      );
    }
    if (!isAllowedMimeType(file.type) && !file.name.match(/\.(pdf|docx?|xlsx?|pptx?|csv|txt|png|jpe?g|gif|webp|zip)$/i)) {
      return NextResponse.json(
        { error: "نوع الملف غير مدعوم. الأنواع المدعومة: PDF, Word, Excel, PowerPoint, صور, ZIP, نص" },
        { status: 400 }
      );
    }
    if (!title.trim()) {
      return NextResponse.json({ error: "عنوان الملف مطلوب" }, { status: 400 });
    }
    if (!DOWNLOAD_CATEGORY_VALUES.includes(category as never)) {
      return NextResponse.json({ error: "التصنيف غير صالح" }, { status: 400 });
    }
    if (!DOWNLOAD_VISIBILITY_VALUES.includes(visibility as never)) {
      return NextResponse.json({ error: "الصلاحية غير صالحة" }, { status: 400 });
    }
    // تحقق من المجلد إن وُجد
    if (folderId) {
      const folder = await db.downloadFolder.findUnique({ where: { id: folderId } });
      if (!folder || folder.schoolId !== schoolId || folder.category !== category) {
        return NextResponse.json(
          { error: "المجلد غير صالح أو لا ينتمي لهذا التصنيف" },
          { status: 400 }
        );
      }
    }

    const catInfo = getCategoryInfo(category);
    if (!catInfo) {
      return NextResponse.json({ error: "التصنيف غير معروف" }, { status: 400 });
    }

    // تأكّد من وجود المجلد
    const targetDir = path.join(UPLOAD_ROOT, catInfo.folder);
    await fs.mkdir(targetDir, { recursive: true });

    // اسم فريد على القرص
    const uniqueName = generateUniqueFileName(file.name);
    const fullPath = path.join(targetDir, uniqueName);

    // اكتب الملف
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(fullPath, buffer);

    // المسار النسبي للقاعدة
    const relativePath = `${catInfo.folder}/${uniqueName}`;

    const record = await db.downloadableFile.create({
      data: {
        schoolId,
        category,
        folderId,
        title: title.trim().slice(0, 200),
        description: description.trim().slice(0, 2000),
        fileName: file.name.slice(0, 200),
        filePath: relativePath,
        fileType: file.type || "application/octet-stream",
        fileSize: buffer.length,
        uploadedById: uploadedById || null,
        uploadedByName: uploadedByName.slice(0, 100),
        visibility,
        sortOrder,
        isActive: true,
        downloadsCount: 0,
      },
    });

    return NextResponse.json(
      { success: true, file: record, message: "تم رفع الملف بنجاح" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[downloads POST] error:", error);
    return NextResponse.json(
      { error: "فشل رفع الملف", details: (error as Error).message },
      { status: 500 }
    );
  }
}
