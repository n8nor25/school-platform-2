import { db } from '../src/lib/db';

async function main() {
  const count = await db.user.count();
  console.log('User count:', count);
  const users = await db.user.findMany({ select: { id: true, username: true, role: true, schoolId: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
  const schools = await db.school.findMany({ select: { id: true, name: true } });
  console.log('Schools:', JSON.stringify(schools, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
