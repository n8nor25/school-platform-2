import { db } from '../src/lib/db';

async function main() {
  const exams = await db.exam.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true, title: true, schoolId: true, classroomId: true,
      startDate: true, endDate: true, durationMinutes: true, status: true,
      school: { select: { id: true, name: true, subdomain: true } },
      _count: { select: { questions: true, submissions: true } },
    },
    take: 6, orderBy: { createdAt: 'desc' },
  });

  console.log('\n=== الامتحانات المنشورة ===');
  for (const e of exams) {
    const now = new Date();
    const active = now >= e.startDate && now <= e.endDate;
    console.log(`- [${active ? 'نشط' : 'غير نشط'}] ${e.title}`);
    console.log(`    examId: ${e.id}`);
    console.log(`    schoolId: ${e.schoolId} | ${e.school?.name} (${e.school?.subdomain})`);
    console.log(`    classroomId: ${e.classroomId ?? 'كل الفصول'}`);
    console.log(`    start: ${e.startDate.toISOString()}`);
    console.log(`    end:   ${e.endDate.toISOString()}`);
    console.log(`    duration: ${e.durationMinutes}min | Q: ${e._count.questions} | subs: ${e._count.submissions}`);
  }

  const schoolIds = Array.from(new Set(exams.map(e => e.schoolId)));
  console.log('\n=== الطلاب في نفس المدارس ===');
  for (const sid of schoolIds.slice(0, 4)) {
    const school = exams.find(e => e.schoolId === sid)?.school;
    console.log(`\nالمدرسة: ${school?.name} (${sid})`);
    const students = await db.student.findMany({
      where: { schoolId: sid, archived: false },
      select: { id: true, name: true, studentNumber: true, status: true, classroom: { select: { name: true } } },
      take: 6, orderBy: { createdAt: 'desc' },
    });
    if (students.length === 0) {
      console.log('  لا طلاب نشطين — البحث عن أي طالب:');
      const any = await db.student.findFirst({
        where: { schoolId: sid },
        select: { id: true, name: true, studentNumber: true, status: true, archived: true },
      });
      if (any) console.log(`  id: ${any.id} | name: ${any.name} | number: ${any.studentNumber} | status: ${any.status} | archived: ${any.archived}`);
      else console.log('  لا يوجد أي طالب في هذه المدرسة');
    } else {
      for (const s of students) {
        console.log(`  - id: ${s.id} | name: ${s.name} | number: ${s.studentNumber} | status: ${s.status} | class: ${s.classroom?.name ?? '—'}`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
