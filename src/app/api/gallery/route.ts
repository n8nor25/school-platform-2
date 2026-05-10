import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCHOOL_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || SCHOOL_ID;
    const includeArchived = searchParams.get("includeArchived") === "true";
    const archivedOnly = searchParams.get("archivedOnly") === "true";

    const where: Record<string, unknown> = { schoolId };
    if (archivedOnly) {
      where.archived = true;
    } else if (!includeArchived) {
      where.archived = false;
    }

    const gallery = await db.gallery.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(gallery);
  } catch (error) {
    console.error("Error fetching gallery:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, title, imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    const gallery = await db.gallery.create({
      data: {
        schoolId: schoolId || SCHOOL_ID,
        title,
        imageUrl,
      },
    });

    return NextResponse.json(gallery, { status: 201 });
  } catch (error) {
    console.error("Error creating gallery item:", error);
    return NextResponse.json(
      { error: "Failed to create gallery item" },
      { status: 500 }
    );
  }
}
