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

    const stats = await db.schoolStats.findUnique({
      where: { schoolId },
    });

    if (!stats) {
      return NextResponse.json(
        { students: 0, teachers: 0, classes: 0, years: 0 },
        { status: 200 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId: bodySchoolId, ...updateData } = body;
    const targetSchoolId = await resolveSchoolId(bodySchoolId);
    if (!targetSchoolId) {
      return NextResponse.json(
        { error: "No school found" },
        { status: 404 }
      );
    }

    const existing = await db.schoolStats.findUnique({
      where: { schoolId: targetSchoolId },
    });

    let stats;
    if (existing) {
      stats = await db.schoolStats.update({
        where: { schoolId: targetSchoolId },
        data: updateData,
      });
    } else {
      stats = await db.schoolStats.create({
        data: {
          schoolId: targetSchoolId,
          ...updateData,
        },
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error updating stats:", error);
    return NextResponse.json(
      { error: "Failed to update stats" },
      { status: 500 }
    );
  }
}
