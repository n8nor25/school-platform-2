// Quick DB connectivity test with full error
import { PrismaClient } from '@prisma/client'

const urls = [
  'postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=5',
  'postgresql://postgres.tjnlxkyzopxnlunpeude:e1yexwk7UBPWPeCV@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5',
]

for (const url of urls) {
  console.log('\n--- Testing:', url.replace(/:[^@]+@/, ':****@'))
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const count = await prisma.school.count()
    console.log('   ✅ SUCCESS, schools:', count)
    await prisma.$disconnect()
    break
  } catch (e) {
    console.log('   ❌ FAILED:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2).slice(0, 1500))
    await prisma.$disconnect()
  }
}
