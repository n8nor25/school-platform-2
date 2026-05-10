import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        schoolId: true,
        permissions: true,
        createdAt: true,
        school: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
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

    const existingUser = await db.user.findUnique({ where: { id } });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if ("username" in body) updateData.username = body.username;
    if ("schoolId" in body) updateData.schoolId = body.schoolId;
    if ("role" in body) updateData.role = body.role;
    if ("permissions" in body) updateData.permissions = body.permissions;

    // Hash password if provided
    if (body.password && typeof body.password === "string" && body.password.trim()) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    // If username or schoolId changed, check for uniqueness
    if (
      ("username" in body && body.username !== existingUser.username) ||
      ("schoolId" in body && body.schoolId !== existingUser.schoolId)
    ) {
      const newUsername = (updateData.username as string) || existingUser.username;
      const newSchoolId = (updateData.schoolId as string) || existingUser.schoolId;

      const conflict = await db.user.findUnique({
        where: { schoolId_username: { schoolId: newSchoolId, username: newUsername } },
      });

      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: "اسم المستخدم موجود بالفعل في هذه المدرسة" },
          { status: 409 }
        );
      }
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        schoolId: true,
        permissions: true,
        createdAt: true,
        school: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
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

    const existingUser = await db.user.findUnique({ where: { id } });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
