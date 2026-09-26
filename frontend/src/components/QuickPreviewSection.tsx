"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { generateQuickPreview } from "@/lib/posterApi";
import { extractErrorMessage } from "@/lib/errors";

interface PreviewResult {
  templateId: string;
  title: string;
  occasionType: string;
  imageUrl: string;
}

export function QuickPreviewSection() {
  const { user } = useAuth();
  const [headlineText, setHeadlineText] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PreviewResult[] | null>(null);

  async function handleGenerate() {
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      const data = await generateQuickPreview({
        name,
        designation,
        party: "",
        district: "",
        thana: "",
        union: "",
        headlineText,
      });
      setResults(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-14 rounded-2xl border border-gray-200 bg-white p-6 sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold text-flagGreen sm:text-3xl">
          একটি লেখায় ৫টি ব্যানার স্টাইল
        </h2>
        <p className="mt-2 text-gray-600">
          একটি হেডলাইন লিখুন — Gemini AI প্রতিটি উপলক্ষের জন্য আলাদাভাবে রঙ ও স্টাইল বেছে
          নিয়ে ৫টি ভিন্ন ব্যানার তৈরি করে দেখাবে।
        </p>
      </div>

      {!user && (
        <p className="mx-auto mt-6 max-w-md rounded bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
          এই ফিচারটি ব্যবহার করতে অনুগ্রহ করে{" "}
          <Link href="/login" className="font-semibold underline">
            লগ-ইন
          </Link>{" "}
          করুন।
        </p>
      )}

      {user && (
        <div className="mx-auto mt-6 max-w-xl space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="আপনার নাম"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="পদবি"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={headlineText}
            onChange={(e) => setHeadlineText(e.target.value)}
            placeholder="হেডলাইন লিখুন, যেমনঃ মহান বিজয় দিবসের শুভেচ্ছা"
            rows={2}
            maxLength={200}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !name || !designation || !headlineText}
            className="w-full rounded bg-flagGreen px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {loading ? "৫টি ব্যানার তৈরি হচ্ছে... (কিছুক্ষণ সময় লাগতে পারে)" : "৫টি ব্যানার তৈরি করুন"}
          </button>

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {results.map((r) => (
            <div key={r.templateId} className="text-center">
              <Image
                src={r.imageUrl}
                alt={r.title}
                width={240}
                height={320}
                className="w-full rounded shadow-md"
              />
              <p className="mt-1 text-xs text-gray-600">{r.title}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
