import { NextResponse } from 'next/server'
import { VAPID_PUBLIC_KEY } from '@/lib/push-config'

/**
 * GET /api/push/vapid-public
 * يرجع المفتاح العام لـ VAPID للاستخدام في pushManager.subscribe.
 */
export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY })
}
