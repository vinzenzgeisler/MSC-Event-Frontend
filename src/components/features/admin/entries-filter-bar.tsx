import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
        <Select value={filter.classId} onValueChange={(next) => onChange("classId", next)}>
          <SelectTrigger id="admin-filter-class" className="text-base md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {classOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-status">Status</Label>
        <Select
          value={statusSelectValue}
          onValueChange={(next) => {
            if (next === DELETED_SCOPE_VALUE) {
              onStatusScopeChange?.("deleted");
              onChange("acceptanceStatus", "all");
              return;
            }
            onStatusScopeChange?.("active");
            onChange("acceptanceStatus", next as AdminEntriesFilter["acceptanceStatus"]);
          }}
        >
          <SelectTrigger id="admin-filter-status" className="text-base md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="pending">Offen</SelectItem>
            <SelectItem value="shortlist">Vorauswahl</SelectItem>
            <SelectItem value="accepted">Zugelassen</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
            {allowDeletedStatusOption && <SelectItem value={DELETED_SCOPE_VALUE}>Gelöschte</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-payment">Zahlung</Label>
        <Select value={filter.paymentStatus} onValueChange={(next) => onChange("paymentStatus", next as AdminEntriesFilter["paymentStatus"])}>
          <SelectTrigger id="admin-filter-payment" className="text-base md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="due">Offen</SelectItem>
            <SelectItem value="paid">Bezahlt</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-checkin">Einchecken</Label>
        <Select value={filter.checkinIdVerified} onValueChange={(next) => onChange("checkinIdVerified", next as AdminEntriesFilter["checkinIdVerified"])}>
          <SelectTrigger id="admin-filter-checkin" className="text-base md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="true">Eingecheckt</SelectItem>
            <SelectItem value="false">Nicht eingecheckt</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-sort">Sortierung</Label>
        <Select
          value={sortValue}
          onValueChange={(next) => {
            const [nextSortBy, nextSortDir] = next.split(":");
            onChange("sortBy", nextSortBy as AdminEntriesFilter["sortBy"]);
            onChange("sortDir", nextSortDir as AdminEntriesFilter["sortDir"]);
          }}
        >
          <SelectTrigger id="admin-filter-sort" className="text-base md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">Neueste zuerst</SelectItem>
            <SelectItem value="createdAt:asc">Älteste zuerst</SelectItem>
            <SelectItem value="updatedAt:desc">Zuletzt aktualisiert</SelectItem>
            <SelectItem value="driverLastName:asc">Name A-Z</SelectItem>
            <SelectItem value="driverLastName:desc">Name Z-A</SelectItem>
            <SelectItem value="startNumberNorm:asc">Startnummer aufsteigend</SelectItem>
            <SelectItem value="startNumberNorm:desc">Startnummer absteigend</SelectItem>
            <SelectItem value="className:asc">Klasse A-Z</SelectItem>
            <SelectItem value="className:desc">Klasse Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
