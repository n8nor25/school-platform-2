/**
 * POST /api/subscriptions/reject
 * رفض super-admin لطلب تسجيل مدرسة.
 * Body:
 *   - schoolId: string (مطلوب)
 *   - reason: string (اختياري)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schoolId, reason = '' } = body

    if (!schoolId) {
      return NextResponse.json({ error: 'معرف المدرسة مطلوب' }, { status: 400 })
    }

    const school = await db.school.findUnique({ where: { id: schoolId } })
    if (!school) {
      return NextResponse.json({ error: 'المدرسة غير موجودة' }, { status: 404 })
    }

    if (school.subscriptionStatus !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: 'هذه المدرسة ليست في حالة انتظار الموافقة' },
        { status: 400 }
      )
    }

    // نحتفظ بالسجل لكن نضع علامة الرفض (لا نحذف المدرسة كي يبقى السجل)
    await db.school.update({
      where: { id: school.id },
      data: {
        rejectionReason: reason.trim(),
        // نُبقي subscriptionStatus كما هو PENDING_APPROVAL لكن مع سبب الرفض
        // (يمكن لـ super-admin حذف المدرسة لاحقًا إن أراد)
        isActive: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: `تم رفض طلب ${school.name}.`,
    })
  } catch (error) {
    console.error('[subscriptions/reject POST] error:', error)
    return NextResponse.json(
      { error: 'فشل الرفض', details: (error as Error).message },
      { status: 500 }
    )
  }
}
