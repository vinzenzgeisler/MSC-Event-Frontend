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
  compact?: boolean;
  onStatusScopeChange?: (scope: "active" | "deleted") => void;
  onChange: <K extends keyof AdminEntriesFilter>(field: K, value: AdminEntriesFilter[K]) => void;
};

const DELETED_SCOPE_VALUE = "__deleted_scope__";
const UNVERIFIED_STATUS_VALUE = "__submitted_unverified__";

export function EntriesFilterBar({
  filter,
  classOptions,
  statusScope = "active",
  allowDeletedStatusOption = false,
  compact = false,
  onStatusScopeChange,
  onChange
}: EntriesFilterBarProps) {
  const statusSelectValue =
    statusScope === "deleted"
      ? DELETED_SCOPE_VALUE
      : filter.registrationStatus === "submitted_unverified"
        ? UNVERIFIED_STATUS_VALUE
        : filter.acceptanceStatus;
  const sortValue = `${filter.sortBy}:${filter.sortDir}`;

  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-3 xl:grid-cols-5"}>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-search">Suche</Label>
        <Input
          id="admin-filter-search"
          placeholder="Suche nach E-Mail, Startnummer oder Name"
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
              onChange("registrationStatus", "all");
              return;
            }
            onStatusScopeChange?.("active");
            if (next === UNVERIFIED_STATUS_VALUE) {
              onChange("acceptanceStatus", "all");
              onChange("registrationStatus", "submitted_unverified");
              return;
            }
            onChange("acceptanceStatus", next as AdminEntriesFilter["acceptanceStatus"]);
            onChange("registrationStatus", "all");
          }}
        >
          <SelectTrigger id="admin-filter-status" className="text-base md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value={UNVERIFIED_STATUS_VALUE}>Nicht verifiziert</SelectItem>
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
