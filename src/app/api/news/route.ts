import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCHOOL_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || SCHOOL_ID;
    const category = searchParams.get("category");
    const limit = searchParams.get("limit");
    const active = searchParams.get("active");

    const includeArchived = searchParams.get("includeArchived") === "true";
    const archivedOnly = searchParams.get("archivedOnly") === "true";

    const where: Record<string, unknown> = { schoolId };
    if (category) where.category = category;
    if (active !== null) where.active = active === "true";
    if (archivedOnly) {
      where.archived = true;
    } else if (!includeArchived) {
      where.archived = false;
    }

    const news = await db.news.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, title, slug, excerpt, content, image, category, active } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const news = await db.news.create({
      data: {
        schoolId: schoolId || SCHOOL_ID,
        title,
        slug,
        excerpt,
        content,
        image,
        category: category || "أخبار",
        active: active !== undefined ? active : true,
      },
    });

    return NextResponse.json(news, { status: 201 });
  } catch (error) {
    console.error("Error creating news:", error);
    return NextResponse.json(
      { error: "Failed to create news" },
      { status: 500 }
    );
  }
}
