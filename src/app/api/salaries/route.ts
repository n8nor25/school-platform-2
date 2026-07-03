import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/salaries - List salary records with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const where: Record<string, unknown> = { schoolId }

    // Filter by employee
    const employeeId = searchParams.get('employeeId')
    if (employeeId) where.employeeId = employeeId

    // Filter by month
    const month = searchParams.get('month')
    if (month) where.month = parseInt(month)

    // Filter by year
    const year = searchParams.get('year')
    if (year) where.year = parseInt(year)

    // Filter by status
    const status = searchParams.get('status')
    if (status) where.status = status

    // Filter by employee department
    const department = searchParams.get('department')
    if (department) {
      where.employee = { department }
    }

    const records = await db.salary.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            jobTitle: true,
            department: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    // If requested, compute summary stats
    const includeStats = searchParams.get('includeStats') === 'true'
    if (includeStats) {
      const total = records.length
      const totalNetSalary = records.reduce((sum, r) => sum + r.netSalary, 0)
      const totalBasicSalary = records.reduce((sum, r) => sum + r.basicSalary, 0)
      const totalAllowances = records.reduce((sum, r) => sum + r.allowances, 0)
      const totalOvertime = records.reduce((sum, r) => sum + r.overtime, 0)
      const totalBonus = records.reduce((sum, r) => sum + r.bonus, 0)
      const totalDeductions = records.reduce((sum, r) => sum + r.deductions, 0)
      const totalAdvancePayment = records.reduce((sum, r) => sum + r.advancePayment, 0)
      const totalInsurance = records.reduce((sum, r) => sum + r.insurance, 0)
      const totalTaxes = records.reduce((sum, r) => sum + r.taxes, 0)
      const paidCount = records.filter(r => r.status === 'مدفوع').length
      const pendingCount = records.filter(r => r.status === 'معلق').length
      const cancelledCount = records.filter(r => r.status === 'ملغي').length

      return NextResponse.json({
        records,
        stats: {
          total,
          totalNetSalary,
          totalBasicSalary,
          totalAllowances,
          totalOvertime,
          totalBonus,
          totalDeductions,
          totalAdvancePayment,
          totalInsurance,
          totalTaxes,
          paidCount,
          pendingCount,
          cancelledCount,
        },
      })
    }

    return NextResponse.json(records)
  } catch (error) {
    console.error('Error fetching salaries:', error)
    return NextResponse.json({ error: 'Failed to fetch salaries' }, { status: 500 })
  }
}

// POST /api/salaries - Create a salary record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    // Validate required fields
    if (!body.employeeId || body.month === undefined || body.year === undefined || body.basicSalary === undefined) {
      return NextResponse.json(
        { error: 'Employee ID, month, year, and basic salary are required' },
        { status: 400 }
      )
    }

    // Validate month range
    const month = parseInt(body.month)
    const year = parseInt(body.year)
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'Month must be between 1 and 12' }, { status: 400 })
    }

    // Check for duplicate (schoolId + employeeId + month + year)
    const existing = await db.salary.findUnique({
      where: {
        schoolId_employeeId_month_year: {
          schoolId,
          employeeId: body.employeeId,
          month,
          year,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Salary record already exists for this employee, month, and year' },
        { status: 409 }
      )
    }

    const basicSalary = parseFloat(body.basicSalary)
    const allowances = parseFloat(body.allowances) || 0
    const overtime = parseFloat(body.overtime) || 0
    const bonus = parseFloat(body.bonus) || 0
    const deductions = parseFloat(body.deductions) || 0
    const advancePayment = parseFloat(body.advancePayment) || 0
    const insurance = parseFloat(body.insurance) || 0
    const taxes = parseFloat(body.taxes) || 0

    // Auto-calculate netSalary if not provided
    const netSalary = body.netSalary !== undefined
      ? parseFloat(body.netSalary)
      : basicSalary + allowances + overtime + bonus - deductions - advancePayment - insurance - taxes

    const record = await db.salary.create({
      data: {
        schoolId,
        employeeId: body.employeeId,
        month,
        year,
        basicSalary,
        allowances,
        overtime,
        bonus,
        deductions,
        advancePayment,
        insurance,
        taxes,
        netSalary,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        paymentMethod: body.paymentMethod || 'تحويل',
        status: body.status || 'معلق',
        notes: body.notes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            jobTitle: true,
            department: true,
          },
        },
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Error creating salary:', error)
    return NextResponse.json({ error: 'Failed to create salary' }, { status: 500 })
  }
}
