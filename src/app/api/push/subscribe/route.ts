import { NextRequest, NextResponse } from 'next/server'
import { addSubscription } from '@/lib/push-store'

/**
 * POST /api/push/subscribe
 * يستقبل اشتراك Push جديد من المتصفح ويخزّنه.
 *
 * Body:
 *   {
 *     subscription: PushSubscription,
 *     schoolId: string,
 *     parentPhone: string,
 *     studentNumbers: string[],
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscription, schoolId, parentPhone, studentNumbers } = body

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
    }
    if (!schoolId || !parentPhone) {
      return NextResponse.json({ error: 'schoolId and parentPhone are required' }, { status: 400 })
    }

    await addSubscription({
      subscription: {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ?? null,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      schoolId,
      parentPhone,
      studentNumbers: Array.isArray(studentNumbers) ? studentNumbers : [],
    })

    return NextResponse.json({ success: true, endpoint: subscription.endpoint })
  } catch (error) {
    console.error('Error saving push subscription:', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
