import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { EntriesFilterBar } from "@/components/features/admin/entries-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { acceptanceStatusClasses, acceptanceStatusLabel, paymentStatusClasses, paymentStatusLabel } from "@/lib/admin-status";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { adminEntriesService } from "@/services/admin-entries.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { AdminDeletedEntryListItem, AdminEntriesFilter, ListMeta } from "@/types/admin";

const PAGE_SIZE = 25;

const initialFilter: AdminEntriesFilter = {
  query: "",
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  checkinIdVerified: "all"
};

const EMPTY_META: ListMeta = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  hasMore: false,
  nextCursor: null
};

const ACCEPTANCE_VALUES: AdminEntriesFilter["acceptanceStatus"][] = ["all", "pending", "shortlist", "accepted", "rejected"];
const PAYMENT_VALUES: AdminEntriesFilter["paymentStatus"][] = ["all", "due", "paid"];
const CHECKIN_VALUES: AdminEntriesFilter["checkinIdVerified"][] = ["all", "true", "false"];

function hasValue<T extends string>(value: string | null, values: readonly T[]): value is T {
  return value !== null && (values as readonly string[]).includes(value);
}

function filterFromSearchParams(searchParams: URLSearchParams): AdminEntriesFilter {
  const classId = searchParams.get("class");
  const query = searchParams.get("q");
  const acceptanceStatus = searchParams.get("status");
  const paymentStatus = searchParams.get("payment");
  const checkin = searchParams.get("checkin");

  return {
    query: query ?? "",
    classId: classId && classId.trim() ? classId : "all",
    acceptanceStatus: hasValue(acceptanceStatus, ACCEPTANCE_VALUES) ? acceptanceStatus : "all",
    paymentStatus: hasValue(paymentStatus, PAYMENT_VALUES) ? paymentStatus : "all",
    checkinIdVerified: hasValue(checkin, CHECKIN_VALUES) ? checkin : "all"
  };
}

function searchParamsFromFilter(filter: AdminEntriesFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.query.trim()) {
    params.set("q", filter.query);
  }
  if (filter.classId !== "all") {
    params.set("class", filter.classId);
  }
  if (filter.acceptanceStatus !== "all") {
    params.set("status", filter.acceptanceStatus);
  }
  if (filter.paymentStatus !== "all") {
    params.set("payment", filter.paymentStatus);
  }
  if (filter.checkinIdVerified !== "all") {
    params.set("checkin", filter.checkinIdVerified);
  }
  return params;
}

function sameFilter(a: AdminEntriesFilter, b: AdminEntriesFilter) {
  return (
    a.query === b.query &&
    a.classId === b.classId &&
    a.acceptanceStatus === b.acceptanceStatus &&
    a.paymentStatus === b.paymentStatus &&
    a.checkinIdVerified === b.checkinIdVerified
  );
}

export function AdminDeletedEntriesPage() {
  const { roles } = useAuth();
  const canDeleteEntries = hasPermission(roles, "entries.delete");
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterDraft, setFilterDraft] = useState<AdminEntriesFilter>(() => filterFromSearchParams(searchParams));
  const debouncedQuery = useDebouncedValue(filterDraft.query, 450);
  const appliedFilter = useMemo<AdminEntriesFilter>(
    () => ({
      query: debouncedQuery,
      classId: filterDraft.classId,
      acceptanceStatus: filterDraft.acceptanceStatus,
      paymentStatus: filterDraft.paymentStatus,
      checkinIdVerified: filterDraft.checkinIdVerified
    }),
    [debouncedQuery, filterDraft.classId, filterDraft.acceptanceStatus, filterDraft.paymentStatus, filterDraft.checkinIdVerified]
  );

  const [rows, setRows] = useState<AdminDeletedEntryListItem[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_META);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRestoreEntryId, setPendingRestoreEntryId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2600);
  }, []);

  const loadFirstPage = useCallback(
    async (filter: AdminEntriesFilter, options?: { showLoader?: boolean; showRefreshing?: boolean }) => {
      if (options?.showLoader) {
        setLoadingInitial(true);
      }
      if (options?.showRefreshing) {
        setRefreshing(true);
      }

      try {
        const page = await adminEntriesService.listDeletedEntriesPage(filter, { limit: PAGE_SIZE });
        setRows(page.entries);
        setMeta(page.meta);
      } catch (error) {
        showToast(getApiErrorMessage(error, "Gelöschte Nennungen konnten nicht geladen werden."));
      } finally {
        setLoadingInitial(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  const loadMore = useCallback(async () => {
    if (loadingInitial || loadingMore || !meta.hasMore || !meta.nextCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await adminEntriesService.listDeletedEntriesPage(appliedFilter, {
        cursor: meta.nextCursor,
        limit: PAGE_SIZE
      });
      setRows((prev) => {
        const known = new Set(prev.map((row) => row.id));
        const merged = [...prev];
        page.entries.forEach((entry) => {
          if (!known.has(entry.id)) {
            known.add(entry.id);
            merged.push(entry);
          }
        });
        return merged;
      });
      setMeta(page.meta);
    } catch (error) {
      showToast(getApiErrorMessage(error, "Weitere gelöschte Nennungen konnten nicht geladen werden."));
    } finally {
      setLoadingMore(false);
    }
  }, [appliedFilter, loadingInitial, loadingMore, meta.hasMore, meta.nextCursor, showToast]);

  useEffect(() => {
    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));
  }, [showToast]);

  useEffect(() => {
    const nextFilter = filterFromSearchParams(searchParams);
    setFilterDraft((prev) => (sameFilter(prev, nextFilter) ? prev : nextFilter));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = searchParamsFromFilter(appliedFilter);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [appliedFilter, searchParams, setSearchParams]);

  useEffect(() => {
    setRows([]);
    setMeta(EMPTY_META);
    void loadFirstPage(appliedFilter, { showLoader: true });
  }, [appliedFilter, loadFirstPage]);

  const activeFilterChips = [
    filterDraft.query && { key: "query", label: `Suche: ${filterDraft.query}` },
    filterDraft.classId !== "all" && {
      key: "classId",
      label: `Klasse: ${classOptions.find((item) => item.id === filterDraft.classId)?.name ?? filterDraft.classId}`
    },
    filterDraft.acceptanceStatus !== "all" && { key: "acceptanceStatus", label: `Status: ${acceptanceStatusLabel(filterDraft.acceptanceStatus)}` },
    filterDraft.paymentStatus !== "all" && { key: "paymentStatus", label: `Zahlung: ${paymentStatusLabel(filterDraft.paymentStatus)}` },
    filterDraft.checkinIdVerified !== "all" && {
      key: "checkinIdVerified",
      label: `Einchecken: ${filterDraft.checkinIdVerified === "true" ? "Ja" : "Nein"}`
    }
  ].filter(Boolean) as Array<{ key: keyof AdminEntriesFilter; label: string }>;

  const removeFilterChip = (key: keyof AdminEntriesFilter) => {
    setFilterDraft((prev) => ({
      ...prev,
      [key]: initialFilter[key]
    }));
  };

  const loadedCountText =
    meta.total > 0
      ? `${meta.total} gelöschte Nennungen${rows.length < meta.total ? ` · ${rows.length} geladen` : ""}${refreshing ? " · aktualisiere…" : ""}`
      : `${rows.length} gelöschte Nennungen${loadingInitial ? " · lädt…" : ""}`;

  if (!canDeleteEntries) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Nur Admin-Rollen dürfen gelöschte Nennungen einsehen.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Gelöschte Nennungen</h1>
        <Button asChild type="button" size="sm" variant="outline">
          <Link to="/admin/entries">Zurück zu Nennungen</Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <EntriesFilterBar
          filter={filterDraft}
          classOptions={classOptions}
          onChange={(field, value) => setFilterDraft((prev) => ({ ...prev, [field]: value }))}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">{loadedCountText}</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void loadFirstPage(appliedFilter, { showRefreshing: true })}>
              {refreshing ? "Aktualisiere…" : "Aktualisieren"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setFilterDraft(initialFilter)}>
              Filter zurücksetzen
            </Button>
          </div>
        </div>
        {activeFilterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button key={chip.key} type="button" onClick={() => removeFilterChip(chip.key)}>
                <Badge variant="outline">{chip.label} ×</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {!rows.length ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">
          {loadingInitial ? "Gelöschte Nennungen werden geladen…" : "Keine gelöschten Nennungen für die aktuelle Filterung."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nennung</th>
                  <th className="px-3 py-2 font-semibold">Klasse</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Zahlung</th>
                  <th className="px-3 py-2 font-semibold">Gelöscht am</th>
                  <th className="px-3 py-2 font-semibold">Gelöscht von</th>
                  <th className="px-3 py-2 font-semibold">Grund</th>
                  <th className="px-3 py-2 font-semibold">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">#{row.startNumber} · {row.vehicleLabel}</div>
                    </td>
                    <td className="px-3 py-2">{row.classLabel}</td>
                    <td className="px-3 py-2">
                      <Badge className={acceptanceStatusClasses(row.status)} variant="outline">
                        {acceptanceStatusLabel(row.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={paymentStatusClasses(row.payment)} variant="outline">
                        {paymentStatusLabel(row.payment)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.deletedAt}</td>
                    <td className="px-3 py-2 text-slate-700">{row.deletedBy}</td>
                    <td className="px-3 py-2 text-slate-700">{row.deleteReason}</td>
                    <td className="px-3 py-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setPendingRestoreEntryId(row.id)}>
                        Wiederherstellen
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(meta.hasMore || loadingMore) && (
        <div className="flex justify-center">
          <Button type="button" size="sm" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Lade weitere gelöschte Nennungen…" : "Weitere gelöschte Nennungen laden"}
          </Button>
        </div>
      )}

      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {toastMessage}
        </div>
      )}

      {pendingRestoreEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Nennung wiederherstellen?</h2>
            <p className="mt-2 text-sm text-slate-600">Die Nennung wird wieder in die normale Nennungs-Liste aufgenommen.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingRestoreEntryId(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const entryId = pendingRestoreEntryId;
                  if (!entryId) {
                    return;
                  }
                  setPendingRestoreEntryId(null);
                  try {
                    await adminEntriesService.restoreEntry(entryId);
                    setRows((prev) => prev.filter((item) => item.id !== entryId));
                    setMeta((prev) => ({
                      ...prev,
                      total: Math.max(0, prev.total - 1)
                    }));
                    showToast(`Nennung ${entryId} wurde wiederhergestellt.`);
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Nennung konnte nicht wiederhergestellt werden."));
                  }
                }}
              >
                Ja, wiederherstellen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
