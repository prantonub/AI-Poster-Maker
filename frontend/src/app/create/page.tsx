"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OCCASION_LABELS, OccasionType, TemplateDTO, PosterFormData } from "@/lib/posterTypes";
import { fetchTemplates, uploadPhotos, createPoster } from "@/lib/posterApi";
import { extractErrorMessage } from "@/lib/errors";

const OCCASIONS = Object.keys(OCCASION_LABELS) as OccasionType[];
const MAX_PHOTOS = 3;
const MAX_PHOTO_MB = 5;

function CreatePosterWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [occasion, setOccasion] = useState<OccasionType | null>(
    (searchParams.get("occasion") as OccasionType) || null
  );
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const [form, setForm] = useState<Omit<PosterFormData, "occasion">>({
    name: "",
    designation: "",
    party: "",
    district: "",
    thana: "",
    union: "",
    headlineText: "",
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load templates whenever the chosen occasion changes.
  useEffect(() => {
    if (!occasion) return;
    setTemplatesLoading(true);
    setTemplateId(null);
    fetchTemplates(occasion)
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [occasion]);

  function handlePhotoSelect(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setPhotoError(null);

    const combined = [...photos, ...incoming].slice(0, MAX_PHOTOS);
    const oversized = incoming.find((f) => f.size > MAX_PHOTO_MB * 1024 * 1024);
    if (oversized) {
      setPhotoError(`প্রতিটি ছবি ${MAX_PHOTO_MB}MB এর কম হতে হবে`);
      return;
    }
    if (photos.length + incoming.length > MAX_PHOTOS) {
      setPhotoError(`সর্বোচ্চ ${MAX_PHOTOS}টি ছবি আপলোড করা যাবে`);
    }
    setPhotos(combined);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!occasion || !templateId) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const uploadedPhotoUrls = await uploadPhotos(photos);
      const fullFormData: PosterFormData = { ...form, occasion };
      const poster = await createPoster(templateId, fullFormData, uploadedPhotoUrls);
      router.push(`/posters/${poster._id}`);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold text-flagGreen">পোস্টার তৈরি করুন</h1>
      <p className="mb-6 text-sm text-gray-500">ধাপ {step} / 4</p>

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">উপলক্ষ বেছে নিন</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => setOccasion(o)}
                className={`rounded-lg border p-4 text-sm font-medium transition ${
                  occasion === o
                    ? "border-flagGreen bg-flagGreen/10 text-flagGreen"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {OCCASION_LABELS[o]}
              </button>
            ))}
          </div>
          <button
            disabled={!occasion}
            onClick={() => setStep(2)}
            className="mt-4 w-full rounded bg-flagGreen px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            পরবর্তী
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">টেমপ্লেট বেছে নিন</h2>
          {templatesLoading && <p className="text-sm text-gray-500">লোড হচ্ছে...</p>}
          {!templatesLoading && templates.length === 0 && (
            <p className="text-sm text-gray-500">এই উপলক্ষের জন্য কোনো টেমপ্লেট পাওয়া যায়নি।</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t._id}
                onClick={() => setTemplateId(t._id)}
                className={`rounded-lg border p-4 text-left transition ${
                  templateId === t._id
                    ? "border-flagGreen bg-flagGreen/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div
                  className="mb-2 h-24 w-full rounded"
                  style={{ background: t.layoutConfig.colorScheme.primary }}
                />
                <p className="font-medium">{t.title}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="w-1/3 rounded border border-gray-300 px-4 py-3 font-semibold"
            >
              পেছনে
            </button>
            <button
              disabled={!templateId}
              onClick={() => setStep(3)}
              className="w-2/3 rounded bg-flagGreen px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              পরবর্তী
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">তথ্য দিন</h2>
          {(
            [
              ["name", "নাম"],
              ["designation", "পদবি"],
              ["party", "দল/সংগঠন"],
              ["district", "জেলা"],
              ["thana", "থানা"],
              ["union", "ইউনিয়ন/ওয়ার্ড"],
            ] as [keyof typeof form, string][]
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium">{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-sm font-medium">হেডলাইন টেক্সট</label>
            <textarea
              value={form.headlineText}
              onChange={(e) => setForm((f) => ({ ...f, headlineText: e.target.value }))}
              maxLength={200}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="মহান বিজয় দিবসের শুভেচ্ছা"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="w-1/3 rounded border border-gray-300 px-4 py-3 font-semibold"
            >
              পেছনে
            </button>
            <button
              disabled={!form.name || !form.designation || !form.headlineText}
              onClick={() => setStep(4)}
              className="w-2/3 rounded bg-flagGreen px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              পরবর্তী
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">ছবি আপলোড করুন (সর্বোচ্চ {MAX_PHOTOS}টি)</h2>

          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 hover:border-flagGreen"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handlePhotoSelect(e.dataTransfer.files);
            }}
          >
            ছবি টেনে আনুন বা ক্লিক করে বেছে নিন
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoSelect(e.target.files)}
            />
          </label>

          {photoError && <p className="text-sm text-red-600">{photoError}</p>}

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {photos.map((file, i) => (
                <div key={i} className="relative">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={`photo-${i}`}
                    width={150}
                    height={150}
                    unoptimized
                    className="h-24 w-full rounded object-cover"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {submitError && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="w-1/3 rounded border border-gray-300 px-4 py-3 font-semibold"
            >
              পেছনে
            </button>
            <button
              disabled={photos.length === 0 || submitting}
              onClick={handleSubmit}
              className="w-2/3 rounded bg-flagGreen px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "তৈরি হচ্ছে..." : "পোস্টার তৈরি করুন"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default function CreatePage() {
  return (
    <ProtectedRoute>
      <CreatePosterWizard />
    </ProtectedRoute>
  );
}
