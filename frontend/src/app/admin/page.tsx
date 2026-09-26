"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchAdminStats,
  fetchAdminTimeseries,
  fetchTopUsers,
  fetchOccasionCounts,
  AdminStats,
  TimeseriesPoint,
  TopUser,
  OccasionCount,
} from "@/lib/adminApi";
import { extractErrorMessage } from "@/lib/errors";
import { OCCASION_LABELS } from "@/lib/posterTypes";
import { Panel, StatCard, Badge, LoadingState, ErrorState, formatNumber } from "@/components/admin/ui";
import { BarChart, DonutChart, RankedBars } from "@/components/admin/charts";

const RANGES = [7, 14, 30, 90];

const STATUS_COLORS: Record<string, string> = {
  completed: "#059669",
  failed: "#F42A41",
  generating: "#F59E0B",
  draft: "#9CA3AF",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "সফল",
  failed: "ব্যর্থ",
  generating: "চলমান",
  draft: "খসড়া",
};

function SystemAlertBanner({ stats }: { stats: AdminStats }) {
  const alerts: { tone: "red" | "amber"; text: string }[] = [];

  if (stats.settings.maintenanceMode) {
    alerts.push({ tone: "red", text: "মেইন্টেন্যান্স মোড চালু — নতুন পোস্টার তৈরি বন্ধ আছে।" });
  }
  if (!stats.settings.generationEnabled) {
    alerts.push({ tone: "amber", text: "জেনারেশন ফিচার বন্ধ আছে।" });
  }
  if (!stats.settings.registrationOpen) {
    alerts.push({ tone: "amber", text: "নতুন রেজিস্ট্রেশন বন্ধ আছে।" });
  }
  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.text}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${
            alert.tone === "red"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <span>{alert.text}</span>
          <Link href="/admin/settings" className="shrink-0 font-medium underline">
            সেটিংসে যান
          </Link>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [occasions, setOccasions] = useState<OccasionCount[]>([]);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, seriesData, topUsersData, occasionData] = await Promise.all([
        fetchAdminStats(),
        fetchAdminTimeseries(days),
        fetchTopUsers(8),
        fetchOccasionCounts(),
      ]);
      setStats(statsData);
      setSeries(seriesData);
      setTopUsers(topUsersData);
      setOccasions(occasionData);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !stats) return <LoadingState label="ড্যাশবোর্ড লোড হচ্ছে..." />;
  if (error && !stats) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const statusData = Object.entries(stats.postersByStatus).map(([key, value]) => ({
    label: STATUS_LABELS[key] ?? key,
    value,
    color: STATUS_COLORS[key] ?? "#9CA3AF",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ড্যাশবোর্ড</h1>
          <p className="text-sm text-gray-500">প্ল্যাটফর্মের সামগ্রিক অবস্থা ও কার্যক্রম</p>
        </div>
        {error && <p className="text-xs text-red-600">সতর্কতা: {error}</p>}
      </div>

      <SystemAlertBanner stats={stats} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="মোট ব্যবহারকারী"
          value={formatNumber(stats.userCount)}
          hint={`আজ নতুন ${stats.newUsersToday} · এ সপ্তাহে ${stats.newUsersWeek}`}
        />
        <StatCard
          label="মোট পোস্টার"
          value={formatNumber(stats.totalPosters)}
          hint={`এ সপ্তাহে ${stats.postersThisWeek} (সফল ${stats.completedThisWeek})`}
        />
        <StatCard
          label="সক্রিয় টেমপ্লেট"
          value={`${stats.activeTemplateCount}/${stats.templateCount}`}
          hint={`অ্যাডমিন ${stats.adminCount} · স্থগিত ${stats.suspendedUsers}`}
        />
        <StatCard
          label="জেনারেশন কল"
          value={formatNumber(stats.geminiCalls)}
          tone={stats.geminiSuccessRate !== null && stats.geminiSuccessRate < 90 ? "warn" : "good"}
          hint={
            stats.geminiSuccessRate !== null
              ? `সফলতার হার ${stats.geminiSuccessRate}%`
              : "এখনো কোনো কল নেই"
          }
        />
      </div>

      <Panel
        title="দৈনিক কার্যক্রম"
        description="নতুন ব্যবহারকারী ও পোস্টার তৈরির সংখ্যা"
        actions={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  days === r ? "bg-flagGreen text-white" : "border border-gray-200 text-gray-600"
                }`}
              >
                {r} দিন
              </button>
            ))}
          </div>
        }
      >
        <BarChart
          data={series as unknown as Record<string, number | string>[]}
          series={[
            { key: "newUsers", label: "নতুন ব্যবহারকারী", color: "#006A4E" },
            { key: "posters", label: "পোস্টার", color: "#3B82F6" },
            { key: "completed", label: "সফল পোস্টার", color: "#10B981" },
            { key: "failed", label: "ব্যর্থ পোস্টার", color: "#F42A41" },
          ]}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="পোস্টার স্ট্যাটাস" description="সব পোস্টারের বর্তমান অবস্থা">
          <DonutChart items={statusData} />
        </Panel>

        <Panel title="উপলক্ষ অনুযায়ী ব্যবহার" description="কোন ধরনের পোস্টার বেশি বানানো হয়">
          <RankedBars
            items={occasions.map((o) => ({
              label: OCCASION_LABELS[o.occasion as keyof typeof OCCASION_LABELS] ?? o.occasion,
              value: o.count,
            }))}
            color="#3B82F6"
          />
        </Panel>
      </div>

      <Panel
        title="সবচেয়ে সক্রিয় ব্যবহারকারী"
        description="সর্বোচ্চ পোস্টার তৈরি করা অ্যাকাউন্টগুলো"
        actions={
          <Link href="/admin/users" className="text-xs font-medium text-flagGreen underline">
            সবাই দেখুন
          </Link>
        }
      >
        {topUsers.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">এখনো কোনো পোস্টার তৈরি হয়নি</p>
        ) : (
          <TopUsersTable rows={topUsers} />
        )}
      </Panel>
    </div>
  );
}

function TopUsersTable({ rows }: { rows: TopUser[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-4">ব্যবহারকারী</th>
            <th className="py-2 pr-4">ইমেইল</th>
            <th className="py-2 pr-4">পোস্টার</th>
            <th className="py-2 pr-4">সফল</th>
            <th className="py-2">সর্বশেষ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4 font-medium text-gray-800">
                {row.name} {!row.isActive && <Badge tone="red">স্থগিত</Badge>}
              </td>
              <td className="py-2 pr-4 text-gray-500">{row.email || "—"}</td>
              <td className="py-2 pr-4">{row.posters}</td>
              <td className="py-2 pr-4">{row.completed}</td>
              <td className="py-2 text-gray-500">{new Date(row.lastPosterAt).toLocaleDateString("bn-BD")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
