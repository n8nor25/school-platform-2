import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const archived = searchParams.get("archived");
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    const results = await db.result.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });

    const examResults = results.map((result) => {
      let students: unknown[] = [];
      try {
        students = JSON.parse(result.students);
      } catch {
        students = [];
      }

      return {
        id: result.id,
        gradeName: result.gradeName,
        term: result.term,
        studentCount: students.length,
        updatedAt: result.updatedAt.toISOString(),
        archived: false, // We don't have an archived field, default to false
      };
    });

    // If archived=false is requested, return all (since we don't have archived field)
    const filtered = archived === "false" ? examResults : examResults;

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error fetching exam results:", error);
    return NextResponse.json(
      { error: "Failed to fetch exam results" },
      { status: 500 }
    );
  }
}
