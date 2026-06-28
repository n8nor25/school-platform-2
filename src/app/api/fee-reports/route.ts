import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveSchoolId } from '@/lib/school-utils'

// GET /api/fee-reports?type=... - Various financial reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schoolId = await resolveSchoolId(searchParams.get('schoolId'))
    if (!schoolId) {
      return NextResponse.json({ error: 'School ID is required' }, { status: 400 })
    }

    const type = searchParams.get('type')
    if (!type) {
      return NextResponse.json({ error: 'type parameter is required' }, { status: 400 })
    }

    // ========== 1) Student Statement ==========
    if (type === 'student-statement') {
      const studentId = searchParams.get('studentId')
      if (!studentId) {
        return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
      }

      const student = await db.student.findFirst({
        where: { id: studentId, schoolId },
        select: {
          id: true,
          name: true,
          studentNumber: true,
          classroom: { select: { name: true, gradeLevel: true } },
        },
      })

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }

      const assignments = await db.studentFee.findMany({
        where: { studentId, schoolId },
        include: {
          fee: { select: { id: true, name: true, feeType: true, totalAmount: true } },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              receiptNumber: true,
              paymentMethod: true,
              installmentNo: true,
              notes: true,
            },
            orderBy: { paymentDate: 'asc' },
          },
        },
        orderBy: { assignedAt: 'asc' },
      })

      const statement = assignments.map((a) => {
        const totalPaid = a.payments.reduce((s, p) => s + p.amount, 0)
        const remaining = a.totalAmount - totalPaid
        const originalAmount = a.fee.totalAmount
        const discount = originalAmount - a.totalAmount
        return {
          id: a.id,
          fee: a.fee,
          originalAmount,
          discountType: a.discountType,
          discountValue: a.discountValue,
          discountReason: a.discountReason,
          discount,
          totalAmount: a.totalAmount,
          payments: a.payments,
          totalPaid,
          remaining,
          status: remaining <= 0 ? 'مدفوع' : totalPaid > 0 ? 'جزئي' : 'غير مدفوع',
        }
      })

      const totals = statement.reduce(
        (acc, s) => {
          acc.totalObligations += s.totalAmount
          acc.totalPaid += s.totalPaid
          acc.totalRemaining += s.remaining
          return acc
        },
        { totalObligations: 0, totalPaid: 0, totalRemaining: 0 }
      )

      return NextResponse.json({ student, statement, totals })
    }

    // ========== 2) Collection Summary ==========
    if (type === 'collection-summary') {
      const academicYearId = searchParams.get('academicYearId')
      const fromDate = searchParams.get('fromDate')
      const toDate = searchParams.get('toDate')

      const feeWhere: Record<string, unknown> = { schoolId }
      if (academicYearId) feeWhere.academicYearId = academicYearId

      const fees = await db.fee.findMany({
        where: feeWhere,
        include: {
          studentFees: { select: { id: true, totalAmount: true } },
        },
      })

      const paymentWhere: Record<string, unknown> = { schoolId }
      if (academicYearId) {
        paymentWhere.fee = { academicYearId }
      }
      if (fromDate || toDate) {
        const range: Record<string, unknown> = {}
        if (fromDate) {
          const s = new Date(fromDate)
          s.setHours(0, 0, 0, 0)
          range.gte = s
        }
        if (toDate) {
          const e = new Date(toDate)
          e.setHours(23, 59, 59, 999)
          range.lte = e
        }
        paymentWhere.paymentDate = range
      }

      const payments = await db.feePayment.findMany({
        where: paymentWhere,
        select: { amount: true, fee: { select: { feeType: true } } },
      })

      // Group by feeType
      const grouped: Record<string, { expected: number; collected: number; outstanding: number }> = {}

      fees.forEach((f) => {
        const ft = f.feeType || 'أخرى'
        if (!grouped[ft]) grouped[ft] = { expected: 0, collected: 0, outstanding: 0 }
        const expectedForFee = f.studentFees.reduce((s, sf) => s + sf.totalAmount, 0)
        grouped[ft].expected += expectedForFee
      })

      payments.forEach((p) => {
        const ft = p.fee?.feeType || 'أخرى'
        if (!grouped[ft]) grouped[ft] = { expected: 0, collected: 0, outstanding: 0 }
        grouped[ft].collected += p.amount
      })

      Object.keys(grouped).forEach((ft) => {
        grouped[ft].outstanding = Math.max(0, grouped[ft].expected - grouped[ft].collected)
      })

      const summary = Object.entries(grouped).map(([feeType, v]) => ({
        feeType,
        ...v,
        collectionRate: v.expected > 0 ? Math.round((v.collected / v.expected) * 100) : 0,
      }))

      const totals = summary.reduce(
        (acc, s) => {
          acc.expected += s.expected
          acc.collected += s.collected
          acc.outstanding += s.outstanding
          return acc
        },
        { expected: 0, collected: 0, outstanding: 0 }
      )

      return NextResponse.json({
        summary,
        totals: {
          ...totals,
          collectionRate: totals.expected > 0 ? Math.round((totals.collected / totals.expected) * 100) : 0,
        },
      })
    }

    // ========== 3) Overdue Report ==========
    if (type === 'overdue') {
      const academicYearId = searchParams.get('academicYearId')
      const today = new Date()
      today.setHours(23, 59, 59, 999)

      const feeWhere: Record<string, unknown> = { schoolId }
      if (academicYearId) feeWhere.academicYearId = academicYearId

      const installments = await db.feeInstallment.findMany({
        where: {
          schoolId,
          fee: feeWhere as never,
          dueDate: { lt: today },
        },
        include: {
          fee: { select: { id: true, name: true, feeType: true, gradeLevel: true } },
          payments: {
            select: { amount: true, studentId: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      })

      // For each installment, also load studentFees for this fee to know who is supposed to pay
      const feeIds = Array.from(new Set(installments.map((i) => i.feeId)))

      const studentFeesByFee: Record<string, { studentId: string; studentName: string; studentNumber: string; gradeLevel: string | null }[]> = {}
      if (feeIds.length > 0) {
        const allStudentFees = await db.studentFee.findMany({
          where: { schoolId, feeId: { in: feeIds } },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                studentNumber: true,
                classroom: { select: { gradeLevel: true } },
              },
            },
          },
        })

        allStudentFees.forEach((sf) => {
          if (!studentFeesByFee[sf.feeId]) studentFeesByFee[sf.feeId] = []
          studentFeesByFee[sf.feeId].push({
            studentId: sf.student.id,
            studentName: sf.student.name,
            studentNumber: sf.student.studentNumber,
            gradeLevel: sf.student.classroom?.gradeLevel || null,
          })
        })
      }

      const overdue: Array<{
        studentId: string
        studentName: string
        studentNumber: string
        gradeLevel: string | null
        feeId: string
        feeName: string
        feeType: string
        installmentId: string
        installmentNo: number
        dueDate: Date
        amount: number
        paidAmount: number
        remaining: number
        daysOverdue: number
      }> = []

      installments.forEach((inst) => {
        const expectedStudents = studentFeesByFee[inst.feeId] || []
        expectedStudents.forEach((s) => {
          // Sum payments by this student for this installment
          const paidAmount = inst.payments
            .filter((p) => p.studentId === s.studentId)
            .reduce((sum, p) => sum + p.amount, 0)
          const remaining = Math.max(0, inst.amount - paidAmount)
          if (remaining > 0) {
            const daysOverdue = Math.floor(
              (today.getTime() - new Date(inst.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            )
            overdue.push({
              studentId: s.studentId,
              studentName: s.studentName,
              studentNumber: s.studentNumber,
              gradeLevel: s.gradeLevel,
              feeId: inst.feeId,
              feeName: inst.fee.name,
              feeType: inst.fee.feeType,
              installmentId: inst.id,
              installmentNo: inst.installmentNo,
              dueDate: inst.dueDate,
              amount: inst.amount,
              paidAmount,
              remaining,
              daysOverdue,
            })
          }
        })
      })

      // Sort by most overdue
      overdue.sort((a, b) => b.daysOverdue - a.daysOverdue)

      const totals = overdue.reduce(
        (acc, o) => {
          acc.totalAmount += o.amount
          acc.totalPaid += o.paidAmount
          acc.totalRemaining += o.remaining
          return acc
        },
        { totalAmount: 0, totalPaid: 0, totalRemaining: 0 }
      )

      return NextResponse.json({ overdue, totals, count: overdue.length })
    }

    // ========== 4) Grade Summary ==========
    if (type === 'grade-summary') {
      const academicYearId = searchParams.get('academicYearId')

      // Get all student fees with their fee + student + classroom
      const studentFeesWhere: Record<string, unknown> = { schoolId }
      if (academicYearId) {
        studentFeesWhere.fee = { academicYearId }
      }

      const studentFees = await db.studentFee.findMany({
        where: studentFeesWhere,
        include: {
          student: {
            select: { id: true, classroom: { select: { gradeLevel: true } } },
          },
          payments: { select: { amount: true } },
        },
      })

      // Group by gradeLevel
      const byGrade: Record<string, {
        gradeLevel: string
        students: Set<string>
        expected: number
        collected: number
      }> = {}

      studentFees.forEach((sf) => {
        const grade = sf.student.classroom?.gradeLevel || 'غير محدد'
        if (!byGrade[grade]) {
          byGrade[grade] = { gradeLevel: grade, students: new Set(), expected: 0, collected: 0 }
        }
        byGrade[grade].students.add(sf.student.id)
        byGrade[grade].expected += sf.totalAmount
        const paid = sf.payments.reduce((s, p) => s + p.amount, 0)
        byGrade[grade].collected += paid
      })

      const summary = Object.values(byGrade).map((g) => ({
        gradeLevel: g.gradeLevel,
        studentsCount: g.students.size,
        expected: g.expected,
        collected: g.collected,
        outstanding: Math.max(0, g.expected - g.collected),
        collectionRate: g.expected > 0 ? Math.round((g.collected / g.expected) * 100) : 0,
      }))

      summary.sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, 'ar'))

      const totals = summary.reduce(
        (acc, s) => {
          acc.studentsCount += s.studentsCount
          acc.expected += s.expected
          acc.collected += s.collected
          acc.outstanding += s.outstanding
          return acc
        },
        { studentsCount: 0, expected: 0, collected: 0, outstanding: 0 }
      )

      return NextResponse.json({
        summary,
        totals: {
          ...totals,
          collectionRate: totals.expected > 0 ? Math.round((totals.collected / totals.expected) * 100) : 0,
        },
      })
    }

    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  } catch (error) {
    console.error('Error generating fee report:', error)
    return NextResponse.json({ error: 'Failed to generate fee report' }, { status: 500 })
  }
}
