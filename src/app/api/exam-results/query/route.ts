import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Subject keys that are added to the total (core subjects)
// Maps normalized key -> possible DB field names
const ADDED_SUBJECTS_MAP: Record<string, string[]> = {
  arabic: ["arabic"],
  english: ["english"],
  social: ["social", "socialStudies"],
  math: ["math"],
  science: ["science"],
};

// Subject keys that are NOT added to the total (enrichment subjects)
const NOT_ADDED_SUBJECTS_MAP: Record<string, string[]> = {
  religion: ["religion"],
  art: ["art"],
  computer: ["computer"],
};

const MIN_PASSING_PERCENT = 50;

const subjectLabels: Record<string, string> = {
  arabic: "عربي",
  english: "انجليزي",
  social: "دراسات",
  math: "رياضيات",
  science: "علوم",
  religion: "دين",
  art: "فنية",
  computer: "كمبيوتر",
};

interface StudentData {
  seatNumber: string | number;
  studentName: string;
  [key: string]: unknown;
}

// Get value from student object, trying multiple possible field names
function getStudentValue(student: StudentData, possibleKeys: string[]): number {
  for (const key of possibleKeys) {
    if (student[key] !== undefined && student[key] !== null) {
      return Number(student[key]) || 0;
    }
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeId = searchParams.get("gradeId");
    const seat = searchParams.get("seat");

    if (!gradeId || !seat) {
      return NextResponse.json(
        { error: "gradeId و seat مطلوبان" },
        { status: 400 }
      );
    }

    // Find the result record by ID
    const result = await db.result.findUnique({
      where: { id: gradeId },
    });

    if (!result) {
      return NextResponse.json(
        { error: "لم يتم العثور على الصف الدراسي" },
        { status: 404 }
      );
    }

    // Parse students JSON
    let students: StudentData[] = [];
    try {
      students = JSON.parse(result.students);
    } catch {
      students = [];
    }

    // Find the specific student by seat number
    const student = students.find(
      (s) => String(s.seatNumber) === String(seat)
    );

    if (!student) {
      return NextResponse.json(
        { error: "لم يتم العثور على طالب برقم الجلوس المحدد" },
        { status: 404 }
      );
    }

    // Calculate max scores for each subject from all students in this grade
    const calculateMax = (possibleKeys: string[]): number => {
      let max = 0;
      for (const s of students) {
        const val = getStudentValue(s, possibleKeys);
        if (val > max) max = val;
      }
      return max;
    };

    // Build max scores map using normalized keys
    const allSubjectsMap = { ...ADDED_SUBJECTS_MAP, ...NOT_ADDED_SUBJECTS_MAP };
    const maxScores: Record<string, number> = {};
    for (const [normalizedKey, possibleKeys] of Object.entries(allSubjectsMap)) {
      maxScores[normalizedKey] = calculateMax(possibleKeys);
    }

    // Calculate max total (sum of max scores of added subjects)
    let maxAddedTotal = 0;
    for (const key of Object.keys(ADDED_SUBJECTS_MAP)) {
      maxAddedTotal += maxScores[key] || 0;
    }
    maxScores.total = maxAddedTotal;

    // Calculate student's added total (sum of added subjects)
    let studentAddedTotal = 0;
    for (const [normalizedKey, possibleKeys] of Object.entries(ADDED_SUBJECTS_MAP)) {
      studentAddedTotal += getStudentValue(student, possibleKeys);
    }

    // Build subject details for added subjects
    const addedSubjectDetails = Object.entries(ADDED_SUBJECTS_MAP).map(([normalizedKey, possibleKeys]) => {
      const score = getStudentValue(student, possibleKeys);
      const max = maxScores[normalizedKey] || 1;
      return {
        subject: normalizedKey,
        subjectLabel: subjectLabels[normalizedKey] || normalizedKey,
        score,
        max,
        minPass: Math.round(max * (MIN_PASSING_PERCENT / 100)),
        passed: max > 0 ? (score / max) * 100 >= MIN_PASSING_PERCENT : false,
      };
    });

    // Build subject details for not-added subjects
    const notAddedSubjectDetails = Object.entries(NOT_ADDED_SUBJECTS_MAP).map(([normalizedKey, possibleKeys]) => {
      const score = getStudentValue(student, possibleKeys);
      const max = maxScores[normalizedKey] || 1;
      return {
        subject: normalizedKey,
        subjectLabel: subjectLabels[normalizedKey] || normalizedKey,
        score,
        max,
        minPass: Math.round(max * (MIN_PASSING_PERCENT / 100)),
        passed: max > 0 ? (score / max) * 100 >= MIN_PASSING_PERCENT : false,
      };
    });

    // Calculate pass conditions
    const totalPass =
      maxAddedTotal > 0
        ? (studentAddedTotal / maxAddedTotal) * 100 >= MIN_PASSING_PERCENT
        : false;

    const addedSubjectPass = addedSubjectDetails.every((s) => s.passed);
    const notAddedSubjectPass = notAddedSubjectDetails.every((s) => s.passed);

    const overallPassed = totalPass && addedSubjectPass && notAddedSubjectPass;

    // Build the student result object using normalized keys
    const studentResult: Record<string, unknown> = {
      seatNumber: String(student.seatNumber),
      studentName: student.studentName,
      total: studentAddedTotal,
    };
    for (const [normalizedKey, possibleKeys] of Object.entries(allSubjectsMap)) {
      studentResult[normalizedKey] = getStudentValue(student, possibleKeys);
    }

    const maxScoresResult: Record<string, number> = {
      total: maxScores.total || 0,
    };
    for (const key of Object.keys(allSubjectsMap)) {
      maxScoresResult[key] = maxScores[key] || 0;
    }

    return NextResponse.json({
      student: studentResult,
      maxScores: maxScoresResult,
      passStatus: {
        passed: overallPassed,
        totalPass,
        addedSubjectPass,
        notAddedSubjectPass,
        minPassingPercent: MIN_PASSING_PERCENT,
        studentAddedTotal,
        maxAddedTotal,
        subjectDetails: {
          added: addedSubjectDetails,
          notAdded: notAddedSubjectDetails,
        },
      },
      gradeName: result.gradeName,
      term: result.term,
    });
  } catch (error) {
    console.error("Error querying exam result:", error);
    return NextResponse.json(
      { error: "Failed to query exam result" },
      { status: 500 }
    );
  }
}
