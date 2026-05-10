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
    if ("name" in body) updateData.name = body.name;
    if ("subjects" in body) {
      updateData.subjects = Array.isArray(body.subjects)
        ? JSON.stringify(body.subjects)
        : body.subjects;
    }
    if ("archived" in body) updateData.archived = body.archived;

    const grade = await db.grade.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(grade);
  } catch (error) {
    console.error("Error updating grade:", error);
    return NextResponse.json(
      { error: "Failed to update grade" },
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
    await db.grade.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting grade:", error);
    return NextResponse.json(
      { error: "Failed to delete grade" },
      { status: 500 }
    );
  }
}
