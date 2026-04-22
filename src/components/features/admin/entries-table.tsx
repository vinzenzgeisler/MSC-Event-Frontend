import { Bike, Car, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptanceStatusClasses,
  acceptanceStatusLabel,
  acceptanceStatusRowAccentClasses,
  checkinClasses,
  checkinLabel,
  paymentStatusClasses,
  paymentStatusLabel
} from "@/lib/admin-status";
import type { AdminEntryListItem } from "@/types/admin";

const RETURN_SNAPSHOT_KEY = "admin.entries.return.v1";

type EntriesTableProps = {
  rows: AdminEntryListItem[];
  canManageStatus: boolean;
  statusActionBusy?: boolean;
  isLoadingInitial?: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  loadMoreRef: (node: HTMLDivElement | null) => void;
  desktopLoadMoreRef?: (node: HTMLDivElement | null) => void;
  desktopScrollContainerRef?: (node: HTMLDivElement | null) => void;
  resolveScrollOffset?: () => number;
  onSetShortlist: (entryId: string) => void;
  onSetAccepted: (entryId: string) => void;
  onSetRejected: (entryId: string) => void;
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
    rejected: "bg-rose-50/25"
  }[status];
}

function acceptanceStatusRowBorderClasses(status: AdminEntryListItem["status"]): string {
  return {
    pending: "border-l-4 border-l-amber-400",
    shortlist: "border-l-4 border-l-primary/70",
    accepted: "border-l-4 border-l-primary/70",
    rejected: "border-l-4 border-l-rose-400"
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
    <span className={cn("inline-flex h-8 w-full", props.wrapperClassName)} title={props.disabledReason}>
      <Button
        type="button"
        size="sm"
        variant={props.variant ?? "outline"}
        className={cn("h-full w-full max-w-full justify-center overflow-hidden text-ellipsis whitespace-nowrap px-3 text-xs", props.className)}
        disabled={disabled}
        onClick={props.onClick}
      >
        {props.label}
      </Button>
    </span>
  );
}

function VehicleThumb({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return <img className="h-16 w-16 rounded-md border object-cover md:h-20 md:w-20" src={src} alt={`Fahrzeug: ${label}`} />;
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

export function EntriesTable({
  rows,
  canManageStatus,
  statusActionBusy = false,
  isLoadingInitial = false,
  isLoadingMore,
  hasMore,
  onLoadMore,
  loadMoreRef,
  desktopLoadMoreRef,
  desktopScrollContainerRef,
  resolveScrollOffset,
  onSetShortlist,
  onSetAccepted,
  onSetRejected
}: EntriesTableProps) {
  const location = useLocation();
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
  const doppelstarterCounts = new Map<string, number>();
  rows.forEach((row) => {
    const key = doppelstarterKey(row);
    if (!key) {
      return;
    }
    doppelstarterCounts.set(key, (doppelstarterCounts.get(key) ?? 0) + 1);
  });
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

  if (!rows.length) {
    if (isLoadingInitial) {
      return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Nennungen werden geladen…</div>;
    }
    return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Keine Nennungen für die aktuelle Filterung.</div>;
  }

  return (
    <div className="space-y-3 xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:flex-col">
      <div className="space-y-2 xl:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`rounded-md border p-3 shadow-sm ${row.confirmationMailVerified ? `bg-white ${acceptanceStatusRowAccentClasses(row.status)}` : "border-l-4 border-l-slate-300 bg-slate-50"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <VehicleThumb src={row.vehicleThumbUrl} label={row.vehicleLabel} />
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <span>{row.name}</span>
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
              <div className="flex flex-col gap-1">
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`/admin/entries/${row.id}${location.search}`}
                    onClick={persistReturnSnapshot}
                    state={{ fromEntriesList: true, scrollY: window.scrollY, loadedCount: rows.length }}
                  >
                    Details
                  </Link>
                </Button>
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
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={`${acceptanceStatusClasses(row.status)} h-7 whitespace-nowrap px-2.5 text-xs`} variant="outline">
                {acceptanceStatusLabel(row.status)}
              </Badge>
              {row.status === "accepted" ? (
                <Badge className={`${paymentStatusClasses(row.payment)} h-7 whitespace-nowrap px-2.5 text-xs`} variant="outline">
                  {paymentStatusLabel(row.payment)}
                </Badge>
              ) : (
                <Badge className="h-7 whitespace-nowrap border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-500" variant="outline">
                  {paymentStatusLabel(row.payment)}
                </Badge>
              )}
              {row.status === "accepted" ? (
                <Badge className={`${checkinClasses(row.checkin === "bestätigt")} h-7 whitespace-nowrap px-2.5 text-xs`} variant="outline">
                  {checkinLabel(row.checkin === "bestätigt")}
                </Badge>
              ) : (
                <Badge className="h-7 whitespace-nowrap border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                  Noch nicht relevant
                </Badge>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-500">Erstellt: {row.createdAt}</div>
          </div>
        ))}
      </div>

      <div className="hidden min-h-0 overflow-hidden rounded-xl border bg-white shadow-sm xl:flex xl:flex-1 xl:flex-col">
        <div ref={desktopScrollContainerRef} className="min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-none">
          <table className="w-full table-fixed text-[13px]">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="sticky top-0 z-10 border-l-4 border-l-slate-100 bg-slate-100 px-4 py-3 font-semibold">Nennung</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Klasse</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">St.-Nr.</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Status</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Zahlung</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Check-in</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Erstellt am</th>
                <th className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t align-middle hover:bg-slate-50 ${row.confirmationMailVerified ? acceptanceStatusRowBackgroundClasses(row.status) : "bg-slate-50"}`}
                >
                  <td className={`px-4 py-2.5 ${row.confirmationMailVerified ? acceptanceStatusRowBorderClasses(row.status) : "border-l-4 border-l-slate-300"}`}>
                    <div className="flex items-start gap-3">
                      <VehicleThumb src={row.vehicleThumbUrl} label={row.vehicleLabel} />
                      <div className="min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 font-semibold leading-tight text-slate-900">
                          <span className="truncate">{row.name}</span>
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
                  <td className="px-3 py-3">
                    <Badge className={`${acceptanceStatusClasses(row.status)} h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 text-xs leading-tight`} variant="outline">
                      {acceptanceStatusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {row.status === "accepted" ? (
                      <Badge className={`${paymentStatusClasses(row.payment)} h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 text-xs leading-tight`} variant="outline">
                        {paymentStatusLabel(row.payment)}
                      </Badge>
                    ) : (
                      <Badge className="h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap border-slate-200 bg-slate-100 px-2 py-1 text-xs leading-tight text-slate-500" variant="outline">
                        {paymentStatusLabel(row.payment)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.status === "accepted" ? (
                      <Badge className={`${checkinClasses(row.checkin === "bestätigt")} h-7 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 text-xs leading-tight`} variant="outline">
                        {checkinLabel(row.checkin === "bestätigt")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">Noch nicht relevant</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-slate-700">
                    <span className="block leading-tight">{row.createdAt}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="col-span-2 h-8 w-full">
                        <Button asChild size="sm" variant="outline" className="h-full w-full justify-center px-3.5 text-xs">
                          <Link
                            to={`/admin/entries/${row.id}${location.search}`}
                            onClick={persistReturnSnapshot}
                            state={{ fromEntriesList: true, scrollY: window.scrollY, loadedCount: rows.length }}
                          >
                            Details
                          </Link>
                        </Button>
                      </div>
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
                            label="Ablehnen"
                            wrapperClassName="h-8 w-full"
                            className="px-3.5"
                            variant="outline"
                            disabledReason={statusDisabledReason(row, "rejected")}
                            onClick={() => onSetRejected(row.id)}
                          />
                          <ActionButton
                            label="Zulassen"
                            wrapperClassName="col-span-2 h-8 w-full"
                            className="px-3.5"
                            variant="default"
                            disabledReason={statusDisabledReason(row, "accepted")}
                            onClick={() => onSetAccepted(row.id)}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
      </div>

      {(hasMore || isLoadingMore) && (
        <div className="flex flex-col items-center gap-2 py-1 xl:hidden">
          <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />
          <Button type="button" size="sm" variant="outline" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? "Lade weitere Nennungen…" : "Weitere Nennungen laden"}
          </Button>
        </div>
      )}
    </div>
  );
}
