import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "لوحة مالك المنصة — Super Admin",
  description: "إدارة الصالونات المسجلة واشتراكاتها وإعدادات المنصة",
  robots: { index: false, follow: false },
};

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
