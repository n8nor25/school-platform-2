import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";

export async function GET(request: Request) {
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

    const school = await db.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    const settings = await db.settings.findUnique({
      where: { schoolId: school.id },
    });

    const stats = await db.schoolStats.findUnique({
      where: { schoolId: school.id },
    });

    return NextResponse.json({
      school,
      settings,
      stats,
      schoolId: school.id,
    });
  } catch (error) {
    console.error("Error fetching school:", error);
    return NextResponse.json(
      { error: "Failed to fetch school data" },
      { status: 500 }
    );
  }
}
