import { useState } from "react";
import type { MarshalCommitmentStatus, MarshalDay, MarshalPerson, MarshalSection, MarshalWorkspace } from "@/types/admin-marshals";

type SaveAction = (person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string, allowOccupied?: boolean) => Promise<boolean>;

export function MarshalSectionLeaderEditor({ workspace, day, section, canWrite, busy, onSave, onPersonOpen }: { workspace: MarshalWorkspace; day: MarshalDay; section: MarshalSection; canWrite: boolean; busy: boolean; onSave: SaveAction; onPersonOpen?: (person: MarshalPerson) => void }) {
  const [changing, setChanging] = useState(false);
  const leader = workspace.people.find((person) => person.isActive && !person.noDeployment && person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id));
  const eligible = workspace.people.filter((person) => person.isActive && !person.noDeployment).sort(compareMarshalNames);

  if (!canWrite) return leader ? <button type="button" className="min-h-10 break-words text-left font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen?.(leader)}>{leader.lastName}, {leader.firstName}</button> : <span>Nicht besetzt</span>;

  async function change(nextId: string) {
    if (nextId === leader?.id) return;
    setChanging(true);
    try {
      const previousStatus = leader?.assignments.find((item) => item.dayId === day.id)?.commitmentStatus ?? "accepted";
      if (leader && !(await onSave(leader, previousStatus, ""))) return;
      const next = eligible.find((person) => person.id === nextId);
      if (next && !(await onSave(next, "accepted", `leader:${section.id}`, true)) && leader) await onSave(leader, previousStatus, `leader:${section.id}`, true);
    } finally { setChanging(false); }
  }

  return <select aria-label={`Abschnittsleitung ${section.name}`} className="h-10 w-full min-w-0 rounded-md border bg-white px-2 text-sm" value={leader?.id ?? ""} disabled={busy || changing} onChange={(event) => void change(event.target.value)}>
    <option value="">Nicht besetzt</option>
    {eligible.map((person) => <option key={person.id} value={person.id}>{person.lastName}, {person.firstName} · Nr. {person.helperNumber}</option>)}
  </select>;
}

function compareMarshalNames(a: MarshalPerson, b: MarshalPerson) {
  return a.lastName.localeCompare(b.lastName, "de", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "de", { sensitivity: "base" }) || a.helperNumber - b.helperNumber;
}

export function MarshalSectionLeaderGrid({ workspace, day, canWrite, busy, onSave }: { workspace: MarshalWorkspace; day: MarshalDay; canWrite: boolean; busy: boolean; onSave: SaveAction }) {
  return <section aria-label="Abschnittsleitungen" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[...workspace.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => <div key={section.id} className="min-w-0 rounded-lg border bg-white p-3"><div className="mb-2 text-sm font-semibold">{section.leaderCode} · {section.name}</div><MarshalSectionLeaderEditor workspace={workspace} day={day} section={section} canWrite={canWrite} busy={busy} onSave={onSave} /></div>)}</section>;
}
