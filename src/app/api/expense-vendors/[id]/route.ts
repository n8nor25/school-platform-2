import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expense-vendors/:id - Single vendor with _count + recent expenses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const vendor = await db.expenseVendor.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { expenses: true, recurringExpenses: true } },
        expenses: {
          take: 10,
          orderBy: { expenseDate: 'desc' },
          select: {
            id: true,
            title: true,
            amount: true,
            expenseDate: true,
            status: true,
            paymentMethod: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    return NextResponse.json(vendor)
  } catch (error) {
    console.error('Error fetching vendor:', error)
    return NextResponse.json({ error: 'تعذر جلب المورد' }, { status: 500 })
  }
}

// PUT /api/expense-vendors/:id - Update vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const existing = await db.expenseVendor.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      type,
      contactPerson,
      phone,
      email,
      address,
      taxNumber,
      taxOffice,
      bankName,
      bankAccount,
      openingBalance,
      notes,
      active,
    } = body

    const updated = await db.expenseVendor.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(type !== undefined ? { type: String(type) } : {}),
        ...(contactPerson !== undefined ? { contactPerson: contactPerson || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(address !== undefined ? { address: address || null } : {}),
        ...(taxNumber !== undefined ? { taxNumber: taxNumber || null } : {}),
        ...(taxOffice !== undefined ? { taxOffice: taxOffice || null } : {}),
        ...(bankName !== undefined ? { bankName: bankName || null } : {}),
        ...(bankAccount !== undefined ? { bankAccount: bankAccount || null } : {}),
        ...(openingBalance !== undefined ? { openingBalance: Number(openingBalance) } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
      include: {
        _count: { select: { expenses: true, recurringExpenses: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'اسم المورد مُستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error updating vendor:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تحديث المورد' },
      { status: 500 }
    )
  }
}

// DELETE /api/expense-vendors/:id - Cascade protection (expenses)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const existing = await db.expenseVendor.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { expenses: true, recurringExpenses: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    if (existing._count.expenses > 0 || existing._count.recurringExpenses > 0) {
      return NextResponse.json(
        {
          error:
            'لا يمكن حذف المورد لوجود مصروفات أو مصروفات متكررة مرتبطة به.',
        },
        { status: 409 }
      )
    }

    await db.expenseVendor.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error deleting vendor:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر حذف المورد' },
      { status: 500 }
    )
  }
}
