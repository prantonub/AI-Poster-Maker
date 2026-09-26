import type { Metadata } from "next";
import { AdminRoute } from "@/components/AdminRoute";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "অ্যাডমিন প্যানেল — AI Poster Maker",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // AdminRoute keeps non-admins (and signed-out visitors) out of the panel.
  return (
    <AdminRoute>
      <AdminShell>{children}</AdminShell>
    </AdminRoute>
  );
}
