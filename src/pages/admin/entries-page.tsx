import { useEffect, useState } from "react";
import { EntriesFilterBar } from "@/components/features/admin/entries-filter-bar";
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

  useEffect(() => {
    adminEntriesService.listEntries(filter).then(setRows);
  }, [filter]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Nennungen</h1>
      <div className="rounded-xl border bg-white p-4">
        <EntriesFilterBar filter={filter} onChange={(field, value) => setFilter((prev) => ({ ...prev, [field]: value }))} />
        <div className="mt-3 text-xs text-slate-500">{rows.length} Treffer in aktueller Filterung</div>
      </div>
      <EntriesTable rows={rows} />
    </div>
  );
}
