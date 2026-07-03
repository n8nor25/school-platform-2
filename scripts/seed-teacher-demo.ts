import { db } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const schoolId = 'cmqu1mqhq0000mj5fuoui57sz';
  const teacherId = 'test-teacher-001';
  const studentId = 'test-student-001';

  // 1) Ensure teacher profile
  await db.examTeacherProfile.upsert({
    where: { teacherId },
    update: { teacherName: 'أ. محمد عبدالله' },
    create: { schoolId, teacherId, teacherName: 'أ. محمد عبدالله' },
  });
  console.log('✓ teacher profile');

  // 2) Ensure student
  await db.student.upsert({
    where: { schoolId_studentNumber: { schoolId, studentNumber: 'TEST-001' } },
    update: {},
    create: { id: studentId, schoolId, studentNumber: 'TEST-001', name: 'طالب تجريبي' },
  });
  console.log('✓ student');

  // 3) Create a demo exam (DRAFT first, then publish)
  const existing = await db.exam.findFirst({ where: { teacherId, title: 'امتحان تجريبي — الرياضيات' } });
  let exam = existing;
  if (!exam) {
    exam = await db.exam.create({
      data: {
        schoolId, teacherId, teacherName: 'أ. محمد عبدالله',
        title: 'امتحان تجريبي — الرياضيات',
        description: 'اختبار قصير في الجبر والهندسة',
        subject: 'الرياضيات',
        classroomName: 'الصف الأول الإعدادي',
        startDate: new Date(Date.now() - 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        durationMinutes: 30,
        maxAttempts: 1,
        maxFileSizeMb: 5,
        allowTextAnswers: true,
        allowImageAnswers: true,
        allowPdfAnswers: false,
        antiCheatEnabled: true,
        showResultImmediately: true,
        passingScore: 50,
        status: 'DRAFT',
      },
    });
    console.log('✓ exam created:', exam.id);
  } else {
    console.log('✓ exam exists:', exam.id);
  }

  // 4) Add questions if none
  const qCount = await db.question.count({ where: { examId: exam.id } });
  if (qCount === 0) {
    await db.question.createMany({
      data: [
        { schoolId, examId: exam.id, type: 'MCQ', text: 'ما ناتج ٧ × ٨؟', options: JSON.stringify(['٥٤','٥٦','٥٨','٦٤']), correctAnswer: '1', points: 2, order: 0, textModeration: 'SAFE', imageModeration: 'SAFE' },
        { schoolId, examId: exam.id, type: 'TRUE_FALSE', text: 'العدد ٧ أولي.', correctAnswer: 'true', points: 1, order: 1, textModeration: 'SAFE', imageModeration: 'SAFE' },
        { schoolId, examId: exam.id, type: 'SHORT', text: 'ما اسم الشكل الذي له ٣ أضلاع؟', correctText: 'مثلث', points: 1, order: 2, textModeration: 'SAFE', imageModeration: 'SAFE' },
        { schoolId, examId: exam.id, type: 'ESSAY', text: 'اشرح خطوة بخطوة كيف تحل المعادلة ٢س + ٣ = ١١.', rubric: JSON.stringify({ criteria: ['ذكر نقل الثابت','القسمة على المعامل','النتيجة س=٤'] }), points: 4, order: 3, textModeration: 'SAFE', imageModeration: 'SAFE' },
      ],
    });
    console.log('✓ 4 questions added');
  } else {
    console.log('✓ questions exist:', qCount);
  }

  // 5) Recompute totalPoints
  const qs = await db.question.findMany({ where: { examId: exam.id }, select: { points: true } });
  const total = qs.reduce((s, q) => s + q.points, 0);
  await db.exam.update({ where: { id: exam.id }, data: { totalPoints: total, status: 'PUBLISHED' } });
  console.log('✓ totalPoints:', total, '| status: PUBLISHED');

  // 6) Add a sample submission from student (SUBMITTED, needs grading for ESSAY)
  const existingSub = await db.submission.findFirst({ where: { examId: exam.id, studentId } });
  if (!existingSub) {
    const sub = await db.submission.create({
      data: {
        schoolId, examId: exam.id, studentId, studentName: 'طالب تجريبي',
        attemptNumber: 1, startedAt: new Date(Date.now() - 25 * 60 * 1000),
        submittedAt: new Date(), status: 'SUBMITTED',
      },
    });
    const allQs = await db.question.findMany({ where: { examId: exam.id }, orderBy: { order: 'asc' } });
    await db.answer.createMany({
      data: [
        { schoolId, submissionId: sub.id, questionId: allQs[0].id, textAnswer: '1', textModeration: 'SAFE', maxScore: allQs[0].points },
        { schoolId, submissionId: sub.id, questionId: allQs[1].id, textAnswer: 'true', textModeration: 'SAFE', maxScore: allQs[1].points },
        { schoolId, submissionId: sub.id, questionId: allQs[2].id, textAnswer: 'مثلث', textModeration: 'SAFE', maxScore: allQs[2].points },
        { schoolId, submissionId: sub.id, questionId: allQs[3].id, textAnswer: 'أنقل الثابت ٣ للطرف الآخر فيصبح -٣ ثم أقسم على معامل س وهو ٢ فتكون س = ٤.', textModeration: 'SAFE', maxScore: allQs[3].points },
      ],
    });
    console.log('✓ sample submission + answers created:', sub.id);
  } else {
    console.log('✓ submission exists');
  }

  console.log('\n=== بيانات الدخول للمعلم ===');
  console.log('schoolId:', schoolId);
  console.log('teacherId:', teacherId, '(أ. محمد عبدالله)');
  console.log('examId:', exam.id);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
