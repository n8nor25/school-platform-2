import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get("subdomain");

    if (!subdomain) {
      return NextResponse.json(
        { error: "Subdomain is required" },
        { status: 400 }
      );
    }

    const school = await db.school.findUnique({
      where: { subdomain },
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
    console.error("Error fetching school by subdomain:", error);
    return NextResponse.json(
      { error: "Failed to fetch school data" },
      { status: 500 }
    );
  }
}
