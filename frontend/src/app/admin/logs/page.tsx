"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchGenerationLogs,
  fetchAuditLogs,
  purgeGenerationLogs,
  AdminGenerationLog,
  AuditLogEntry,
  GenerationLogSummary,
  Paginated,
} from "@/lib/adminApi";
import { extractErrorMessage } from "@/lib/errors";
import { useAdminToast } from "@/components/admin/Toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Panel,
  Pagination,
  Select,
  StatCard,
  TableWrap,
  Td,
  Th,
  formatDate,
  useDebounced,
} from "@/components/admin/ui";

type Tab = "generation" | "audit";

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("generation");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">লগ ও অডিট</h1>
        <p className="text-sm text-gray-500">
          AI জেনারেশনের কার্যক্রম, খরচের হিসাব এবং অ্যাডমিন কার্যক্রমের নথি
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { key: "generation", label: "জেনারেশন লগ" },
            { key: "audit", label: "অ্যাডমিন অডিট" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-flagGreen text-flagGreen"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generation" ? <GenerationLogsTab /> : <AuditTab />}
    </div>
  );
}

type GenerationData = Paginated<AdminGenerationLog> & { summary: GenerationLogSummary };

function GenerationLogsTab() {
  const toast = useAdminToast();

  const [data, setData] = useState<GenerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<"true" | "false" | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [purgeDays, setPurgeDays] = useState(90);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [busy, setBusy] = useState(false);

  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, success, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchGenerationLogs({
          page,
          limit,
          success: success || undefined,
          search: debouncedSearch || undefined,
        })
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, success, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="মোট কল" value={data.summary.total} />
          <StatCard
            label="সফলতার হার"
            value={data.summary.successRate !== null ? `${data.summary.successRate}%` : "N/A"}
            tone={data.summary.successRate !== null && data.summary.successRate < 80 ? "warn" : "good"}
          />
          <StatCard
            label="গড় লেটেন্সি"
            value={data.summary.avgLatencyMs !== null ? `${data.summary.avgLatencyMs} ms` : "N/A"}
          />
          <StatCard label="মোট টোকেন" value={data.summary.totalTokens} />
        </div>
      )}

      <Panel
        title="লগ ব্যবস্থাপনা"
        description="পুরনো লগ মুছলে ডেটাবেসের জায়গা ফাঁকা হয়"
        actions={
          <div className="flex items-end gap-2">
            <Select
              value={purgeDays}
              onChange={(e) => setPurgeDays(Number(e.target.value))}
              aria-label="রিটেনশন"
            >
              <option value={30}>30 দিনের পুরনো</option>
              <option value={90}>90 দিনের পুরনো</option>
              <option value={180}>180 দিনের পুরনো</option>
              <option value={365}>1 বছরের পুরনো</option>
            </Select>
            <Button variant="danger" onClick={() => setConfirmPurge(true)}>
              পুরনো লগ মুছুন
            </Button>
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="এরর মেসেজে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={success}
            onChange={(e) => setSuccess(e.target.value as "true" | "false" | "")}
            aria-label="ফলাফল"
          >
            <option value="">সব ফলাফল</option>
            <option value="true">শুধু সফল</option>
            <option value="false">শুধু ব্যর্থ</option>
          </Select>
          <Button onClick={load} loading={loading} variant="secondary">
            রিফ্রেশ
          </Button>
        </div>
      </Panel>

      <Panel>
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="কোনো লগ পাওয়া যায়নি" />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr className="border-b border-gray-200">
                  <Th>ফলাফল</Th>
                  <Th className="text-right">টোকেন</Th>
                  <Th className="text-right">লেটেন্সি</Th>
                  <Th>পোস্টার</Th>
                  <Th>এরর</Th>
                  <Th>সময়</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log._id} className="border-b border-gray-100 last:border-0">
                    <Td>
                      {log.success ? <Badge tone="green">সফল</Badge> : <Badge tone="red">ব্যর্থ</Badge>}
                    </Td>
                    <Td className="text-right">{log.tokensUsed ?? "—"}</Td>
                    <Td className="text-right">
                      {log.latencyMs !== undefined ? `${log.latencyMs} ms` : "—"}
                    </Td>
                    <Td>
                      <code className="text-[10px] text-gray-400">{log.posterId}</code>
                    </Td>
                    <Td className="max-w-xs">
                      {log.errorMessage ? (
                        <span className="block truncate text-xs text-red-600" title={log.errorMessage}>
                          {log.errorMessage}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-gray-500">{formatDate(log.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmPurge}
        title="পুরনো জেনারেশন লগ মুছে ফেলা হবে"
        destructive
        confirmLabel="মুছে ফেলুন"
        loading={busy}
        message={`${purgeDays} দিনের পুরনো সব জেনারেশন লগ স্থায়ীভাবে মুছে যাবে।`}
        onCancel={() => setConfirmPurge(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            const result = await purgeGenerationLogs(purgeDays);
            toast.success(`${result.deleted} টি লগ মুছে ফেলা হয়েছে।`);
            setConfirmPurge(false);
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

const ACTION_TONES: Record<string, "green" | "red" | "amber" | "blue" | "gray"> = {
  user: "blue",
  poster: "gray",
  template: "amber",
  settings: "red",
  system: "red",
  generationLog: "gray",
};

function AuditTab() {
  const [data, setData] = useState<Paginated<AuditLogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, entity, action, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await fetchAuditLogs({
          page,
          limit,
          search: debouncedSearch || undefined,
          entity: entity || undefined,
          action: action || undefined,
        })
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, entity, action]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Panel
      title="অ্যাডমিন কার্যক্রমের নথি"
      description="কোন অ্যাডমিন কখন কী পরিবর্তন করেছে"
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="সারসংক্ষেপ বা ইমেইল খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="এন্টিটি">
          <option value="">সব এন্টিটি</option>
          <option value="user">ব্যবহারকারী</option>
          <option value="poster">পোস্টার</option>
          <option value="template">টেমপ্লেট</option>
          <option value="settings">সেটিংস</option>
          <option value="system">সিস্টেম</option>
        </Select>
        <Input
          placeholder="অ্যাকশন (যেমন user)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <Button onClick={load} loading={loading} variant="secondary">
          রিফ্রেশ
        </Button>
      </div>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="কোনো অডিট এন্ট্রি নেই"
          hint="অ্যাডমিন প্যানেল থেকে কোনো পরিবর্তন করলে সেটি এখানে দেখা যাবে।"
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr className="border-b border-gray-200">
                <Th>অ্যাডমিন</Th>
                <Th>অ্যাকশন</Th>
                <Th>বিবরণ</Th>
                <Th>IP</Th>
                <Th>সময়</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry._id} className="border-b border-gray-100 last:border-0">
                  <Td className="text-xs text-gray-700">{entry.adminEmail}</Td>
                  <Td>
                    <Badge tone={ACTION_TONES[entry.entity] ?? "gray"}>{entry.action}</Badge>
                  </Td>
                  <Td className="max-w-md text-xs">{entry.summary ?? "—"}</Td>
                  <Td className="text-[11px] text-gray-400">{entry.ip ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-xs text-gray-500">{formatDate(entry.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      )}
    </Panel>
  );
}
