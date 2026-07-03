import { db } from '../src/lib/db'

async function main() {
  const school = await db.school.findFirst({ where: { subdomain: 'demo' } })
  const subs = await db.submission.findMany({ select: { id: true, studentId: true, studentName: true, examId: true, status: true, attemptNumber: true } })
  console.log('SUBMISSIONS:', JSON.stringify(subs, null, 2))

  // get students that have submissions
  const studentIds = [...new Set(subs.map(s => s.studentId))]
  console.log('STUDENT_IDS_WITH_SUBS:', studentIds)

  const students = await db.student.findMany({ where: { id: { in: studentIds } }, take: 10, select: { id: true, name: true } })
  console.log('STUDENTS:', JSON.stringify(students, null, 2))

  // any student
  const anyStudent = await db.student.findFirst({ select: { id: true, name: true, classroomId: true } })
  console.log('ANY_STUDENT:', JSON.stringify(anyStudent, null, 2))
}

main().catch(console.error).finally(() => process.exit(0))
