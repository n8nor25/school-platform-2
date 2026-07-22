import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const grouped = await prisma.downloadableFile.groupBy({
    by: ['category'],
    _count: { _all: true },
    where: { isActive: true },
  })
  console.log('Grouped:', JSON.stringify(grouped, null, 2))
  const total = await prisma.downloadableFile.count()
  console.log('Total (incl inactive):', total)
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1) })
