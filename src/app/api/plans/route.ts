/**
 * GET /api/plans
 * قائمة الباقات النشطة (عام — لا يحتاج صلاحية)
 */
import { NextResponse } from 'next/server'
import { getAllActivePlans, FEATURE_LABELS } from '@/lib/subscription'

export async function GET() {
  try {
    const plans = await getAllActivePlans()
    return NextResponse.json({
      success: true,
      plans: plans.map(p => ({
        ...p,
        featureLabels: p.features.map(f => FEATURE_LABELS[f] || f),
      })),
    })
  } catch (error) {
    console.error('[plans GET] error:', error)
    return NextResponse.json({ error: 'فشل جلب الباقات', details: (error as Error).message }, { status: 500 })
  }
}
