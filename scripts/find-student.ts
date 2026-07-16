// Quick script to find a registered student + their classroom
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const SCHOOL_ID = 'cmqu1mqhq0000mj5fuoui57sz'

async function main() {
  // Find an active student
  const students = await db.student.findMany({
    where: { schoolId: SCHOOL_ID, archived: false },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      classroomId: true,
      status: true,
      parentPhone: true,
      parentName: true,
    }
  })

  console.log('=== Active students in school ===')
  console.log(JSON.stringify(students, null, 2))

  // Also fetch classrooms so we can match names
  const classrooms = await db.classroom.findMany({
    where: { schoolId: SCHOOL_ID },
    take: 30,
    select: { id: true, name: true, gradeLevel: true }
  })
  console.log('\n=== Classrooms ===')
  console.log(JSON.stringify(classrooms, null, 2))

  // Existing training exams
  const training = await db.exam.findMany({
    where: { schoolId: SCHOOL_ID, category: 'TRAINING' },
    select: {
      id: true,
      title: true,
      subject: true,
      examPeriod: true,
      status: true,
      classroomId: true,
      classroomName: true,
      startDate: true,
      endDate: true,
      _count: { select: { questions: true, submissions: true } }
    }
  })
  console.log('\n=== Existing training exams ===')
  console.log(JSON.stringify(training, null, 2))

  // Existing submissions for training exams
  const subs = await db.submission.findMany({
    where: { exam: { schoolId: SCHOOL_ID, category: 'TRAINING' } },
    select: {
      id: true,
      examId: true,
      studentId: true,
      studentName: true,
      percentage: true,
      status: true,
      submittedAt: true,
    },
    take: 50,
  })
  console.log('\n=== Training exam submissions ===')
  console.log(JSON.stringify(subs, null, 2))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(() => db.$disconnect())
