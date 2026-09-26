"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminUsers,
  fetchAdminUser,
  updateAdminUser,
  setAdminUserRole,
  setAdminUserStatus,
  resetAdminUserPassword,
  deleteAdminUser,
  bulkUserAction,
  AdminUser,
  AdminUserDetail,
  Paginated,
  UserRole,
} from "@/lib/adminApi";
import { extractErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";
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
  Pagination,
  Select,
  TableWrap,
  Td,
  Th,
  formatDate,
  statusTone,
  useDebounced,
} from "@/components/admin/ui";

const SORTS = [
  { value: "createdAt:desc", label: "নতুন আগে" },
  { value: "createdAt:asc", label: "পুরনো আগে" },
  { value: "name:asc", label: "নাম (ক-হ)" },
  { value: "lastLoginAt:desc", label: "সর্বশেষ লগইন" },
];

type BulkAction = "activate" | "suspend" | "make_admin" | "make_user" | "delete";

const BULK_LABELS: Record<BulkAction, string> = {
  activate: "সক্রিয় করুন",
  suspend: "স্থগিত করুন",
  make_admin: "অ্যাডমিন করুন",
  make_user: "সাধারণ ব্যবহারকারী করুন",
  delete: "মুছে ফেলুন",
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useAdminToast();

  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [status, setStatus] = useState<"active" | "suspended" | "">("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, status, sort, limit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        role: role || undefined,
        status: status || undefined,
        sort,
      });
      setData(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, role, status, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = useMemo(
    () => !!data && data.items.length > 0 && data.items.every((u) => selected.has(u._id)),
    [data, selected]
  );

  function toggleAll() {
    if (!data) return;
    setSelected(allSelected ? new Set() : new Set(data.items.map((u) => u._id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: BulkAction) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const result = await bulkUserAction(action, Array.from(selected));
      if (result.affected > 0) toast.success(`${result.affected} জন ব্যবহারকারীর কাজ সম্পন্ন হয়েছে।`);
      if (result.skipped && result.skipped.length > 0) {
        toast.info(`${result.skipped.length} টি এড়িয়ে গেছে (নিজের অ্যাকাউন্ট বা শেষ অ্যাডমিন)।`);
      }
      setSelected(new Set());
      setBulkAction(null);
      load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ব্যবহারকারী ব্যবস্থাপনা</h1>
        <p className="text-sm text-gray-500">
          অ্যাকাউন্ট তৈরি, সম্পাদনা, স্থগিতকরণ, পাসওয়ার্ড রিসেট ও মুছে ফেলা
        </p>
      </div>

      <Panel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="নাম, ইমেইল বা ফোন খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole | "")}
            aria-label="রোল"
          >
            <option value="">সব রোল</option>
            <option value="user">ব্যবহারকারী</option>
            <option value="admin">অ্যাডমিন</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "suspended" | "")}
            aria-label="অবস্থা"
          >
            <option value="">সব অবস্থা</option>
            <option value="active">সক্রিয়</option>
            <option value="suspended">স্থগিত</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="সাজান">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button onClick={load} loading={loading} variant="secondary">
            রিফ্রেশ
          </Button>
        </div>
      </Panel>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-flagGreen/30 bg-flagGreen/5 px-4 py-3">
          <span className="text-sm font-medium text-flagGreen">{selected.size} টি নির্বাচিত</span>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(BULK_LABELS) as BulkAction[])
              .filter((a) => a !== "delete")
              .map((action) => (
                <Button key={action} onClick={() => runBulk(action)} disabled={busy}>
                  {BULK_LABELS[action]}
                </Button>
              ))}
            <Button variant="danger" onClick={() => setBulkAction("delete")}>
              {BULK_LABELS.delete}
            </Button>
          </div>
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
          <EmptyState title="কোনো ব্যবহারকারী পাওয়া যায়নি" hint="সার্চ বা ফিল্টার পরিবর্তন করে দেখুন।" />
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
                  <Th>ব্যবহারকারী</Th>
                  <Th>যোগাযোগ</Th>
                  <Th>রোল</Th>
                  <Th>অবস্থা</Th>
                  <Th className="text-right">পোস্টার</Th>
                  <Th>সর্বশেষ লগইন</Th>
                  <Th>যোগদান</Th>
                  <Th className="text-right">কাজ</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => {
                  const isSelf = u._id === currentUser?._id;
                  return (
                    <tr key={u._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <Td>
                        <input
                          type="checkbox"
                          checked={selected.has(u._id)}
                          onChange={() => toggleOne(u._id)}
                          aria-label={`${u.name} নির্বাচন করুন`}
                        />
                      </Td>
                      <Td>
                        <button
                          onClick={() => setDetailId(u._id)}
                          className="text-left font-medium text-gray-900 hover:text-flagGreen hover:underline"
                        >
                          {u.name}
                        </button>{" "}
                        {isSelf && <Badge tone="blue">আপনি</Badge>}
                        <p className="text-[11px] text-gray-400">{u.loginCount} বার লগইন</p>
                      </Td>
                      <Td>
                        <p className="text-gray-700">{u.email}</p>
                        <p className="text-[11px] text-gray-400">{u.phone}</p>
                      </Td>
                      <Td>
                        {u.role === "admin" ? <Badge tone="green">অ্যাডমিন</Badge> : <Badge>ব্যবহারকারী</Badge>}
                      </Td>
                      <Td>
                        {u.isActive ? <Badge tone="green">সক্রিয়</Badge> : <Badge tone="red">স্থগিত</Badge>}
                      </Td>
                      <Td className="text-right">{u.posterCount}</Td>
                      <Td className="text-xs text-gray-500">{formatDate(u.lastLoginAt)}</Td>
                      <Td className="text-xs text-gray-500">{formatDate(u.createdAt)}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                            onClick={() => setEditTarget(u)}
                          >
                            সম্পাদনা
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                            onClick={() => setPasswordTarget(u)}
                          >
                            পাসওয়ার্ড
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                            disabled={isSelf}
                            onClick={async () => {
                              try {
                                await setAdminUserStatus(u._id, !u.isActive);
                                toast.success(
                                  u.isActive ? "অ্যাকাউন্ট স্থগিত করা হয়েছে।" : "অ্যাকাউন্ট সক্রিয় করা হয়েছে।"
                                );
                                load();
                              } catch (err) {
                                toast.error(extractErrorMessage(err));
                              }
                            }}
                          >
                            {u.isActive ? "স্থগিত" : "সক্রিয়"}
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs text-flagRed"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(u)}
                          >
                            মুছুন
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
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
        <UserDetailModal
          id={detailId}
          isSelf={detailId === currentUser?._id}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}
      {passwordTarget && (
        <PasswordModal
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() => {
            setPasswordTarget(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="ব্যবহারকারী মুছে ফেলা হবে"
        destructive
        confirmLabel="মুছে ফেলুন"
        loading={busy}
        message={
          <>
            <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) অ্যাকাউন্টটি মুছে যাবে, সাথে তার সব পোস্টার
            ও লগ। এ কাজটি ফেরানো যাবে না।
          </>
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setBusy(true);
          try {
            await deleteAdminUser(deleteTarget._id);
            toast.success("ব্যবহারকারী মুছে ফেলা হয়েছে।");
            setDeleteTarget(null);
            load();
          } catch (err) {
            toast.error(extractErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={bulkAction === "delete"}
        title="নির্বাচিত ব্যবহারকারীদের মুছে ফেলা হবে"
        destructive
        confirmLabel="মুছে ফেলুন"
        loading={busy}
        message={`${selected.size} টি অ্যাকাউন্ট তাদের সব পোস্টারসহ মুছে যাবে। নিজের অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে বাদ পড়বে।`}
        onCancel={() => setBulkAction(null)}
        onConfirm={() => runBulk("delete")}
      />
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useAdminToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateAdminUser(user._id, { name, email, phone });
      toast.success("তথ্য হালনাগাদ হয়েছে।");
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
      title="ব্যবহারকারীর তথ্য সম্পাদনা"
      description={user.email}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            বাতিল
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="নাম">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="ইমেইল" hint="ইমেইল পরিবর্তন করলে লগইনও নতুন ইমেইলে করতে হবে">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="ফোন">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function PasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useAdminToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  async function save() {
    if (mismatch || tooShort) return;
    setBusy(true);
    try {
      await resetAdminUserPassword(user._id, password);
      toast.success("পাসওয়ার্ড পরিবর্তন করা হয়েছে।");
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
      title="পাসওয়ার্ড রিসেট"
      description={`${user.name} (${user.email}) — নতুন পাসওয়ার্ডটি তাকে জানিয়ে দিন`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            বাতিল
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={mismatch || tooShort || password.length === 0}
            onClick={save}
          >
            পরিবর্তন করুন
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="নতুন পাসওয়ার্ড" hint="সর্বনিম্ন ৮ অক্ষর">
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="নতুন পাসওয়ার্ড আবার লিখুন">
          <Input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {tooShort && <p className="text-xs text-red-600">পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।</p>}
        {mismatch && <p className="text-xs text-red-600">দুটি পাসওয়ার্ড মিলছে না।</p>}
      </div>
    </Modal>
  );
}

function UserDetailModal({
  id,
  isSelf,
  onClose,
  onChanged,
}: {
  id: string;
  isSelf: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useAdminToast();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await fetchAdminUser(id));
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(role: "user" | "admin") {
    setBusy(true);
    try {
      await setAdminUserRole(id, role);
      toast.success(role === "admin" ? "অ্যাডমিন করা হয়েছে।" : "সাধারণ ব্যবহারকারী করা হয়েছে।");
      load();
      onChanged();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="ব্যবহারকারীর বিস্তারিত" onClose={onClose} size="lg">
      {error && <ErrorState message={error} onRetry={load} />}
      {!detail && !error && <LoadingState />}

      {detail && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="নাম" value={detail.name} />
            <InfoRow label="ইমেইল" value={detail.email} />
            <InfoRow label="ফোন" value={detail.phone} />
            <InfoRow
              label="অবস্থা"
              value={detail.isActive ? "সক্রিয়" : "স্থগিত"}
            />
            <InfoRow label="মোট পোস্টার" value={String(detail.posterCount)} />
            <InfoRow label="লগইন সংখ্যা" value={String(detail.loginCount)} />
            <InfoRow label="সর্বশেষ লগইন" value={formatDate(detail.lastLoginAt)} />
            <InfoRow label="যোগদানের তারিখ" value={formatDate(detail.createdAt)} />
          </div>

          <div className="rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-700">রোল পরিবর্তন</p>
            <div className="flex gap-2">
              <Button
                variant={detail.role === "admin" ? "primary" : "secondary"}
                disabled={busy || isSelf || detail.role === "admin"}
                onClick={() => changeRole("admin")}
              >
                অ্যাডমিন
              </Button>
              <Button
                variant={detail.role === "user" ? "primary" : "secondary"}
                disabled={busy || isSelf || detail.role === "user"}
                onClick={() => changeRole("user")}
              >
                সাধারণ ব্যবহারকারী
              </Button>
            </div>
            {isSelf && (
              <p className="mt-2 text-[11px] text-amber-700">
                নিজের রোল পরিবর্তন করা যাবে না — এতে লগ-আউট হয়ে যেতে পারে।
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">সাম্প্রতিক পোস্টার</p>
            {detail.recentPosters.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">কোনো পোস্টার নেই</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {detail.recentPosters.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800">{p.formData.headlineText}</p>
                      <p className="text-[11px] text-gray-400">{formatDate(p.createdAt)}</p>
                    </div>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}
