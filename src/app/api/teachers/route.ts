import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolIdParam = searchParams.get("schoolId");
    const schoolId = await resolveSchoolId(schoolIdParam);
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school found" },
        { status: 404 }
      );
    }
    const includeArchived = searchParams.get("includeArchived") === "true";
    const archivedOnly = searchParams.get("archivedOnly") === "true";

    const where: Record<string, unknown> = { schoolId };
    if (archivedOnly) {
      where.archived = true;
    } else if (!includeArchived) {
      where.archived = false;
    }

    const teachers = await db.teacher.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(teachers);
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return NextResponse.json(
      { error: "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId: bodySchoolId, name, subject, email, imageUrl, sortOrder, active } = body;
    const schoolId = await resolveSchoolId(bodySchoolId);
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school found" },
        { status: 404 }
      );
    }

    if (!name || !subject) {
      return NextResponse.json(
        { error: "Name and subject are required" },
        { status: 400 }
      );
    }

    const teacher = await db.teacher.create({
      data: {
        schoolId,
        name,
        subject,
        email,
        imageUrl,
        sortOrder: sortOrder || 0,
        active: active !== undefined ? active : true,
      },
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error("Error creating teacher:", error);
    return NextResponse.json(
      { error: "Failed to create teacher" },
      { status: 500 }
    );
  }
}
