import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

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

    const bus = await db.bus.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        plateNumber: true,
        driverName: true,
        driverPhone: true,
        driverLicense: true,
        supervisorName: true,
        supervisorPhone: true,
        capacity: true,
        model: true,
        color: true,
        notes: true,
      },
    })
    if (!bus) {
      return NextResponse.json({ error: 'Bus not found' }, { status: 404 })
    }

    const routes = await db.busRoute.findMany({
      where: { busId: id, schoolId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        area: true,
        morningTime: true,
        afternoonTime: true,
        monthlyFee: true,
        stops: true,
        subscriptions: {
          where: { status: 'نشط' },
          select: {
            id: true,
            direction: true,
            monthlyFee: true,
            status: true,
            student: {
              select: {
                id: true,
                name: true,
                studentNumber: true,
                address: true,
                phone: true,
                parentName: true,
                parentPhone: true,
                parentPhone2: true,
                classroom: { select: { name: true, gradeLevel: true } },
              },
            },
          },
          orderBy: { student: { name: 'asc' } },
        },
      },
    })

    const routesWithCount = routes.map((r) => ({
      ...r,
      studentsCount: r.subscriptions.length,
    }))

    return NextResponse.json({ bus, routes: routesWithCount })
  } catch (error: any) {
    console.error('Error fetching bus report:', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch bus report' }, { status: 500 })
  }
}
