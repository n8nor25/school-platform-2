import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const users = await db.user.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, schoolId, role, permissions } = body;

    if (!username || !password || !schoolId) {
      return NextResponse.json(
        { error: "Username, password, and schoolId are required" },
        { status: 400 }
      );
    }

    // Check if username already exists for this school
    const existing = await db.user.findUnique({
      where: { schoolId_username: { schoolId, username } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "اسم المستخدم موجود بالفعل في هذه المدرسة" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        schoolId,
        role: role || "school_admin",
        permissions: permissions || "{}",
      },
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

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
