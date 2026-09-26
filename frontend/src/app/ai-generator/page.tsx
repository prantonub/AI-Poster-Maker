"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AI_ASPECT_RATIOS, AI_ASPECT_RATIO_LABELS, AiAspectRatio } from "@/lib/posterTypes";
import { generateAiPoster } from "@/lib/posterApi";
import { extractErrorMessage } from "@/lib/errors";

const EXAMPLE_PROMPTS = [
  "একটা ঈদ মোবারক ব্যানার বানিয়ে দাও। সবুজ ও সোনালি রঙ ব্যবহার করো।",
  "মহান বিজয় দিবসের শুভেচ্ছা ব্যানার, লাল-সবুজ রঙে, আধুনিক ডিজাইন",
  "শহীদ দিবসের শোক ব্যানার, মার্জিত কালো-সাদা ডিজাইন",
];

const LOADING_MESSAGES = [
  "Gemini AI আপনার পোস্টার ডিজাইন করছে...",
  "রঙ, লেআউট ও টাইপোগ্রাফি সাজানো হচ্ছে...",
  "প্রায় শেষ — আরও কিছুক্ষণ অপেক্ষা করুন...",
];

interface GenerationRequest {
  prompt: string;
  aspectRatio: AiAspectRatio;
  image?: string;
}

function AiGenerator() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AiAspectRatio>("4:5");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerationRequest | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Rotating status lines keep the loading state feeling alive.
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const id = setInterval(() => {
      setLoadingStep((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2600);
    return () => clearInterval(id);
  }, [loading]);

  // Single entry point for generate, regenerate and edit — they differ only
  // in the request they send.
  async function runGeneration(request: GenerationRequest) {
    setError(null);
    setLoading(true);
    try {
      const data = await generateAiPoster(request);
      setImageUrl(data.imageUrl);
      setLastRequest(request);
      setEditMode(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("দয়া করে একটি প্রম্পট লিখুন।");
      return;
    }
    void runGeneration({ prompt: trimmed, aspectRatio });
  }

  function handleRegenerate() {
    if (lastRequest) void runGeneration(lastRequest);
  }

  function handleEdit() {
    const trimmed = editPrompt.trim();
    if (!trimmed) {
      setError("দয়া করে কী পরিবর্তন করতে চান লিখুন।");
      return;
    }
    if (!imageUrl || !lastRequest) return;
    // Edits keep the aspect ratio of the image being edited.
    void runGeneration({
      prompt: trimmed,
      aspectRatio: lastRequest.aspectRatio,
      image: imageUrl,
    });
  }

  async function handleDownload() {
    if (!imageUrl) return;
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `ai-poster-${Date.now()}.${blob.type === "image/jpeg" ? "jpg" : "png"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: let Cloudinary serve the file as an attachment.
      try {
        const url = new URL(imageUrl);
        url.searchParams.set("dl", "ai-poster");
        window.open(url.toString(), "_blank");
      } catch {
        window.open(imageUrl, "_blank");
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4 pb-16 sm:p-8">
      <h1 className="text-2xl font-bold text-flagGreen sm:text-3xl">
        AI পোস্টার / ব্যানার জেনারেটর
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        যা চান বাংলায় বা ইংরেজিতে লিখুন — Gemini AI আপনার প্রম্পট অনুযায়ী একটি প্রস্তুত
        সোশ্যাল-মিডিয়া পোস্টার ডিজাইন তৈরি করবে।
      </p>

      {/* ---------- Prompt card ---------- */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <label htmlFor="poster-prompt" className="block text-sm font-semibold text-gray-800">
          আপনার প্রম্পট
        </label>
        <textarea
          id="poster-prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (error) setError(null);
          }}
          rows={6}
          maxLength={2000}
          placeholder="যেমন: একটা ঈদ মোবারক ব্যানার বানিয়ে দাও। সবুজ ও সোনালি রঙ ব্যবহার করো।"
          className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-relaxed focus:border-flagGreen focus:outline-none focus:ring-2 focus:ring-flagGreen/20"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
          <span>প্রম্পটই ডিজাইনের নিয়ন্ত্রণে থাকবে</span>
          <span>{prompt.length}/2000</span>
        </div>

        {/* Example prompts — click to fill */}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              disabled={loading}
              onClick={() => {
                setPrompt(example);
                if (error) setError(null);
              }}
              className="max-w-full truncate rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 transition hover:border-flagGreen hover:text-flagGreen disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Aspect ratio (optional) */}
        <div className="mt-5">
          <span className="block text-sm font-semibold text-gray-800">
            অ্যাসপেক্ট রেশিও <span className="font-normal text-gray-400">(ঐচ্ছিক — ডিফল্ট 4:5)</span>
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AI_ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                disabled={loading}
                onClick={() => setAspectRatio(ratio)}
                className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                  aspectRatio === ratio
                    ? "border-flagGreen bg-flagGreen/10 ring-2 ring-flagGreen/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="block text-sm font-bold text-gray-800">
                  {AI_ASPECT_RATIO_LABELS[ratio].label}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {AI_ASPECT_RATIO_LABELS[ratio].hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-flagGreen px-6 py-4 text-base font-bold text-white shadow-md shadow-flagGreen/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          ✨ Generate Poster
        </button>
      </section>

      {/* ---------- Single error banner (empty prompt, API errors, etc.) ---------- */}
      {error && !loading && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ {error}
        </p>
      )}

      {/* ---------- Polished loading state ---------- */}
      {loading && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-flagGreen/20 border-t-flagGreen" />
          <p className="text-sm font-medium text-gray-700">{LOADING_MESSAGES[loadingStep]}</p>
          <p className="mt-1 text-xs text-gray-400">
            সাধারণত ১০–৩০ সেকেন্ড সময় লাগে — কিছুক্ষণ অপেক্ষা করুন।
          </p>
          <div className="mx-auto mt-5 max-w-sm animate-pulse space-y-3">
            <div className="h-3 rounded bg-gray-200" />
            <div className="h-3 w-5/6 rounded bg-gray-200" />
            <div className="h-3 w-2/3 rounded bg-gray-200" />
          </div>
        </section>
      )}

      {/* ---------- Generated poster ---------- */}
      {!loading && imageUrl && lastRequest && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-flagGreen">আপনার পোস্টার</h2>
            <span className="rounded-full bg-flagGreen/10 px-3 py-1 text-xs font-semibold text-flagGreen">
              {lastRequest.aspectRatio}
            </span>
          </div>

          <div
            className="relative mx-auto w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-lg"
            style={{ aspectRatio: lastRequest.aspectRatio.replace(":", " / ") }}
          >
            <Image
              src={imageUrl}
              alt="Generated poster"
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-contain"
              priority
            />
          </div>

          <p className="mt-3 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-600">প্রম্পট:</span> {lastRequest.prompt}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleRegenerate}
              className="rounded-xl border border-flagGreen px-4 py-3 text-sm font-semibold text-flagGreen transition hover:bg-flagGreen/5"
            >
              ↻ Regenerate
            </button>
            <button
              type="button"
              onClick={() => {
                setEditMode((v) => !v);
                setError(null);
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                editMode
                  ? "border-flagGreen bg-flagGreen text-white"
                  : "border-flagGreen text-flagGreen hover:bg-flagGreen/5"
              }`}
            >
              ✏ Edit with Prompt
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-xl bg-flagGreen px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {downloading ? "↓ ডাউনলোড হচ্ছে..." : "↓ Download"}
            </button>
          </div>

          {editMode && (
            <div className="mt-4 rounded-xl border border-dashed border-flagGreen/40 bg-flagGreen/5 p-4">
              <label htmlFor="edit-prompt" className="block text-sm font-semibold text-gray-800">
                কী পরিবর্তন করতে চান?
              </label>
              <textarea
                id="edit-prompt"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder='যেমন: "background dark green করো", "লেখাটা বড় করো", "আরও premium করে দাও"'
                className="mt-2 w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:border-flagGreen focus:outline-none focus:ring-2 focus:ring-flagGreen/20"
              />
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-xl bg-flagGreen px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  ✏ Apply Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setEditPrompt("");
                    setError(null);
                  }}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  বাতিল
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default function AiGeneratorPage() {
  return (
    <ProtectedRoute>
      <AiGenerator />
    </ProtectedRoute>
  );
}
