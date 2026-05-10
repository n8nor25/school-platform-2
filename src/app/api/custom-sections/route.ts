import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SCHOOL_ID } from '@/lib/constants'

// GET /api/custom-sections?schoolId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = searchParams.get('schoolId') || SCHOOL_ID

    const sections = await db.customSection.findMany({
      where: { schoolId },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(sections)
  } catch (error) {
    console.error('Error fetching custom sections:', error)
    return NextResponse.json(
      { error: 'فشل في جلب الأقسام المخصصة' },
      { status: 500 }
    )
  }
}

// POST /api/custom-sections - Create a custom section
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId, title, content, imageUrl, layout, active, sortOrder } = body

    if (!schoolId || !title) {
      return NextResponse.json(
        { error: 'يرجى توفير المدرسة والعنوان' },
        { status: 400 }
      )
    }

    // Get the max sortOrder for this school's custom sections
    const maxOrder = await db.customSection.findFirst({
      where: { schoolId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const section = await db.customSection.create({
      data: {
        schoolId,
        title,
        content: content || '',
        imageUrl: imageUrl || null,
        layout: layout || 'full',
        active: active !== undefined ? active : true,
        sortOrder: sortOrder !== undefined ? sortOrder : (maxOrder?.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('Error creating custom section:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء القسم المخصص' },
      { status: 500 }
    )
  }
}

// PUT /api/custom-sections - Update a custom section or update order
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Handle section order update
    if (body.action === 'updateOrder') {
      const { schoolId, sectionOrder } = body
      if (!schoolId || !sectionOrder) {
        return NextResponse.json(
          { error: 'يرجى توفير المدرسة وترتيب الأقسام' },
          { status: 400 }
        )
      }

      // Store the section order in Settings
      const existing = await db.settings.findUnique({
        where: { schoolId },
      })

      if (existing) {
        await db.settings.update({
          where: { schoolId },
          data: { sectionOrder: JSON.stringify(sectionOrder) },
        })
      } else {
        await db.settings.create({
          data: {
            schoolId,
            sectionOrder: JSON.stringify(sectionOrder),
          },
        })
      }

      return NextResponse.json({ success: true, sectionOrder })
    }

    // Handle individual section update
    const { id, title, content, imageUrl, layout, active } = body
    if (!id) {
      return NextResponse.json(
        { error: 'يرجى توفير معرف القسم' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (layout !== undefined) updateData.layout = layout
    if (active !== undefined) updateData.active = active

    const section = await db.customSection.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(section)
  } catch (error) {
    console.error('Error updating custom section:', error)
    return NextResponse.json(
      { error: 'فشل في تحديث القسم المخصص' },
      { status: 500 }
    )
  }
}

// DELETE /api/custom-sections - Delete a custom section
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'يرجى توفير معرف القسم' },
        { status: 400 }
      )
    }

    await db.customSection.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting custom section:', error)
    return NextResponse.json(
      { error: 'فشل في حذف القسم المخصص' },
      { status: 500 }
    )
  }
}
