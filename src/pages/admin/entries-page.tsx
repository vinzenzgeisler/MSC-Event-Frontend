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
  const [actionMessage, setActionMessage] = useState("");

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
      {actionMessage && <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{actionMessage}</div>}
      <EntriesTable
        rows={rows}
        onSetShortlist={async (entryId) => {
          await adminEntriesService.setEntryStatus(entryId, "to_shortlist");
          setActionMessage(`Nennung ${entryId} wurde auf Vorauswahl gesetzt.`);
          refresh();
        }}
        onSetAccepted={async (entryId) => {
          const confirmed = window.confirm("Status auf 'Zugelassen' setzen? Danach wird automatisch die Zulassungs-Mail versendet.");
          if (!confirmed) {
            return;
          }
          await adminEntriesService.setEntryStatus(entryId, "to_accepted");
          setActionMessage(`Nennung ${entryId} wurde zugelassen. Zulassungs-Mail wurde angestoßen.`);
          refresh();
        }}
      />
    </div>
  );
}
