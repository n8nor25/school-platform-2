import { db } from "@/lib/db";

/**
 * Resolves a schoolId from the provided value or falls back to the first active school.
 * Returns null if no school can be found.
 */
export async function resolveSchoolId(
  schoolIdParam: string | null | undefined
): Promise<string | null> {
  if (schoolIdParam) return schoolIdParam;
  const firstSchool = await db.school.findFirst({ where: { isActive: true } });
  return firstSchool?.id || null;
}
