import { db } from '../src/lib/db';

async function main() {
  const sohagMapUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d110502.76718827617!2d31.66512595!3d26.5593145!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x144f1f9b6c3e3fd5%3A0x8e5e3e0a1e0e2e0e!2sSohag%2C%20Egypt!5e0!3m2!1sar!2seg!4v1700000000000!5m2!1sar!2seg';
  
  const schools = await db.school.findMany();
  for (const school of schools) {
    await db.school.update({
      where: { id: school.id },
      data: { mapEmbedUrl: sohagMapUrl }
    });
    console.log('Updated school: ' + school.name);
  }
  console.log('Done!');
}

main().catch(console.error);
