import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'
const prisma = new PrismaClient()
async function main() {
  const files = await prisma.downloadableFile.findMany({ where: { category: 'GENERAL' } })
  for (const f of files) {
    try { await fs.unlink(path.join(process.cwd(), 'uploads', 'downloads', f.filePath)) } catch {}
    await prisma.downloadableFile.delete({ where: { id: f.id } })
  }
  console.log(`Deleted ${files.length} GENERAL files`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
