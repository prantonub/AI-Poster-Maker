"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { fetchPoster, regeneratePoster } from "@/lib/posterApi";
import { forceDownload } from "@/lib/download";
import { PosterDTO } from "@/lib/posterTypes";
import { extractErrorMessage } from "@/lib/errors";

const POLL_INTERVAL_MS = 2000;
const MAX_RETRIES = 3;

function PosterPreview() {
  const params = useParams<{ id: string }>();
  const [poster, setPoster] = useState<PosterDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchPoster(params.id);
        if (cancelled) return;
        setPoster(data);
        if (data.status === "generating") {
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err));
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [params.id]);

  async function handleDownload() {
    if (!poster?.generatedImageUrl) return;
    setDownloading(true);
    setError(null);
    try {
      const filename = `poster-${poster._id}.png`;
      await forceDownload(poster.generatedImageUrl, filename);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      await regeneratePoster(params.id);
      const data = await fetchPoster(params.id);
      setPoster(data);
      if (data.status === "generating") {
        timerRef.current = setTimeout(function poll() {
          fetchPoster(params.id).then((d) => {
            setPoster(d);
            if (d.status === "generating") {
              timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
            }
          });
        }, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center p-6 text-center">
      {error && (
        <p className="mb-4 w-full rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!poster && !error && <p className="text-gray-500">লোড হচ্ছে...</p>}

      {poster?.status === "generating" && (
        <div className="space-y-3">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-flagGreen border-t-transparent" />
          <p className="text-gray-600">আপনার পোস্টার তৈরি হচ্ছে...</p>
        </div>
      )}

      {poster?.status === "completed" && poster.generatedImageUrl && (
        <div className="w-full space-y-4">
          <Image
            src={poster.generatedImageUrl}
            alt="Generated poster"
            width={600}
            height={800}
            className="mx-auto w-full max-w-sm rounded shadow-lg"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 rounded bg-flagGreen px-4 py-3 text-center font-semibold text-white disabled:opacity-60"
            >
              {downloading ? "ডাউনলোড হচ্ছে..." : "ডাউনলোড PNG"}
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || poster.retryCount >= MAX_RETRIES}
              className="flex-1 rounded border border-flagGreen px-4 py-3 font-semibold text-flagGreen disabled:opacity-40"
            >
              {poster.retryCount >= MAX_RETRIES
                ? "পুনরায় তৈরির সীমা শেষ"
                : regenerating
                ? "..."
                : "পুনরায় তৈরি করুন"}
            </button>
          </div>
        </div>
      )}

      {poster?.status === "failed" && (
        <div className="w-full space-y-3">
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {poster.errorMessage || "পোস্টার তৈরি ব্যর্থ হয়েছে।"}
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating || poster.retryCount >= MAX_RETRIES}
            className="w-full rounded bg-flagGreen px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {poster.retryCount >= MAX_RETRIES ? "পুনরায় তৈরির সীমা শেষ" : "আবার চেষ্টা করুন"}
          </button>
        </div>
      )}
    </main>
  );
}

export default function PosterPage() {
  return (
    <ProtectedRoute>
      <PosterPreview />
    </ProtectedRoute>
  );
}
