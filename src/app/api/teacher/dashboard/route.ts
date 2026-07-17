import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";

/**
 * Teacher Portal Dashboard
 * GET /api/teacher/dashboard?schoolId&teacherId
 *
 * Returns:
 *   teacher: { id, name, subject, email, phone, imageUrl }
 *   classrooms: [{ id, name, gradeLevel, section, studentCount }]
 *   stats: { totalStudents, totalClasses, examsThisWeek, pendingGrading }
 *   recentNews: latest 5 active news for the school
 *   todaySchedule: today's schedule entries (Schedule model, teacherName match)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolIdParam = searchParams.get("schoolId");
    const teacherId = searchParams.get("teacherId");

    const schoolId = await resolveSchoolId(schoolIdParam);
    if (!schoolId) {
      return NextResponse.json(
        { error: "لم يتم العثور على مدرسة" },
        { status: 404 }
      );
    }
    if (!teacherId) {
      return NextResponse.json(
        { error: "معرّف المعلم مطلوب" },
        { status: 400 }
      );
    }

    // Fake teacher (no real teachers in school during test mode)
    if (teacherId.startsWith("fake-")) {
      return NextResponse.json({
        teacher: {
          id: teacherId,
          name: "معلم تجريبي",
          subject: "مادة تجريبية",
          email: "teacher@example.com",
          phone: "",
          imageUrl: null,
        },
        classrooms: [],
        stats: {
          totalStudents: 0,
          totalClasses: 0,
          examsThisWeek: 0,
          pendingGrading: 0,
        },
        recentNews: [],
        todaySchedule: [],
        fakeTeacher: true,
      });
    }

    const teacher = await db.teacher.findFirst({
      where: { id: teacherId, schoolId },
      select: {
        id: true,
        name: true,
        subject: true,
        email: true,
        imageUrl: true,
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "لم يتم العثور على المعلم" },
        { status: 404 }
      );
    }

    // 1) Classrooms assigned to this teacher (via Classroom.teacherId)
    const classrooms = await db.classroom.findMany({
      where: { teacherId: teacher.id },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        section: true,
        _count: { select: { students: { where: { archived: false } } } },
      },
      orderBy: { name: "asc" },
    });

    const classroomIds = classrooms.map((c) => c.id);

    // 2) Stats
    const totalStudents = classrooms.reduce(
      (sum, c) => sum + (c._count?.students ?? 0),
      0
    );
    const totalClasses = classrooms.length;

    // Week window (Monday-Sunday)
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // days since Monday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const examsThisWeek = await db.exam.count({
      where: {
        teacherId: teacher.id,
        startDate: { gte: startOfWeek, lt: endOfWeek },
      },
    });

    // Pending grading: submissions on this teacher's exams that are SUBMITTED
    // but not yet graded.
    const pendingGrading = await db.submission.count({
      where: {
        exam: { teacherId: teacher.id },
        status: "SUBMITTED",
        gradedAt: null,
      },
    });

    // 3) Recent news (school-wide), top 5
    const recentNews = await db.news.findMany({
      where: {
        schoolId,
        archived: false,
        active: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        excerpt: true,
        image: true,
        category: true,
        createdAt: true,
      },
    });

    // 4) Today's schedule (Schedule model has teacherName + dayOfWeek Int?)
    // JS getDay(): 0=Sun..6=Sat. We try to match by teacher name and today's day.
    const todayIdx = now.getDay();
    const todayScheduleRaw = await db.schedule.findMany({
      where: {
        schoolId,
        archived: false,
        active: true,
        teacherName: { equals: teacher.name },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        category: true,
        grade: true,
        section: true,
        dayOfWeek: true,
        fileName: true,
        filePath: true,
      },
    });
    const todaySchedule = todayScheduleRaw.filter(
      (s) => s.dayOfWeek === null || s.dayOfWeek === todayIdx
    );

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        subject: teacher.subject,
        email: teacher.email || "",
        phone: "",
        imageUrl: teacher.imageUrl || null,
      },
      classrooms: classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        section: c.section,
        studentCount: c._count?.students ?? 0,
      })),
      stats: {
        totalStudents,
        totalClasses,
        examsThisWeek,
        pendingGrading,
      },
      recentNews: recentNews.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.excerpt || "",
        image: n.image || null,
        category: n.category,
        createdAt: n.createdAt.toISOString(),
      })),
      todaySchedule: todaySchedule.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        grade: s.grade || "",
        section: s.section || "",
        fileName: s.fileName,
        filePath: s.filePath,
      })),
      fakeTeacher: false,
      classroomIds,
    });
  } catch (error) {
    console.error("Teacher dashboard error:", error);
    return NextResponse.json(
      { error: "فشل تحميل لوحة تحكم المعلم" },
      { status: 500 }
    );
  }
}
