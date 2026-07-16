import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use SQLite by default (Supabase projects were deleted/unreachable).
// If DATABASE_URL is provided externally (e.g. real Postgres in production),
// it will be respected.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/home/z/my-project/db/custom.db'
}

// Log the active database connection (mask password for security)
const maskedUrl = (process.env.DATABASE_URL || '').replace(/:([^@]+)@/, ':****@')
console.log(`[db] ✅ Connected to: ${maskedUrl}`)

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

// تطبيق النمط الفردي (Singleton) لضمان إعادة استخدام نفس كائن الذاكرة وعدم تكراره
const prisma = globalForPrisma.prisma ?? createPrismaClient()

export const db = prisma

// حفظ نسخة الكائن بشكل دائم لمنع تسريب الذاكرة (Memory Leak) في السيرفر
globalForPrisma.prisma = prisma
