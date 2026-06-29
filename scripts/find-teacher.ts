import { db } from '../src/lib/db';
async function main() {
  const teachers = await db.examTeacherProfile.findMany({
    select: { teacherId: true, teacherName: true, schoolId: true, totalExamsCreated: true, totalQuestionsInBank: true },
    take: 10,
  });
  console.log('=== ExamTeacherProfile rows ===');
  for (const t of teachers) {
    console.log(`  teacherId: ${t.teacherId} | name: ${t.teacherName} | school: ${t.schoolId} | exams: ${t.totalExamsCreated} | bankQs: ${t.totalQuestionsInBank}`);
  }
  const exams = await db.exam.findMany({
    select: { teacherId: true, teacherName: true, title: true, status: true },
    take: 20,
  });
  console.log('\n=== Exams by teacher ===');
  const seen = new Set<string>();
  for (const e of exams) {
    const key = e.teacherId;
    if (!seen.has(key)) { seen.add(key); console.log(`  teacherId: ${e.teacherId} | name: ${e.teacherName} | exam: ${e.title} (${e.status})`); }
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
