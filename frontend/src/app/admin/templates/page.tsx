"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminTemplates,
  createAdminTemplate,
  updateAdminTemplate,
  toggleAdminTemplate,
  duplicateAdminTemplate,
  deleteAdminTemplate,
  bulkTemplateAction,
  AdminTemplate,
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
  Field,
  Input,
  LoadingState,
  Modal,
  Panel,
  Select,
  TableWrap,
  Td,
  Th,
  formatDate,
  useDebounced,
} from "@/components/admin/ui";

type TemplateDraft = {
  title: string;
  occasionType: OccasionType;
  thumbnailUrl: string;
  htmlTemplatePath: string;
  isActive: boolean;
};

const EMPTY_DRAFT: TemplateDraft = {
  title: "",
  occasionType: "victory_day",
  thumbnailUrl: "",
  htmlTemplatePath: "",
  isActive: true,
};

export default function AdminTemplatesPage() {
  const toast = useAdminToast();

  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [occasion, setOccasion] = useState<OccasionType | "">("");
  const [isActive, setIsActive] = useState<"true" | "false" | "">("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplates(
        await fetchAdminTemplates({
          search: debouncedSearch || undefined,
          occasion: occasion || undefined,
          isActive: isActive || undefined,
        })
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, occasion, isActive]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = useMemo(
    () => templates.length > 0 && templates.every((t) => selected.has(t._id)),
    [templates, selected]
  );

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(templates.map((t) => t._id)));
  }

  async function runBulk(action: "activate" | "deactivate" | "delete") {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const result = await bulkTemplateAction(action, Array.from(selected));
      toast.success(`${result.affected} টি টেমপ্লেট আপডেট হয়েছে।`);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">টেমপ্লেট ব্যবস্থাপনা</h1>
          <p className="text-sm text-gray-500">
            পোস্টার লেআউট সক্রিয়/নিষ্ক্রিয় করা, কপি তৈরি ও মুছে ফেলা
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing({ ...EMPTY_DRAFT });
            setEditingId(null);
          }}
        >
          + নতুন টেমপ্লেট
        </Button>
      </div>

      <Panel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="টেমপ্লেটের নাম খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
          <Select
            value={isActive}
            onChange={(e) => setIsActive(e.target.value as "true" | "false" | "")}
            aria-label="অবস্থা"
          >
            <option value="">সব অবস্থা</option>
            <option value="true">সক্রিয়</option>
            <option value="false">নিষ্ক্রিয়</option>
          </Select>
          <Button onClick={load} loading={loading} variant="secondary">
            রিফ্রেশ
          </Button>
        </div>
      </Panel>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-flagGreen/30 bg-flagGreen/5 px-4 py-3">
          <span className="text-sm font-medium text-flagGreen">{selected.size} টি নির্বাচিত</span>
          <Button disabled={busy} onClick={() => runBulk("activate")}>
            সক্রিয় করুন
          </Button>
          <Button disabled={busy} onClick={() => runBulk("deactivate")}>
            নিষ্ক্রিয় করুন
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => runBulk("delete")}>
            মুছে ফেলুন
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
        {loading && templates.length === 0 ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : templates.length === 0 ? (
          <EmptyState title="কোনো টেমপ্লেট পাওয়া যায়নি" hint="নতুন টেমপ্লেট যোগ করুন বা ফিল্টার বদলান।" />
        ) : (
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
                <Th>টেমপ্লেট</Th>
                <Th>উপলক্ষ</Th>
                <Th>ফাইল</Th>
                <Th className="text-right">ব্যবহার</Th>
                <Th>অবস্থা</Th>
                <Th>তৈরি</Th>
                <Th className="text-right">কাজ</Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.has(t._id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(t._id)) next.delete(t._id);
                          else next.add(t._id);
                          return next;
                        })
                      }
                      aria-label={`${t.title} নির্বাচন করুন`}
                    />
                  </Td>
                  <Td className="font-medium text-gray-900">{t.title}</Td>
                  <Td className="text-xs">{OCCASION_LABELS[t.occasionType]}</Td>
                  <Td>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                      {t.htmlTemplatePath}
                    </code>
                    {!t.fileExists && (
                      <p className="mt-1">
                        <Badge tone="red">ফাইল পাওয়া যায়নি</Badge>
                      </p>
                    )}
                  </Td>
                  <Td className="text-right">{t.posterCount}</Td>
                  <Td>
                    {t.isActive ? <Badge tone="green">সক্রিয়</Badge> : <Badge tone="gray">নিষ্ক্রিয়</Badge>}
                  </Td>
                  <Td className="text-xs text-gray-500">{formatDate(t.createdAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        onClick={() => {
                          setEditing({
                            title: t.title,
                            occasionType: t.occasionType,
                            thumbnailUrl: t.thumbnailUrl,
                            htmlTemplatePath: t.htmlTemplatePath,
                            isActive: t.isActive,
                          });
                          setEditingId(t._id);
                        }}
                      >
                        সম্পাদনা
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await toggleAdminTemplate(t._id);
                            toast.success(t.isActive ? "টেমপ্লেট নিষ্ক্রিয় করা হয়েছে।" : "টেমপ্লেট সক্রিয় করা হয়েছে।");
                            load();
                          } catch (err) {
                            toast.error(extractErrorMessage(err));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t.isActive ? "নিষ্ক্রিয়" : "সক্রিয়"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await duplicateAdminTemplate(t._id);
                            toast.success("টেমপ্লেটের কপি তৈরি হয়েছে (নিষ্ক্রিয় অবস্থায়)।");
                            load();
                          } catch (err) {
                            toast.error(extractErrorMessage(err));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        কপি
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs text-flagRed"
                        onClick={() => setDeleteTarget(t)}
                      >
                        মুছুন
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      {editing && (
        <TemplateFormModal
          draft={editing}
          id={editingId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="টেমপ্লেট মুছে ফেলা হবে"
        destructive
        confirmLabel="মুছে ফেলুন"
        loading={busy}
        message={`"${deleteTarget?.title}" — টেমপ্লেটটি মুছে যাবে। কোনো পোস্টার এটি ব্যবহার করে থাকলে সার্ভার মুছে দেবে না।`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setBusy(true);
          try {
            await deleteAdminTemplate(deleteTarget._id);
            toast.success("টেমপ্লেট মুছে ফেলা হয়েছে।");
            setDeleteTarget(null);
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

function TemplateFormModal({
  draft,
  id,
  onClose,
  onSaved,
}: {
  draft: TemplateDraft;
  id: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useAdminToast();
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);

  const valid =
    form.title.trim().length > 0 &&
    form.thumbnailUrl.trim().length > 0 &&
    form.htmlTemplatePath.trim().length > 0;

  async function save() {
    setBusy(true);
    try {
      if (id) {
        await updateAdminTemplate(id, form);
        toast.success("টেমপ্লেট হালনাগাদ হয়েছে।");
      } else {
        await createAdminTemplate(form);
        toast.success("নতুন টেমপ্লেট তৈরি হয়েছে।");
      }
      onSaved();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={id ? "টেমপ্লেট সম্পাদনা" : "নতুন টেমপ্লেট"}
      description="HTML ফাইলটি সার্ভারের templates ফোল্ডারে থাকতে হবে"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            বাতিল
          </Button>
          <Button variant="primary" loading={busy} disabled={!valid} onClick={save}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="টেমপ্লেটের নাম">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>
        <Field label="উপলক্ষ">
          <Select
            value={form.occasionType}
            onChange={(e) => setForm({ ...form, occasionType: e.target.value as OccasionType })}
          >
            {Object.entries(OCCASION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="HTML ফাইলের নাম" hint="যেমন: victory-day.html (পাথ ছাড়া)">
          <Input
            value={form.htmlTemplatePath}
            onChange={(e) => setForm({ ...form, htmlTemplatePath: e.target.value })}
            placeholder="victory-day.html"
          />
        </Field>
        <Field label="থাম্বনেইল URL">
          <Input
            value={form.thumbnailUrl}
            onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
            placeholder="/templates/thumbnails/victory_day.png"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          সক্রিয় (ব্যবহারকারীরা এটি দেখতে পাবেন)
        </label>
      </div>
    </Modal>
  );
}
