'use client'

import React from 'react'
import { Wallet, CreditCard, FileText, Banknote } from 'lucide-react'

/**
 * Format a number as Egyptian Pound currency in Arabic.
 * Example: 12500.5 -> "١٢٬٥٠٠٫٥ ج.م"
 */
export function formatCurrency(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  return `${n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`
}

/**
 * Format a number with Arabic numerals (no currency suffix).
 */
export function formatNumber(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  return n.toLocaleString('ar-EG', { maximumFractionDigits: 2 })
}

/**
 * Format a date (Date | ISO string) as "yyyy/MM/dd" in Arabic numerals.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd}`
}

/**
 * Format a date in a long Arabic form like "15 يناير 2025".
 */
export function formatLongDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Color-coded class map for the five expense statuses.
 * Returns Tailwind classes for badge background/text/border.
 */
export const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  'مسودة': {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
  },
  'معلق': {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  'معتمد': {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  'مدفوع': {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
  },
  'مرفوض': {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
}

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS['مسودة']
}

/**
 * Icons for payment methods.
 */
export const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  'نقدي': <Wallet className="w-3.5 h-3.5" />,
  'تحويل': <Banknote className="w-3.5 h-3.5" />,
  'شيك': <FileText className="w-3.5 h-3.5" />,
  'بطاقة': <CreditCard className="w-3.5 h-3.5" />,
}

/**
 * Vendor type colors.
 */
export const VENDOR_TYPE_COLORS: Record<string, string> = {
  'مورد': 'bg-[#610000]/10 text-[#610000] border-[#610000]/20',
  'مقاول': 'bg-amber-100 text-amber-700 border-amber-200',
  'جهة حكومية': 'bg-purple-100 text-purple-700 border-purple-200',
  'مستفيد': 'bg-green-100 text-green-700 border-green-200',
}

/**
 * Frequency badge colors for recurring expenses.
 */
export const FREQUENCY_COLORS: Record<string, string> = {
  'أسبوعي': 'bg-sky-100 text-sky-700 border-sky-200',
  'شهري': 'bg-[#610000]/10 text-[#610000] border-[#610000]/20',
  'ربعي': 'bg-amber-100 text-amber-700 border-amber-200',
  'سنوي': 'bg-green-100 text-green-700 border-green-200',
}

/**
 * Period badge colors for budgets.
 */
export const PERIOD_COLORS: Record<string, string> = {
  'سنوي': 'bg-[#610000]/10 text-[#610000] border-[#610000]/20',
  'ربعي': 'bg-amber-100 text-amber-700 border-amber-200',
  'شهري': 'bg-sky-100 text-sky-700 border-sky-200',
}

/**
 * Petty cash transaction type colors.
 */
export const PETTY_CASH_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  'صرف': {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  'تغذية': {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  'تسوية': {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
}

/**
 * Arabic month names (1-indexed).
 */
export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

export function getArabicMonth(monthNumber: number): string {
  return ARABIC_MONTHS[monthNumber - 1] || '—'
}

/**
 * Returns true if date is in the past (next-run is overdue).
 */
export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false
  const d = new Date(date)
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d.getTime() <= today.getTime()
}

/**
 * Color class for a budget progress percentage.
 */
export function getBudgetProgressColor(percent: number): string {
  if (percent > 100) return 'bg-red-500'
  if (percent >= 80) return 'bg-orange-500'
  if (percent >= 50) return 'bg-amber-500'
  return 'bg-green-500'
}

/**
 * Tailwind class for a remaining-amount cell.
 */
export function getRemainingColor(remaining: number): string {
  return remaining >= 0 ? 'text-green-600' : 'text-red-600'
}

/**
 * Common select options for payment methods.
 */
export const PAYMENT_METHODS = ['نقدي', 'تحويل', 'شيك', 'بطاقة']

/**
 * Common select options for expense statuses.
 */
export const EXPENSE_STATUSES = ['مسودة', 'معلق', 'معتمد', 'مدفوع', 'مرفوض']

/**
 * Common select options for vendor types.
 */
export const VENDOR_TYPES = ['مورد', 'مقاول', 'جهة حكومية', 'مستفيد']

/**
 * Common select options for recurring frequencies.
 */
export const FREQUENCIES = ['أسبوعي', 'شهري', 'ربعي', 'سنوي']

/**
 * Common select options for budget periods.
 */
export const BUDGET_PERIODS = ['سنوي', 'ربعي', 'شهري']

/**
 * Common select options for petty cash transaction types.
 */
export const PETTY_CASH_TYPES = ['صرف', 'تغذية', 'تسوية']

/**
 * Test school ID used as fallback when the admin store isn't hydrated.
 */
export const TEST_SCHOOL_ID = 'cmqu1mqhq0000mj5fuoui57sz'

/**
 * Test academic year ID used as fallback.
 */
export const TEST_ACADEMIC_YEAR_ID = 'cmqvi1fy70001u1zmumxho7th'

/**
 * Returns selectedSchoolId if present, else the test fallback.
 */
export function resolveSchool(selectedSchoolId: string | undefined | null): string {
  return selectedSchoolId || TEST_SCHOOL_ID
}
