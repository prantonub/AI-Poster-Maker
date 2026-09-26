"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      // Carry the attempted location so login can send the user back here
      // instead of dropping them on the default landing page.
      router.replace("/login?next=/admin");
    } else if (user.role !== "admin") {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        লোড হচ্ছে...
      </div>
    );
  }

  return <>{children}</>;
}
