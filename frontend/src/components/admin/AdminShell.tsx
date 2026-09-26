"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AdminToastProvider } from "./Toast";
import { Badge } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: "📊", description: "সারসংক্ষেপ ও ট্রেন্ড" },
  { href: "/admin/users", label: "ব্যবহারকারী", icon: "👥", description: "অ্যাকাউন্ট ও পরিচয়" },
  { href: "/admin/posters", label: "পোস্টার", icon: "🖼️", description: "সব পোস্টার ও স্ট্যাটাস" },
  { href: "/admin/templates", label: "টেমপ্লেট", icon: "🎨", description: "লেআউট ম্যানেজমেন্ট" },
  { href: "/admin/logs", label: "লগ ও অডিট", icon: "📜", description: "জেনারেশন ও কার্যক্রম" },
  { href: "/admin/settings", label: "সেটিংস", icon: "⚙️", description: "প্ল্যাটফর্ম কন্ট্রোল" },
  { href: "/admin/system", label: "সিস্টেম", icon: "🖥️", description: "সার্ভার ও ডেটাবেস" },
];

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition ${
        active ? "bg-flagGreen text-white shadow-sm" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span aria-hidden="true" className="mt-0.5 text-base">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{item.label}</span>
        <span className={`block text-[11px] ${active ? "text-white/80" : "text-gray-500"}`}>
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg border border-gray-200 p-2 lg:hidden"
            onClick={onMenu}
            aria-label="মেনু"
          >
            ☰
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-flagGreen text-white">
              🛡️
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight text-gray-900">
                অ্যাডমিন <span className="text-flagGreen">প্যানেল</span>
              </span>
              <span className="block text-[11px] leading-tight text-gray-500">AI Poster Maker</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <span className="hidden items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flagGreen text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-xs">
                <span className="block font-medium text-gray-800">{user.name}</span>
                <span className="block text-[10px] text-gray-500">{user.email}</span>
              </span>
              <Badge tone="green">admin</Badge>
            </span>
          )}
          <Link
            href="/"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            সাইটে ফিরুন
          </Link>
          <button
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="rounded-lg bg-flagRed px-3 py-1.5 text-sm font-medium text-white hover:bg-flagRed/90"
          >
            লগ-আউট
          </button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="space-y-3">
      <div>
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          ম্যানেজমেন্ট
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} active={isActive(item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
        <p className="mb-1 font-semibold text-gray-700">⚠️ নিরাপত্তা</p>
        অ্যাডমিন প্যানেলের প্রতিটি পরিবর্তন একটি অডিট লগে সংরক্ষিত হয়।
      </div>
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar onMenu={() => setMobileOpen((v) => !v)} />

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6">
        <aside
          className={`${
            mobileOpen ? "block" : "hidden"
          } fixed inset-x-0 top-[57px] z-30 max-h-[70vh] overflow-y-auto border-b border-gray-200 bg-white p-3 lg:static lg:block lg:w-60 lg:shrink-0 lg:overflow-visible lg:rounded-xl lg:border lg:border-gray-200 lg:bg-white lg:p-3 lg:shadow-sm`}
        >
          <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 top-[57px] z-20 bg-black/20 lg:hidden"
            onClick={() => setMobileOpen(false)}
            role="presentation"
          />
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminToastProvider>
      <Shell>{children}</Shell>
    </AdminToastProvider>
  );
}
