/**
 * يزرع مجلدات فرعية تجريبية + يضبط الصلاحيات والترتيب على الملفات الموجودة
 * تشغيل: bun scripts/seed-folders.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const FOLDER_SEED: { category: string; name: string; description: string; sortOrder: number }[] = [
  { category: 'STUDENT_AFFAIRS', name: 'نماذج التسجيل', description: 'نماذج تسجيل الطلاب الجدد', sortOrder: 1 },
  { category: 'STUDENT_AFFAIRS', name: 'إذونات الانصراف', description: 'نماذج إذن خروج الطلاب', sortOrder: 2 },
  { category: 'STAFF_AFFAIRS', name: 'نماذج الإجازات', description: 'طلبات إجازات العاملين', sortOrder: 1 },
  { category: 'FINANCIAL', name: 'السندات المالية', description: 'سندات التحصيل والصرف', sortOrder: 1 },
  { category: 'GENERAL', name: 'أدلة وإرشادات', description: 'أدلة تعريفية وكتيبات', sortOrder: 1 },
]

async function main() {
  const schools = await prisma.school.findMany({ where: { isActive: true } })
  console.log(`Found ${schools.length} schools`)
  for (const school of schools) {
    // أنشئ المجلدات إن لم تكن موجودة
    const folderIds: Record<string, string> = {}
    for (const fs of FOLDER_SEED) {
      const existing = await prisma.downloadFolder.findFirst({
        where: { schoolId: school.id, category: fs.category, name: fs.name },
      })
      let folder
      if (existing) {
        folder = existing
      } else {
        folder = await prisma.downloadFolder.create({
          data: { schoolId: school.id, ...fs, isActive: true },
        })
      }
      folderIds[`${fs.category}:${fs.name}`] = folder.id
    }
    console.log(`  ${school.name}: ${Object.keys(folderIds).length} folders ensured`)

    // اضبط الملفات الموجودة: الصلاحيات + الترتيب + المجلد
    const files = await prisma.downloadableFile.findMany({ where: { schoolId: school.id } })
    for (const f of files) {
      const updates: { visibility?: string; sortOrder?: number; folderId?: string | null } = {}
      // الصلاحيات: اجعل بعض الملفات غير عامة لتظهر البطاقات
      if (f.category === 'STAFF_AFFAIRS') {
        updates.visibility = 'STAFF'
      } else if (f.category === 'FINANCIAL' && f.title.includes('رواتب')) {
        updates.visibility = 'ADMIN'
      } else if (f.title.includes('تسجيل')) {
        updates.visibility = 'TEACHER'
      } else {
        updates.visibility = 'PUBLIC'
      }
      // الترتيب: متنوّع
      updates.sortOrder = Math.floor(Math.random() * 5)
      // المجلد: اربط حسب العنوان
      if (f.title.includes('تسجيل') && folderIds['STUDENT_AFFAIRS:نماذج التسجيل']) {
        updates.folderId = folderIds['STUDENT_AFFAIRS:نماذج التسجيل']
      } else if (f.title.includes('خروج') && folderIds['STUDENT_AFFAIRS:إذونات الانصراف']) {
        updates.folderId = folderIds['STUDENT_AFFAIRS:إذونات الانصراف']
      } else if (f.title.includes('إجازة') && folderIds['STAFF_AFFAIRS:نماذج الإجازات']) {
        updates.folderId = folderIds['STAFF_AFFAIRS:نماذج الإجازات']
      } else if (f.title.includes('سند') && folderIds['FINANCIAL:السندات المالية']) {
        updates.folderId = folderIds['FINANCIAL:السندات المالية']
      } else if (f.title.includes('دليل') && folderIds['GENERAL:أدلة وإرشادات']) {
        updates.folderId = folderIds['GENERAL:أدلة وإرشادات']
      }
      await prisma.downloadableFile.update({ where: { id: f.id }, data: updates })
    }
    console.log(`  ${school.name}: updated ${files.length} files`)
  }
  console.log('Done')
}

main().catch(console.error).finally(() => prisma.$disconnect())
