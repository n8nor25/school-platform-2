import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create demo school
  const school = await prisma.school.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      name: 'المدرسة الإعدادية النموذجية',
      subdomain: 'demo',
      description: 'مدرسة رائدة في التعليم الإعدادي - نسعى لتقديم تعليم عصري متميز',
      primaryColor: '#610000',
      secondaryColor: '#009688',
      address: 'الشارع الرئيسي، المدينة',
      phone: '0123456789',
      email: 'info@school.edu',
      isActive: true,
    }
  })

  // Create settings for the school
  await prisma.settings.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      heroTitle: 'المدرسة الإعدادية النموذجية',
      heroSubtitle: 'نحو تعليم متميز ومستقبل مشرق',
      bannerTitle: 'مرحباً بكم في مدرستنا',
      vision: 'نسعى لتقديم تعليم عصري متميز يُعد طلابنا ليكونوا قادة المستقبل، من خلال بيئة تعليمية محفزة وكوادر تعليمية مؤهلة.',
      showNewsTicker: true,
      showHeroBanner: true,
      showSlider: true,
      showAbout: true,
      showNews: true,
      showServices: true,
      showGallery: true,
      showTeachers: true,
      showStats: true,
      showContact: true,
      sectionOrder: '["slider","about","news","services","gallery","teachers","stats","contact"]',
    }
  })

  // Create school stats
  await prisma.schoolStats.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      students: 850,
      teachers: 45,
      classes: 24,
      years: 15,
    }
  })

  // Create super admin
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: 'admin' } },
    update: {},
    create: {
      schoolId: school.id,
      username: 'admin',
      password: hashedPassword,
      role: 'super_admin',
      permissions: '{}',
    }
  })

  // Create school admin
  await prisma.user.upsert({
    where: { schoolId_username: { schoolId: school.id, username: 'school1admin' } },
    update: {},
    create: {
      schoolId: school.id,
      username: 'school1admin',
      password: hashedPassword,
      role: 'school_admin',
      permissions: '{}',
    }
  })

  // Create demo news
  const newsData = [
    { title: 'بدء التسجيل للفصل الدراسي الجديد', excerpt: 'يسر إدارة المدرسة الإعلان عن فتح باب التسجيل للفصل الدراسي الجديد', category: 'أخبار', active: true },
    { title: 'نتائج المسابقة العلمية', excerpt: 'حقق طلابنا نتائج متميزة في المسابقة العلمية المحلية', category: 'أخبار', active: true },
    { title: 'تنبيه: موعد الامتحانات النهائية', excerpt: 'يُعلن عن بدء الامتحانات النهائية اعتباراً من الأسبوع القادم', category: 'تنبيه', active: true },
    { title: 'افتتاح المختبر الجديد', excerpt: 'تم افتتاح مختبر علوم جديد مجهز بأحدث الأجهزة', category: 'أخبار', active: true },
    { title: 'رحلة علمية لمتحف العلوم', excerpt: 'تنظم المدرسة رحلة علمية لمتحف العلوم والتكنولوجيا', category: 'فعاليات', active: true },
    { title: 'حفل تكريم الطلاب المتفوقين', excerpt: 'تتشرف إدارة المدرسة بدعوتكم لحفل تكريم الطلاب المتفوقين', category: 'فعاليات', active: true },
  ]

  for (const news of newsData) {
    await prisma.news.create({
      data: {
        schoolId: school.id,
        ...news,
      }
    })
  }

  // Create demo teachers
  const teachersData = [
    { name: 'أ/ محمد علي', subject: 'رياضيات', sortOrder: 0 },
    { name: 'أ/ فاطمة أحمد', subject: 'لغة عربية', sortOrder: 1 },
    { name: 'أ/ خالد حسن', subject: 'علوم', sortOrder: 2 },
    { name: 'أ/ سارة محمود', subject: 'لغة انجليزية', sortOrder: 3 },
    { name: 'أ/ عبدالله سعيد', subject: 'دراسات', sortOrder: 4 },
    { name: 'أ/ نورا عبدالرحمن', subject: 'حاسب آلي', sortOrder: 5 },
  ]

  for (const teacher of teachersData) {
    await prisma.teacher.create({
      data: {
        schoolId: school.id,
        ...teacher,
        active: true,
      }
    })
  }

  // Create demo sliders
  const slidersData = [
    { imageUrl: 'https://picsum.photos/seed/slide1/800/400', title: 'نحو تعليم متميز', subtitle: 'نسعى لتقديم أفضل تجربة تعليمية', sortOrder: 0, active: true },
    { imageUrl: 'https://picsum.photos/seed/slide2/800/400', title: 'بيئة تعليمية محفزة', subtitle: 'فريق من المعلمين المتميزين', sortOrder: 1, active: true },
    { imageUrl: 'https://picsum.photos/seed/slide3/800/400', title: 'نتائج مشرفة', subtitle: 'طلابنا يحققون أعلى المراتب', sortOrder: 2, active: true },
  ]

  for (const slider of slidersData) {
    await prisma.slider.create({
      data: {
        schoolId: school.id,
        ...slider,
      }
    })
  }

  // Create demo gallery
  for (let i = 1; i <= 8; i++) {
    await prisma.gallery.create({
      data: {
        schoolId: school.id,
        title: `صورة من أنشطة المدرسة ${i}`,
        imageUrl: `https://picsum.photos/seed/gallery${i}/400/400`,
      }
    })
  }

  // Create a demo custom section
  await prisma.customSection.create({
    data: {
      schoolId: school.id,
      title: 'أنشطة المدرسة',
      content: '<p>تقدم مدرستنا العديد من الأنشطة اللامنهجية التي تساهم في تطوير مهارات الطلاب وإثراء خبراتهم. تشمل هذه الأنشطة المسابقات العلمية والرياضية والأنشطة الفنية والثقافية.</p><ul><li>مسابقات علمية وتقنية</li><li>أنشطة رياضية متنوعة</li><li>برامج فنية وإبداعية</li><li>رحلات تعليمية</li></ul>',
      imageUrl: 'https://picsum.photos/seed/activities/800/400',
      layout: 'image-right',
      active: true,
      sortOrder: 0,
    }
  })

  console.log('✅ Seed data created successfully!')
  console.log(`School ID: ${school.id}`)
  console.log('Login: admin / admin123')
  console.log('Login: school1admin / admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
