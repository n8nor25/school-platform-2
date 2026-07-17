import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  const school = await prisma.school.findFirst()
  if (!school) {
    console.log('No school found')
    return
  }
  // Create sample PDF bytes
  const pdfBytes = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Sample PDF) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000196 00000 n
trailer << /Size 5 /Root 1 0 R >>
startxref
290
%%EOF`)
  const uploadRoot = path.join(process.cwd(), 'uploads', 'downloads')
  
  const samples = [
    { cat: 'STUDENT_AFFAIRS', folder: 'student-affairs', title: 'نموذج تسجيل طالب جديد', desc: 'نموذج تسجيل الطالب في المدرسة للعام الدراسي 2024/2025', name: 'student-registration.pdf' },
    { cat: 'STUDENT_AFFAIRS', folder: 'student-affairs', title: 'إذن خروج الطالب', desc: 'استمارة إذن خروج الطالب خلال اليوم الدراسي', name: 'leave-permit.pdf' },
    { cat: 'STUDENT_AFFAIRS', folder: 'student-affairs', title: 'تعهد سلوك الطالب', desc: 'استمارة تعهد على سلوك الطالب ومتابعة الدراسة', name: 'behavior-pledge.docx' },
    { cat: 'STAFF_AFFAIRS', folder: 'staff-affairs', title: 'طلب إجازة عامل', desc: 'نموذج طلب إجازة للعاملين بالمدرسة', name: 'leave-request.pdf' },
    { cat: 'STAFF_AFFAIRS', folder: 'staff-affairs', title: 'استمارة تقييم أداء', desc: 'استمارة تقييم أداء العاملين', name: 'performance-evaluation.xlsx' },
    { cat: 'FINANCIAL', folder: 'financial', title: 'سند تحصيل رسوم دراسية', desc: 'نموذج سند رسمي لتحصيل الرسوم الدراسية', name: 'fees-receipt.pdf' },
    { cat: 'FINANCIAL', folder: 'financial', title: 'كشف رواتب العاملين', desc: 'كشف تفصيلي برواتب العاملين', name: 'salaries.xlsx' },
    { cat: 'ADMINISTRATIVE', folder: 'administrative', title: 'تعليمات عامة للمدرسة', desc: 'تعاميم إدارية وتعليمات عامة للعاملين والطلاب', name: 'general-directives.pdf' },
    { cat: 'ADMINISTRATIVE', folder: 'administrative', title: 'محضر اجتماع مجلس الإدارة', desc: 'نموذج محضر اجتماع مجلس إدارة المدرسة', name: 'board-meeting.docx' },
    { cat: 'GENERAL', folder: 'general', title: 'دليل المدرسة التعريفي', desc: 'دليل شامل بالخدمات والأنشطة المقدمة من المدرسة', name: 'school-guide.pdf' },
    { cat: 'GENERAL', folder: 'general', title: 'خطة العام الدراسي', desc: 'خطة عامة للأنشطة والمقررات الدراسية', name: 'annual-plan.pptx' },
  ]
  
  let count = 0
  for (const s of samples) {
    // check if already exists
    const existing = await prisma.downloadableFile.findFirst({ where: { schoolId: school.id, title: s.title } })
    if (existing) {
      console.log('skip', s.title)
      continue
    }
    const targetDir = path.join(uploadRoot, s.folder)
    await fs.mkdir(targetDir, { recursive: true })
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${s.name}`
    await fs.writeFile(path.join(targetDir, unique), pdfBytes)
    await prisma.downloadableFile.create({
      data: {
        schoolId: school.id,
        category: s.cat,
        title: s.title,
        description: s.desc,
        fileName: s.name,
        filePath: `${s.folder}/${unique}`,
        fileType: s.name.endsWith('.pdf') ? 'application/pdf' : s.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : s.name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileSize: pdfBytes.length,
        uploadedByName: 'إدارة المدرسة',
        isActive: true,
        downloadsCount: Math.floor(Math.random() * 100),
      }
    })
    count++
  }
  console.log(`Created ${count} sample files`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
