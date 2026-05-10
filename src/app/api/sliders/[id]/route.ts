import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slider = await db.slider.findUnique({ where: { id } });

    if (!slider) {
      return NextResponse.json(
        { error: "Slider not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(slider);
  } catch (error) {
    console.error("Error fetching slider:", error);
    return NextResponse.json(
      { error: "Failed to fetch slider" },
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

    const existingSlider = await db.slider.findUnique({ where: { id } });

    if (!existingSlider) {
      return NextResponse.json(
        { error: "Slider not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if ("imageUrl" in body) updateData.imageUrl = body.imageUrl;
    if ("title" in body) updateData.title = body.title;
    if ("subtitle" in body) updateData.subtitle = body.subtitle;
    if ("link" in body) updateData.link = body.link;
    if ("sortOrder" in body) updateData.sortOrder = body.sortOrder;
    if ("active" in body) updateData.active = body.active;
    if ("archived" in body) updateData.archived = body.archived;

    const slider = await db.slider.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(slider);
  } catch (error) {
    console.error("Error updating slider:", error);
    return NextResponse.json(
      { error: "Failed to update slider" },
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
    await db.slider.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting slider:", error);
    return NextResponse.json(
      { error: "Failed to delete slider" },
      { status: 500 }
    );
  }
}
