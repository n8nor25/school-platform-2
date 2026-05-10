import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCHOOL_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || SCHOOL_ID;
    const category = searchParams.get("category");
    const type = searchParams.get("type");

    const includeArchived = searchParams.get("includeArchived") === "true";
    const archivedOnly = searchParams.get("archivedOnly") === "true";

    const where: Record<string, unknown> = { schoolId };
    if (category) where.category = category;
    if (type) where.type = type;
    if (archivedOnly) {
      where.archived = true;
    } else if (!includeArchived) {
      where.archived = false;
    }

    const schedules = await db.schedule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      schoolId,
      title,
      category,
      grade,
      section,
      teacherName,
      dayOfWeek,
      filePath,
      fileName,
      type,
      active,
    } = body;

    if (!title || !filePath || !fileName) {
      return NextResponse.json(
        { error: "Title, filePath, and fileName are required" },
        { status: 400 }
      );
    }

    const schedule = await db.schedule.create({
      data: {
        schoolId: schoolId || SCHOOL_ID,
        title,
        category: category || "class",
        grade,
        section,
        teacherName,
        dayOfWeek,
        filePath,
        fileName,
        type: type || "حالي",
        active: active !== undefined ? active : true,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}
