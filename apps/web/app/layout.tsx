import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import CustomerBottomBar from "@/components/CustomerBottomBar";
import { ToasterProvider } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "صالون الحلاقة — احجز موعدك",
  description: "نظام حجز مواعيد صالون حلاقة — اختر الحلاق والخدمة والموعد المناسب لك",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "صالون الحلاقة",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <ToasterProvider>
          <Navbar />
          <main className="w-full px-4 py-6">
            {children}
            <CustomerBottomBar />
          </main>
        </ToasterProvider>
      </body>
    </html>
  );
}
