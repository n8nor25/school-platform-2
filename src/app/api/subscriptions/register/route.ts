/**
 * POST /api/subscriptions/register
 * تسجيل مدرسة جديدة + طلب اشتراك (يحتاج موافقة super-admin)
 *
 * Body:
 *   - schoolName: string (مطلوب)
 *   - subdomain: string (مطلوب، فريد)
 *   - planCode: "basic" | "pro" | "enterprise" (مطلوب)
 *   - billingCycle: "MONTHLY" | "ANNUAL" (اختياري، افتراضي MONTHLY)
 *   - adminName: string (مطلوب)
 *   - adminEmail: string (مطلوب)
 *   - adminPhone: string (مطلوب)
 *   - adminUsername: string (مطلوب، فريد عبر كل المدارس)
 *   - adminPassword: string (مطلوب، 6+ أحرف)
 *   - schoolAddress?: string
 *   - schoolPhone?: string
 *   - primaryColor?: string (افتراضي #610000)
 *   - secondaryColor?: string (افتراضي #009688)
 *
 * النتيجة: تنشئ School بحالة PENDING_APPROVAL (لا وصول للوحة).
 * عند الموافقة، يُنشأ User للمسؤول + SchoolSubscription بوضع TRIAL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import {
  BILLING_CYCLE,
  suggestSubdomain,
  suggestUsername,
} from '@/lib/subscription'

const VALID_PLAN_CODES = ['basic', 'pro', 'enterprise']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      schoolName, subdomain, planCode, billingCycle = BILLING_CYCLE.MONTHLY,
      adminName, adminEmail, adminPhone, adminUsername, adminPassword,
      schoolAddress = '', schoolPhone = '',
      primaryColor = '#610000', secondaryColor = '#009688',
    } = body

    // التحقق من الحقول المطلوبة
    const missing: string[] = []
    if (!schoolName) missing.push('اسم المدرسة')
    if (!subdomain) missing.push('المعرّف الفرعي')
    if (!planCode) missing.push('الباقة')
    if (!adminName) missing.push('اسم المسؤول')
    if (!adminEmail) missing.push('بريد المسؤول')
    if (!adminPhone) missing.push('هاتف المسؤول')
    if (!adminUsername) missing.push('اسم المستخدم')
    if (!adminPassword) missing.push('كلمة المرور')
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'حقول مطلوبة ناقصة', missing },
        { status: 400 }
      )
    }

    if (!VALID_PLAN_CODES.includes(planCode)) {
      return NextResponse.json({ error: 'الباقة غير صالحة' }, { status: 400 })
    }

    if (adminPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }

    // تنظيف المعرّف الفرعي
    const cleanSubdomain = String(subdomain).trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (cleanSubdomain.length < 3) {
      return NextResponse.json(
        { error: 'المعرّف الفرعي يجب أن يكون 3 أحرف على الأقل (حروف إنجليزية وأرقام فقط)' },
        { status: 400 }
      )
    }

    // التحقق من عدم تكرار المعرّف الفرعي
    const existingSchool = await db.school.findUnique({ where: { subdomain: cleanSubdomain } })
    if (existingSchool) {
      return NextResponse.json(
        { error: 'هذا المعرّف الفرعي محجوز بالفعل، اختر معرّفًا آخر' },
        { status: 409 }
      )
    }

    // التحقق من عدم تكرار اسم المستخدم
    const existingUser = await db.user.findFirst({ where: { username: adminUsername } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'اسم المستخدم محجوز بالفعل، اختر اسمًا آخر' },
        { status: 409 }
      )
    }

    // جلب الباقة المطلوبة
    const plan = await db.subscriptionPlan.findUnique({ where: { code: planCode } })
    if (!plan) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }

    // إنشاء المدرسة بحالة PENDING_APPROVAL
    const school = await db.school.create({
      data: {
        name: schoolName.trim(),
        subdomain: cleanSubdomain,
        description: '',
        address: schoolAddress,
        phone: schoolPhone || adminPhone,
        email: adminEmail,
        primaryColor,
        secondaryColor,
        isActive: true,
        subscriptionStatus: 'PENDING_APPROVAL',
        pendingPlanId: plan.id,
        registrantName: adminName.trim(),
        registrantEmail: adminEmail.trim().toLowerCase(),
        registrantPhone: adminPhone.trim(),
        registrantUsername: adminUsername.trim(),
        // نخزّن كلمة المرور مشفّرة مسبقًا حتى لا نطلبها مرة أخرى عند الموافقة
        registrantTempPassword: await bcrypt.hash(adminPassword, 10),
      },
    })

    return NextResponse.json(
      {
        success: true,
        message:
          'تم استلام طلب التسجيل بنجاح. سيتم مراجعته من قِبل إدارة المنصة خلال 24-48 ساعة. سيصلك إشعار على بريدك عند التفعيل.',
        schoolId: school.id,
        schoolName: school.name,
        subdomain: school.subdomain,
        status: 'PENDING_APPROVAL',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[subscriptions/register POST] error:', error)
    return NextResponse.json(
      { error: 'فشل التسجيل', details: (error as Error).message },
      { status: 500 }
    )
  }
}
