import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeName = searchParams.get("gradeName");
    const term = searchParams.get("term");
    const seatNumber = searchParams.get("seatNumber");
    const schoolId = searchParams.get("schoolId");

    if (!gradeName || !term || !seatNumber) {
      return NextResponse.json(
        { error: "gradeName, term, and seatNumber are required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      gradeName,
      term,
    };
    if (schoolId) where.schoolId = schoolId;

    const results = await db.result.findMany({ where });

    for (const result of results) {
      let students: Record<string, unknown>[] = [];
      try {
        students = JSON.parse(result.students);
      } catch {
        students = [];
      }

      const student = students.find(
        (s) => String(s.seatNumber) === String(seatNumber)
      );

      if (student) {
        return NextResponse.json({
          found: true,
          resultId: result.id,
          gradeName: result.gradeName,
          term: result.term,
          student,
        });
      }
    }

    return NextResponse.json({ found: false, student: null });
  } catch (error) {
    console.error("Error searching results:", error);
    return NextResponse.json(
      { error: "Failed to search results" },
      { status: 500 }
    );
  }
}
