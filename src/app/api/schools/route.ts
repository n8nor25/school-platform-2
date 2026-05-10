import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const schools = await db.school.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        primaryColor: true,
        secondaryColor: true,
        description: true,
        logoUrl: true,
        address: true,
        phone: true,
        email: true,
        facebookUrl: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(schools);
  } catch (error) {
    console.error("Error fetching schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      subdomain,
      description,
      logoUrl,
      primaryColor,
      secondaryColor,
      address,
      phone,
      email,
      facebookUrl,
      isActive,
    } = body;

    if (!name || !subdomain) {
      return NextResponse.json(
        { error: "Name and subdomain are required" },
        { status: 400 }
      );
    }

    // Check for duplicate subdomain
    const existing = await db.school.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return NextResponse.json(
        { error: "النطاق الفرعي موجود بالفعل" },
        { status: 409 }
      );
    }

    const school = await db.school.create({
      data: {
        name,
        subdomain,
        description: description || "",
        logoUrl: logoUrl || null,
        primaryColor: primaryColor || "#610000",
        secondaryColor: secondaryColor || "#009688",
        address: address || "",
        phone: phone || "",
        email: email || "",
        facebookUrl: facebookUrl || null,
        isActive: isActive ?? true,
      },
    });

    // Create default settings for the new school
    await db.settings.create({
      data: {
        schoolId: school.id,
      },
    });

    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    console.error("Error creating school:", error);
    return NextResponse.json(
      { error: "Failed to create school" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const existing = await db.school.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    // If subdomain is changing, check for conflict
    if (body.subdomain && body.subdomain !== existing.subdomain) {
      const conflict = await db.school.findUnique({
        where: { subdomain: body.subdomain },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "النطاق الفرعي موجود بالفعل" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if ("name" in body) updateData.name = body.name;
    if ("subdomain" in body) updateData.subdomain = body.subdomain;
    if ("description" in body) updateData.description = body.description;
    if ("logoUrl" in body) updateData.logoUrl = body.logoUrl;
    if ("primaryColor" in body) updateData.primaryColor = body.primaryColor;
    if ("secondaryColor" in body) updateData.secondaryColor = body.secondaryColor;
    if ("address" in body) updateData.address = body.address;
    if ("phone" in body) updateData.phone = body.phone;
    if ("email" in body) updateData.email = body.email;
    if ("facebookUrl" in body) updateData.facebookUrl = body.facebookUrl;
    if ("isActive" in body) updateData.isActive = body.isActive;

    const school = await db.school.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(school);
  } catch (error) {
    console.error("Error updating school:", error);
    return NextResponse.json(
      { error: "Failed to update school" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "School ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.school.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    await db.school.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting school:", error);
    return NextResponse.json(
      { error: "Failed to delete school" },
      { status: 500 }
    );
  }
}
