import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { EntriesFilterBar } from "@/components/features/admin/entries-filter-bar";
import { EntriesTable } from "@/components/features/admin/entries-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { acceptanceStatusLabel, paymentStatusLabel } from "@/lib/admin-status";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { adminEntriesService } from "@/services/admin-entries.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { AdminEntriesFilter, AdminEntryListItem, ListMeta } from "@/types/admin";

const PAGE_SIZE = 25;
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = "admin.entries.page.cache.v1";

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

type EntriesCachePayload = {
  savedAt: number;
  filter: AdminEntriesFilter;
  rows: AdminEntryListItem[];
  meta: ListMeta;
};

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

function mergeRowsById(existing: AdminEntryListItem[], incoming: AdminEntryListItem[]) {
  if (!incoming.length) {
    return existing;
  }

  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  incoming.forEach((item) => {
    if (seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    merged.push(item);
  });
  return merged;
}

function rowMatchesFilter(row: AdminEntryListItem, filter: AdminEntriesFilter, classNameById: Map<string, string>) {
  if (filter.classId !== "all") {
    if (row.classId && row.classId !== filter.classId) {
      return false;
    }
    if (!row.classId) {
      const className = classNameById.get(filter.classId);
      if (className && className !== row.classLabel) {
        return false;
      }
    }
  }

  if (filter.acceptanceStatus !== "all" && row.status !== filter.acceptanceStatus) {
    return false;
  }

  if (filter.paymentStatus !== "all" && row.payment !== filter.paymentStatus) {
    return false;
  }

  if (filter.checkinIdVerified !== "all") {
    const checkinAsString = row.checkin === "bestätigt" ? "true" : "false";
    if (checkinAsString !== filter.checkinIdVerified) {
      return false;
    }
  }

  const query = filter.query.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return row.name.toLowerCase().includes(query) || row.startNumber.toLowerCase().includes(query) || row.vehicleLabel.toLowerCase().includes(query);
}

function readEntriesCache(filter: AdminEntriesFilter): EntriesCachePayload | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<EntriesCachePayload>;
    if (!parsed || typeof parsed.savedAt !== "number" || !parsed.filter || !parsed.meta || !Array.isArray(parsed.rows)) {
      return null;
    }
    if (!sameFilter(parsed.filter as AdminEntriesFilter, filter)) {
      return null;
    }
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      filter: parsed.filter as AdminEntriesFilter,
      rows: parsed.rows as AdminEntryListItem[],
      meta: parsed.meta as ListMeta
    };
  } catch {
    return null;
  }
}

function writeEntriesCache(filter: AdminEntriesFilter, rows: AdminEntryListItem[], meta: ListMeta) {
  const payload: EntriesCachePayload = {
    savedAt: Date.now(),
    filter,
    rows,
    meta
  };
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

export function AdminEntriesPage() {
  const { roles } = useAuth();
  const canManageStatus = hasPermission(roles, "entries.status.write");
  const canDeleteEntries = hasPermission(roles, "entries.delete");
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilterRef = useRef<AdminEntriesFilter>(filterFromSearchParams(searchParams));
  const [filterDraft, setFilterDraft] = useState<AdminEntriesFilter>(initialFilterRef.current);

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

  const [rows, setRows] = useState<AdminEntryListItem[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_META);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAcceptEntryId, setPendingAcceptEntryId] = useState<string | null>(null);
  const [pendingRejectEntryId, setPendingRejectEntryId] = useState<string | null>(null);
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);

  const rowsRef = useRef<AdminEntryListItem[]>([]);
  const activeRequestRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);
  const firstFilterLoadRef = useRef(true);

  const classNameById = useMemo(() => {
    return new Map(classOptions.map((item) => [item.id, item.name]));
  }, [classOptions]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const beginRequest = () => {
    activeRequestRef.current += 1;
    return activeRequestRef.current;
  };

  const isRequestActive = (requestId: number) => requestId === activeRequestRef.current;

  const fetchSnapshot = useCallback(
    async (filter: AdminEntriesFilter, minimumRows: number, requestId: number): Promise<{ rows: AdminEntryListItem[]; meta: ListMeta } | null> => {
      const targetSize = Math.max(minimumRows, PAGE_SIZE);
      let nextCursor: string | undefined;
      let mergedRows: AdminEntryListItem[] = [];
      let latestMeta = EMPTY_META;

      while (true) {
        const page = await adminEntriesService.listEntriesPage(filter, {
          cursor: nextCursor,
          limit: PAGE_SIZE
        });

        if (!isRequestActive(requestId)) {
          return null;
        }

        mergedRows = mergeRowsById(mergedRows, page.entries);
        latestMeta = page.meta;

        if (!page.meta.hasMore || !page.meta.nextCursor) {
          break;
        }

        if (mergedRows.length >= targetSize) {
          break;
        }

        nextCursor = page.meta.nextCursor;
      }

      return {
        rows: mergedRows,
        meta: latestMeta
      };
    },
    []
  );

  const replaceRows = useCallback(
    async (filter: AdminEntriesFilter, options?: { minimumRows?: number; showLoader?: boolean; showRefreshing?: boolean; silentError?: boolean }) => {
      const requestId = beginRequest();
      const minimumRows = options?.minimumRows ?? 0;

      if (options?.showLoader) {
        setLoadingInitial(true);
      }
      if (options?.showRefreshing) {
        setRefreshing(true);
      }
      setLoadingMore(false);

      try {
        const snapshot = await fetchSnapshot(filter, minimumRows, requestId);
        if (!snapshot || !isRequestActive(requestId)) {
          return;
        }

        setRows(snapshot.rows);
        setMeta(snapshot.meta);
        writeEntriesCache(filter, snapshot.rows, snapshot.meta);
      } catch (error) {
        if (!isRequestActive(requestId)) {
          return;
        }
        if (!options?.silentError) {
          showToast(getApiErrorMessage(error, "Nennungen konnten nicht geladen werden."));
        }
      } finally {
        if (!isRequestActive(requestId)) {
          return;
        }
        setLoadingInitial(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fetchSnapshot]
  );

  const loadMore = useCallback(async () => {
    if (loadingInitial || loadingMore || refreshing || !meta.hasMore || !meta.nextCursor) {
      return;
    }

    const requestId = beginRequest();
    setLoadingMore(true);

    try {
      const page = await adminEntriesService.listEntriesPage(appliedFilter, {
        cursor: meta.nextCursor,
        limit: PAGE_SIZE
      });

      if (!isRequestActive(requestId)) {
        return;
      }

      setRows((prev) => {
        const merged = mergeRowsById(prev, page.entries);
        writeEntriesCache(appliedFilter, merged, page.meta);
        return merged;
      });
      setMeta(page.meta);
    } catch (error) {
      if (!isRequestActive(requestId)) {
        return;
      }
      showToast(getApiErrorMessage(error, "Weitere Nennungen konnten nicht geladen werden."));
    } finally {
      if (!isRequestActive(requestId)) {
        return;
      }
      setLoadingMore(false);
    }
  }, [appliedFilter, loadingInitial, loadingMore, meta.hasMore, meta.nextCursor, refreshing]);

  const refreshSnapshot = useCallback(
    async (manual: boolean) => {
      await replaceRows(appliedFilter, {
        minimumRows: rowsRef.current.length,
        showLoader: manual && rowsRef.current.length === 0,
        showRefreshing: manual,
        silentError: !manual
      });
    },
    [appliedFilter, replaceRows]
  );

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const cached = readEntriesCache(initialFilterRef.current);
    if (!cached) {
      return;
    }

    hydratedFromCacheRef.current = true;
    setRows(cached.rows);
    setMeta(cached.meta);
    setLoadingInitial(false);
  }, []);

  useEffect(() => {
    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));
  }, []);

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
    const keepCachedRows = firstFilterLoadRef.current && hydratedFromCacheRef.current;
    firstFilterLoadRef.current = false;

    if (!keepCachedRows) {
      setRows([]);
      setMeta((prev) => ({ ...prev, hasMore: false, nextCursor: null }));
    }

    void replaceRows(appliedFilter, {
      minimumRows: keepCachedRows ? rowsRef.current.length : 0,
      showLoader: !keepCachedRows,
      showRefreshing: keepCachedRows,
      silentError: false
    });
  }, [appliedFilter, replaceRows]);

  useEffect(() => {
    if (!loadMoreNode || !meta.hasMore || loadingMore || loadingInitial) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "220px 0px" }
    );

    observer.observe(loadMoreNode);

    return () => {
      observer.disconnect();
    };
  }, [loadMore, loadMoreNode, loadingInitial, loadingMore, meta.hasMore]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void refreshSnapshot(false);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    writeEntriesCache(appliedFilter, rows, meta);
  }, [appliedFilter, meta, rows]);

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

  const applyLocalStatusUpdate = (entryId: string, nextStatus: AdminEntryListItem["status"]) => {
    setRows((prev) => {
      const row = prev.find((item) => item.id === entryId);
      if (!row) {
        return prev;
      }

      const updatedRow: AdminEntryListItem = {
        ...row,
        status: nextStatus
      };

      if (!rowMatchesFilter(updatedRow, appliedFilter, classNameById)) {
        return prev.filter((item) => item.id !== entryId);
      }

      return prev.map((item) => (item.id === entryId ? updatedRow : item));
    });
  };

  const loadedCountText =
    meta.total > 0
      ? `${meta.total} Treffer in aktueller Filterung${rows.length < meta.total ? ` · ${rows.length} geladen` : ""}${refreshing ? " · aktualisiere…" : ""}`
      : `${rows.length} Treffer in aktueller Filterung${loadingInitial ? " · lädt…" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Nennungen</h1>
        {canDeleteEntries && (
          <Button asChild type="button" size="sm" variant="outline">
            <Link to="/admin/entries/deleted">Gelöschte Nennungen</Link>
          </Button>
        )}
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
            <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refreshSnapshot(true)}>
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

      <EntriesTable
        rows={rows}
        canManageStatus={canManageStatus}
        isLoadingInitial={loadingInitial}
        isLoadingMore={loadingMore}
        hasMore={meta.hasMore}
        onLoadMore={() => void loadMore()}
        loadMoreRef={setLoadMoreNode}
        onSetShortlist={async (entryId) => {
          if (!canManageStatus) {
            showToast("Nur Admin-Rollen dürfen den Status ändern.");
            return;
          }
          const row = rows.find((item) => item.id === entryId);
          if (row?.status === "shortlist") {
            showToast("Nennung ist bereits auf Vorauswahl.");
            return;
          }
          try {
            await adminEntriesService.setEntryStatus(entryId, "to_shortlist");
            applyLocalStatusUpdate(entryId, "shortlist");
            showToast(`Nennung ${entryId} wurde auf Vorauswahl gesetzt.`);
          } catch (error) {
            showToast(getApiErrorMessage(error, "Status konnte nicht aktualisiert werden."));
          }
        }}
        onSetAccepted={async (entryId) => {
          if (!canManageStatus) {
            showToast("Nur Admin-Rollen dürfen den Status ändern.");
            return;
          }
          const row = rows.find((item) => item.id === entryId);
          if (row?.status === "accepted") {
            showToast("Nennung ist bereits zugelassen.");
            return;
          }
          setPendingAcceptEntryId(entryId);
        }}
        onSetRejected={async (entryId) => {
          if (!canManageStatus) {
            showToast("Nur Admin-Rollen dürfen den Status ändern.");
            return;
          }
          const row = rows.find((item) => item.id === entryId);
          if (row?.status === "rejected") {
            showToast("Nennung ist bereits abgelehnt.");
            return;
          }
          setPendingRejectEntryId(entryId);
        }}
      />

      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {toastMessage}
        </div>
      )}

      {canManageStatus && pendingAcceptEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Auf „Zugelassen“ setzen?</h2>
            <p className="mt-2 text-sm text-slate-600">Nach der Bestätigung wird automatisch die Zulassungs-Mail an den Fahrer angestoßen.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingAcceptEntryId(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const entryId = pendingAcceptEntryId;
                  if (!entryId) {
                    return;
                  }
                  try {
                    await adminEntriesService.setEntryStatus(entryId, "to_accepted");
                    applyLocalStatusUpdate(entryId, "accepted");
                    showToast(`Nennung ${entryId} wurde zugelassen.`);
                    setPendingAcceptEntryId(null);
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Nennung konnte nicht zugelassen werden."));
                  }
                }}
              >
                Ja, zulassen
              </Button>
            </div>
          </div>
        </div>
      )}

      {canManageStatus && pendingRejectEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Nennung ablehnen?</h2>
            <p className="mt-2 text-sm text-slate-600">Die Nennung wird auf den Status „Abgelehnt“ gesetzt. Das kann später wieder geändert werden.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingRejectEntryId(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const entryId = pendingRejectEntryId;
                  if (!entryId) {
                    return;
                  }
                  try {
                    await adminEntriesService.setEntryStatus(entryId, "to_rejected");
                    applyLocalStatusUpdate(entryId, "rejected");
                    showToast(`Nennung ${entryId} wurde abgelehnt.`);
                    setPendingRejectEntryId(null);
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Nennung konnte nicht abgelehnt werden."));
                  }
                }}
              >
                Ja, ablehnen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
