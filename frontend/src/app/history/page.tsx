"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { fetchPosterHistory, deletePoster } from "@/lib/posterApi";
import { PaginatedPosters } from "@/lib/posterTypes";
import { extractErrorMessage } from "@/lib/errors";

function HistoryGrid() {
  const { user } = useAuth();
  const [data, setData] = useState<PaginatedPosters | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchPosterHistory(user._id, page)
      .then(setData)
      .catch((err) => setError(extractErrorMessage(err)));
  }, [user, page]);

  async function handleDelete(id: string) {
    try {
      await deletePoster(id);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((p) => p._id !== id) } : prev
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-flagGreen">আমার পোস্টারসমূহ</h1>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {data && data.items.length === 0 && (
        <p className="text-gray-500">
          এখনো কোনো পোস্টার তৈরি হয়নি।{" "}
          <Link href="/create" className="text-flagGreen underline">
            একটি তৈরি করুন
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {data?.items.map((poster) => (
          <div key={poster._id} className="rounded-lg border border-gray-200 p-2">
            {poster.status === "completed" && poster.generatedImageUrl ? (
              <Link href={`/posters/${poster._id}`}>
                <Image
                  src={poster.generatedImageUrl}
                  alt={poster.formData.headlineText}
                  width={300}
                  height={400}
                  className="w-full rounded object-cover"
                />
              </Link>
            ) : (
              <Link
                href={`/posters/${poster._id}`}
                className="flex h-32 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-500"
              >
                {poster.status === "failed" ? "ব্যর্থ" : "তৈরি হচ্ছে..."}
              </Link>
            )}
            <p className="mt-2 truncate text-xs text-gray-600">{poster.formData.headlineText}</p>
            <button
              onClick={() => handleDelete(poster._id)}
              className="mt-1 text-xs text-red-600 underline"
            >
              মুছে ফেলুন
            </button>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded px-3 py-1 text-sm ${
                p === page ? "bg-flagGreen text-white" : "border border-gray-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryGrid />
    </ProtectedRoute>
  );
}
