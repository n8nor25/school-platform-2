import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// POST /api/events/seed - Create a sample event (no AI)
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const schoolIdParam =
      (body && typeof body === 'object' && 'schoolId' in body
        ? String((body as { schoolId?: unknown }).schoolId)
        : null) || searchParams.get('schoolId')
    const schoolId = await resolveSchoolId(schoolIdParam)
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    // Resolve academic year: active year for school > null
    const activeYear = await db.academicYear.findFirst({
      where: { schoolId, isActive: true },
    })
    const academicYearId = activeYear?.id || null

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000)

    const program = [
      {
        time: '09:00',
        title: 'الافتتاح',
        description: 'كلمة ترحيبية من مدير المدرسة وتلاوة آيات من القرآن الكريم',
      },
      {
        time: '09:30',
        title: 'تكريم المتفوقين',
        description: 'توزيع الجوائز والشهادات على الطلاب المتفوقين',
      },
      {
        time: '10:30',
        title: 'فاصل فني',
        description: 'فقرة فنية من تقديم طلاب المدرسة',
      },
      {
        time: '11:00',
        title: 'الختام',
        description: 'تكريم الجهات المشاركة وتوزيع الهدايا التذكارية',
      },
    ]

    const created = await db.event.create({
      data: {
        schoolId,
        academicYearId,
        title: 'حفل تكريم المتفوقين',
        description:
          'يقيم حفل تكريم المتفوقين تكريماً للطلاب الذين أظهروا تفوقاً ملحوظاً خلال العام الدراسي. يشمل الحفل توزيع الجوائز والشهادات التقديرية والاحتفاء بإنجازات الطلاب أمام أولياء الأمور والمعلمين.',
        type: 'حفل',
        status: 'مجدولة',
        startDate,
        endDate,
        location: 'مسرح المدرسة',
        organizerId: 'admin',
        organizerName: 'مدير النظام',
        targetAudience: 'الكل',
        targetIds: JSON.stringify([]),
        isPublic: true,
        program: JSON.stringify(program),
        requirements:
          '- حضور الطلاب المتفوقين بزيهم المدرسي الرسمي\n- تواجد أولياء الأمور قبل موعد الحفل بنصف ساعة\n- إحضار بطاقة الدعوة',
        aiGenerated: false,
      },
      include: {
        _count: { select: { registrations: true, feedback: true, gallery: true } },
      },
    })

    return NextResponse.json(
      {
        ...created,
        targetIds: JSON.parse(created.targetIds || '[]'),
        program: created.program ? JSON.parse(created.program) : null,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error seeding event:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر إنشاء الفعالية التجريبية' },
      { status: 500 }
    )
  }
}
