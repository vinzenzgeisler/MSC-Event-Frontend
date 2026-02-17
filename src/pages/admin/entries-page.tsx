import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntriesFilterBar } from "@/components/features/admin/entries-filter-bar";
import { acceptanceStatusLabel, paymentStatusLabel } from "@/lib/admin-status";
import { EntriesTable } from "@/components/features/admin/entries-table";
import { adminEntriesService } from "@/services/admin-entries.service";
import type { AdminEntriesFilter, AdminEntryListItem } from "@/types/admin";

const initialFilter: AdminEntriesFilter = {
  query: "",
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  checkinIdVerified: "all"
};

export function AdminEntriesPage() {
  const [filter, setFilter] = useState<AdminEntriesFilter>(initialFilter);
  const [rows, setRows] = useState<AdminEntryListItem[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [pendingAcceptEntryId, setPendingAcceptEntryId] = useState<string | null>(null);

  const refresh = () => {
    adminEntriesService.listEntries(filter).then(setRows);
  };

  useEffect(() => {
    refresh();
  }, [filter]);

  const activeFilterChips = [
    filter.query && { key: "query", label: `Suche: ${filter.query}` },
    filter.classId !== "all" && { key: "classId", label: `Klasse: ${filter.classId}` },
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
        <EntriesFilterBar filter={filter} onChange={(field, value) => setFilter((prev) => ({ ...prev, [field]: value }))} />
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
        onSetShortlist={async (entryId) => {
          await adminEntriesService.setEntryStatus(entryId, "to_shortlist");
          setToastMessage(`Nennung ${entryId} wurde auf Vorauswahl gesetzt.`);
          setTimeout(() => setToastMessage(""), 2200);
          refresh();
        }}
        onSetAccepted={async (entryId) => {
          setPendingAcceptEntryId(entryId);
        }}
      />
      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {toastMessage}
        </div>
      )}
      {pendingAcceptEntryId && (
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
                  await adminEntriesService.setEntryStatus(pendingAcceptEntryId, "to_accepted");
                  setToastMessage(`Nennung ${pendingAcceptEntryId} wurde zugelassen. Zulassungs-Mail wurde angestoßen.`);
                  setTimeout(() => setToastMessage(""), 2600);
                  setPendingAcceptEntryId(null);
                  refresh();
                }}
              >
                Ja, zulassen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
