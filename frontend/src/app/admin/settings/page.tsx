"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminSettings, updateAdminSettings, AppSettings } from "@/lib/adminApi";
import { extractErrorMessage } from "@/lib/errors";
import { useAdminToast } from "@/components/admin/Toast";
import {
  Button,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Panel,
  Textarea,
  Toggle,
} from "@/components/admin/ui";

export default function AdminSettingsPage() {
  const toast = useAdminToast();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminSettings();
      setSettings(result.settings);
      setDirty(false);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch(changes: Partial<AppSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...changes } : prev));
    setDirty(true);
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    try {
      const result = await updateAdminSettings(settings);
      setSettings(result.settings);
      setDirty(false);
      toast.success("সেটিংস সংরক্ষিত হয়েছে।");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !settings) return <LoadingState label="সেটিংস লোড হচ্ছে..." />;
  if (error && !settings) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">প্ল্যাটফর্ম সেটিংস</h1>
          <p className="text-sm text-gray-500">
            পরিবর্তনগুলো সাথে সাথে কার্যকর হয় — কোনো রিডিপ্লয় লাগবে না
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} disabled={busy}>
            বাতিল
          </Button>
          <Button variant="primary" onClick={save} loading={busy} disabled={!dirty}>
            সংরক্ষণ
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          অসংরক্ষিত পরিবর্তন আছে — "সংরক্ষণ" চাপলে কার্যকর হবে।
        </div>
      )}

      <Panel title="চালু/বন্ধ নিয়ন্ত্রণ" description="প্ল্যাটফর্মের ফিচার সাথে সাথে নিয়ন্ত্রণ করুন">
        <div className="space-y-3">
          <Toggle
            checked={settings.maintenanceMode}
            onChange={(v) => patch({ maintenanceMode: v })}
            label="মেইন্টেন্যান্স মোড"
            description="চালু থাকলে কোনো ব্যবহারকারী নতুন পোস্টার তৈরি বা AI ইমেজ জেনারেট করতে পারবেন না।"
          />
          <Toggle
            checked={settings.registrationOpen}
            onChange={(v) => patch({ registrationOpen: v })}
            label="রেজিস্ট্রেশন চালু"
            description="বন্ধ করলে নতুন অ্যাকাউন্ট খোলা যাবে না; পুরনো ব্যবহারকারী স্বাভাবিকভাবে কাজ করবেন।"
          />
          <Toggle
            checked={settings.generationEnabled}
            onChange={(v) => patch({ generationEnabled: v })}
            label="AI জেনারেশন চালু"
            description="Hugging Face API খরচ সীমিত রাখতে বন্ধ করা যায়। টেমপ্লেট-ভিত্তিক পোস্টারও বন্ধ থাকবে।"
          />
        </div>
      </Panel>

      <Panel title="সাইটের ঘোষণা ও সহায়তা" description="ব্যবহারকারীরা এগুলো সাইটে দেখতে পাবেন">
        <div className="space-y-4">
          <Field
            label="ঘোষণা"
            hint="খালি রাখলে কোনো ব্যানার দেখানো হবে না (সর্বোচ্চ ৩০০ অক্ষর)"
          >
            <Textarea
              rows={3}
              value={settings.siteNotice}
              onChange={(e) => patch({ siteNotice: e.target.value })}
              placeholder="যেমন: আগামীকাল থেকে নতুন ফিচার চালু হবে।"
            />
          </Field>

          <Field label="সহায়তা ইমেইল" hint="ব্যবহারকারী সমস্যা জানাতে ব্যবহার করবেন">
            <Input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => patch({ supportEmail: e.target.value })}
              placeholder="support@example.com"
            />
          </Field>

          <Field
            label="প্রতিদিনের পোস্টার লিমিট (প্রতি ব্যবহারকারী)"
            hint="0 দিলে কোনো সীমা নেই"
          >
            <Input
              type="number"
              min={0}
              max={1000}
              value={settings.dailyPosterLimitPerUser}
              onChange={(e) =>
                patch({ dailyPosterLimitPerUser: Math.max(0, Number(e.target.value) || 0) })
              }
              className="max-w-[160px]"
            />
          </Field>
        </div>
      </Panel>

      <Panel title="ঝুঁকির সতর্কতা" description="সেটিংস বদলানোর আগে যা মাথায় রাখা দরকার">
        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-gray-600">
          <li>
            মেইন্টেন্যান্স মোড চালু করলে ইতিমধ্যে চলমান পোস্টার প্রক্রিয়া থেমে যাবে না — শুধু নতুন
            অনুরোধ ব্লক হবে।
          </li>
          <li>
            কোনো অ্যাডমিন একটি ফিচার বন্ধ করলে তা সাথে সাথেই কার্যকর হয়; ক্যাশ ৩০ সেকেন্ডে মেয়াদ শেষ হয়।
          </li>
          <li>
            প্রতিটি সেটিংস পরিবর্তন অডিট লগে সংরক্ষিত হয়, যা "লগ ও অডিট" পাতায় দেখা যাবে।
          </li>
        </ul>
      </Panel>
    </div>
  );
}
