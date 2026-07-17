// Seed minimal data: school, classroom, teacher, students, training exam with submissions
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // 1. School
  const school = await db.school.upsert({
    where: { subdomain: 'default' },
    update: {},
    create: {
      id: 'cmqu1mqhq0000mj5fuoui57sz',
      name: 'مدرسة النور التجريبية',
      subdomain: 'default',
      primaryColor: '#610000',
      secondaryColor: '#009688',
      address: 'القاهرة، مصر',
      phone: '0223456789',
      email: 'info@alnoor.edu',
      isActive: true,
    },
  })
  console.log('✅ School:', school.id, school.name)

  // 2. Academic Year
  const academicYear = await db.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: '2024/2025' } },
    update: {},
    create: {
      schoolId: school.id,
      name: '2024/2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
  })
  console.log('✅ AcademicYear:', academicYear.id, academicYear.name)

  // 3. Classroom
  const classroom = await db.classroom.upsert({
    where: { schoolId_academicYearId_name: { schoolId: school.id, academicYearId: academicYear.id, name: 'الثالث الإعدادي - أ' } },
    update: {},
    create: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      name: 'الثالث الإعدادي - أ',
      gradeLevel: 'الثالث الإعدادي',
      section: 'أ',
    }
  })
  console.log('✅ Classroom:', classroom.id, classroom.name)

  // 4. Teacher (Teacher table has no user link in this schema)
  const teacher = await db.teacher.create({
    data: {
      schoolId: school.id,
      name: 'أ. محمد عبد الله',
      subject: 'الرياضيات',
      email: 'teacher@alnoor.edu',
    }
  }).catch(async () => {
    return await db.teacher.findFirst({ where: { schoolId: school.id, email: 'teacher@alnoor.edu' } })!
  })
  console.log('✅ Teacher:', teacher?.id, teacher?.name)

  // 4. Students (real students, not test-)
  const studentsData = [
    { studentNumber: '2024001', name: 'أحمد محمود علي', parentName: 'محمود علي', parentPhone: '01011111111' },
    { studentNumber: '2024002', name: 'سارة خالد إبراهيم', parentName: 'خالد إبراهيم', parentPhone: '01022222222' },
    { studentNumber: '2024003', name: 'يوسف عماد الدين', parentName: 'عماد الدين', parentPhone: '01033333333' },
    { studentNumber: '2024004', name: 'ملك أحمد فؤاد', parentName: 'أحمد فؤاد', parentPhone: '01044444444' },
    { studentNumber: '2024005', name: 'عمر هاني سعد', parentName: 'هاني سعد', parentPhone: '01055555555' },
  ]

  const students = []
  for (const s of studentsData) {
    const student = await db.student.upsert({
      where: { schoolId_studentNumber: { schoolId: school.id, studentNumber: s.studentNumber } },
      update: { classroomId: classroom.id },
      create: {
        schoolId: school.id,
        classroomId: classroom.id,
        studentNumber: s.studentNumber,
        name: s.name,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        gender: s.name.startsWith('سارة') || s.name.startsWith('ملك') ? 'أنثى' : 'ذكر',
        status: 'نشط',
      },
    })
    students.push(student)
    console.log('✅ Student:', student.studentNumber, student.name)
  }

  // 5. Training exams across periods with explanations
  const now = new Date()
  const day = 24 * 60 * 60 * 1000

  const trainingExams = [
    { title: 'تدريبي أسبوعي 1 - الجبر', subject: 'الرياضيات', period: 'WEEKLY', daysAgo: 28 },
    { title: 'تدريبي أسبوعي 2 - الجبر', subject: 'الرياضيات', period: 'WEEKLY', daysAgo: 21 },
    { title: 'تدريبي منتصف الشهر - الهندسة', subject: 'الرياضيات', period: 'MIDMONTH', daysAgo: 14 },
    { title: 'تدريبي أسبوعي 3 - الإحصاء', subject: 'الرياضيات', period: 'WEEKLY', daysAgo: 7 },
    { title: 'تدريبي شهري شامل', subject: 'الرياضيات', period: 'MONTHLY', daysAgo: 1 },
  ]

  for (const te of trainingExams) {
    const startDate = new Date(now.getTime() - te.daysAgo * day)
    const endDate = new Date(startDate.getTime() + 7 * day)

    const exam = await db.exam.create({
      data: {
        schoolId: school.id,
        title: te.title,
        description: 'امتحان تدريبي تلقائي - يمكن إعادة المحاولة',
        subject: te.subject,
        teacherId: teacher.id,
        teacherName: teacher.name,
        classroomId: classroom.id,
        classroomName: classroom.name,
        startDate,
        endDate,
        durationMinutes: 30,
        shuffleQuestions: false,
        shuffleOptions: false,
        allowReview: true,
        showResultImmediately: true,
        parentVisible: true,
        maxAttempts: 99,
        category: 'TRAINING',
        examPeriod: te.period,
        showAnswersAfter: true,
        allowRetakes: true,
        status: 'PUBLISHED',
        totalPoints: 4,
        passingScore: 2,
        questions: {
          create: [
            {
              schoolId: school.id,
              type: 'MCQ',
              text: 'ما هو ناتج 7 × 8 ؟',
              options: JSON.stringify(['54', '56', '64', '48']),
              correctAnswer: '1',
              points: 1,
              order: 0,
              explanation: '7 × 8 = 56. يمكن تذكرها من جدول الضرب: 7×8 = 56.',
            },
            {
              schoolId: school.id,
              type: 'MCQ',
              text: 'ما هو الجذر التربيعي لـ 144 ؟',
              options: JSON.stringify(['10', '11', '12', '13']),
              correctAnswer: '2',
              points: 1,
              order: 1,
              explanation: '12 × 12 = 144، إذن الجذر التربيعي لـ 144 هو 12.',
            },
            {
              schoolId: school.id,
              type: 'TRUE_FALSE',
              text: 'العدد 7 أولي (Prime).',
              options: JSON.stringify(['صحيح', 'خطأ']),
              correctAnswer: '0',
              points: 1,
              order: 2,
              explanation: 'العدد 7 يقبل القسمة فقط على 1 ونفسه، لذا فهو عدد أولي.',
            },
            {
              schoolId: school.id,
              type: 'MCQ',
              text: 'ما مساحة مربع طول ضلعه 5 سم ؟',
              options: JSON.stringify(['10 سم²', '20 سم²', '25 سم²', '50 سم²']),
              correctAnswer: '2',
              points: 1,
              order: 3,
              explanation: 'مساحة المربع = طول الضلع × نفسه = 5 × 5 = 25 سم².',
            },
          ]
        }
      }
    })
    console.log('✅ Training exam:', exam.id, exam.title, '| period:', te.period)

    // 6. Seed submissions so the performance curve has data
    // For each student: progressive improvement
    const targetStudent = students[0] // أحمد
    const attempts = [
      { idx: 0, pct: 50 }, // week1: 2/4
      { idx: 1, pct: 50 },
      { idx: 2, pct: 75 }, // midmonth
      { idx: 3, pct: 75 }, // week3
      { idx: 4, pct: 100 }, // monthly
    ]
    const attemptForThisExam = attempts.find(a => a.idx === trainingExams.indexOf(te))
    if (attemptForThisExam) {
      const score = (attemptForThisExam.pct / 100) * 4
      await db.submission.create({
        data: {
          schoolId: school.id,
          examId: exam.id,
          studentId: targetStudent.id,
          studentName: targetStudent.name,
          attemptNumber: 1,
          startedAt: new Date(startDate.getTime() + 1 * day),
          submittedAt: new Date(startDate.getTime() + 1 * day + 25 * 60 * 1000),
          status: 'GRADED',
          totalScore: score,
          maxScore: 4,
          percentage: attemptForThisExam.pct,
          passed: score >= 2,
          gradedAt: new Date(startDate.getTime() + 1 * day + 30 * 60 * 1000),
        }
      })
      console.log(`   📝 Submission for ${targetStudent.name}: ${score}/4 (${attemptForThisExam.pct}%)`)

      // Also seed submissions for a few other students so the class average has data
      for (let i = 1; i < students.length; i++) {
        const s = students[i]
        // Vary scores so class avg is realistic
        const classPct = Math.max(25, Math.min(100, attemptForThisExam.pct + (i % 3 === 0 ? -25 : (i % 3 === 1 ? 0 : 25))))
        const classScore = (classPct / 100) * 4
        await db.submission.create({
          data: {
            schoolId: school.id,
            examId: exam.id,
            studentId: s.id,
            studentName: s.name,
            attemptNumber: 1,
            startedAt: new Date(startDate.getTime() + 1 * day),
            submittedAt: new Date(startDate.getTime() + 1 * day + 25 * 60 * 1000),
            status: 'GRADED',
            totalScore: classScore,
            maxScore: 4,
            percentage: classPct,
            passed: classScore >= 2,
            gradedAt: new Date(startDate.getTime() + 1 * day + 30 * 60 * 1000),
          }
        })
      }
    }
  }

  // 7. Summary
  const totalStudents = await db.student.count({ where: { schoolId: school.id } })
  const totalExams = await db.exam.count({ where: { schoolId: school.id, category: 'TRAINING' } })
  const totalSubs = await db.submission.count({ where: { exam: { schoolId: school.id, category: 'TRAINING' } } })
  console.log('\n========== SEED COMPLETE ==========')
  console.log('School:', school.id)
  console.log('Students:', totalStudents)
  console.log('Training exams:', totalExams)
  console.log('Training submissions:', totalSubs)
  console.log('First student login → studentNumber:', students[0].studentNumber, '| name:', students[0].name)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
