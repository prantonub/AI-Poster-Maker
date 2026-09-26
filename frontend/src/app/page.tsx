import Link from "next/link";
import { OCCASION_LABELS, OccasionType } from "@/lib/posterTypes";
import { QuickPreviewSection } from "@/components/QuickPreviewSection";

const OCCASIONS: { key: OccasionType; blurb: string; color: string }[] = [
  { key: "victory_day", blurb: "বিজয় দিবসের পোস্টার তৈরি করুন", color: "bg-flagGreen" },
  { key: "tribute", blurb: "শ্রদ্ধা ও স্মরণসভার পোস্টার", color: "bg-gray-700" },
  { key: "campaign", blurb: "নির্বাচনী প্রচারের পোস্টার", color: "bg-blue-700" },
  { key: "greeting", blurb: "উৎসব শুভেচ্ছার পোস্টার", color: "bg-amber-600" },
  { key: "eid_festival", blurb: "ঈদ ও অন্যান্য উৎসবের পোস্টার", color: "bg-purple-700" },
];

export default function Home() {
  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-flagGreen sm:text-4xl">
            AI Political Poster Maker
          </h1>
          <p className="mt-3 text-gray-600">
            ফর্ম পূরণ করুন, ছবি আপলোড করুন — কয়েক সেকেন্ডে প্রিন্ট-রেডি পোস্টার পান।
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OCCASIONS.map((o) => (
            <Link
              key={o.key}
              href={`/create?occasion=${o.key}`}
              className={`${o.color} rounded-xl p-6 text-white shadow-sm transition hover:opacity-90`}
            >
              <h2 className="text-xl font-bold">{OCCASION_LABELS[o.key]}</h2>
              <p className="mt-1 text-sm text-white/85">{o.blurb}</p>
            </Link>
          ))}
        </div>

        <QuickPreviewSection />
      </div>
    </main>
  );
}
