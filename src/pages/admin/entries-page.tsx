import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntriesFilterBar } from "@/components/features/admin/entries-filter-bar";
import { acceptanceStatusLabel, paymentStatusLabel } from "@/lib/admin-status";
import { EntriesTable } from "@/components/features/admin/entries-table";
import { adminEntriesService } from "@/services/admin-entries.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import type { AdminEntriesFilter, AdminEntryListItem } from "@/types/admin";

const initialFilter: AdminEntriesFilter = {
  query: "",
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  checkinIdVerified: "all"
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

export function AdminEntriesPage() {
  const { roles } = useAuth();
  const canManageStatus = hasPermission(roles, "entries.status.write");
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<AdminEntriesFilter>(() => filterFromSearchParams(searchParams));
  const [rows, setRows] = useState<AdminEntryListItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [pendingAcceptEntryId, setPendingAcceptEntryId] = useState<string | null>(null);
  const [pendingRejectEntryId, setPendingRejectEntryId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const refresh = async () => {
    try {
      setRows(await adminEntriesService.listEntries(filter));
    } catch (error) {
      showToast(getApiErrorMessage(error, "Nennungen konnten nicht geladen werden."));
    }
  };

  useEffect(() => {
    void refresh();
  }, [filter]);

  useEffect(() => {
    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));
  }, []);

  useEffect(() => {
    const nextFilter = filterFromSearchParams(searchParams);
    setFilter((prev) => (sameFilter(prev, nextFilter) ? prev : nextFilter));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = searchParamsFromFilter(filter);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [filter, searchParams, setSearchParams]);

  const activeFilterChips = [
    filter.query && { key: "query", label: `Suche: ${filter.query}` },
    filter.classId !== "all" && { key: "classId", label: `Klasse: ${classOptions.find((item) => item.id === filter.classId)?.name ?? filter.classId}` },
    filter.acceptanceStatus !== "all" && { key: "acceptanceStatus", label: `Status: ${acceptanceStatusLabel(filter.acceptanceStatus)}` },
    filter.paymentStatus !== "all" && { key: "paymentStatus", label: `Zahlung: ${paymentStatusLabel(filter.paymentStatus)}` },
    filter.checkinIdVerified !== "all" && { key: "checkinIdVerified", label: `Einchecken: ${filter.checkinIdVerified === "true" ? "Ja" : "Nein"}` }
  ].filter(Boolean) as Array<{ key: keyof AdminEntriesFilter; label: string }>;

  const removeFilterChip = (key: keyof AdminEntriesFilter) => {
    setFilter((prev) => ({
      ...prev,
      [key]: initialFilter[key]
    }));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Nennungen</h1>
      <div className="rounded-xl border bg-white p-4">
        <EntriesFilterBar
          filter={filter}
          classOptions={classOptions}
          onChange={(field, value) => setFilter((prev) => ({ ...prev, [field]: value }))}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">{rows.length} Treffer in aktueller Filterung</div>
          <Button type="button" size="sm" variant="outline" onClick={() => setFilter(initialFilter)}>
            Filter zurücksetzen
          </Button>
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
            showToast(`Nennung ${entryId} wurde auf Vorauswahl gesetzt.`);
            await refresh();
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
            <p className="mt-2 text-sm text-slate-600">
              Nach der Bestätigung wird automatisch die Zulassungs-Mail an den Fahrer angestoßen.
            </p>
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
                    showToast(`Nennung ${entryId} wurde zugelassen.`);
                    setPendingAcceptEntryId(null);
                    await refresh();
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
            <p className="mt-2 text-sm text-slate-600">
              Die Nennung wird auf den Status „Abgelehnt“ gesetzt. Das kann später wieder geändert werden.
            </p>
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
                    showToast(`Nennung ${entryId} wurde abgelehnt.`);
                    setPendingRejectEntryId(null);
                    await refresh();
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
