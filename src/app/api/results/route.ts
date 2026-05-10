import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeName = searchParams.get("gradeName");
    const term = searchParams.get("term");
    const schoolId = searchParams.get("schoolId");

    const includeArchived = searchParams.get("includeArchived") === "true";
    const archivedOnly = searchParams.get("archivedOnly") === "true";

    const where: Record<string, unknown> = {};
    if (gradeName) where.gradeName = gradeName;
    if (term) where.term = term;
    if (schoolId) where.schoolId = schoolId;
    if (archivedOnly) {
      where.archived = true;
    } else if (!includeArchived) {
      where.archived = false;
    }

    const results = await db.result.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const resultsWithCount = results.map((result) => {
      let students: unknown[] = [];
      try {
        students = JSON.parse(result.students);
      } catch {
        students = [];
      }
      return {
        ...result,
        students: undefined,
        studentCount: students.length,
      };
    });

    return NextResponse.json(resultsWithCount);
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gradeName, term, students, schoolId } = body;

    if (!gradeName || !term) {
      return NextResponse.json(
        { error: "Grade name and term are required" },
        { status: 400 }
      );
    }

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 }
      );
    }

    const studentsString = Array.isArray(students)
      ? JSON.stringify(students)
      : students || "[]";

    const result = await db.result.create({
      data: {
        gradeName,
        term,
        students: studentsString,
        schoolId,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating result:", error);
    return NextResponse.json(
      { error: "Failed to create result" },
      { status: 500 }
    );
  }
}
