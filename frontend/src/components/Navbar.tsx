"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-flagGreen text-white">
            🖼️
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-gray-900">
              AI Poster <span className="text-flagGreen">Maker</span>
            </p>
            <p className="text-[11px] leading-tight text-gray-500">এআই পোস্টার তৈরি</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link href="/" className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            হোম
          </Link>
          <Link href="/create" className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            পোস্টার তৈরি
          </Link>
          {user && (
            <Link
              href="/history"
              className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              🗂️ আমার পোস্টারসমূহ
            </Link>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              অ্যাডমিন
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-flagGreen text-sm font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <button
                onClick={handleLogout}
                className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                লগ-আউট
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                লগ-ইন
              </Link>
              <Link
                href="/register"
                className="rounded bg-flagGreen px-3 py-1.5 text-sm font-medium text-white"
              >
                রেজিস্ট্রেশন
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
