/**
 * ============================================================
 *  POST /api/invoices/[id]/pay
 *    → دفع فاتورة. طريقتان:
 *      (1) manual: رفع إيصال تحويل بنكي + ملاحظات (ينتظر مراجعة super-admin)
 *      (2) paymob: بدء عملية دفع إلكتروني (يعيد رابط الدفع)
 *
 *  Body (manual — multipart/form-data):
 *    - method: "manual"
 *    - receipt: File (صورة/PDF إيصال التحويل)
 *    - notes: string (اختياري)
 *
 *  Body (paymob - JSON):
 *    - method: "paymob"
 *    → يعيد { checkoutUrl } (إن كانت مفاتيح Paymob مهيّأة)
 *      أو { error: "Paymob غير مهيأ" } (إن لم تكن)
 * ============================================================
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import { INVOICE_STATUS, PAYMENT_METHOD } from '@/lib/subscription'

const RECEIPTS_DIR = path.join(process.cwd(), 'uploads', 'receipts')

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { subscription: true, plan: true },
    })
    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }
    if (invoice.status === INVOICE_STATUS.PAID) {
      return NextResponse.json({ error: 'هذه الفاتورة مدفوعة بالفعل' }, { status: 400 })
    }

    const contentType = request.headers.get('content-type') || ''
    let method = PAYMENT_METHOD.MANUAL
    let receiptPath: string | null = null
    let notes = ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      method = (form.get('method') as string) || PAYMENT_METHOD.MANUAL
      notes = (form.get('notes') as string) || ''
      const receipt = form.get('receipt')
      if (receipt instanceof File) {
        if (receipt.size > 10 * 1024 * 1024) {
          return NextResponse.json({ error: 'حجم الإيصال يتجاوز 10 ميجا' }, { status: 400 })
        }
        await fs.mkdir(RECEIPTS_DIR, { recursive: true })
        const ext = (receipt.name.split('.').pop() || 'pdf').toLowerCase()
        const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
        const fullPath = path.join(RECEIPTS_DIR, uniqueName)
        const buf = Buffer.from(await receipt.arrayBuffer())
        await fs.writeFile(fullPath, buf)
        receiptPath = `receipts/${uniqueName}`
      }
    } else {
      const body = await request.json()
      method = body.method || PAYMENT_METHOD.MANUAL
      notes = body.notes || ''
    }

    // ===== الدفع اليدوي (تحويل بنكي) =====
    if (method === PAYMENT_METHOD.MANUAL) {
      if (!receiptPath) {
        return NextResponse.json({ error: 'إيصال التحويل مطلوب' }, { status: 400 })
      }
      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          manualReceiptUrl: receiptPath,
          manualNotes: notes.slice(0, 500),
          paymentMethod: PAYMENT_METHOD.MANUAL,
          // تبقى PENDING حتى يراجعها super-admin
        },
      })
      // سجل حركة دفع
      await db.paymentTransaction.create({
        data: {
          invoiceId: invoice.id,
          schoolId: invoice.schoolId,
          gateway: PAYMENT_METHOD.MANUAL,
          amount: invoice.amount,
          currency: invoice.currency,
          status: 'PENDING',
          payload: JSON.stringify({ receiptUrl: receiptPath, notes }),
        },
      })
      return NextResponse.json({
        success: true,
        message: 'تم استلام إيصال التحويل. سيتم مراجعته وتأكيد الدفع خلال 24-48 ساعة.',
      })
    }

    // ===== الدفع عبر Paymob (جاهز للتفعيل عند إضافة المفاتيح) =====
    if (method === PAYMENT_METHOD.PAYMOB) {
      const apiKey = process.env.PAYMOB_API_KEY
      if (!apiKey) {
        return NextResponse.json(
          {
            error: 'الدفع الإلكتروني عبر Paymob غير مُفعّل حاليًا. يرجى استخدام التحويل البنكي اليدوي. سيتم تفعيل Paymob قريبًا.',
          },
          { status: 503 }
        )
      }
      // TODO عند تفعيل Paymob:
      // 1) POST /api/auth/tokens → auth_token
      // 2) POST /api/ecommerce/orders → merchant_order_id
      // 3) POST /api/acceptance/payment_keys → payment_token + iframe URL
      // سجل حركة دفع pending
      await db.paymentTransaction.create({
        data: {
          invoiceId: invoice.id,
          schoolId: invoice.schoolId,
          gateway: PAYMENT_METHOD.PAYMOB,
          amount: invoice.amount,
          currency: invoice.currency,
          status: 'PENDING',
        },
      })
      // placeholder — سيُستبدل بالتنفيذ الفعلي عند توفّر المفاتيح
      return NextResponse.json(
        { error: 'Paymob قيد التهيئة — استخدم التحويل البنكي اليدوي مؤقتًا' },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: 'طريقة دفع غير مدعومة' }, { status: 400 })
  } catch (error) {
    console.error('[invoices/pay POST] error:', error)
    return NextResponse.json(
      { error: 'فشل تسجيل الدفع', details: (error as Error).message },
      { status: 500 }
    )
  }
}
