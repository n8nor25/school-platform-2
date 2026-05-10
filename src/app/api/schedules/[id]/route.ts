import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if ("title" in body) updateData.title = body.title;
    if ("category" in body) updateData.category = body.category;
    if ("grade" in body) updateData.grade = body.grade;
    if ("section" in body) updateData.section = body.section;
    if ("teacherName" in body) updateData.teacherName = body.teacherName;
    if ("dayOfWeek" in body) updateData.dayOfWeek = body.dayOfWeek;
    if ("filePath" in body) updateData.filePath = body.filePath;
    if ("fileName" in body) updateData.fileName = body.fileName;
    if ("type" in body) updateData.type = body.type;
    if ("active" in body) updateData.active = body.active;
    if ("archived" in body) updateData.archived = body.archived;

    const schedule = await db.schedule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
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
    await db.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // P2025: Record not found
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
