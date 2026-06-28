import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// DELETE /api/fee-payments/[id] - Delete a payment
export async function DELETE(
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

    const existing = await db.feePayment.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    await db.feePayment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting fee payment:', error)
    return NextResponse.json({ error: 'Failed to delete fee payment' }, { status: 500 })
  }
}
