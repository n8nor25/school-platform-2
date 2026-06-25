import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ===== CRITICAL FIXED: SQLite → Supabase PostgreSQL connection management =====
// تفعيل مجمع الاتصالات من Supabase على المنفذ الصحيح 6543 لضمان عدم نفاد حدود الاتصال
const SUPABASE_DATABASE_URL = 'postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=4'
const SUPABASE_DIRECT_URL = 'postgresql://postgres.ivclktmhpkyxzlywewpl:qEk9OmC8XKRyTUQS@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'

const currentUrl = process.env.DATABASE_URL || ''
const currentDirectUrl = process.env.DIRECT_URL || ''

// Override DATABASE_URL if it's not pointing to PostgreSQL
if (!currentUrl.startsWith('postgresql://')) {
  process.env.DATABASE_URL = SUPABASE_DATABASE_URL
  console.warn('[db] ⚠️ DATABASE_URL was not PostgreSQL, overriding with Supabase PostgreSQL')
}

// Override DIRECT_URL if it's not pointing to PostgreSQL
if (!currentDirectUrl.startsWith('postgresql://')) {
  process.env.DIRECT_URL = SUPABASE_DIRECT_URL
  console.warn('[db] ⚠️ DIRECT_URL was not PostgreSQL, overriding with Supabase pooler URL')
}

// Log the active database connection (mask password for security)
const maskedUrl = (process.env.DATABASE_URL || '').replace(/:([^@]+)@/, ':****@')
console.log(`[db] ✅ Connected to: ${maskedUrl}`)

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// تطبيق النمط الفردي (Singleton) لضمان إعادة استخدام نفس كائن الذاكرة وعدم تكراره
const prisma = globalForPrisma.prisma ?? createPrismaClient()

export const db = prisma

// حفظ نسخة الكائن بشكل دائم لمنع تسريب الذاكرة (Memory Leak) في السيرفر
globalForPrisma.prisma = prisma
