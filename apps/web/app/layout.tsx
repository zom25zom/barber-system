import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Navbar from "@/components/Navbar";
import CustomerBottomBar from "@/components/CustomerBottomBar";
import { ToasterProvider } from "@/components/Toaster";
import SessionGuard from "@/components/SessionGuard";

export const metadata: Metadata = {
  metadataBase: new URL("https://barber-web.nawafzwd25.workers.dev"),
  title: "صالون الحلاقة — احجز موعدك",
  description: "نظام حجز مواعيد صالون حلاقة — اختر الحلاق والخدمة والموعد المناسب لك",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "صالون الحلاقة",
    statusBarStyle: "black-translucent",
  },
  // Social sharing previews (WhatsApp/Facebook/Twitter). metadataBase above
  // resolves these into the ABSOLUTE URLs social platforms require.
  openGraph: {
    type: "website",
    siteName: "صالونك",
    title: "صالونك — احجز موعدك",
    description: "نظام حجز مواعيد صالون حلاقة — اختر الحلاق والخدمة والموعد المناسب لك",
    images: [
      {
        url: "/og-salonak.png",
        width: 1200,
        height: 630,
        alt: "صالونك — نظام حجز مواعيد صالونات الحلاقة",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "صالونك — احجز موعدك",
    description: "نظام حجز مواعيد صالون حلاقة — اختر الحلاق والخدمة والموعد المناسب لك",
    images: ["/og-salonak.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // via an inline pre-hydration script (FOUC prevention) — React must not warn.
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Barber Smart fonts (Phase 1): loaded but NOT applied app-wide yet.
            Real pages keep Tajawal until Phase 2 migrates them onto --bs-font-sans. */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--bs-bg)] text-[var(--bs-text)] antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToasterProvider>
            <SessionGuard />
            <Navbar />
            <main className="w-full px-4 py-6">
              {children}
              <CustomerBottomBar />
            </main>
          </ToasterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
