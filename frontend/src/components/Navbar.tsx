"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";

interface PlatformConfig {
  maintenanceMode: boolean;
  registrationOpen: boolean;
  generationEnabled: boolean;
  siteNotice: string;
  supportEmail: string;
}

/**
 * Site-wide banner driven by the admin panel's platform settings
 * (Admin → সেটিংস). Fails silently: a banner must never break the app if the
 * config endpoint is unreachable.
 */
export function PlatformBanner() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<PlatformConfig>("/auth/config")
      .then(({ data }) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  const messages: { text: string; className: string }[] = [];

  if (config.maintenanceMode) {
    messages.push({
      text: "সাইটটি সাময়িকভাবে মেইন্টেন্যান্সে আছে — পোস্টার তৈরি সাময়িকভাবে বন্ধ রাখা হয়েছে।",
      className: "bg-amber-100 text-amber-900",
    });
  } else if (!config.generationEnabled) {
    messages.push({
      text: "পোস্টার তৈরি ফিচার সাময়িকভাবে বন্ধ আছে।",
      className: "bg-amber-100 text-amber-900",
    });
  }

  if (config.siteNotice) {
    messages.push({ text: config.siteNotice, className: "bg-sky-100 text-sky-900" });
  }

  if (!config.registrationOpen) {
    messages.push({
      text: "নতুন রেজিস্ট্রেশন সাময়িকভাবে বন্ধ আছে।",
      className: "bg-amber-100 text-amber-900",
    });
  }

  if (messages.length === 0) return null;

  return (
    <div className="space-y-1">
      {messages.map((message) => (
        <div key={message.text} className={`px-4 py-2 text-center text-xs ${message.className}`}>
          {message.text}
          {config.supportEmail && (
            <span className="ml-2 hidden sm:inline">
              সহায়তা:{" "}
              <a href={`mailto:${config.supportEmail}`} className="underline">
                {config.supportEmail}
              </a>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface NavLink {
  href: string;
  label: string;
  /** Highlighted styling for the AI generator (the site's headline feature). */
  accent?: boolean;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "হোম" },
  { href: "/create", label: "পোস্টার তৈরি" },
  { href: "/ai-generator", label: "AI পোস্টার / ব্যানার জেনারেটর", accent: true },
  { href: "/history", label: "🗂️ আমার পোস্টারসমূহ", requiresAuth: true },
  { href: "/admin", label: "অ্যাডমিন", requiresAdmin: true },
];

/**
 * Active-page detection. "/" must match exactly, otherwise the home link would
 * stay highlighted on every route. Nested paths match on a segment boundary so
 * "/create" never lights up for something like "/create-archive".
 */
function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // The admin section renders its own shell + top bar, so the public navbar
  // (and its banner) would be duplicated chrome there. Hide it entirely.
  if (pathname.startsWith("/admin")) {
    return null;
  }

  function handleLogout() {
    logout();
    router.push("/");
  }

  const visibleLinks = NAV_LINKS.filter((link) => {
    if (link.requiresAuth) return !!user;
    if (link.requiresAdmin) return user?.role === "admin";
    return true;
  });

  return (
    <>
      <PlatformBanner />
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
          {visibleLinks.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-flagGreen text-white shadow-sm"
                    : link.accent
                    ? "text-flagGreen hover:bg-flagGreen/10"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
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
    </>
  );
}
