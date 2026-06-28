import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// Helper: compute next run date based on frequency
function computeNextRunDate(from: Date, frequency: string): Date {
  const next = new Date(from)
  switch (frequency) {
    case 'أسبوعي':
      next.setDate(next.getDate() + 7)
      break
    case 'شهري':
      next.setMonth(next.getMonth() + 1)
      break
    case 'ربعي':
      next.setMonth(next.getMonth() + 3)
      break
    case 'سنوي':
      next.setFullYear(next.getFullYear() + 1)
      break
    default:
      next.setMonth(next.getMonth() + 1)
  }
  return next
}

// POST /api/recurring-expenses/:id/generate - Generate an Expense from template (today)
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

    const recurring = await db.recurringExpense.findFirst({
      where: { id, schoolId },
    })
    if (!recurring) {
      return NextResponse.json({ error: 'المصروف المتكرر غير موجود' }, { status: 404 })
    }

    // Resolve active academic year
    const activeYear = await db.academicYear.findFirst({
      where: { schoolId, isActive: true },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create the expense (today's date)
    const expense = await db.expense.create({
      data: {
        schoolId,
        academicYearId: activeYear?.id || null,
        categoryId: recurring.categoryId,
        vendorId: recurring.vendorId,
        recurringExpenseId: recurring.id,
        title: recurring.title,
        amount: recurring.amount,
        expenseDate: today,
        paymentMethod: recurring.paymentMethod,
        recipient: recurring.recipient,
        reference: recurring.reference,
        notes: recurring.notes
          ? `مصروف متكرر: ${recurring.notes}`
          : 'مصروف متكرر',
        status: 'مدفوع',
      },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        vendor: { select: { id: true, name: true, type: true } },
        approvals: true,
      },
    })

    // Update the recurring template: lastRunDate = today, nextRunDate = computed
    const nextRun = computeNextRunDate(today, recurring.frequency)
    await db.recurringExpense.update({
      where: { id: recurring.id },
      data: {
        lastRunDate: today,
        nextRunDate: nextRun,
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Error generating recurring expense:', error)
    return NextResponse.json(
      { error: err?.message || 'تعذر توليد المصروف' },
      { status: 500 }
    )
  }
}
