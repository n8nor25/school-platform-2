/**
 * GET /api/exams/student?schoolId&studentId
 * يعرض للطالب قائمة الامتحانات المنشورة المتاحة + تسليماته السابقة.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractStudentContext, getExamTimeStatus, errorResponse, successResponse } from '../_student-helpers';

export async function GET(req: NextRequest) {
  const { student, error, status } = await extractStudentContext(req);
  if (!student) return errorResponse(error!, status);

  // All published exams in the school
  const exams = await db.exam.findMany({
    where: { schoolId: student.schoolId, status: 'PUBLISHED' },
    select: {
      id: true, title: true, description: true, subject: true,
      teacherName: true, classroomName: true,
      startDate: true, endDate: true, durationMinutes: true,
      passwordHash: true, maxAttempts: true, antiCheatEnabled: true,
      totalPoints: true, passingScore: true,
      _count: { select: { questions: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  // Student's submissions for these exams
  const examIds = exams.map(e => e.id);
  const submissions = await db.submission.findMany({
    where: { studentId: student.studentId, examId: { in: examIds } },
    select: {
      id: true, examId: true, status: true, attemptNumber: true,
      submittedAt: true, totalScore: true, maxScore: true, percentage: true, passed: true,
      startedAt: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  // Group submissions per exam
  const subsByExam = new Map<string, typeof submissions>();
  for (const s of submissions) {
    if (!subsByExam.has(s.examId)) subsByExam.set(s.examId, []);
    subsByExam.get(s.examId)!.push(s);
  }

  const result = exams.map(e => {
    const subs = subsByExam.get(e.id) || [];
    const completedAttempts = subs.filter(s => s.status !== 'IN_PROGRESS').length;
    const inProgress = subs.find(s => s.status === 'IN_PROGRESS');
    const timeStatus = getExamTimeStatus(e);
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      subject: e.subject,
      teacherName: e.teacherName,
      classroomName: e.classroomName,
      startDate: e.startDate,
      endDate: e.endDate,
      durationMinutes: e.durationMinutes,
      hasPassword: !!e.passwordHash,
      maxAttempts: e.maxAttempts,
      antiCheatEnabled: e.antiCheatEnabled,
      totalPoints: e.totalPoints,
      passingScore: e.passingScore,
      questionsCount: e._count.questions,
      timeStatus,
      attemptsUsed: completedAttempts,
      attemptsRemaining: Math.max(0, e.maxAttempts - completedAttempts),
      inProgressSubmissionId: inProgress?.id || null,
      bestScore: subs
        .filter(s => s.percentage != null)
        .reduce((max, s) => (s.percentage! > max ? s.percentage! : max), 0) || null,
      submissions: subs,
    };
  });

  // Split into available (OPEN) and other
  const available = result.filter(e => e.timeStatus === 'OPEN' && e.attemptsRemaining > 0 && !e.inProgressSubmissionId);
  const inProgressList = result.filter(e => e.inProgressSubmissionId);
  const upcoming = result.filter(e => e.timeStatus === 'UPCOMING');
  const endedOrExhausted = result.filter(e =>
    (e.timeStatus === 'ENDED' || e.attemptsRemaining === 0) && !e.inProgressSubmissionId
  );

  return successResponse({
    studentName: student.studentName,
    available,
    inProgress: inProgressList,
    upcoming,
    finished: endedOrExhausted,
  });
}
