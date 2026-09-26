"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSystemInfo, resetStuckPosters, syncIndexes, SystemInfo } from "@/lib/adminApi";
import { extractErrorMessage } from "@/lib/errors";
import { useAdminToast } from "@/components/admin/Toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Panel,
  StatCard,
  formatBytes,
  formatNumber,
} from "@/components/admin/ui";

function ConfigCheck({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-[11px] text-gray-500">{hint}</p>}
      </div>
      {ok ? <Badge tone="green">কনফিগার্ড</Badge> : <Badge tone="red">সেট নেই</Badge>}
    </div>
  );
}

const COLLECTION_ROWS: [string, keyof SystemInfo["collections"]][] = [
  ["ব্যবহারকারী", "userCount"],
  ["পোস্টার", "posterCount"],
  ["টেমপ্লেট", "templateCount"],
  ["জেনারেশন লগ", "logCount"],
  ["অডিট লগ", "auditCount"],
  ["সেটিংস", "settingCount"],
];

export default function AdminSystemPage() {
  const toast = useAdminToast();

  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await fetchSystemInfo());
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !info) return <LoadingState label="সিস্টেম তথ্য লোড হচ্ছে..." />;
  if (error && !info) return <ErrorState message={error} onRetry={load} />;
  if (!info) return null;

  const heapPercent = Math.round((info.memory.heapUsedBytes / info.memory.heapTotalBytes) * 100);
  const systemMemoryPercent = Math.round(
    ((info.memory.systemTotalBytes - info.memory.systemFreeBytes) / info.memory.systemTotalBytes) * 100
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">সিস্টেম ও ডেটাবেস</h1>
          <p className="text-sm text-gray-500">সার্ভারের স্বাস্থ্য, কনফিগারেশন ও রক্ষণাবেক্ষণ কাজ</p>
        </div>
        <Button onClick={load} loading={loading} variant="secondary">
          রিফ্রেশ
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="সার্ভার চলছে"
          value={info.server.uptimeLabel}
          hint={`${info.server.environment} · Node ${info.server.nodeVersion}`}
        />
        <StatCard
          label="মেমরি (হিপ)"
          value={`${heapPercent}%`}
          tone={heapPercent > 85 ? "bad" : "default"}
          hint={`${formatBytes(info.memory.heapUsedBytes)} / ${formatBytes(info.memory.heapTotalBytes)}`}
        />
        <StatCard
          label="সিস্টেম মেমরি"
          value={`${systemMemoryPercent}%`}
          tone={systemMemoryPercent > 90 ? "bad" : "default"}
          hint={`${formatBytes(info.memory.systemTotalBytes - info.memory.systemFreeBytes)} ব্যবহৃত`}
        />
        <StatCard
          label="ডেটাবেস"
          value={info.database.connected ? "সংযুক্ত" : "বিচ্ছিন্ন"}
          tone={info.database.connected ? "good" : "bad"}
          hint={info.database.name ? `${info.database.name} @ ${info.database.host ?? "?"}` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="কনফিগারেশন পরীক্ষা" description="প্রয়োজনীয় পরিবেশরা সেট আছে কি না">
          <div className="space-y-2">
            <ConfigCheck label="MongoDB" ok={info.configuration.mongodb} hint="MONGODB_URI" />
            <ConfigCheck label="JWT সিক্রেট" ok={info.configuration.jwtSecretSet} hint="JWT_SECRET" />
            <ConfigCheck
              label="Hugging Face API"
              ok={info.configuration.huggingFace}
              hint="AI ইমেজ জেনারেশন ও স্টাইল পরামর্শ"
            />
            <ConfigCheck
              label="Cloudinary"
              ok={info.configuration.cloudinary}
              hint="ছবি আপলোড ও সংরক্ষণ"
            />
            <ConfigCheck
              label="Puppeteer / Chromium"
              ok={info.services.puppeteer.ready}
              hint={info.services.puppeteer.error ?? "পোস্টার রেন্ডারিং ইঞ্জিন"}
            />
          </div>
        </Panel>

        <Panel title="ডেটাবেস সংগ্রহ" description="প্রতিটি কালেকশনে কত ডকুমেন্ট আছে">
          <dl className="space-y-2 text-sm">
            {COLLECTION_ROWS.map(([label, key]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-gray-100 pb-2"
              >
                <dt className="text-gray-600">{label}</dt>
                <dd className="font-semibold text-gray-900">
                  {formatNumber(info.collections[key])}
                </dd>
              </div>
            ))}
            {info.database.sizeBytes !== undefined && (
              <div className="flex items-center justify-between pt-1">
                <dt className="text-gray-600">ডেটাবেসের আকার</dt>
                <dd className="font-semibold text-gray-900">
                  {formatBytes(info.database.sizeBytes)}
                </dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      <Panel title="রক্ষণাবেক্ষণ কাজ" description="সরাসরি ডেটাবেসে প্রভাব ফেলে এমন কাজ">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-800">আটকে থাকা পোস্টার রিসেট</p>
            <p className="mt-1 text-xs text-gray-500">
              ১৫ মিনিটের বেশি "তৈরি হচ্ছে" অবস্থায় আটকে থাকা পোস্টারগুলো ব্যর্থ হিসেবে চিহ্নিত করা হবে, যাতে
              ব্যবহারকারী আবার চেষ্টা করতে পারেন।
            </p>
            <Button className="mt-3" onClick={() => setConfirmReset(true)}>
              রিসেট করুন
            </Button>
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-800">ইনডেক্স পুনর্গঠন</p>
            <p className="mt-1 text-xs text-gray-500">
              মডেলগুলোর ঘোষিত ইনডেক্সগুলো পুনরায় তৈরি করা হবে। খোঁজা ও ফিল্টার দ্রুত হবে।
            </p>
            <Button
              className="mt-3"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await syncIndexes();
                  toast.success("ইনডেক্স পুনর্গঠন সম্পন্ন হয়েছে।");
                } catch (err) {
                  toast.error(extractErrorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              ইনডেক্স সিঙ্ক করুন
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="সার্ভার তথ্য">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["OS", info.server.platform],
              ["PID", String(info.server.pid)],
              ["র‍্যাম (RSS)", formatBytes(info.memory.rssBytes)],
              ["DB অবস্থা", String(info.database.readyState)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
              <dd className="text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <ConfirmDialog
        open={confirmReset}
        title="আটকে থাকা পোস্টার রিসেট করা হবে"
        confirmLabel="রিসেট করুন"
        loading={busy}
        message="১৫ মিনিটের বেশি চলমান থাকা সব পোস্টার 'ব্যর্থ' হিসেবে চিহ্নিত হবে।"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            const result = await resetStuckPosters(15);
            toast.success(`${result.reset} টি পোস্টার রিসেট হয়েছে।`);
            setConfirmReset(false);
            load();
          } catch (err) {
            toast.error(extractErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
