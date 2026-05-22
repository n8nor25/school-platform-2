import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ===== CRITICAL: Fix SQLite → Supabase PostgreSQL override =====
// The container sets a system-level DATABASE_URL pointing to SQLite,
// which overrides the .env file. This code detects that and forces
// the correct Supabase PostgreSQL URLs at runtime, BEFORE the
// PrismaClient is instantiated.
// Connection limit=5 to avoid Supabase pooler max client limits.
const SUPABASE_DATABASE_URL = 'postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5'
const SUPABASE_DIRECT_URL = 'postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connection_limit=5'

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
  return new PrismaClient()
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
