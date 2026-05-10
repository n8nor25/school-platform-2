import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCHOOL_ID } from "@/lib/constants";

// Fields that belong to the School model, not Settings
const SCHOOL_FIELDS = ["phone", "email", "address", "name", "description", "logoUrl", "primaryColor", "secondaryColor"];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || SCHOOL_ID;

    const settings = await db.settings.findUnique({
      where: { schoolId },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    // Also include school contact data so the frontend can display it
    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: { phone: true, email: true, address: true, name: true, description: true, logoUrl: true, primaryColor: true, secondaryColor: true },
    });

    return NextResponse.json({ ...settings, ...school });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId, ...allData } = body;
    const targetSchoolId = schoolId || SCHOOL_ID;

    // Separate Settings fields from School fields
    const settingsData: Record<string, unknown> = {};
    const schoolData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(allData)) {
      if (SCHOOL_FIELDS.includes(key)) {
        schoolData[key] = value;
      } else {
        settingsData[key] = value;
      }
    }

    // Update School fields if any
    if (Object.keys(schoolData).length > 0) {
      await db.school.update({
        where: { id: targetSchoolId },
        data: schoolData,
      });
    }

    // Update or create Settings
    let settings;
    if (Object.keys(settingsData).length > 0) {
      const existing = await db.settings.findUnique({
        where: { schoolId: targetSchoolId },
      });

      if (existing) {
        settings = await db.settings.update({
          where: { schoolId: targetSchoolId },
          data: settingsData,
        });
      } else {
        settings = await db.settings.create({
          data: {
            schoolId: targetSchoolId,
            ...settingsData,
          },
        });
      }
    } else {
      settings = await db.settings.findUnique({
        where: { schoolId: targetSchoolId },
      });
    }

    // Return combined data
    const school = await db.school.findUnique({
      where: { id: targetSchoolId },
      select: { phone: true, email: true, address: true, name: true, description: true, logoUrl: true, primaryColor: true, secondaryColor: true },
    });

    return NextResponse.json({ ...settings, ...school });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
