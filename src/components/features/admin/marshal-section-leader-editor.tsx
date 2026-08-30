import { useState } from "react";
import type { MarshalCommitmentStatus, MarshalDay, MarshalPerson, MarshalSection, MarshalWorkspace } from "@/types/admin-marshals";

type SaveAction = (person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string, allowOccupied?: boolean) => Promise<boolean>;

export function MarshalSectionLeaderEditor({ workspace, day, section, canWrite, busy, onSave, onPersonOpen }: { workspace: MarshalWorkspace; day: MarshalDay; section: MarshalSection; canWrite: boolean; busy: boolean; onSave: SaveAction; onPersonOpen?: (person: MarshalPerson) => void }) {
  const [changingSlot, setChangingSlot] = useState<number | null>(null);
  const leaders = workspace.people
    .filter((person) => person.isActive && !person.noDeployment && person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id))
    .sort(compareMarshalNames);
  const eligible = workspace.people.filter((person) => person.isActive && !person.noDeployment).sort(compareMarshalNames);
  const target = section.leaderTargetStaff ?? 2;
  const slots = Array.from({ length: Math.max(target, leaders.length) }, (_, index) => leaders[index] ?? null);

  if (!canWrite) {
    return (
      <div className="grid gap-2">
        {slots.map((leader, index) => leader ? (
          <button key={leader.id} type="button" className="min-h-10 break-words rounded-md border bg-white px-2 text-left font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen?.(leader)}>
            {index + 1}. {leader.lastName}, {leader.firstName}
          </button>
        ) : <span key={`empty-${index}`} className="flex min-h-10 items-center rounded-md border border-dashed px-2 text-slate-500">{index + 1}. Nicht besetzt</span>)}
      </div>
    );
  }

  async function change(index: number, nextId: string) {
    const leader = slots[index];
    if (nextId === leader?.id) return;
    setChangingSlot(index);
    try {
      const previousStatus = leader?.assignments.find((item) => item.dayId === day.id)?.commitmentStatus ?? "accepted";
      if (leader && !(await onSave(leader, previousStatus, "", true))) return;
      const next = eligible.find((person) => person.id === nextId);
      if (next && !(await onSave(next, "accepted", `leader:${section.id}`, true)) && leader) {
        await onSave(leader, previousStatus, `leader:${section.id}`, true);
      }
    } finally {
      setChangingSlot(null);
    }
  }

  return (
    <div className="grid gap-2">
      {slots.map((leader, index) => (
        <label key={leader?.id ?? `empty-${index}`} className="grid gap-1 text-xs font-medium text-slate-600">
          Abschnittsleitung {index + 1}{index >= target ? " (über Soll)" : ""}
          <select aria-label={`Abschnittsleitung ${index + 1} für ${section.name}`} className="h-10 w-full min-w-0 rounded-md border bg-white px-2 text-sm font-normal text-slate-950" value={leader?.id ?? ""} disabled={busy || changingSlot !== null} onChange={(event) => void change(index, event.target.value)}>
            <option value="">Nicht besetzt</option>
            {eligible.map((person) => {
              const assignedToAnotherSlot = leaders.some((item) => item.id === person.id && item.id !== leader?.id);
              return <option key={person.id} value={person.id} disabled={assignedToAnotherSlot}>{person.lastName}, {person.firstName} · Nr. {person.helperNumber}</option>;
            })}
          </select>
        </label>
      ))}
    </div>
  );
}

function compareMarshalNames(a: MarshalPerson, b: MarshalPerson) {
  return a.lastName.localeCompare(b.lastName, "de", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "de", { sensitivity: "base" }) || a.helperNumber - b.helperNumber;
}
