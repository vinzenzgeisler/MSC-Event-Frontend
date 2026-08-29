import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MarshalDay, MarshalHelperArea, MarshalWorkspace } from "@/types/admin-marshals";
import type { SidebarView } from "@/components/features/admin/marshal-sidebar";

type Props = {
  workspace: MarshalWorkspace;
  days: MarshalDay[];
  onViewChange: (view: SidebarView) => void;
};

type StaffingRow = {
  key: string;
  label: string;
  assigned: number;
  target?: number;
};

export function MarshalReadinessView({ workspace, days, onViewChange }: Props) {
  const eligibleParticipationIds = new Set(
    workspace.people.filter((person) => !person.noDeployment).map((person) => person.participation.id),
  );
  const activePostIds = new Set(workspace.posts.filter((post) => post.isActive).map((post) => post.id));
  const trackTarget = workspace.posts
    .filter((post) => post.isActive)
    .reduce((sum, post) => sum + post.targetStaff, 0);
  const trackRows = sortDays(days).map((day) => ({
    key: day.id,
    label: shortDayLabel(day),
    assigned: workspace.people.filter((person) =>
      !person.noDeployment
      && person.assignments.some((assignment) => assignment.dayId === day.id && assignment.postId && activePostIds.has(assignment.postId)),
    ).length,
    target: trackTarget,
  }));
  const areas = [...workspace.areas].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Bereitschaft</h1>
        <p className="mt-1 text-sm text-slate-600">Besetzungsstand aller Helferbereiche auf einen Blick.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        <ReadinessCard title="Streckenposten" rows={trackRows} onClick={() => onViewChange(trackViewForDays(days))} />
        {areas.map((area) => (
          <ReadinessCard
            key={area.id}
            title={area.name}
            rows={areaRows(workspace, area, days, eligibleParticipationIds)}
            onClick={() => onViewChange(viewForArea(area))}
          />
        ))}
      </div>
    </div>
  );
}

function ReadinessCard({ title, rows, onClick }: { title: string; rows: StaffingRow[]; onClick: () => void }) {
  return (
    <Card className="transition-colors hover:border-blue-300 hover:bg-blue-50/30">
      <button type="button" className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={onClick}>
        <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {rows.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {rows.map(({ key, ...row }) => <StaffingStatus key={key} {...row} />)}
            </div>
          ) : (
            <p className="py-2 text-sm text-slate-500">Keine Einteilungen konfiguriert.</p>
          )}
        </CardContent>
      </button>
    </Card>
  );
}

function StaffingStatus({ label, assigned, target }: Omit<StaffingRow, "key">) {
  const filled = target === undefined ? assigned > 0 : assigned >= target;
  const statusLabel = assigned === 0 ? "unbesetzt" : filled ? "besetzt" : "teilweise besetzt";
  return (
    <div className="flex min-h-9 items-center gap-2 py-1.5 text-sm">
      <span
        className={cn("h-2.5 w-2.5 flex-none rounded-full", assigned === 0 ? "bg-red-500" : filled ? "bg-green-500" : "bg-amber-400")}
        title={statusLabel}
        aria-label={statusLabel}
      />
      <span className="min-w-0 flex-1 truncate text-slate-700">{label}</span>
      <span className="flex-none font-semibold tabular-nums text-slate-900">
        {assigned}{target !== undefined ? ` / ${target}` : ""}
      </span>
    </div>
  );
}

function areaRows(workspace: MarshalWorkspace, area: MarshalHelperArea, days: MarshalDay[], eligibleParticipationIds: Set<string>): StaffingRow[] {
  const shifts = workspace.areaShifts
    .filter((shift) => shift.areaId === area.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.shiftDate.localeCompare(b.shiftDate));
  if (shifts.length > 0) {
    return shifts.map((shift) => ({
      key: shift.id,
      label: shift.label,
      assigned: new Set(workspace.shiftAssignments
        .filter((assignment) => assignment.shiftId === shift.id && eligibleParticipationIds.has(assignment.participationId))
        .map((assignment) => assignment.participationId)).size,
    }));
  }

  const assigned = new Set(workspace.areaAssignments
    .filter((assignment) => assignment.areaId === area.id && eligibleParticipationIds.has(assignment.participationId))
    .map((assignment) => assignment.participationId)).size;
  const scopedDay = area.dayScope ? days.find((day) => day.dayKey === area.dayScope) : undefined;
  return [{ key: scopedDay?.id ?? area.id, label: scopedDay ? shortDayLabel(scopedDay) : "Gesamt", assigned }];
}

function sortDays(days: MarshalDay[]) {
  return [...days].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

function shortDayLabel(day: MarshalDay) {
  return day.dayKey === "saturday" ? "Sa" : "So";
}

function trackViewForDays(days: MarshalDay[]): SidebarView {
  return days.some((day) => day.dayKey === "saturday") ? "track_saturday" : "track_sunday";
}

function viewForArea(area: MarshalHelperArea): SidebarView {
  if (["setup_fl1", "setup_fl2", "general_saturday", "general_sunday"].includes(area.code)) {
    return area.code as SidebarView;
  }
  return `area:${area.id}`;
}
