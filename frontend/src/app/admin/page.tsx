"use client";

import { useEffect, useState } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminPosters,
  fetchAdminTemplates,
  fetchAdminGenerationLogs,
  toggleAdminTemplate,
  AdminStats,
  AdminUser,
  AdminPoster,
  AdminTemplate,
  AdminGenerationLog,
} from "@/lib/adminApi";
import { extractErrorMessage } from "@/lib/errors";

type Tab = "overview" | "users" | "posters" | "templates" | "logs";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "ওভারভিউ" },
  { key: "users", label: "ব্যবহারকারী" },
  { key: "posters", label: "পোস্টার" },
  { key: "templates", label: "টেমপ্লেট" },
  { key: "logs", label: "Gemini লগ" },
];

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-flagGreen">{value}</p>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStats().then(setStats).catch((e) => setError(extractErrorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p className="text-gray-500">লোড হচ্ছে...</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="মোট ব্যবহারকারী" value={stats.userCount} />
      <Card label="মোট পোস্টার" value={stats.totalPosters} />
      <Card label="সক্রিয় টেমপ্লেট" value={`${stats.activeTemplateCount}/${stats.templateCount}`} />
      <Card label="Gemini কল" value={stats.geminiCalls} />
      <Card label="তৈরি হয়েছে" value={stats.postersByStatus.completed ?? 0} />
      <Card label="তৈরি হচ্ছে" value={stats.postersByStatus.generating ?? 0} />
      <Card label="ব্যর্থ" value={stats.postersByStatus.failed ?? 0} />
      <Card label="Gemini সফলতার হার" value={stats.geminiSuccessRate !== null ? `${stats.geminiSuccessRate}%` : "N/A"} />
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminUsers().then((d) => setUsers(d.items)).catch((e) => setError(extractErrorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-4">নাম</th>
            <th className="py-2 pr-4">ইমেইল</th>
            <th className="py-2 pr-4">ফোন</th>
            <th className="py-2 pr-4">রোল</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{u.name}</td>
              <td className="py-2 pr-4">{u.email}</td>
              <td className="py-2 pr-4">{u.phone}</td>
              <td className="py-2 pr-4">
                <span className={u.role === "admin" ? "font-semibold text-flagGreen" : ""}>{u.role}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostersTab() {
  const [posters, setPosters] = useState<AdminPoster[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminPosters(1, statusFilter)
      .then((d) => setPosters(d.items))
      .catch((e) => setError(extractErrorMessage(e)));
  }, [statusFilter]);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="mb-3 rounded border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">সব স্ট্যাটাস</option>
        <option value="completed">তৈরি হয়েছে</option>
        <option value="generating">তৈরি হচ্ছে</option>
        <option value="failed">ব্যর্থ</option>
      </select>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-4">ব্যবহারকারী</th>
              <th className="py-2 pr-4">টেমপ্লেট</th>
              <th className="py-2 pr-4">স্ট্যাটাস</th>
              <th className="py-2 pr-4">তারিখ</th>
            </tr>
          </thead>
          <tbody>
            {posters.map((p) => (
              <tr key={p._id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{typeof p.userId === "object" ? p.userId.name : p.userId}</td>
                <td className="py-2 pr-4">{typeof p.templateId === "object" ? p.templateId.title : p.templateId}</td>
                <td className="py-2 pr-4">{p.status}</td>
                <td className="py-2 pr-4">{new Date(p.createdAt).toLocaleDateString("bn-BD")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchAdminTemplates().then(setTemplates).catch((e) => setError(extractErrorMessage(e)));
  }
  useEffect(load, []);

  async function handleToggle(id: string) {
    try {
      await toggleAdminTemplate(id);
      load();
    } catch (e) {
      setError(extractErrorMessage(e));
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-4">টাইটেল</th>
            <th className="py-2 pr-4">উপলক্ষ</th>
            <th className="py-2 pr-4">সক্রিয়</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t._id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{t.title}</td>
              <td className="py-2 pr-4">{t.occasionType}</td>
              <td className="py-2 pr-4">{t.isActive ? "হ্যাঁ" : "না"}</td>
              <td className="py-2 pr-4">
                <button
                  onClick={() => handleToggle(t._id)}
                  className="rounded border border-flagGreen px-3 py-1 text-xs font-semibold text-flagGreen"
                >
                  {t.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<AdminGenerationLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminGenerationLogs().then((d) => setLogs(d.items)).catch((e) => setError(extractErrorMessage(e)));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2 pr-4">সফল</th>
            <th className="py-2 pr-4">টোকেন</th>
            <th className="py-2 pr-4">লেটেন্সি (ms)</th>
            <th className="py-2 pr-4">তারিখ</th>
            <th className="py-2 pr-4">এরর</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l._id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{l.success ? "✅" : "❌"}</td>
              <td className="py-2 pr-4">{l.tokensUsed ?? "-"}</td>
              <td className="py-2 pr-4">{l.latencyMs ?? "-"}</td>
              <td className="py-2 pr-4">{new Date(l.createdAt).toLocaleString("bn-BD")}</td>
              <td className="max-w-xs truncate py-2 pr-4 text-red-600">{l.errorMessage ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-bold text-flagGreen">অ্যাডমিন প্যানেল</h1>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === t.key ? "bg-flagGreen text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "posters" && <PostersTab />}
      {tab === "templates" && <TemplatesTab />}
      {tab === "logs" && <LogsTab />}
    </main>
  );
}

export default function AdminPage() {
  return (
    <AdminRoute>
      <AdminDashboard />
    </AdminRoute>
  );
}
