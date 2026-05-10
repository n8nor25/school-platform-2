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
    if ("subject" in body) updateData.subject = body.subject;
    if ("email" in body) updateData.email = body.email;
    if ("imageUrl" in body) updateData.imageUrl = body.imageUrl;
    if ("sortOrder" in body) updateData.sortOrder = body.sortOrder;
    if ("active" in body) updateData.active = body.active;
    if ("archived" in body) updateData.archived = body.archived;

    const teacher = await db.teacher.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(teacher);
  } catch (error) {
    console.error("Error updating teacher:", error);
    return NextResponse.json(
      { error: "Failed to update teacher" },
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
    await db.teacher.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting teacher:", error);
    return NextResponse.json(
      { error: "Failed to delete teacher" },
      { status: 500 }
    );
  }
}
