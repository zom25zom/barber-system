import type { Metadata } from "next";
import ThemeDemoClient from "./ThemeDemoClient";

/** Sandbox page — foundation verification only. noindex; review in Phase 2. */
export const metadata: Metadata = {
  title: "عرض نظام التصميم — Barber Smart",
  robots: { index: false, follow: false },
};

export default function ThemeDemoPage() {
  return <ThemeDemoClient />;
}
