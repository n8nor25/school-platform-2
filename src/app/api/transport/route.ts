import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const search = searchParams.get('search')?.trim() || ''
    const routeId = searchParams.get('routeId')
    const status = searchParams.get('status')
    const direction = searchParams.get('direction')

    const where: Record<string, unknown> = { schoolId }
    if (routeId) where.routeId = routeId
    if (status) where.status = status
    if (direction) where.direction = direction
    if (search) {
      where.student = {
        OR: [
          { name: { contains: search } },
          { studentNumber: { contains: search } },
        ],
      }
    }

    const subscriptions = await db.studentTransport.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            phone: true,
            parentPhone: true,
            parentPhone2: true,
            address: true,
            classroom: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            area: true,
            bus: { select: { id: true, plateNumber: true } },
          },
        },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = subscriptions.map((s) => {
      const paidTotal = s.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const { payments, ...rest } = s
      return { ...rest, paidTotal, paidCount: payments.length }
    })

    return NextResponse.json({ subscriptions: result })
  } catch (error) {
    console.error('Error fetching transport subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const {
      studentId,
      routeId,
      startDate,
      endDate,
      direction,
      monthlyFee,
      status,
      notes,
    } = body

    if (!studentId || !routeId || !startDate) {
      return NextResponse.json(
        { error: 'studentId, routeId and startDate are required' },
        { status: 400 }
      )
    }

    // Validate student + route belong to school
    const student = await db.student.findFirst({ where: { id: studentId, schoolId } })
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }
    const route = await db.busRoute.findFirst({ where: { id: routeId, schoolId } })
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    // Check if student already has an active subscription
    const existingActive = await db.studentTransport.findFirst({
      where: { studentId, status: 'نشط' },
    })
    if (existingActive) {
      return NextResponse.json(
        { error: 'الطالب لديه اشتراك نشط بالفعل. أوقف الاشتراك الحالي أولاً.' },
        { status: 409 }
      )
    }

    const finalFee =
      monthlyFee !== undefined && monthlyFee !== null
        ? Number(monthlyFee)
        : Number(route.monthlyFee)

    const created = await db.studentTransport.create({
      data: {
        schoolId,
        studentId,
        routeId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        direction: direction || 'ذهاب وعودة',
        monthlyFee: finalFee,
        status: status || 'نشط',
        notes: notes || null,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            phone: true,
            parentPhone: true,
            parentPhone2: true,
            address: true,
            classroom: { select: { id: true, name: true, gradeLevel: true } },
          },
        },
        route: {
          select: {
            id: true,
            name: true,
            area: true,
            bus: { select: { id: true, plateNumber: true } },
          },
        },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'الطالب لديه اشتراك بالفعل' },
        { status: 409 }
      )
    }
    console.error('Error creating transport subscription:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create subscription' }, { status: 500 })
  }
}
