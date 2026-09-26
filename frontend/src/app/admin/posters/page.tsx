"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  fetchAdminPosters,
  fetchAdminPoster,
  setAdminPosterStatus,
  regenerateAdminPoster,
  deleteAdminPoster,
  bulkDeleteAdminPosters,
  exportAdminPostersCsv,
  AdminPoster,
  Paginated,
  PosterStatus,
  OccasionType,
} from "@/lib/adminApi";
import { OCCASION_LABELS } from "@/lib/posterTypes";
import { extractErrorMessage } from "@/lib/errors";
import { useAdminToast } from "@/components/admin/Toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Panel,
  Pagination,
  Select,
  Input,
  TableWrap,
  Td,
  Th,
  formatDate,
  statusTone,
  useDebounced,
} from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  draft: "খসড়া",
  generating: "তৈরি হচ্ছে",
  completed: "সফল",
  failed: "ব্যর্থ",
};

const SORTS = [
  { value: "createdAt:desc", label: "নতুন আগে" },
  { value: "createdAt:asc", label: "পুরনো আগে" },
  { value: "updatedAt:desc", label: "সর্বশেষ আপডেট" },
];

function ownerOf(poster: AdminPoster) {
  return typeof poster.userId === "string" || poster.userId === null
    ? { name: "(মুছে ফেলা ব্যবহারকারী)", email: "" }
    : poster.userId;
}

function templateTitle(poster: AdminPoster): string {
  return typeof poster.templateId === "string" || poster.templateId === null
    ? "—"
    : poster.templateId.title;
}

export default function AdminPostersPage() {
  const toast = useAdminToast();

  const [data, setData] = useState<Paginated<AdminPoster> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PosterStatus | "">("");
  const [occasion, setOccasion] = useState<OccasionType | "">("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPoster | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, occasion, sort, limit]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      occasion: occasion || undefined,
      sort,
    }),
    [debouncedSearch, status, occasion, sort]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminPosters({ ...filters, page, limit }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = useMemo(
    () => !!data && data.items.length > 0 && data.items.every((p) => selected.has(p._id)),
    [data, selected]
  );

  function toggleAll() {
    if (!data) return;
    setSelected(allSelected ? new Set() : new Set(data.items.map((p) => p._id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">পোস্টার ব্যবস্থাপনা</h1>
        <p className="text-sm text-gray-500">
          সব ব্যবহারকারীর পোস্টার — স্ট্যাটাস দেখা, পুনরায় তৈরি, মুছে ফেলা ও CSV রপ্তানি
        </p>
      </div>

      <Panel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="হেডলাইন বা নাম খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as PosterStatus | "")}
            aria-label="স্ট্যাটাস"
          >
            <option value="">সব স্ট্যাটাস</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value as OccasionType | "")}
            aria-label="উপলক্ষ"
          >
            <option value="">সব উপলক্ষ</option>
            {Object.entries(OCCASION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="সাজান">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button onClick={load} loading={loading} variant="secondary">
              রিফ্রেশ
            </Button>
            <Button
              variant="secondary"
              loading={exporting}
              onClick={() =>
                withBusy(async () => {
                  setExporting(true);
                  try {
                    await exportAdminPostersCsv(filters);
                    toast.success("CSV ফাইল ডাউনলোড হয়েছে।");
                  } finally {
                    setExporting(false);
                  }
                })
              }
            >
              CSV
            </Button>
          </div>
        </div>
      </Panel>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-flagRed/30 bg-flagRed/5 px-4 py-3">
          <span className="text-sm font-medium text-flagRed">{selected.size} টি নির্বাচিত</span>
          <Button variant="danger" onClick={() => setConfirmBulkDelete(true)}>
            নির্বাচিতগুলো মুছুন
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 underline"
          >
            বাতিল
          </button>
        </div>
      )}

      <Panel>
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="কোনো পোস্টার পাওয়া যায়নি" hint="সার্চ বা ফিল্টার পরিবর্তন করে দেখুন।" />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr className="border-b border-gray-200">
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="সব নির্বাচন করুন"
                    />
                  </Th>
                  <Th>পোস্টার</Th>
                  <Th>ব্যবহারকারী</Th>
                  <Th>টেমপ্লেট</Th>
                  <Th>স্ট্যাটাস</Th>
                  <Th>তৈরি</Th>
                  <Th className="text-right">কাজ</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.has(p._id)}
                        onChange={() => toggleOne(p._id)}
                        aria-label="পোস্টার নির্বাচন করুন"
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        {p.generatedImageUrl ? (
                          <Image
                            src={p.generatedImageUrl}
                            alt={p.formData.headlineText}
                            width={40}
                            height={52}
                            className="h-13 w-10 rounded object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-13 w-10 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">
                            নেই
                          </span>
                        )}
                        <div className="min-w-0">
                          <button
                            onClick={() => setDetailId(p._id)}
                            className="block max-w-[220px] truncate text-left font-medium text-gray-900 hover:text-flagGreen hover:underline"
                          >
                            {p.formData.headlineText}
                          </button>
                          <p className="text-[11px] text-gray-400">{p.formData.name}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-gray-700">{ownerOf(p).name}</p>
                      <p className="text-[11px] text-gray-400">{ownerOf(p).email}</p>
                    </Td>
                    <Td className="text-xs">{templateTitle(p)}</Td>
                    <Td>
                      <Badge tone={statusTone(p.status)}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                      {p.retryCount > 0 && (
                        <p className="mt-0.5 text-[10px] text-gray-400">পুনরায় চেষ্টা: {p.retryCount}</p>
                      )}
                    </Td>
                    <Td className="text-xs text-gray-500">{formatDate(p.createdAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1 text-xs"
                          onClick={() => setDetailId(p._id)}
                        >
                          বিস্তারিত
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1 text-xs"
                          disabled={busy}
                          onClick={() =>
                            withBusy(async () => {
                              await regenerateAdminPoster(p._id);
                              toast.success("পোস্টারটি পুনরায় তৈরি শুরু হয়েছে।");
                              load();
                            })
                          }
                        >
                          পুনরায় তৈরি
                        </Button>
                        {p.generatedImageUrl && (
                          <Link
                            href={p.generatedImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                          >
                            ছবি
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1 text-xs text-flagRed"
                          onClick={() => setDeleteTarget(p)}
                        >
                          মুছুন
                        </Button>
                      </div>
                    </Td>
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

      {detailId && (
        <PosterDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="পোস্টার মুছে ফেলা হবে"
        destructive
        confirmLabel="মুছে ফেলুন"
        loading={busy}
        message={`"${deleteTarget?.formData.headlineText}" — এই পোস্টারটি স্থায়ীভাবে মুছে যাবে।`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() =>
          withBusy(async () => {
            if (!deleteTarget) return;
            await deleteAdminPoster(deleteTarget._id);
            toast.success("পোস্টার মুছে ফেলা হয়েছে।");
            setDeleteTarget(null);
            load();
          })
        }
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title="নির্বাচিত পোস্টারগুলো মুছে ফেলা হবে"
        destructive
        confirmLabel="মুছে ফেলুন"
        loading={busy}
        message={`${selected.size} টি পোস্টার স্থায়ীভাবে মুছে যাবে।`}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={() =>
          withBusy(async () => {
            const result = await bulkDeleteAdminPosters(Array.from(selected));
            toast.success(`${result.deleted} টি পোস্টার মুছে ফেলা হয়েছে।`);
            setSelected(new Set());
            setConfirmBulkDelete(false);
            load();
          })
        }
      />
    </div>
  );
}

function PosterDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useAdminToast();
  const [poster, setPoster] = useState<AdminPoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPoster(await fetchAdminPoster(id));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: PosterStatus) {
    setBusy(true);
    try {
      await setAdminPosterStatus(id, status);
      toast.success(`স্ট্যাটাস "${STATUS_LABELS[status]}" এ পরিবর্তন হয়েছে।`);
      load();
      onChanged();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="পোস্টারের বিস্তারিত" onClose={onClose} size="lg">
      {error && <ErrorState message={error} onRetry={load} />}
      {!poster && !error && <LoadingState />}

      {poster && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {poster.generatedImageUrl && (
              <Image
                src={poster.generatedImageUrl}
                alt={poster.formData.headlineText}
                width={200}
                height={260}
                className="rounded-lg border border-gray-200"
                unoptimized
              />
            )}
            <div className="min-w-0 flex-1 space-y-1.5 text-sm">
              <p className="text-base font-semibold text-gray-900">{poster.formData.headlineText}</p>
              <p className="text-gray-600">নাম: {poster.formData.name}</p>
              {poster.formData.designation && (
                <p className="text-gray-500">পদবি: {poster.formData.designation}</p>
              )}
              {poster.formData.party && <p className="text-gray-500">দল: {poster.formData.party}</p>}
              <p className="text-gray-500">
                ব্যবহারকারী: {ownerOf(poster).name} ({ownerOf(poster).email})
              </p>
              <p className="text-gray-500">টেমপ্লেট: {templateTitle(poster)}</p>
              <p className="text-xs text-gray-400">
                তৈরি: {formatDate(poster.createdAt)} · আপডেট: {formatDate(poster.updatedAt)}
              </p>
              {poster.errorMessage && (
                <p className="rounded bg-red-50 p-2 text-xs text-red-700">{poster.errorMessage}</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">স্ট্যাটাস পরিবর্তন</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  variant={poster.status === key ? "primary" : "secondary"}
                  disabled={busy || poster.status === key}
                  onClick={() => changeStatus(key as PosterStatus)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {poster.uploadedPhotoUrls.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-700">আপলোড করা ছবি</p>
              <div className="flex flex-wrap gap-2">
                {poster.uploadedPhotoUrls.map((url) => (
                  <Image
                    key={url}
                    src={url}
                    alt="আপলোড"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded object-cover"
                    unoptimized
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">জেনারেশন লগ</p>
            {poster.generationLogs && poster.generationLogs.length > 0 ? (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {poster.generationLogs.map((log) => (
                  <li
                    key={log._id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <span className={log.success ? "text-emerald-700" : "text-red-700"}>
                      {log.success ? "✓ সফল" : "✕ ব্যর্থ"}
                    </span>
                    <span className="text-gray-500">
                      {log.latencyMs ?? "-"} ms · {log.tokensUsed ?? "-"} টোকেন
                    </span>
                    <span className="text-gray-400">{formatDate(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-center text-xs text-gray-400">কোনো লগ নেই</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
