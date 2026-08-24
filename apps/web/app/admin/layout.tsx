import type { Metadata } from "next";
import AdminClientLayout from "./AdminClientLayout";

export const metadata: Metadata = {
  title: "لوحة تحكم الصالون — الإدارة",
  description: "لوحة تحكم وإدارة صالون الحلاقة والحجوزات والإشعارات",
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    title: "إدارة الصالون",
    statusBarStyle: "black-translucent",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminClientLayout>{children}</AdminClientLayout>;
}
