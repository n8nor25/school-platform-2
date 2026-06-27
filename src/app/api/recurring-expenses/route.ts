import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/recurring-expenses - List recurring expenses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const active = searchParams.get('active')
    const categoryId = searchParams.get('categoryId')
    const vendorId = searchParams.get('vendorId')

    const where: Record<string, unknown> = { schoolId }
    if (active === 'true') where.active = true
    if (active === 'false') where.active = false
    if (categoryId) where.categoryId = categoryId
    if (vendorId) where.vendorId = vendorId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { recipient: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ]
    }

    const recurringExpenses = await db.recurringExpense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        _count: { select: { expenses: true } },
      },
      orderBy: { nextRunDate: 'asc' },
    })

    return NextResponse.json({ recurringExpenses })
  } catch (error) {
    console.error('Error fetching recurring expenses:', error)
    return NextResponse.json({ error: 'تعذر جلب المصروفات المتكررة' }, { status: 500 })
  }
}

// POST /api/recurring-expenses - Create a recurring expense template
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      title,
      amount,
      frequency,
      startDate,
      endDate,
      categoryId,
      vendorId,
      paymentMethod,
      recipient,
      reference,
      notes,
      active,
      autoGenerate,
    } = body

    if (!title || amount === undefined || !frequency || !startDate) {
      return NextResponse.json(
        { error: 'العنوان والمبلغ والتكرار وتاريخ البدء مطلوبة' },
        { status: 400 }
      )
    }

    const validFrequencies = ['أسبوعي', 'شهري', 'ربعي', 'سنوي']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'التكرار غير صالح (أسبوعي / شهري / ربعي / سنوي)' },
        { status: 400 }
      )
    }

    // For first run, nextRunDate = startDate
    const start = new Date(startDate)
    const nextRunDate = start

    const created = await db.recurringExpense.create({
      data: {
        schoolId,
        categoryId: categoryId || null,
        vendorId: vendorId || null,
        title: String(title),
        amount: Number(amount),
        frequency: String(frequency),
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        nextRunDate,
        paymentMethod: paymentMethod ? String(paymentMethod) : 'نقدي',
        recipient: recipient || null,
        reference: reference || null,
        notes: notes || null,
        active: active !== undefined ? Boolean(active) : true,
        autoGenerate: autoGenerate !== undefined ? Boolean(autoGenerate) : false,
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        _count: { select: { expenses: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('Error creating recurring expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء المصروف المتكرر' },
      { status: 500 }
    )
  }
}
