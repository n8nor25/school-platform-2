import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/fees - List fees with filters and counts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { schoolId }

    const search = searchParams.get('search')
    if (search) {
      where.name = { contains: search }
    }

    const gradeLevel = searchParams.get('gradeLevel')
    if (gradeLevel) where.gradeLevel = gradeLevel

    const feeType = searchParams.get('feeType')
    if (feeType) where.feeType = feeType

    const active = searchParams.get('active')
    if (active !== null) where.active = active === 'true'

    const academicYearId = searchParams.get('academicYearId')
    if (academicYearId) where.academicYearId = academicYearId

    const fees = await db.fee.findMany({
      where,
      include: {
        _count: {
          select: {
            studentFees: true,
            feeInstallments: true,
          },
        },
        academicYear: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ fees })
  } catch (error) {
    console.error('Error fetching fees:', error)
    return NextResponse.json({ error: 'Failed to fetch fees' }, { status: 500 })
  }
}

// POST /api/fees - Create fee with auto-installments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolId = await resolveSchoolId(body.schoolId)
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    if (!body.academicYearId || !body.name || body.totalAmount === undefined) {
      return NextResponse.json(
        { error: 'academicYearId, name, and totalAmount are required' },
        { status: 400 }
      )
    }

    const installmentsCount: number = Number(body.installments) > 0 ? Number(body.installments) : 1
    const totalAmount: number = Number(body.totalAmount)

    // Auto-calc installmentAmount if not provided
    const installmentAmount: number =
      body.installmentAmount !== undefined && body.installmentAmount !== null
        ? Number(body.installmentAmount)
        : totalAmount / installmentsCount

    // dueDates: array of date strings
    let dueDates: string[] = []
    if (Array.isArray(body.dueDates)) {
      dueDates = body.dueDates.filter(
        (d: unknown): d is string => typeof d === 'string' && d !== ''
      )
    } else if (typeof body.dueDates === 'string') {
      try {
        const parsed = JSON.parse(body.dueDates)
        if (Array.isArray(parsed)) {
          dueDates = parsed.filter(
            (d: unknown): d is string => typeof d === 'string' && d !== ''
          )
        }
      } catch {
        dueDates = []
      }
    }

    // Create the fee first
    const fee = await db.fee.create({
      data: {
        schoolId,
        academicYearId: body.academicYearId,
        name: body.name,
        gradeLevel: body.gradeLevel || null,
        totalAmount,
        installments: installmentsCount,
        installmentAmount,
        dueDates: JSON.stringify(dueDates),
        feeType: body.feeType || 'دراسة',
        active: body.active !== undefined ? !!body.active : true,
      },
    })

    // Auto-create FeeInstallment records
    const installmentsToCreate = []
    const limit = Math.max(installmentsCount, dueDates.length)
    for (let i = 0; i < limit; i++) {
      const dueDateStr = dueDates[i] || new Date().toISOString()
      installmentsToCreate.push({
        schoolId,
        feeId: fee.id,
        installmentNo: i + 1,
        amount: installmentAmount,
        dueDate: new Date(dueDateStr),
      })
    }

    if (installmentsToCreate.length > 0) {
      await db.feeInstallment.createMany({ data: installmentsToCreate })
    }

    const feeWithInstallments = await db.fee.findUnique({
      where: { id: fee.id },
      include: {
        feeInstallments: { orderBy: { installmentNo: 'asc' } },
        _count: { select: { studentFees: true } },
      },
    })

    return NextResponse.json({ fee: feeWithInstallments }, { status: 201 })
  } catch (error) {
    console.error('Error creating fee:', error)
    return NextResponse.json({ error: 'Failed to create fee' }, { status: 500 })
  }
}
