import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const r = await db.student.findMany({
  where: { schoolId: 'cmqu1mqhq0000mj5fuoui57sz' },
  select: { id: true, studentNumber: true, name: true }
})
console.log(JSON.stringify(r, null, 2))
await db.$disconnect()
