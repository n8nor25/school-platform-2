import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await db.result.findUnique({ where: { id } });

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    let students: unknown[] = [];
    try {
      students = JSON.parse(result.students);
    } catch {
      students = [];
    }

    return NextResponse.json({
      ...result,
      students,
    });
  } catch (error) {
    console.error("Error fetching result:", error);
    return NextResponse.json(
      { error: "Failed to fetch result" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if ("gradeName" in body) updateData.gradeName = body.gradeName;
    if ("term" in body) updateData.term = body.term;
    if ("students" in body) {
      updateData.students = Array.isArray(body.students)
        ? JSON.stringify(body.students)
        : body.students;
    }
    if ("archived" in body) updateData.archived = body.archived;

    const result = await db.result.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating result:", error);
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.result.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting result:", error);
    return NextResponse.json(
      { error: "Failed to delete result" },
      { status: 500 }
    );
  }
}
