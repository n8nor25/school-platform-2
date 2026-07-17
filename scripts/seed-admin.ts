import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()

const SCHOOL_ID = 'cmqu1mqhq0000mj5fuoui57sz'

async function main() {
  const username = 'admin'
  const password = 'admin123'
  const hash = await bcrypt.hash(password, 10)

  // upsert by username (only unique field besides id)
  const existing = await db.user.findFirst({ where: { username } })
  let user
  if (existing) {
    user = await db.user.update({ where: { id: existing.id }, data: { password: hash, role: 'super_admin' } })
    console.log('✅ Updated admin user:', user.username, user.role)
  } else {
    user = await db.user.create({
      data: {
        schoolId: SCHOOL_ID,
        username,
        password: hash,
        role: 'super_admin',
        permissions: '{}',
      }
    })
    console.log('✅ Created admin user:', user.username, user.role)
  }
  console.log('\n========== ADMIN LOGIN ==========')
  console.log('URL: http://localhost:3000/?action=admin')
  console.log('Username:', username)
  console.log('Password:', password)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
