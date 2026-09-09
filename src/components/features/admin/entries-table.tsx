import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bike, Car, CheckCircle2, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  acceptanceStatusClasses,
  acceptanceStatusLabel,
  acceptanceStatusRowAccentClasses,
  techStatusClasses,
  techStatusLabel,
  paymentStatusClasses,
  paymentStatusLabel,
  waiverSignedClasses,
  waiverSignedLabel
} from "@/lib/admin-status";
import type { AdminEntryListItem } from "@/types/admin";

const RETURN_SNAPSHOT_KEY = "admin.entries.return.v1";
const DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";
const DESKTOP_ROW_ESTIMATE = 172;
const DESKTOP_OVERSCAN = 8;

type EntriesTableProps = {
  rows: AdminEntryListItem[];
  viewMode: "administration" | "race";
  canManageStatus: boolean;
  canSignWaiver: boolean;
  statusActionBusy?: boolean;
  isLoadingInitial?: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  desktopLoadMoreRef?: (node: HTMLDivElement | null) => void;
  desktopScrollContainerRef?: (node: HTMLDivElement | null) => void;
  resolveScrollOffset?: () => number;
  onSignWaiver: (row: AdminEntryListItem) => void;
  onSetShortlist: (entryId: string) => void;
  onSetAccepted: (entryId: string) => void;
  onSetRejected: (entryId: string) => void;
  onSetWithdrawn: (entryId: string) => void;
};

function doppelstarterKey(row: AdminEntryListItem) {
  const groupId = (row.groupIdRaw ?? "").trim();
  if (groupId) {
    return `group:${groupId}`;
  }
  const driverPersonId = (row.driverPersonIdRaw ?? "").trim();
  if (driverPersonId) {
    return `person:${driverPersonId}`;
  }
  const driverEmail = (row.driverEmailRaw ?? "").trim().toLowerCase();
  if (driverEmail) {
    return `email:${driverEmail}`;
  }
  return "";
}

function acceptanceStatusRowBackgroundClasses(status: AdminEntryListItem["status"]): string {
  return {
    pending: "bg-amber-50/25",
    shortlist: "bg-primary/5",
    accepted: "bg-primary/5",
    rejected: "bg-rose-50/25",
    withdrawn: "bg-slate-50"
  }[status];
}

function acceptanceStatusRowBorderClasses(status: AdminEntryListItem["status"]): string {
  return {
    pending: "border-l-4 border-l-amber-400",
    shortlist: "border-l-4 border-l-primary/70",
    accepted: "border-l-4 border-l-primary/70",
    rejected: "border-l-4 border-l-rose-400",
    withdrawn: "border-l-4 border-l-slate-400"
  }[status];
}

function ActionButton(props: {
  label: string;
  onClick?: () => void;
  variant?: "default" | "outline";
  disabledReason?: string;
  wrapperClassName?: string;
  className?: string;
}) {
  const disabled = Boolean(props.disabledReason);
  return (
    <span className={cn("inline-flex h-8 w-full min-w-0 max-w-full overflow-hidden", props.wrapperClassName)} title={props.disabledReason}>
      <Button
        type="button"
        size="sm"
        variant={props.variant ?? "outline"}
        className={cn("h-full w-full min-w-0 max-w-full justify-center overflow-hidden px-2 text-xs", props.className)}
        disabled={disabled}
        onClick={props.onClick}
      >
        <span className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{props.label}</span>
      </Button>
    </span>
  );
}

function VehicleThumb({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return <img className="h-16 w-16 rounded-md border object-cover md:h-20 md:w-20" src={src} alt={`Fahrzeug: ${label}`} loading="lazy" decoding="async" />;
  }
  const isMoto = label.toLowerCase().includes("yamaha") || label.toLowerCase().includes("moto");
  return (
    <div
      className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border bg-slate-100 text-slate-500 md:h-20 md:w-20"
      title="Bild nicht verfügbar (Backend liefert keine URL)"
    >
      {isMoto ? <Bike className="h-7 w-7" /> : <Car className="h-7 w-7" />}
      <span className="hidden text-[10px] leading-tight md:block">Bild fehlt</span>
    </div>
  );
}

function EntriesTableInner({
  rows,
  viewMode,
  canManageStatus,
  canSignWaiver,
  statusActionBusy = false,
  isLoadingInitial = false,
  isLoadingMore,
  hasMore,
  onLoadMore,
  loadMoreRef,
  desktopLoadMoreRef,
  desktopScrollContainerRef,
  resolveScrollOffset,
  onSignWaiver,
  onSetShortlist,
  onSetAccepted,
  onSetRejected,
  onSetWithdrawn
}: EntriesTableProps) {
  const location = useLocation();
  const desktopScrollerRef = useRef<HTMLDivElement | null>(null);
  const desktopScrollRafRef = useRef<number | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  );
  const [desktopScrollTop, setDesktopScrollTop] = useState(0);
  const [desktopViewportHeight, setDesktopViewportHeight] = useState(DESKTOP_ROW_ESTIMATE * 8);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleChange = () => setIsDesktopLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const handleDesktopScrollContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      desktopScrollerRef.current = node;
      desktopScrollContainerRef?.(node);
      if (node) {
        setDesktopViewportHeight(node.clientHeight || DESKTOP_ROW_ESTIMATE * 8);
        setDesktopScrollTop(node.scrollTop);
      }
    },
    [desktopScrollContainerRef]
  );

  useEffect(() => {
    const node = desktopScrollerRef.current;
    if (!isDesktopLayout || !node) {
      return;
    }

    const updateMetrics = () => {
      setDesktopViewportHeight(node.clientHeight || DESKTOP_ROW_ESTIMATE * 8);
      setDesktopScrollTop(node.scrollTop);
    };

    const handleScroll = () => {
      if (desktopScrollRafRef.current !== null) {
        return;
      }
      desktopScrollRafRef.current = window.requestAnimationFrame(() => {
        desktopScrollRafRef.current = null;
        setDesktopScrollTop(node.scrollTop);
      });
    };

    updateMetrics();
    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(node);
    node.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      node.removeEventListener("scroll", handleScroll);
      if (desktopScrollRafRef.current !== null) {
        window.cancelAnimationFrame(desktopScrollRafRef.current);
        desktopScrollRafRef.current = null;
      }
    };
  }, [isDesktopLayout, rows.length]);

  const persistReturnSnapshot = () => {
    try {
      sessionStorage.setItem(
        RETURN_SNAPSHOT_KEY,
        JSON.stringify({
          search: location.search,
          scrollY: Math.max(0, Math.floor(resolveScrollOffset?.() ?? window.scrollY)),
          loadedCount: rows.length,
          savedAt: Date.now()
        })
      );
    } catch {
      // no-op: restoration gracefully falls back when storage is unavailable
    }
  };
  const doppelstarterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = doppelstarterKey(row);
      if (!key) {
        return;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [rows]);

  const isDoppelstarter = (row: AdminEntryListItem) => {
    if ((row.groupSizeRaw ?? 0) > 1) {
      return true;
    }
    const key = doppelstarterKey(row);
    if (!key) {
      return false;
    }
    return (doppelstarterCounts.get(key) ?? 0) > 1;
  };

  const statusDisabledReason = (row: AdminEntryListItem, target: AdminEntryListItem["status"]) => {
    if (statusActionBusy) {
      return "Status wird aktualisiert…";
    }
    if (!row.confirmationMailVerified) {
      return "Status erst nach verifizierter E-Mail änderbar.";
    }
    if (row.status === target) {
      return "Bereits in diesem Status.";
    }
    return undefined;
  };

  const desktopVisibleRange = useMemo(() => {
    if (!isDesktopLayout || rows.length === 0) {
      return { startIndex: 0, endIndex: rows.length };
    }

    const startIndex = Math.max(0, Math.floor(desktopScrollTop / DESKTOP_ROW_ESTIMATE) - DESKTOP_OVERSCAN);
    const visibleCount = Math.ceil(desktopViewportHeight / DESKTOP_ROW_ESTIMATE) + DESKTOP_OVERSCAN * 2;
    return {
      startIndex,
      endIndex: Math.min(rows.length, startIndex + visibleCount)
    };
  }, [desktopScrollTop, desktopViewportHeight, isDesktopLayout, rows.length]);

  const desktopRows = isDesktopLayout ? rows.slice(desktopVisibleRange.startIndex, desktopVisibleRange.endIndex) : rows;
  const desktopTopSpacerHeight = isDesktopLayout ? desktopVisibleRange.startIndex * DESKTOP_ROW_ESTIMATE : 0;
  const desktopBottomSpacerHeight = isDesktopLayout ? Math.max(0, (rows.length - desktopVisibleRange.endIndex) * DESKTOP_ROW_ESTIMATE) : 0;

  const waiverComplete = (row: AdminEntryListItem) =>
    row.waiverSigners.driver.signed && (!row.waiverSigners.codriver || row.waiverSigners.codriver.signed);

  const handleStatusMenuAction = (row: AdminEntryListItem, action: string) => {
    if (action === "waiver") {
      onSignWaiver(row);
    } else if (action === "shortlist") {
      onSetShortlist(row.id);
    } else if (action === "accepted") {
      onSetAccepted(row.id);
    } else if (action === "rejected") {
      onSetRejected(row.id);
    } else if (action === "withdrawn") {
      onSetWithdrawn(row.id);
    }
  };

  const raceActions = (row: AdminEntryListItem) => {
    const complete = waiverComplete(row);
    const showMenu = canManageStatus || (canSignWaiver && complete);
    return (
      <div className="grid min-w-0 gap-2">
        <Button asChild variant="outline" className="h-11 w-full min-w-0 overflow-hidden px-3">
          <Link
            to={`/admin/entries/${row.id}${location.search}`}
            onClick={persistReturnSnapshot}
            state={{ fromEntriesList: true, scrollY: window.scrollY, loadedCount: rows.length }}
          >
            <span className="truncate">Details</span>
          </Link>
        </Button>
        {complete ? (
          <div className="flex h-11 min-w-0 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Eingecheckt</span>
          </div>
        ) : canSignWaiver ? (
          <Button type="button" className="h-11 w-full min-w-0 overflow-hidden px-3" onClick={() => onSignWaiver(row)}>
            <span className="truncate">HV unterschreiben</span>
          </Button>
        ) : (
          <div className="flex h-11 items-center justify-center rounded-md border bg-slate-50 px-3 text-sm text-slate-500">HV offen</div>
        )}
        {showMenu ? (
          <Select value="" onValueChange={(value) => handleStatusMenuAction(row, value)}>
            <SelectTrigger className="ml-auto h-9 w-11 justify-center px-2 [&>svg:last-child]:hidden" title="Weitere Aktionen" aria-label={`Weitere Aktionen für ${row.name}`}>
              <MoreHorizontal className="h-5 w-5" />
            </SelectTrigger>
            <SelectContent align="end">
              {canSignWaiver && complete ? <SelectItem value="waiver">HV erneut erfassen</SelectItem> : null}
              {canManageStatus ? <SelectItem value="shortlist" disabled={Boolean(statusDisabledReason(row, "shortlist"))}>Auf Vorauswahl setzen</SelectItem> : null}
              {canManageStatus ? <SelectItem value="accepted" disabled={Boolean(statusDisabledReason(row, "accepted"))}>Zulassen</SelectItem> : null}
              {canManageStatus ? <SelectItem value="rejected" disabled={Boolean(statusDisabledReason(row, "rejected"))}>Ablehnen</SelectItem> : null}
              {canManageStatus ? <SelectItem value="withdrawn" disabled={Boolean(statusDisabledReason(row, "withdrawn"))}>Absagen</SelectItem> : null}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    );
  };

  if (!rows.length) {
    if (isLoadingInitial) {
      return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Nennungen werden geladen…</div>;
    }
    return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Keine Nennungen für die aktuelle Filterung.</div>;
  }

  return (
    <div className="space-y-3 xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:flex-col">
      {!isDesktopLayout && <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`rounded-md border p-3 shadow-sm ${row.confirmationMailVerified ? `bg-white ${acceptanceStatusRowAccentClasses(row.status)}` : "border-l-4 border-l-slate-300 bg-slate-50"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <VehicleThumb src={row.vehicleThumbUrl} label={row.vehicleLabel} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <span>{row.name}</span>
                    {row.identityProtected ? (
                      <Badge className="h-5 shrink-0 border-violet-200 bg-violet-50 px-1.5 text-[10px] text-violet-800" variant="outline">
                        Veröffentlichungsname
                      </Badge>
                    ) : null}
                    {row.confirmationMailVerified && (
                      <span title="E-Mail verifiziert">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
                    {row.classLabel} · #{row.startNumber}
                  </div>
                  <div className="text-xs text-slate-500">{row.vehicleLabel}</div>
                  {row.orgaCode ? <div className="text-xs text-slate-500">Orga-Code: {row.orgaCode}</div> : null}
                  {isDoppelstarter(row) && (
                    <Badge className="mt-1 h-5 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800" variant="outline">
                      Doppelstarter
                    </Badge>
                  )}
                </div>
              </div>
              <div className={cn("shrink-0", viewMode === "race" ? "w-[9.5rem]" : "flex w-[7.25rem] flex-col gap-1")}>
                {viewMode === "race" ? raceActions(row) : (
                  <>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`/admin/entries/${row.id}${location.search}`}
                    onClick={persistReturnSnapshot}
                    state={{ fromEntriesList: true, scrollY: window.scrollY, loadedCount: rows.length }}
                  >
                    Details
                  </Link>
                </Button>
                {canSignWaiver ? (
                  <Button type="button" size="sm" variant="outline" className="h-8 min-w-0 px-2 text-xs" title="Haftverzicht unterschreiben" aria-label={`Haftverzicht für ${row.name} unterschreiben`} onClick={() => onSignWaiver(row)}>
                    HV sign.
                  </Button>
                ) : null}
                {canManageStatus && (
                  <>
                    <ActionButton
                      label="Vorauswahl"
                      wrapperClassName="h-8 w-full"
                      className="px-3.5"
                      variant="outline"
                      disabledReason={statusDisabledReason(row, "shortlist")}
                      onClick={() => onSetShortlist(row.id)}
                    />
                    <ActionButton
                      label="Zulassen"
                      wrapperClassName="h-8 w-full"
                      className="px-3.5"
                      variant="default"
                      disabledReason={statusDisabledReason(row, "accepted")}
                      onClick={() => onSetAccepted(row.id)}
                    />
                    <ActionButton
                      label="Ablehnen"
                      wrapperClassName="h-8 w-full"
                      className="px-3.5"
                      variant="outline"
                      disabledReason={statusDisabledReason(row, "rejected")}
                      onClick={() => onSetRejected(row.id)}
                    />
                    <ActionButton
                      label="Absagen"
                      wrapperClassName="h-8 w-full"
                      className="px-3.5"
                      variant="outline"
                      disabledReason={statusDisabledReason(row, "withdrawn")}
                      onClick={() => onSetWithdrawn(row.id)}
                    />
                  </>
                )}
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {viewMode === "administration" ? (
                <Badge className={`${acceptanceStatusClasses(row.status)} h-7 whitespace-nowrap px-2.5 text-xs`} variant="outline">
                  {acceptanceStatusLabel(row.status)}
                </Badge>
              ) : null}
              {row.status === "accepted" ? (
                <Badge className={`${paymentStatusClasses(row.payment ?? "due")} h-7 whitespace-nowrap px-2.5 text-xs`} variant="outline">
                  {paymentStatusLabel(row.payment ?? "due")}
                </Badge>
              ) : (
                <Badge className="h-7 whitespace-nowrap border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-500" variant="outline">
                  Nicht relevant
                </Badge>
              )}
              {row.status === "accepted" ? (
                <Badge className={`${techStatusClasses(row.techStatus)} h-7 whitespace-nowrap px-2.5 text-xs`} variant="outline">
                  Prüfung: {techStatusLabel(row.techStatus)}
                </Badge>
              ) : (
                <Badge className="h-7 whitespace-nowrap border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                  Noch nicht relevant
                </Badge>
              )}
              <Badge className={`${waiverSignedClasses(row.waiverSigners.driver.signed)} h-auto max-w-full whitespace-normal break-words px-2.5 py-1 text-center text-xs leading-tight`} variant="outline">
                Fahrer: {waiverSignedLabel(row.waiverSigners.driver.signed)}
              </Badge>
              {row.waiverSigners.codriver ? (
                <Badge className={`${waiverSignedClasses(row.waiverSigners.codriver.signed)} h-auto max-w-full whitespace-normal break-words px-2.5 py-1 text-center text-xs leading-tight`} variant="outline">
                  Beifahrer: {waiverSignedLabel(row.waiverSigners.codriver.signed)}
                </Badge>
              ) : null}
            </div>
            {viewMode === "administration" ? <div className="mt-2 text-xs text-slate-500">Erstellt: {row.createdAt}</div> : null}
          </div>
        ))}
      </div>}

      {isDesktopLayout && <div className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-sm xl:flex xl:flex-1 xl:flex-col">
        <div ref={handleDesktopScrollContainerRef} className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-none">
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              <col className={viewMode === "race" ? "w-[30%]" : "w-[23%]"} />
              <col className={viewMode === "race" ? "w-[10%]" : "w-[9%]"} />
              <col className={viewMode === "race" ? "w-[8%]" : "w-[7%]"} />
              {viewMode === "administration" ? <col className="w-[10%]" /> : null}
              <col className={viewMode === "race" ? "w-[10%]" : "w-[9%]"} />
              <col className={viewMode === "race" ? "w-[10%]" : "w-[9%]"} />
              <col className={viewMode === "race" ? "w-[14%]" : "w-[11%]"} />
              {viewMode === "administration" ? <col className="w-[8%]" /> : null}
              <col className={viewMode === "race" ? "w-[18%]" : "w-[14%]"} />
            </colgroup>
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="sticky top-0 z-10 border-l-4 border-l-slate-100 bg-slate-100 px-4 py-3 font-semibold">Nennung</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Klasse</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">St.-Nr.</th>
                {viewMode === "administration" ? <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Status</th> : null}
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Zahlung</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Prüfstatus</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Haftverzicht</th>
                {viewMode === "administration" ? <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Erstellt am</th> : null}
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {desktopTopSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={viewMode === "race" ? 7 : 9} style={{ height: desktopTopSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
              {desktopRows.map((row) => (
                <tr
                  key={row.id}
                  className={`h-[172px] border-t align-middle hover:bg-slate-50 ${row.confirmationMailVerified ? acceptanceStatusRowBackgroundClasses(row.status) : "bg-slate-50"}`}
                >
                  <td className={`px-4 py-2.5 ${row.confirmationMailVerified ? acceptanceStatusRowBorderClasses(row.status) : "border-l-4 border-l-slate-300"}`}>
                    <div className="flex items-start gap-3">
                      <VehicleThumb src={row.vehicleThumbUrl} label={row.vehicleLabel} />
                      <div className="min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 font-semibold leading-tight text-slate-900">
                          <span className="truncate">{row.name}</span>
                          {row.identityProtected ? (
                            <Badge className="h-5 shrink-0 border-violet-200 bg-violet-50 px-1.5 text-[10px] text-violet-800" variant="outline">
                              Veröffentlichungsname
                            </Badge>
                          ) : null}
                          {row.confirmationMailVerified && (
                            <span title="E-Mail verifiziert">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-600">{row.vehicleLabel}</div>
                        {row.orgaCode ? <div className="truncate text-xs text-slate-500">Orga-Code: {row.orgaCode}</div> : null}
                        {isDoppelstarter(row) && (
                          <Badge className="mt-1 h-5 border-amber-300 bg-amber-50 px-1.5 text-[10px] text-amber-800" variant="outline">
                            Doppelstarter
                          </Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 font-medium text-slate-800">
                    <span className="block truncate">{row.classLabel}</span>
                  </td>
                  <td className="px-3 py-3.5 font-medium text-slate-900">
                    <span className="block truncate">{row.startNumber}</span>
                  </td>
                  {viewMode === "administration" ? <td className="px-3 py-3">
                    <Badge className={`${acceptanceStatusClasses(row.status)} h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 text-xs leading-tight`} variant="outline">
                      {acceptanceStatusLabel(row.status)}
                    </Badge>
                  </td> : null}
                  <td className="px-3 py-3">
                    {row.status === "accepted" ? (
                      <Badge className={`${paymentStatusClasses(row.payment ?? "due")} h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 text-xs leading-tight`} variant="outline">
                        {paymentStatusLabel(row.payment ?? "due")}
                      </Badge>
                    ) : (
                      <Badge className="h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap border-slate-200 bg-slate-100 px-2 py-1 text-xs leading-tight text-slate-500" variant="outline">
                        Nicht relevant
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.status === "accepted" ? (
                      <Badge className={`${techStatusClasses(row.techStatus)} h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 text-xs leading-tight`} variant="outline">
                        {techStatusLabel(row.techStatus)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">Noch nicht relevant</span>
                    )}
                  </td>
                  <td className="min-w-0 px-2 py-3">
                    <div className="grid min-w-0 gap-1">
                      <Badge className={`${waiverSignedClasses(row.waiverSigners.driver.signed)} h-auto w-full min-w-0 justify-center whitespace-normal break-words px-1 py-1 text-center text-[10px] leading-tight`} variant="outline">
                        F: {waiverSignedLabel(row.waiverSigners.driver.signed)}
                      </Badge>
                      {row.waiverSigners.codriver ? (
                        <Badge className={`${waiverSignedClasses(row.waiverSigners.codriver.signed)} h-auto w-full min-w-0 justify-center whitespace-normal break-words px-1 py-1 text-center text-[10px] leading-tight`} variant="outline">
                          BF: {waiverSignedLabel(row.waiverSigners.codriver.signed)}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  {viewMode === "administration" ? <td className="px-3 py-3.5 text-slate-700">
                    <span className="block leading-tight">{row.createdAt}</span>
                  </td> : null}
                  <td className="min-w-0 px-2 py-3">
                    {viewMode === "race" ? raceActions(row) : (
                    <div className="grid min-w-0 grid-cols-2 gap-1.5 overflow-hidden">
                      <div className="col-span-2 h-8 min-w-0">
                        <Button asChild size="sm" variant="outline" className="h-full w-full min-w-0 justify-center overflow-hidden px-2 text-xs">
                          <Link
                            to={`/admin/entries/${row.id}${location.search}`}
                            onClick={persistReturnSnapshot}
                            state={{ fromEntriesList: true, scrollY: window.scrollY, loadedCount: rows.length }}
                          >
                            <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Details</span>
                          </Link>
                        </Button>
                      </div>
                      {canSignWaiver ? (
                        <div className="col-span-2 h-8 min-w-0">
                          <Button type="button" size="sm" variant="outline" className="h-full w-full min-w-0 justify-center overflow-hidden border-primary/30 bg-primary/5 px-1.5 text-xs text-primary hover:bg-primary/10" title="Haftverzicht unterschreiben" aria-label={`Haftverzicht für ${row.name} unterschreiben`} onClick={() => onSignWaiver(row)}>
                            <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">HV sign.</span>
                          </Button>
                        </div>
                      ) : null}
                      {canManageStatus && (
                        <>
                          <ActionButton
                            label="Vorauswahl"
                            wrapperClassName="h-8 w-full"
                            className="px-1.5"
                            variant="outline"
                            disabledReason={statusDisabledReason(row, "shortlist")}
                            onClick={() => onSetShortlist(row.id)}
                          />
                          <ActionButton
                            label="Zulassen"
                            wrapperClassName="h-8 w-full"
                            className="px-1.5"
                            variant="default"
                            disabledReason={statusDisabledReason(row, "accepted")}
                            onClick={() => onSetAccepted(row.id)}
                          />
                          <ActionButton
                            label="Ablehnen"
                            wrapperClassName="h-8 w-full"
                            className="px-1.5"
                            variant="outline"
                            disabledReason={statusDisabledReason(row, "rejected")}
                            onClick={() => onSetRejected(row.id)}
                          />
                          <ActionButton
                            label="Absagen"
                            wrapperClassName="h-8 w-full"
                            className="px-1.5"
                            variant="outline"
                            disabledReason={statusDisabledReason(row, "withdrawn")}
                            onClick={() => onSetWithdrawn(row.id)}
                          />
                        </>
                      )}
                    </div>
                    )}
                  </td>
                </tr>
              ))}
              {desktopBottomSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={viewMode === "race" ? 7 : 9} style={{ height: desktopBottomSpacerHeight, padding: 0, border: 0 }} />
                </tr>
              )}
            </tbody>
          </table>
          {(hasMore || isLoadingMore) && (
            <div className="flex flex-col items-center gap-2 px-3 py-3">
              <div ref={desktopLoadMoreRef} className="h-1 w-full" aria-hidden="true" />
              <Button type="button" size="sm" variant="outline" disabled={isLoadingMore} onClick={onLoadMore}>
                {isLoadingMore ? "Lade weitere Nennungen…" : "Weitere Nennungen laden"}
              </Button>
            </div>
          )}
        </div>
      </div>}

      {!isDesktopLayout && (hasMore || isLoadingMore) && (
        <div className="flex flex-col items-center gap-2 py-1">
          <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
          <Button type="button" size="sm" variant="outline" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? "Lade weitere Nennungen…" : "Weitere Nennungen laden"}
          </Button>
        </div>
      )}
    </div>
  );
}

export const EntriesTable = memo(EntriesTableInner, (prev, next) => {
  return (
    prev.rows === next.rows &&
    prev.viewMode === next.viewMode &&
    prev.canManageStatus === next.canManageStatus &&
    prev.canSignWaiver === next.canSignWaiver &&
    prev.statusActionBusy === next.statusActionBusy &&
    prev.isLoadingInitial === next.isLoadingInitial &&
    prev.isLoadingMore === next.isLoadingMore &&
    prev.hasMore === next.hasMore
  );
});
