import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarshalConfirmDialog } from "@/components/features/admin/marshal-confirm-dialog";
import { marshalStatusLabels } from "@/components/features/admin/marshal-status";
import { cn } from "@/lib/utils";
import type { MarshalCommitmentStatus, MarshalHelperArea, MarshalPerson, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  area: MarshalHelperArea;
  dayKey: "saturday" | "sunday";
  canWrite: boolean;
  busy: boolean;
  onDayChange: (day: "saturday" | "sunday") => void;
  onPersonOpen: (person: MarshalPerson) => void;
  onSave: (person: MarshalPerson, status: MarshalCommitmentStatus, note: string | null) => Promise<boolean>;
  onRemove: (person: MarshalPerson) => Promise<boolean>;
};

export function MarshalGeneralView({ workspace, area, dayKey, canWrite, busy, onDayChange, onPersonOpen, onSave, onRemove }: Props) {
  const [personId, setPersonId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [removePerson, setRemovePerson] = useState<MarshalPerson | null>(null);
  const assignments = workspace.areaAssignments.filter((item) => item.areaId === area.id);
  const memberParticipationIds = new Set(assignments.map((assignment) => assignment.participationId));
  const people = workspace.people.filter((person) => memberParticipationIds.has(person.participation.id)).filter((person) => statusFilter === "all" || assignments.some((assignment) => assignment.participationId === person.participation.id && assignment.commitmentStatus === statusFilter)).sort((a, b) => a.helperNumber - b.helperNumber);
  const available = workspace.people.filter((person) => person.isActive && !person.noDeployment && !memberParticipationIds.has(person.participation.id));

  useEffect(() => {
    setPersonId("");
    setRemovePerson(null);
  }, [area.id]);

  useEffect(() => {
    if (personId && !available.some((person) => person.id === personId)) setPersonId("");
  }, [available, personId]);

  async function addPerson() {
    const person = available.find((item) => item.id === personId);
    if (!person) return;
    const saved = await onSave(person, "not_asked", null);
    if (saved) setPersonId("");
  }

  async function confirmRemove() {
    if (!removePerson) return;
    const removed = await onRemove(removePerson);
    if (removed) setRemovePerson(null);
  }

  return <><Card><CardHeader className="p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Allgemeine Helfer</CardTitle><p className="mt-1 text-sm text-slate-600">{area.responsibleLabel ?? "Allgemeine Aufgaben ohne feste Tagesschicht"}</p></div><div className="inline-flex self-start rounded-lg border bg-slate-50 p-1" role="group" aria-label="Veranstaltungstag">{(["saturday", "sunday"] as const).map((key) => <Button key={key} type="button" size="sm" variant={dayKey === key ? "default" : "ghost"} aria-pressed={dayKey === key} onClick={() => onDayChange(key)}>{key === "saturday" ? "Samstag" : "Sonntag"}</Button>)}</div></div></CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0"><div className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_220px] sm:items-end"><label className="grid gap-1 text-xs font-medium text-slate-600">Person hinzufügen<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={personId} disabled={!canWrite || busy} onChange={(event) => setPersonId(event.target.value)}><option value="">Person wählen …</option>{available.map((person) => <option key={person.id} value={person.id}>{person.helperNumber} · {person.lastName}, {person.firstName}</option>)}</select></label><Button type="button" disabled={!canWrite || busy || !personId} onClick={() => void addPerson()}><UserPlus className="mr-2 h-4 w-4" />Hinzufügen</Button><label className="grid gap-1 text-xs font-medium text-slate-600">Statusfilter<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Alle Status</option>{Object.entries(marshalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Nr.</th><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Bemerkung</th>{canWrite && <th className="p-3">Aktionen</th>}</tr></thead><tbody>{people.map((person) => { const assignment = assignments.find((item) => item.participationId === person.participation.id); const status = assignment?.commitmentStatus ?? "not_asked"; return <tr key={person.id} className={cn("border-b", person.noDeployment && "bg-red-50 text-red-900")}><td className="p-3 text-slate-500">{person.helperNumber}</td><td className="p-3"><button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button>{person.noDeployment && <span className="ml-2 text-xs font-semibold">⚠ kein Einsatz</span>}</td><td className="p-3"><select aria-label={`Status für ${person.firstName} ${person.lastName}`} className="h-10 rounded-md border bg-white px-2" value={status} disabled={!canWrite || busy || person.noDeployment} onChange={(event) => void onSave(person, event.target.value as MarshalCommitmentStatus, assignment?.note ?? null)}>{Object.entries(marshalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-3"><input key={assignment?.note ?? ""} aria-label={`Bemerkung für ${person.firstName} ${person.lastName}`} className="h-10 w-full rounded-md border bg-white px-3" defaultValue={assignment?.note ?? ""} disabled={!canWrite || busy || person.noDeployment} onBlur={(event) => { if (event.target.value !== (assignment?.note ?? "")) void onSave(person, status, event.target.value || null); }} /></td>{canWrite && <td className="p-2"><Button type="button" size="sm" variant="ghost" className="text-red-700" disabled={busy} aria-label={`${person.firstName} ${person.lastName} aus ${area.name} entfernen`} onClick={() => setRemovePerson(person)}><Trash2 className="h-4 w-4" /></Button></td>}</tr>; })}</tbody></table>{people.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Noch keine allgemeinen Helfer für {dayKey === "saturday" ? "Samstag" : "Sonntag"}.</p>}</div>
    </CardContent></Card>{removePerson && <MarshalConfirmDialog title="Bereichszuordnung entfernen?" description={<><strong>{removePerson.firstName} {removePerson.lastName}</strong> wird aus „{area.name}“ entfernt.</>} confirmLabel={<><Trash2 className="mr-2 h-4 w-4" />Aus Bereich entfernen</>} confirmDisabled={busy} onConfirm={() => void confirmRemove()} onCancel={() => setRemovePerson(null)} />}</>;
}
