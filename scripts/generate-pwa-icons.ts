/**
 * توليد أيقونات PWA (maskable + apple-touch-icon) من الأيقونة الحالية
 * يستخدم sharp لإنشاء نسخ بـ safe zone للتطبيقات المثبّتة
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const SOURCE_ICON = join(PUBLIC_DIR, 'icon-512.png');

if (!existsSync(SOURCE_ICON)) {
  console.error('❌ icon-512.png not found in public/');
  process.exit(1);
}

const BRAND_COLOR = '#610000'; // لون المدرسة الأساسي
const WHITE = '#ffffff';

async function generateMaskable(size: number, outputPath: string) {
  /**
   * أيقونات maskable تحتاج إلى safe zone (المنطقة المركزية 80%)
   * نضع الأيقونة الأصلية في المنتصف مع خلفية بلون المدرسة
   */
  const innerSize = Math.round(size * 0.75); // 75% للمنطقة الآمنة
  const padding = Math.round((size - innerSize) / 2);

  const innerIcon = await sharp(SOURCE_ICON)
    .resize(innerSize, innerSize, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_COLOR,
    },
  })
    .composite([{ input: innerIcon, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log(`✅ Generated: ${outputPath}`);
}

async function generateAppleTouchIcon(outputPath: string) {
  /**
   * apple-touch-icon تحتاج خلفية صلبة (iOS يضيف rounded corners تلقائياً)
   * مقاس 180x180 هو الموصى به
   */
  const size = 180;
  const innerSize = Math.round(size * 0.72);
  const padding = Math.round((size - innerSize) / 2);

  const innerIcon = await sharp(SOURCE_ICON)
    .resize(innerSize, innerSize, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_COLOR,
    },
  })
    .composite([{ input: innerIcon, left: padding, top: padding }])
    .png()
    .toFile(outputPath);

  console.log(`✅ Generated: ${outputPath}`);
}

async function generateFavicon(outputPath: string) {
  /**
   * favicon مقاس 32x32 للتبويبات
   */
  await sharp(SOURCE_ICON)
    .resize(32, 32, { fit: 'contain' })
    .toFile(outputPath);

  console.log(`✅ Generated: ${outputPath}`);
}

async function main() {
  console.log('🎨 Generating PWA icons...\n');

  // Maskable icons (with safe zone padding)
  await generateMaskable(192, join(PUBLIC_DIR, 'icon-maskable-192.png'));
  await generateMaskable(512, join(PUBLIC_DIR, 'icon-maskable-512.png'));

  // Apple touch icon (for iOS home screen)
  await generateAppleTouchIcon(join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // Favicon (32x32 for browser tabs)
  await generateFavicon(join(PUBLIC_DIR, 'favicon-32.png'));

  console.log('\n✨ All PWA icons generated successfully!');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
