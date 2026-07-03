import { NextRequest, NextResponse } from 'next/server'
import { removeSubscription } from '@/lib/push-store'

/**
 * POST /api/push/unsubscribe
 * يزيل اشتراك Push.
 *
 * Body: { endpoint: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint } = body

    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
    }

    await removeSubscription(endpoint)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }
}
