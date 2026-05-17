import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ===== CRITICAL: Fix SQLite → Supabase PostgreSQL override =====
// The container startup script (/start.sh) overwrites .env with SQLite on every restart.
// This code detects that and forces the correct Supabase PostgreSQL URLs at runtime.
const SUPABASE_DATABASE_URL = 'postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
const SUPABASE_DIRECT_URL = 'postgresql://postgres:e1yexwk7UBPWPeCV@db.tjnlxkyzopxnlunpeude.supabase.co:5432/postgres'

const currentUrl = process.env.DATABASE_URL || ''
if (currentUrl.startsWith('file:') || !currentUrl.startsWith('postgresql')) {
  process.env.DATABASE_URL = SUPABASE_DATABASE_URL
  process.env.DIRECT_URL = SUPABASE_DIRECT_URL
  console.warn('[db] ⚠️ DATABASE_URL was pointing to SQLite, overriding with Supabase PostgreSQL')
} else {
  // Even if DATABASE_URL is PostgreSQL, make sure DIRECT_URL is also set
  if (!process.env.DIRECT_URL || process.env.DIRECT_URL.startsWith('file:')) {
    process.env.DIRECT_URL = SUPABASE_DIRECT_URL
  }
}

function createPrismaClient() {
  return new PrismaClient()
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
