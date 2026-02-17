import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminEntriesFilter } from "@/types/admin";

type EntriesFilterBarProps = {
  filter: AdminEntriesFilter;
  onChange: <K extends keyof AdminEntriesFilter>(field: K, value: AdminEntriesFilter[K]) => void;
};

export function EntriesFilterBar({ filter, onChange }: EntriesFilterBarProps) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
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
          <option value="Auto Elite">Auto Elite</option>
          <option value="Auto Pro">Auto Pro</option>
          <option value="Moto Open">Moto Open</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="admin-filter-status">Status</Label>
        <select
          id="admin-filter-status"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filter.acceptanceStatus}
          onChange={(event) => onChange("acceptanceStatus", event.target.value as AdminEntriesFilter["acceptanceStatus"])}
        >
          <option value="all">Alle</option>
          <option value="pending">Offen</option>
          <option value="shortlist">Vorauswahl</option>
          <option value="accepted">Zugelassen</option>
          <option value="rejected">Abgelehnt</option>
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
    </div>
  );
}
