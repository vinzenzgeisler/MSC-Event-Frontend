import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminEntriesFilter } from "@/types/admin";
import type { AdminClassOption } from "@/services/admin-meta.service";

type EntriesFilterBarProps = {
  filter: AdminEntriesFilter;
  classOptions: AdminClassOption[];
  statusScope?: "active" | "deleted";
  allowDeletedStatusOption?: boolean;
  onStatusScopeChange?: (scope: "active" | "deleted") => void;
  onChange: <K extends keyof AdminEntriesFilter>(field: K, value: AdminEntriesFilter[K]) => void;
};

const DELETED_SCOPE_VALUE = "__deleted_scope__";

export function EntriesFilterBar({ filter, classOptions, statusScope = "active", allowDeletedStatusOption = false, onStatusScopeChange, onChange }: EntriesFilterBarProps) {
  const statusSelectValue = statusScope === "deleted" ? DELETED_SCOPE_VALUE : filter.acceptanceStatus;
  const sortValue = `${filter.sortBy}:${filter.sortDir}`;

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div className="space-y-1">
        <Label htmlFor="admin-filter-search">Suche</Label>
        <Input
          id="admin-filter-search"
          placeholder="Name oder Startnummer"
          value={filter.query}
          onChange={(event) => onChange("query", event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-class">Klasse</Label>
        <select
          id="admin-filter-class"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filter.classId}
          onChange={(event) => onChange("classId", event.target.value)}
        >
          <option value="all">Alle</option>
          {classOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-status">Status</Label>
        <select
          id="admin-filter-status"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={statusSelectValue}
          onChange={(event) => {
            const next = event.target.value;
            if (next === DELETED_SCOPE_VALUE) {
              onStatusScopeChange?.("deleted");
              onChange("acceptanceStatus", "all");
              return;
            }
            onStatusScopeChange?.("active");
            onChange("acceptanceStatus", next as AdminEntriesFilter["acceptanceStatus"]);
          }}
        >
          <option value="all">Alle</option>
          <option value="pending">Offen</option>
          <option value="shortlist">Vorauswahl</option>
          <option value="accepted">Zugelassen</option>
          <option value="rejected">Abgelehnt</option>
          {allowDeletedStatusOption && <option value={DELETED_SCOPE_VALUE}>Gelöschte</option>}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-payment">Zahlung</Label>
        <select
          id="admin-filter-payment"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filter.paymentStatus}
          onChange={(event) => onChange("paymentStatus", event.target.value as AdminEntriesFilter["paymentStatus"])}
        >
          <option value="all">Alle</option>
          <option value="due">Offen</option>
          <option value="paid">Bezahlt</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-checkin">Einchecken</Label>
        <select
          id="admin-filter-checkin"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filter.checkinIdVerified}
          onChange={(event) => onChange("checkinIdVerified", event.target.value as AdminEntriesFilter["checkinIdVerified"])}
        >
          <option value="all">Alle</option>
          <option value="true">Eingecheckt</option>
          <option value="false">Nicht eingecheckt</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-sort">Sortierung</Label>
        <select
          id="admin-filter-sort"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={sortValue}
          onChange={(event) => {
            const [nextSortBy, nextSortDir] = event.target.value.split(":");
            onChange("sortBy", nextSortBy as AdminEntriesFilter["sortBy"]);
            onChange("sortDir", nextSortDir as AdminEntriesFilter["sortDir"]);
          }}
        >
          <option value="createdAt:desc">Neueste zuerst</option>
          <option value="createdAt:asc">Älteste zuerst</option>
          <option value="updatedAt:desc">Zuletzt aktualisiert</option>
          <option value="driverLastName:asc">Name A-Z</option>
          <option value="driverLastName:desc">Name Z-A</option>
          <option value="startNumberNorm:asc">Startnummer aufsteigend</option>
          <option value="startNumberNorm:desc">Startnummer absteigend</option>
          <option value="className:asc">Klasse A-Z</option>
          <option value="className:desc">Klasse Z-A</option>
        </select>
      </div>
    </div>
  );
}
