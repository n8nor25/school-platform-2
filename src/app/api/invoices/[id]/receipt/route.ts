/**
 * GET /api/invoices/[id]/receipt
 * عرض/تحميل إيصال التحويل البنكي (لـ super-admin فقط — مبسّط)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'

const RECEIPTS_ROOT = path.join(process.cwd(), 'uploads')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoice = await db.invoice.findUnique({ where: { id } })
    if (!invoice) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }
    if (!invoice.manualReceiptUrl) {
      return NextResponse.json({ error: 'لا يوجد إيصال لهذه الفاتورة' }, { status: 404 })
    }
    const fullPath = path.join(RECEIPTS_ROOT, invoice.manualReceiptUrl)
    try {
      await fs.access(fullPath)
    } catch {
      return NextResponse.json({ error: 'الملف غير موجود على القرص' }, { status: 404 })
    }
    const buf = await fs.readFile(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    const mime =
      ext === '.pdf' ? 'application/pdf' :
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.webp' ? 'image/webp' :
      'application/octet-stream'
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="receipt-${invoice.invoiceNumber}${ext}"`,
      },
    })
  } catch (error) {
    console.error('[invoices/receipt GET] error:', error)
    return NextResponse.json({ error: 'فشل جلب الإيصال' }, { status: 500 })
  }
}
