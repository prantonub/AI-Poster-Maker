"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage } from "@/lib/errors";

const ADMIN_PREFIX = "/admin";

/**
 * Only same-origin, absolute-internal paths are allowed as a redirect target.
 * Anything else (absolute URLs, protocol-relative "//evil.com", "/login" loops)
 * falls back to the default landing page — this prevents an open redirect via
 * a crafted ?next= link.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;          // blocks "https://evil.com"
  if (raw.startsWith("//")) return null;          // blocks "//evil.com"
  if (raw.startsWith("/login") || raw.startsWith("/register")) return null;
  return raw;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = safeNextPath(searchParams.get("next"));
  const wantsAdmin = !!nextPath && nextPath.startsWith(ADMIN_PREFIX);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);

      // A non-admin must never be sent to the panel, even with a ?next=/admin
      // link — send them home instead.
      if (wantsAdmin && loggedInUser?.role !== "admin") {
        setError("এই অ্যাকাউন্টের অ্যাডমিন প্যানেলে প্রবেশাধিকার নেই।");
        setSubmitting(false);
        return;
      }

      router.replace(nextPath ?? "/create");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-bold text-flagGreen">লগ-ইন করুন</h1>

        {wantsAdmin && (
          <p className="rounded bg-flagGreen/10 px-3 py-2 text-xs text-flagGreen">
            অ্যাডমিন প্যানেলে প্রবেশ করতে একটি অ্যাডমিন অ্যাকাউন্টে লগ-ইন করুন। সফল হলে আপনি সরাসরি
            প্যানেলে ফিরে যাবেন।
          </p>
        )}

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">ইমেইল</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">পাসওয়ার্ড</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-flagGreen px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "..." : "লগ-ইন"}
        </button>

        <p className="text-center text-sm text-gray-600">
          অ্যাকাউন্ট নেই?{" "}
          <Link href="/register" className="text-flagGreen underline">
            রেজিস্টার করুন
          </Link>
        </p>
      </form>
    </main>
  );
}

// useSearchParams() requires a Suspense boundary on a statically prerendered
// route, otherwise `next build` fails the missing-suspense-with-CSR-bailout
// check.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-gray-500">লোড হচ্ছে...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
