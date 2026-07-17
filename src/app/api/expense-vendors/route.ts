import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/expense-vendors - List vendors with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const active = searchParams.get('active')
    const type = searchParams.get('type')

    const where: Record<string, unknown> = { schoolId }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (type) where.type = type
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { contactPerson: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const vendors = await db.expenseVendor.findMany({
      where,
      include: {
        _count: { select: { expenses: true, recurringExpenses: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ vendors })
  } catch (error) {
    console.error('Error fetching expense vendors:', error)
    return NextResponse.json({ error: 'تعذر جلب الموردين' }, { status: 500 })
  }
}

// POST /api/expense-vendors - Create a new vendor
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
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

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: 'اسم المورد مطلوب' },
        { status: 400 }
      )
    }

    const created = await db.expenseVendor.create({
      data: {
        schoolId,
        name: String(name).trim(),
        type: type ? String(type) : 'مورد',
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        taxNumber: taxNumber || null,
        taxOffice: taxOffice || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        openingBalance: openingBalance !== undefined ? Number(openingBalance) : 0,
        notes: notes || null,
        active: active !== undefined ? Boolean(active) : true,
      },
      include: {
        _count: { select: { expenses: true, recurringExpenses: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'اسم المورد مُستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error creating expense vendor:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء المورد' },
      { status: 500 }
    )
  }
}
