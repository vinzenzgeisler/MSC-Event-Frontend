import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSetupAreaMemberParticipationIds } from "@/components/features/admin/marshal-assignment-helpers";
import { marshalStatusLabels } from "@/components/features/admin/marshal-status";
import { cn } from "@/lib/utils";
import type { MarshalCommitmentStatus, MarshalHelperArea, MarshalPerson, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  area: MarshalHelperArea;
  canWrite: boolean;
  busy: boolean;
  onPersonOpen: (person: MarshalPerson) => void;
  onAddPerson: (person: MarshalPerson) => Promise<boolean>;
  onSaveShift: (person: MarshalPerson, shiftId: string, status: MarshalCommitmentStatus) => Promise<boolean>;
};

export function MarshalAufbauView({ workspace, area, canWrite, busy, onPersonOpen, onAddPerson, onSaveShift }: Props) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [personId, setPersonId] = useState("");
  const shifts = useMemo(() => workspace.areaShifts.filter((shift) => shift.areaId === area.id).sort((a, b) => a.sortOrder - b.sortOrder || a.shiftDate.localeCompare(b.shiftDate)), [area.id, workspace.areaShifts]);
  const shiftIds = new Set(shifts.map((shift) => shift.id));
  const memberParticipationIds = getSetupAreaMemberParticipationIds(area.id, shiftIds, workspace.areaAssignments, workspace.shiftAssignments);
  const areaMembers = workspace.people.filter((person) => memberParticipationIds.has(person.participation.id));
  const people = areaMembers.filter((person) => statusFilter === "all"
    || workspace.areaAssignments.some((assignment) => assignment.areaId === area.id && assignment.participationId === person.participation.id && assignment.commitmentStatus === statusFilter)
    || workspace.shiftAssignments.some((assignment) => assignment.participationId === person.participation.id && shiftIds.has(assignment.shiftId) && assignment.commitmentStatus === statusFilter))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de"));
  const available = workspace.people.filter((person) => person.isActive && !person.noDeployment && !memberParticipationIds.has(person.participation.id));

  async function addPerson() {
    const person = workspace.people.find((item) => item.id === personId);
    if (!person) return;
    const saved = await onAddPerson(person);
    if (saved) setPersonId("");
  }

  return (
    <Card><CardHeader className="p-4 sm:p-6"><CardTitle>{area.name}</CardTitle><p className="mt-1 text-sm text-slate-600">{area.responsibleLabel ? `Verantwortlich: ${area.responsibleLabel}` : "Schichtweise Einsatzplanung"}</p></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="flex flex-col gap-2 rounded-xl border bg-slate-50 p-3 sm:flex-row sm:items-end"><label className="grid flex-1 gap-1 text-xs font-medium text-slate-600">Person hinzufügen<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-950" value={personId} disabled={!canWrite || busy} onChange={(event) => setPersonId(event.target.value)}><option value="">Person wählen …</option>{available.map((person) => <option key={person.id} value={person.id}>{person.helperNumber} · {person.lastName}, {person.firstName}</option>)}</select></label><Button type="button" disabled={!personId || !canWrite || busy} onClick={() => void addPerson()}><UserPlus className="mr-2 h-4 w-4" />Person hinzufügen</Button><label className="grid gap-1 text-xs font-medium text-slate-600">Statusfilter<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Alle Status</option>{Object.entries(marshalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {shifts.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">Für diesen Aufbau-Bereich sind noch keine Schichten konfiguriert. Personen können dem Bereich bereits zugeordnet werden; Schichten werden unter „Konfiguration“ angelegt.</p>}
        <div className="overflow-x-auto"><table className="min-w-max w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="sticky left-0 z-10 bg-slate-50 p-3">Name</th>{shifts.map((shift) => <th key={shift.id} className="min-w-28 p-3 text-center"><span className="block">{shift.label}</span><span className="normal-case font-normal">{formatShortDate(shift.shiftDate)}</span></th>)}<th className="p-3">Shirt</th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className={cn("border-b", person.noDeployment && "bg-red-50 text-red-900")}><td className="sticky left-0 z-10 bg-inherit p-3"><button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button></td>{shifts.map((shift) => {
          const assignment = workspace.shiftAssignments.find((item) => item.participationId === person.participation.id && item.shiftId === shift.id);
          const status = assignment?.commitmentStatus ?? "not_asked";
          return <td key={shift.id} className="p-2 text-center"><select aria-label={`${shift.label} für ${person.firstName} ${person.lastName}`} title={marshalStatusLabels[status]} className={cn("h-9 w-24 rounded-md border px-2 text-center text-sm font-semibold", statusClass(status))} value={status} disabled={!canWrite || busy || person.noDeployment} onChange={(event) => void onSaveShift(person, shift.id, event.target.value as MarshalCommitmentStatus)}>{Object.entries(marshalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>;
        })}<td className="p-3">{person.participation.shirtSizeSnapshot ?? person.shirtSize ?? "—"}</td></tr>)}</tbody></table>{people.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Noch keine Personen in diesem Bereich.</p>}</div>
      </CardContent></Card>
  );
}

function statusClass(status: MarshalCommitmentStatus) { return status === "accepted" ? "border-green-300 bg-green-100 text-green-800" : status === "declined" ? "border-red-300 bg-red-100 text-red-800" : status === "pending" || status === "tentative" ? "border-amber-300 bg-amber-100 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-500"; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`)); }
