import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/employees - List employees
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolIdParam = searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    const where: Record<string, unknown> = { schoolId, archived: false }

    const department = searchParams.get('department')
    if (department) where.department = department

    const status = searchParams.get('status')
    if (status) where.status = status

    const search = searchParams.get('search')
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

// POST /api/employees - Create employee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const schoolIdParam = body.schoolId
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'No school found' }, { status: 404 })
    }

    if (!body.name || !body.employeeNumber || !body.jobTitle) {
      return NextResponse.json({ error: 'Name, employee number, and job title are required' }, { status: 400 })
    }

    const existing = await db.employee.findUnique({
      where: { schoolId_employeeNumber: { schoolId, employeeNumber: body.employeeNumber } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Employee number already exists' }, { status: 409 })
    }

    const employee = await db.employee.create({
      data: {
        schoolId,
        employeeNumber: body.employeeNumber,
        name: body.name,
        nationalId: body.nationalId || null,
        jobTitle: body.jobTitle,
        department: body.department || null,
        qualification: body.qualification || null,
        specialization: body.specialization || null,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        salary: body.salary || 0,
        allowances: body.allowances || 0,
        deductions: body.deductions || 0,
        contractType: body.contractType || 'دائم',
        status: body.status || 'نشط',
        bankName: body.bankName || null,
        bankAccount: body.bankAccount || null,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error('Error creating employee:', error)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
