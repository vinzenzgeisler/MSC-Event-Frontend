import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { EntriesFilterBar } from "@/components/features/admin/entries-filter-bar";
import { EntriesTable } from "@/components/features/admin/entries-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { acceptanceStatusClasses, acceptanceStatusLabel, paymentStatusClasses, paymentStatusLabel } from "@/lib/admin-status";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { adminIamService } from "@/services/admin-iam.service";
import { adminEntriesService } from "@/services/admin-entries.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { AdminDeletedEntryListItem, AdminEntriesFilter, AdminEntryListItem, ListMeta } from "@/types/admin";

const PAGE_SIZE = 25;
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = "admin.entries.page.cache.v5";

type EntriesScope = "active" | "deleted";

const initialFilter: AdminEntriesFilter = {
  query: "",
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  checkinIdVerified: "all",
  sortBy: "createdAt",
  sortDir: "desc"
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
const SORT_BY_VALUES: AdminEntriesFilter["sortBy"][] = ["createdAt", "updatedAt", "driverLastName", "driverFirstName", "className", "startNumberNorm"];
const SORT_DIR_VALUES: AdminEntriesFilter["sortDir"][] = ["asc", "desc"];

const SORT_LABELS: Record<`${AdminEntriesFilter["sortBy"]}:${AdminEntriesFilter["sortDir"]}`, string> = {
  "createdAt:desc": "Neueste zuerst",
  "createdAt:asc": "Älteste zuerst",
  "updatedAt:desc": "Zuletzt aktualisiert",
  "updatedAt:asc": "Zuletzt aktualisiert (alt zuerst)",
  "driverLastName:asc": "Name A-Z",
  "driverLastName:desc": "Name Z-A",
  "driverFirstName:asc": "Vorname A-Z",
  "driverFirstName:desc": "Vorname Z-A",
  "className:asc": "Klasse A-Z",
  "className:desc": "Klasse Z-A",
  "startNumberNorm:asc": "Startnummer aufsteigend",
  "startNumberNorm:desc": "Startnummer absteigend"
};

function sortLabel(sortBy: AdminEntriesFilter["sortBy"], sortDir: AdminEntriesFilter["sortDir"]) {
  return SORT_LABELS[`${sortBy}:${sortDir}`] ?? `${sortBy} ${sortDir}`;
}

function formatEntryHeadline(entry: Pick<AdminEntryListItem, "name" | "vehicleLabel"> | Pick<AdminDeletedEntryListItem, "name" | "vehicleLabel"> | null | undefined) {
  if (!entry) {
    return "Nennung";
  }
  return `${entry.name} · ${entry.vehicleLabel}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_EMBEDDED_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isLikelyTechnicalActor(value: string) {
  const raw = value.trim();
  if (!raw) {
    return true;
  }
  if (UUID_PATTERN.test(raw) || UUID_EMBEDDED_PATTERN.test(raw)) {
    return true;
  }
  if (raw.startsWith("arn:") || raw.includes("|")) {
    return true;
  }
  return false;
}

function MailNoteSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">{props.title}</div>
          <div className="text-xs text-slate-500">{props.description}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={props.checked}
          disabled={props.disabled}
          onClick={() => props.onChange(!props.checked)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full border transition",
            props.checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-slate-200",
            props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
              props.checked ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

type EntriesCachePayload = {
  savedAt: number;
  filter: AdminEntriesFilter;
  rows: AdminEntryListItem[];
  meta: ListMeta;
};

type EntriesPageLocationState = {
  restoreEntriesScrollY?: number;
} | null;

function hasValue<T extends string>(value: string | null, values: readonly T[]): value is T {
  return value !== null && (values as readonly string[]).includes(value);
}

function filterFromSearchParams(searchParams: URLSearchParams): AdminEntriesFilter {
  const classId = searchParams.get("class");
  const query = searchParams.get("q");
  const acceptanceStatus = searchParams.get("status");
  const paymentStatus = searchParams.get("payment");
  const checkin = searchParams.get("checkin");
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir");

  return {
    query: query ?? "",
    classId: classId && classId.trim() ? classId : "all",
    acceptanceStatus: hasValue(acceptanceStatus, ACCEPTANCE_VALUES) ? acceptanceStatus : "all",
    paymentStatus: hasValue(paymentStatus, PAYMENT_VALUES) ? paymentStatus : "all",
    checkinIdVerified: hasValue(checkin, CHECKIN_VALUES) ? checkin : "all",
    sortBy: hasValue(sortBy, SORT_BY_VALUES) ? sortBy : "createdAt",
    sortDir: hasValue(sortDir, SORT_DIR_VALUES) ? sortDir : "desc"
  };
}

function scopeFromSearchParams(searchParams: URLSearchParams, canDeleteEntries: boolean): EntriesScope {
  if (!canDeleteEntries) {
    return "active";
  }
  const scope = searchParams.get("scope");
  return scope === "deleted" ? "deleted" : "active";
}

function searchParamsFromState(filter: AdminEntriesFilter, scope: EntriesScope, canDeleteEntries: boolean): URLSearchParams {
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
  if (filter.sortBy !== initialFilter.sortBy) {
    params.set("sortBy", filter.sortBy);
  }
  if (filter.sortDir !== initialFilter.sortDir) {
    params.set("sortDir", filter.sortDir);
  }
  if (canDeleteEntries && scope === "deleted") {
    params.set("scope", "deleted");
  }
  return params;
}

function sameFilter(a: AdminEntriesFilter, b: AdminEntriesFilter) {
  return (
    a.query === b.query &&
    a.classId === b.classId &&
    a.acceptanceStatus === b.acceptanceStatus &&
    a.paymentStatus === b.paymentStatus &&
    a.checkinIdVerified === b.checkinIdVerified &&
    a.sortBy === b.sortBy &&
    a.sortDir === b.sortDir
  );
}

function mergeRowsById(existing: AdminEntryListItem[], incoming: AdminEntryListItem[]) {
  if (!incoming.length) {
    return existing;
  }

  const byId = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

function mergeDeletedRowsById(existing: AdminDeletedEntryListItem[], incoming: AdminDeletedEntryListItem[]) {
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

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

  const tokens = parseSmartSearchQuery(filter.query);
  if (!tokens.length) {
    return true;
  }

  const firstName = normalizeSearchValue(row.driverFirstNameRaw || "");
  const lastName = normalizeSearchValue(row.driverLastNameRaw || "");
  const startNumber = normalizeSearchValue(row.startNumber || "");
  const startNumberNorm = normalizeSearchValue(row.startNumberNormRaw || "");
  const email = normalizeSearchValue(row.driverEmailRaw || "");
  const anyHaystack = normalizeSearchValue([row.name, row.vehicleLabel, firstName, lastName, startNumber, startNumberNorm, email].join(" "));

  return tokens.every((token) => anyHaystack.includes(token.value));
}

type SmartSearchToken = {
  value: string;
};

function splitSearchTerms(query: string) {
  const terms: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(query)) !== null) {
    const quoted = match[1];
    const plain = match[2];
    const raw = (quoted ?? plain ?? "").trim();
    if (!raw) {
      continue;
    }
    terms.push(raw);
  }
  return terms;
}

function parseSmartSearchQuery(query: string): SmartSearchToken[] {
  const terms = splitSearchTerms(query);
  return terms
    .map((term) => ({ value: normalizeSearchValue(term) }))
    .filter((item) => Boolean(item.value));
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
  const canReadIam = hasPermission(roles, "iam.read");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingScrollRestoreY, setPendingScrollRestoreY] = useState<number | null>(null);

  const initialFilterRef = useRef<AdminEntriesFilter>(filterFromSearchParams(searchParams));
  const [filterDraft, setFilterDraft] = useState<AdminEntriesFilter>(initialFilterRef.current);
  const [viewScope, setViewScope] = useState<EntriesScope>(() => scopeFromSearchParams(searchParams, canDeleteEntries));

  const debouncedQuery = useDebouncedValue(filterDraft.query, 450);
  const appliedFilter = useMemo<AdminEntriesFilter>(
    () => ({
      query: debouncedQuery,
      classId: filterDraft.classId,
      acceptanceStatus: filterDraft.acceptanceStatus,
      paymentStatus: filterDraft.paymentStatus,
      checkinIdVerified: filterDraft.checkinIdVerified,
      sortBy: filterDraft.sortBy,
      sortDir: filterDraft.sortDir
    }),
    [debouncedQuery, filterDraft.classId, filterDraft.acceptanceStatus, filterDraft.paymentStatus, filterDraft.checkinIdVerified, filterDraft.sortBy, filterDraft.sortDir]
  );

  const [rows, setRows] = useState<AdminEntryListItem[]>([]);
  const [meta, setMeta] = useState<ListMeta>(EMPTY_META);
  const [deletedRows, setDeletedRows] = useState<AdminDeletedEntryListItem[]>([]);
  const [deletedMeta, setDeletedMeta] = useState<ListMeta>(EMPTY_META);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAcceptEntryId, setPendingAcceptEntryId] = useState<string | null>(null);
  const [pendingRejectEntryId, setPendingRejectEntryId] = useState<string | null>(null);
  const [pendingRestoreEntryId, setPendingRestoreEntryId] = useState<string | null>(null);
  const [includeDriverNoteOnAccept, setIncludeDriverNoteOnAccept] = useState(true);
  const [includeDriverNoteOnReject, setIncludeDriverNoteOnReject] = useState(true);
  const [actorLabelById, setActorLabelById] = useState<Map<string, string>>(new Map());
  const [actorLookupLoaded, setActorLookupLoaded] = useState(false);
  const [statusActionBusy, setStatusActionBusy] = useState<null | { entryId: string; action: "shortlist" | "accepted" | "rejected" }>(null);
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);

  const rowsRef = useRef<AdminEntryListItem[]>([]);
  const deletedRowsRef = useRef<AdminDeletedEntryListItem[]>([]);
  const activeRequestRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);
  const firstFilterLoadRef = useRef(true);
  const hasRestoredFromStateRef = useRef(false);

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

  const fetchActiveSnapshot = useCallback(
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

  const fetchDeletedSnapshot = useCallback(
    async (
      filter: AdminEntriesFilter,
      minimumRows: number,
      requestId: number
    ): Promise<{ rows: AdminDeletedEntryListItem[]; meta: ListMeta } | null> => {
      const targetSize = Math.max(minimumRows, PAGE_SIZE);
      let nextCursor: string | undefined;
      let mergedRows: AdminDeletedEntryListItem[] = [];
      let latestMeta = EMPTY_META;

      while (true) {
        const page = await adminEntriesService.listDeletedEntriesPage(filter, {
          cursor: nextCursor,
          limit: PAGE_SIZE
        });

        if (!isRequestActive(requestId)) {
          return null;
        }

        mergedRows = mergeDeletedRowsById(mergedRows, page.entries);
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

  const replaceActiveRows = useCallback(
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
        const snapshot = await fetchActiveSnapshot(filter, minimumRows, requestId);
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
    [fetchActiveSnapshot]
  );

  const replaceDeletedRows = useCallback(
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
        const snapshot = await fetchDeletedSnapshot(filter, minimumRows, requestId);
        if (!snapshot || !isRequestActive(requestId)) {
          return;
        }

        setDeletedRows(snapshot.rows);
        setDeletedMeta(snapshot.meta);
      } catch (error) {
        if (!isRequestActive(requestId)) {
          return;
        }
        if (!options?.silentError) {
          showToast(getApiErrorMessage(error, "Gelöschte Nennungen konnten nicht geladen werden."));
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
    [fetchDeletedSnapshot]
  );

  const loadMoreActive = useCallback(async () => {
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

  const loadMoreDeleted = useCallback(async () => {
    if (loadingInitial || loadingMore || refreshing || !deletedMeta.hasMore || !deletedMeta.nextCursor) {
      return;
    }

    const requestId = beginRequest();
    setLoadingMore(true);

    try {
      const page = await adminEntriesService.listDeletedEntriesPage(appliedFilter, {
        cursor: deletedMeta.nextCursor,
        limit: PAGE_SIZE
      });

      if (!isRequestActive(requestId)) {
        return;
      }

      setDeletedRows((prev) => mergeDeletedRowsById(prev, page.entries));
      setDeletedMeta(page.meta);
    } catch (error) {
      if (!isRequestActive(requestId)) {
        return;
      }
      showToast(getApiErrorMessage(error, "Weitere gelöschte Nennungen konnten nicht geladen werden."));
    } finally {
      if (!isRequestActive(requestId)) {
        return;
      }
      setLoadingMore(false);
    }
  }, [appliedFilter, deletedMeta.hasMore, deletedMeta.nextCursor, loadingInitial, loadingMore, refreshing]);

  const loadMore = useCallback(async () => {
    if (viewScope === "deleted") {
      await loadMoreDeleted();
      return;
    }
    await loadMoreActive();
  }, [loadMoreActive, loadMoreDeleted, viewScope]);

  const refreshSnapshot = useCallback(
    async (manual: boolean) => {
      if (viewScope === "deleted") {
        await replaceDeletedRows(appliedFilter, {
          minimumRows: deletedRowsRef.current.length,
          showLoader: manual && deletedRowsRef.current.length === 0,
          showRefreshing: manual,
          silentError: !manual
        });
        return;
      }

      await replaceActiveRows(appliedFilter, {
        minimumRows: rowsRef.current.length,
        showLoader: manual && rowsRef.current.length === 0,
        showRefreshing: manual,
        silentError: !manual
      });
    },
    [appliedFilter, replaceActiveRows, replaceDeletedRows, viewScope]
  );

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    deletedRowsRef.current = deletedRows;
  }, [deletedRows]);

  useEffect(() => {
    const cached = readEntriesCache(initialFilterRef.current);
    if (!cached) {
      return;
    }

    hydratedFromCacheRef.current = true;
    rowsRef.current = cached.rows;
    setRows(cached.rows);
    setMeta(cached.meta);
    if (viewScope === "active") {
      setLoadingInitial(false);
    }
  }, [viewScope]);

  useEffect(() => {
    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));
  }, []);

  useEffect(() => {
    if (viewScope !== "deleted" || !canDeleteEntries || !canReadIam || actorLookupLoaded) {
      return;
    }

    let cancelled = false;
    adminIamService
      .getOverview()
      .then((overview) => {
        if (cancelled) {
          return;
        }
        const mapping = new Map<string, string>();
        overview.accounts.forEach((account) => {
          const preferred = (account.email ?? "").trim() || account.username.trim() || account.id;
          mapping.set(account.id, preferred);
          mapping.set(account.id.toLowerCase(), preferred);
          mapping.set(account.username, preferred);
          mapping.set(account.username.toLowerCase(), preferred);
          if (account.email) {
            mapping.set(account.email, preferred);
            mapping.set(account.email.toLowerCase(), preferred);
          }
        });
        setActorLabelById(mapping);
        setActorLookupLoaded(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setActorLookupLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [actorLookupLoaded, canDeleteEntries, canReadIam, viewScope]);

  useEffect(() => {
    const nextFilter = filterFromSearchParams(searchParams);
    setFilterDraft((prev) => (sameFilter(prev, nextFilter) ? prev : nextFilter));

    const nextScope = scopeFromSearchParams(searchParams, canDeleteEntries);
    setViewScope((prev) => (prev === nextScope ? prev : nextScope));
  }, [canDeleteEntries, searchParams]);

  useEffect(() => {
    const nextParams = searchParamsFromState(appliedFilter, viewScope, canDeleteEntries);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [appliedFilter, canDeleteEntries, searchParams, setSearchParams, viewScope]);

  useEffect(() => {
    const state = location.state as EntriesPageLocationState;
    if (hasRestoredFromStateRef.current || typeof state?.restoreEntriesScrollY !== "number") {
      return;
    }
    hasRestoredFromStateRef.current = true;
    setPendingScrollRestoreY(Math.max(0, state.restoreEntriesScrollY));
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (viewScope === "deleted") {
      setDeletedRows([]);
      setDeletedMeta((prev) => ({ ...prev, hasMore: false, nextCursor: null }));

      void replaceDeletedRows(appliedFilter, {
        minimumRows: 0,
        showLoader: true,
        showRefreshing: false,
        silentError: false
      });
      return;
    }

    const keepCachedRows = firstFilterLoadRef.current && hydratedFromCacheRef.current;
    firstFilterLoadRef.current = false;

    if (!keepCachedRows) {
      setRows([]);
      setMeta((prev) => ({ ...prev, hasMore: false, nextCursor: null }));
    }

    void replaceActiveRows(appliedFilter, {
      minimumRows: keepCachedRows ? rowsRef.current.length : 0,
      showLoader: true,
      showRefreshing: false,
      silentError: false
    });
  }, [appliedFilter, replaceActiveRows, replaceDeletedRows, viewScope]);

  useEffect(() => {
    if (viewScope !== "active" || !loadMoreNode || !meta.hasMore || loadingMore || loadingInitial) {
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
  }, [loadMore, loadMoreNode, loadingInitial, loadingMore, meta.hasMore, viewScope]);

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

  useEffect(() => {
    if (viewScope !== "active" || pendingScrollRestoreY === null || loadingInitial) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: pendingScrollRestoreY, behavior: "auto" });
      setPendingScrollRestoreY(null);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [loadingInitial, pendingScrollRestoreY, rows.length, viewScope]);

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
    },
    (filterDraft.sortBy !== initialFilter.sortBy || filterDraft.sortDir !== initialFilter.sortDir) && {
      key: "sortBy",
      label: `Sortierung: ${sortLabel(filterDraft.sortBy, filterDraft.sortDir)}`
    }
  ].filter(Boolean) as Array<{ key: keyof AdminEntriesFilter; label: string }>;

  const removeFilterChip = (key: keyof AdminEntriesFilter) => {
    if (key === "sortBy" || key === "sortDir") {
      setFilterDraft((prev) => ({
        ...prev,
        sortBy: initialFilter.sortBy,
        sortDir: initialFilter.sortDir
      }));
      return;
    }
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

      const updated = prev.map((item) => (item.id === entryId ? updatedRow : item));
      return updated;
    });
  };

  const visibleRows = useMemo(() => rows.filter((row) => rowMatchesFilter(row, appliedFilter, classNameById)), [appliedFilter, classNameById, rows]);
  const shownCount = viewScope === "deleted" ? deletedRows.length : visibleRows.length;
  const shownTotal = viewScope === "deleted" ? deletedMeta.total : meta.total;
  const pendingAcceptRow = pendingAcceptEntryId ? rows.find((item) => item.id === pendingAcceptEntryId) : null;
  const pendingRejectRow = pendingRejectEntryId ? rows.find((item) => item.id === pendingRejectEntryId) : null;
  const hasAcceptDriverNote = Boolean(pendingAcceptRow?.driverNote);
  const hasRejectDriverNote = Boolean(pendingRejectRow?.driverNote);
  const loadedCountText =
    shownTotal > 0
      ? `${shownTotal} ${viewScope === "deleted" ? "gelöschte Nennungen" : "Treffer in aktueller Filterung"}${shownCount < shownTotal ? ` · ${shownCount} geladen` : ""}${refreshing ? " · aktualisiere…" : ""}`
      : `${shownCount} ${viewScope === "deleted" ? "gelöschte Nennungen" : "Treffer in aktueller Filterung"}${loadingInitial ? " · lädt…" : ""}`;

  const resolveActorLabel = (rawValue: string) => {
    const raw = rawValue.trim();
    if (!raw) {
      return "Unbekannt";
    }

    if (actorLabelById.has(raw)) {
      return actorLabelById.get(raw) ?? raw;
    }
    const lowered = raw.toLowerCase();
    if (actorLabelById.has(lowered)) {
      return actorLabelById.get(lowered) ?? raw;
    }

    const embeddedId = raw.match(UUID_EMBEDDED_PATTERN)?.[0];
    if (embeddedId) {
      if (actorLabelById.has(embeddedId)) {
        return actorLabelById.get(embeddedId) ?? raw;
      }
      const embeddedLower = embeddedId.toLowerCase();
      if (actorLabelById.has(embeddedLower)) {
        return actorLabelById.get(embeddedLower) ?? raw;
      }
    }

    if (isLikelyTechnicalActor(raw)) {
      return "Unbekannt";
    }

    return raw;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Nennungen</h1>
      <div className="rounded-xl border bg-white p-4">
        <EntriesFilterBar
          filter={filterDraft}
          classOptions={classOptions}
          statusScope={viewScope}
          allowDeletedStatusOption={canDeleteEntries}
          onStatusScopeChange={(scope) => setViewScope(scope)}
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

      {viewScope === "deleted" ? (
        <>
          {!deletedRows.length ? (
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
                      <th className="px-3 py-2 font-semibold">Löschgrund</th>
                      <th className="px-3 py-2 font-semibold">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedRows.map((row) => (
                      <tr key={row.id} className="border-t align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{row.name}</div>
                          <div className="text-xs text-slate-500">
                            #{row.startNumber} · {row.vehicleLabel}
                          </div>
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
                        <td className="px-3 py-2 text-slate-700">{resolveActorLabel(row.deletedBy)}</td>
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

          {(deletedMeta.hasMore || loadingMore) && (
            <div className="flex flex-col items-center gap-2 py-1">
              <Button type="button" size="sm" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Lade weitere gelöschte Nennungen…" : "Weitere gelöschte Nennungen laden"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EntriesTable
          rows={visibleRows}
          canManageStatus={canManageStatus}
          statusActionBusy={statusActionBusy !== null}
          isLoadingInitial={loadingInitial}
          isLoadingMore={loadingMore}
          hasMore={meta.hasMore}
          onLoadMore={() => void loadMore()}
          loadMoreRef={setLoadMoreNode}
          onSetShortlist={async (entryId) => {
            if (statusActionBusy) {
              return;
            }
            if (!canManageStatus) {
              showToast("Nur Admin-Rollen dürfen den Status ändern.");
              return;
            }
            const row = rows.find((item) => item.id === entryId);
            if (row?.status === "shortlist") {
              showToast("Nennung ist bereits auf Vorauswahl.");
              return;
            }
            setStatusActionBusy({ entryId, action: "shortlist" });
            try {
              await adminEntriesService.setEntryStatus(entryId, "to_shortlist");
              applyLocalStatusUpdate(entryId, "shortlist");
              showToast(`${formatEntryHeadline(row)} wurde auf Vorauswahl gesetzt.`);
            } catch (error) {
              showToast(getApiErrorMessage(error, "Status konnte nicht aktualisiert werden."));
            } finally {
              setStatusActionBusy(null);
            }
          }}
          onSetAccepted={async (entryId) => {
            if (statusActionBusy) {
              return;
            }
            if (!canManageStatus) {
              showToast("Nur Admin-Rollen dürfen den Status ändern.");
              return;
            }
            const row = rows.find((item) => item.id === entryId);
            if (row?.status === "accepted") {
              showToast("Nennung ist bereits zugelassen.");
              return;
            }
            setIncludeDriverNoteOnAccept(true);
            setPendingAcceptEntryId(entryId);
          }}
          onSetRejected={async (entryId) => {
            if (statusActionBusy) {
              return;
            }
            if (!canManageStatus) {
              showToast("Nur Admin-Rollen dürfen den Status ändern.");
              return;
            }
            const row = rows.find((item) => item.id === entryId);
            if (row?.status === "rejected") {
              showToast("Nennung ist bereits abgelehnt.");
              return;
            }
            setIncludeDriverNoteOnReject(true);
            setPendingRejectEntryId(entryId);
          }}
        />
      )}

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
            <div className="mt-3">
              <MailNoteSwitch
                checked={includeDriverNoteOnAccept}
                disabled={!hasAcceptDriverNote}
                onChange={setIncludeDriverNoteOnAccept}
                title="Fahrer-Notiz in Mail mitsenden"
                description={
                  hasAcceptDriverNote
                    ? "Die aktuelle Fahrer-Notiz wird in der Zulassungs-Mail ergänzt."
                    : "Keine Fahrer-Notiz vorhanden."
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingAcceptEntryId(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={statusActionBusy !== null}
                onClick={async () => {
                  const entryId = pendingAcceptEntryId;
                  if (!entryId || statusActionBusy) {
                    return;
                  }
                  setStatusActionBusy({ entryId, action: "accepted" });
                  try {
                    await adminEntriesService.setEntryStatus(entryId, "to_accepted", {
                      includeDriverNoteInLifecycleMail: includeDriverNoteOnAccept
                    });
                    applyLocalStatusUpdate(entryId, "accepted");
                    showToast(`${formatEntryHeadline(pendingAcceptRow)} wurde zugelassen.`);
                    setPendingAcceptEntryId(null);
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Nennung konnte nicht zugelassen werden."));
                  } finally {
                    setStatusActionBusy(null);
                  }
                }}
              >
                {statusActionBusy?.entryId === pendingAcceptEntryId && statusActionBusy.action === "accepted" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gesetzt…
                  </>
                ) : (
                  "Ja, zulassen"
                )}
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
            <div className="mt-3">
              <MailNoteSwitch
                checked={includeDriverNoteOnReject}
                disabled={!hasRejectDriverNote}
                onChange={setIncludeDriverNoteOnReject}
                title="Fahrer-Notiz in Mail mitsenden"
                description={
                  hasRejectDriverNote
                    ? "Die aktuelle Fahrer-Notiz wird in der Ablehnungs-Mail ergänzt."
                    : "Keine Fahrer-Notiz vorhanden."
                }
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingRejectEntryId(null)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={statusActionBusy !== null}
                onClick={async () => {
                  const entryId = pendingRejectEntryId;
                  if (!entryId || statusActionBusy) {
                    return;
                  }
                  setStatusActionBusy({ entryId, action: "rejected" });
                  try {
                    await adminEntriesService.setEntryStatus(entryId, "to_rejected", {
                      includeDriverNoteInLifecycleMail: includeDriverNoteOnReject
                    });
                    applyLocalStatusUpdate(entryId, "rejected");
                    showToast(`${formatEntryHeadline(pendingRejectRow)} wurde abgelehnt.`);
                    setPendingRejectEntryId(null);
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Nennung konnte nicht abgelehnt werden."));
                  } finally {
                    setStatusActionBusy(null);
                  }
                }}
              >
                {statusActionBusy?.entryId === pendingRejectEntryId && statusActionBusy.action === "rejected" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gesetzt…
                  </>
                ) : (
                  "Ja, ablehnen"
                )}
              </Button>
            </div>
          </div>
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
                  const deletedEntry = deletedRows.find((item) => item.id === entryId);
                  if (!entryId) {
                    return;
                  }
                  setPendingRestoreEntryId(null);
                  try {
                    await adminEntriesService.restoreEntry(entryId);
                    setDeletedRows((prev) => prev.filter((item) => item.id !== entryId));
                    setDeletedMeta((prev) => ({
                      ...prev,
                      total: Math.max(0, prev.total - 1)
                    }));
                    setViewScope("active");
                    showToast(`${formatEntryHeadline(deletedEntry)} wurde wiederhergestellt.`);
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
