import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// POST /api/expenses/:id/approve - Record an approval action and update expense status
export async function POST(
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

    const existing = await db.expense.findFirst({ where: { id, schoolId } })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    const body = await request.json()
    const { action, notes, approverName, approverId, approverRole } = body

    const validActions = ['اعتماد', 'رفض', 'طلب تعديل']
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: 'الإجراء غير صالح (يجب أن يكون اعتماد / رفض / طلب تعديل)' },
        { status: 400 }
      )
    }
    if (!approverName) {
      return NextResponse.json(
        { error: 'اسم المعتمد مطلوب' },
        { status: 400 }
      )
    }

    // Create the approval record
    const approval = await db.expenseApproval.create({
      data: {
        expenseId: id,
        schoolId,
        approverId: approverId || null,
        approverName: String(approverName),
        approverRole: approverRole || null,
        action: String(action),
        notes: notes || null,
      },
    })

    // Update the parent expense status based on the action
    const statusMap: Record<string, string> = {
      'اعتماد': 'معتمد',
      'رفض': 'مرفوض',
      'طلب تعديل': 'مسودة',
    }
    const newStatus = statusMap[action]
    const updateData: Record<string, unknown> = { status: newStatus }
    if (action === 'اعتماد') {
      updateData.approvedBy = approverId || String(approverName)
      updateData.approvedAt = new Date()
    }

    await db.expense.update({ where: { id }, data: updateData })

    const updated = await db.expense.findFirst({
      where: { id, schoolId },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        approvals: { orderBy: { approvedAt: 'desc' } },
      },
    })

    return NextResponse.json({ expense: updated, approval }, { status: 201 })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error approving expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر تسجيل الاعتماد' },
      { status: 500 }
    )
  }
}
