import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSchoolId } from "@/lib/school-utils";

/**
 * Teacher Portal Login
 * POST /api/teacher/login
 * Body: { schoolId?, teacherCode, phone }
 *
 * - Validates teacherCode + phone (400 if missing)
 * - Test mode: phone starts with "test-" -> return real teacher (matched by email
 *   if teacherCode looks like an email, else first teacher in school). If no
 *   teachers exist in school, return fake data with warning.
 * - Real mode: find teacher by school + email (Teacher model has no `phone`
 *   field, so we match against `email`). If not found -> 401.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schoolId: bodySchoolId, teacherCode, phone } = body as {
      schoolId?: string;
      teacherCode?: string;
      phone?: string;
    };

    if (!teacherCode || !phone) {
      return NextResponse.json(
        { error: "كود المعلم ورقم الهاتف مطلوبان" },
        { status: 400 }
      );
    }

    const schoolId = await resolveSchoolId(bodySchoolId);
    if (!schoolId) {
      return NextResponse.json(
        { error: "لم يتم العثور على مدرسة" },
        { status: 404 }
      );
    }

    const isTestMode = String(phone).toLowerCase().startsWith("test-");

    // Helper: fetch teacher's classrooms (Classroom.teacherId == teacher.id)
    async function fetchClassrooms(teacherId: string) {
      const classrooms = await db.classroom.findMany({
        where: { teacherId },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          section: true,
        },
        orderBy: { name: "asc" },
      });
      return classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        section: c.section,
      }));
    }

    if (isTestMode) {
      // Test mode — try to find a real teacher in this school.
      const codeStr = String(teacherCode).trim().toLowerCase();
      const looksLikeEmail = codeStr.includes("@");

      // Try match by email first
      let teacher: Awaited<ReturnType<typeof db.teacher.findFirst>> = null;
      if (looksLikeEmail) {
        teacher = await db.teacher.findFirst({
          where: {
            schoolId,
            archived: false,
            email: { equals: String(teacherCode).trim() },
          },
        });
      }
      // Fallback: first non-archived teacher in school
      if (!teacher) {
        teacher = await db.teacher.findFirst({
          where: { schoolId, archived: false },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (teacher) {
        const classrooms = await fetchClassrooms(teacher.id);
        return NextResponse.json({
          teacherId: teacher.id,
          name: teacher.name,
          subject: teacher.subject,
          email: teacher.email || "",
          phone: phone as string,
          imageUrl: teacher.imageUrl || null,
          classrooms,
          testMode: true,
          fakeTeacher: false,
          warning:
            "أنت تستخدم وضع التجربة — تم تسجيل دخولك كمعلم حقيقي موجود في المدرسة.",
        });
      }

      // No teachers in school -> return fake data
      const fakeId = `fake-${Date.now()}`;
      return NextResponse.json({
        teacherId: fakeId,
        name: "معلم تجريبي",
        subject: "مادة تجريبية",
        email: "teacher@example.com",
        phone: phone as string,
        imageUrl: null,
        classrooms: [],
        testMode: true,
        fakeTeacher: true,
        warning:
          "لا يوجد معلمون مسجّلون في هذه المدرسة بعد. أنت تعمل ببيانات تجريبية.",
      });
    }

    // Real mode — match by email (Teacher model has no phone field)
    const emailStr = String(teacherCode).trim();
    const teacher = await db.teacher.findFirst({
      where: {
        schoolId,
        archived: false,
        email: { equals: emailStr },
      },
    });

    if (!teacher) {
      return NextResponse.json(
        {
          error:
            "بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني (كود المعلم) المرتبط بحسابك.",
        },
        { status: 401 }
      );
    }

    const classrooms = await fetchClassrooms(teacher.id);
    return NextResponse.json({
      teacherId: teacher.id,
      name: teacher.name,
      subject: teacher.subject,
      email: teacher.email || "",
      phone: phone as string,
      imageUrl: teacher.imageUrl || null,
      classrooms,
      testMode: false,
      fakeTeacher: false,
    });
  } catch (error) {
    console.error("Teacher login error:", error);
    return NextResponse.json(
      { error: "فشل تسجيل الدخول. حاول مرة أخرى." },
      { status: 500 }
    );
  }
}
