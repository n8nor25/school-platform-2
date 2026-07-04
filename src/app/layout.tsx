import type { Metadata, Viewport } from "next";
import { Geist, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { InstallPrompt } from "@/components/pwa/install-prompt";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "منصة المدرسة الإلكترونية",
    template: "%s | منصة المدرسة",
  },
  description: "منصة تعليمية شاملة لإدارة المدارس — أخبار، نتائج، امتحانات إلكترونية، وخدمات تفاعلية لأولياء الأمور والمعلمين والطلاب",
  keywords: ["مدرسة", "تعليم", "نتائج", "امتحانات إلكترونية", "منصة مدارس", "إدارة مدرسية", "أولياء الأمور"],
  authors: [{ name: "منصة المدرسة" }],
  creator: "منصة المدرسة",
  publisher: "منصة المدرسة",
  applicationName: "منصة المدرسة",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon-32.png"],
  },
  appleWebApp: {
    capable: true,
    title: "منصة المدرسة",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#610000",
    "msapplication-tap-highlight": "no",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#610000" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
        <style>{`
          @keyframes pwaSlideUp {
            from { transform: translateX(-50%) translateY(100px); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
          }
        `}</style>
      </head>
      <body
        className={`${geist.variable} ${cairo.variable} antialiased bg-background text-foreground font-[family-name:var(--font-cairo)]`}
      >
        {children}
        <Toaster position="top-center" dir="rtl" richColors />
        {/* PWA: تسجيل Service Worker + زر التثبيت */}
        <RegisterSW />
        <InstallPrompt />
      </body>
    </html>
  );
}
