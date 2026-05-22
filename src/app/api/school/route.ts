import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      // No schoolId provided, return the first available school
      const anySchool = await db.school.findFirst({
        where: { isActive: true },
      });
      if (!anySchool) {
        return NextResponse.json(
          { error: "No school found" },
          { status: 404 }
        );
      }
      const settings = await db.settings.findUnique({
        where: { schoolId: anySchool.id },
      });
      const stats = await db.schoolStats.findUnique({
        where: { schoolId: anySchool.id },
      });
      return NextResponse.json({
        school: anySchool,
        settings,
        stats,
        schoolId: anySchool.id,
      });
    }

    const school = await db.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      // School not found by ID, try to find any active school as fallback
      const anySchool = await db.school.findFirst({
        where: { isActive: true },
      });
      if (!anySchool) {
        return NextResponse.json(
          { error: "No school found" },
          { status: 404 }
        );
      }
      const settings = await db.settings.findUnique({
        where: { schoolId: anySchool.id },
      });
      const stats = await db.schoolStats.findUnique({
        where: { schoolId: anySchool.id },
      });
      return NextResponse.json({
        school: anySchool,
        settings,
        stats,
        schoolId: anySchool.id,
      });
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
