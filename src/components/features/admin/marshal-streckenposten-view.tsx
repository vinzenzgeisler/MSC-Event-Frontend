import { useMemo, useState } from "react";
import { List, Map, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPostTarget, MarshalPlanningMap, MarshalPlanningOverview, type PlanningTargetMode } from "@/components/features/admin/marshal-planning-map";
import { marshalStatusLabels, StatusBadge } from "@/components/features/admin/marshal-status";
import { MarshalSectionLeaderEditor } from "@/components/features/admin/marshal-section-leader-editor";
import { cn } from "@/lib/utils";
import type { MarshalCommitmentStatus, MarshalDay, MarshalPerson, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  day: MarshalDay;
  dayKey: "saturday" | "sunday";
  canWrite: boolean;
  busy: boolean;
  targetMode: PlanningTargetMode;
  onTargetModeChange: (mode: PlanningTargetMode) => void;
  onDayChange: (day: "saturday" | "sunday") => void;
  onPersonOpen: (person: MarshalPerson) => void;
  onSave: (person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string, allowOccupied?: boolean) => Promise<boolean>;
  onReplace: (currentPerson: MarshalPerson, replacementPerson: MarshalPerson, postId: string) => Promise<boolean>;
};

export function MarshalStreckenpostenView({ workspace, day, dayKey, canWrite, busy, targetMode, onTargetModeChange, onDayChange, onPersonOpen, onSave, onReplace }: Props) {
  const [mode, setMode] = useState<"list" | "overview" | "map">("list");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const term = search.trim().toLocaleLowerCase("de");
  const people = workspace.people.filter((person) => {
    const assignment = person.assignments.find((item) => item.dayId === day.id);
    const matchesTerm = !term || `${person.helperNumber} ${person.lastName} ${person.firstName} ${assignment?.functionCode ?? ""}`.toLocaleLowerCase("de").includes(term);
    const matchesStatus = statusFilter === "all" || (assignment?.commitmentStatus ?? "not_asked") === statusFilter;
    const matchesSection = sectionFilter === "all" || assignment?.sectionId === sectionFilter;
    return matchesTerm && matchesStatus && matchesSection;
  }).sort((a, b) => {
    const aa = a.assignments.find((item) => item.dayId === day.id);
    const ba = b.assignments.find((item) => item.dayId === day.id);
    if (aa?.role === "section_leader" && ba?.role !== "section_leader") return -1;
    if (ba?.role === "section_leader" && aa?.role !== "section_leader") return 1;
    const ap = workspace.posts.find((post) => post.id === aa?.postId)?.sortOrder ?? 9999;
    const bp = workspace.posts.find((post) => post.id === ba?.postId)?.sortOrder ?? 9999;
    return ap - bp || a.helperNumber - b.helperNumber;
  });
  const leaderRows = useMemo(() => [...workspace.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => {
    const assignedLeaders = workspace.people.filter((person) => person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id));
    const leader = assignedLeaders.find((person) => !person.noDeployment);
    const assignment = leader?.assignments.find((item) => item.dayId === day.id);
    const matchesSection = sectionFilter === "all" || section.id === sectionFilter;
    const sectionText = `${section.leaderCode} ${section.name}`;
    const mainText = `${sectionText} ${leader?.helperNumber ?? ""} ${leader?.lastName ?? ""} ${leader?.firstName ?? ""}`.toLocaleLowerCase("de");
    const mainMatchesStatus = statusFilter === "all" || (assignment?.commitmentStatus ?? "not_asked") === statusFilter;
    const showMain = matchesSection && (!term || mainText.includes(term)) && mainMatchesStatus;
    const historicalLeaders = assignedLeaders.filter((person) => person.noDeployment).filter((person) => {
      const historicalAssignment = person.assignments.find((item) => item.dayId === day.id);
      const historicalText = `${sectionText} ${person.helperNumber} ${person.lastName} ${person.firstName}`.toLocaleLowerCase("de");
      return matchesSection && (!term || historicalText.includes(term)) && (statusFilter === "all" || historicalAssignment?.commitmentStatus === statusFilter);
    });
    return { section, leader, historicalLeaders, assignment, showMain };
  }).filter(({ historicalLeaders, showMain }) => showMain || historicalLeaders.length > 0), [day.id, sectionFilter, statusFilter, term, workspace.people, workspace.sections]);

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><CardTitle>Streckenposten</CardTitle>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Veranstaltungstag">{(["saturday", "sunday"] as const).map((key) => <Button key={key} type="button" size="sm" variant={dayKey === key ? "default" : "ghost"} aria-pressed={dayKey === key} onClick={() => onDayChange(key)}>{key === "saturday" ? "Samstag" : "Sonntag"}</Button>)}</div>
          <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Darstellung"><Button type="button" size="sm" variant={mode === "list" ? "default" : "ghost"} aria-pressed={mode === "list"} onClick={() => setMode("list")}><List className="mr-1.5 h-4 w-4" />Liste</Button><Button type="button" size="sm" variant={mode === "overview" ? "default" : "ghost"} aria-pressed={mode === "overview"} onClick={() => setMode("overview")}><MapPinned className="mr-1.5 h-4 w-4" />Übersicht</Button><Button type="button" size="sm" variant={mode === "map" ? "default" : "ghost"} aria-pressed={mode === "map"} onClick={() => setMode("map")}><Map className="mr-1.5 h-4 w-4" />Karte</Button></div>
          <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Sollbesetzung"><Button type="button" size="sm" variant={targetMode === "normal" ? "default" : "ghost"} aria-pressed={targetMode === "normal"} onClick={() => onTargetModeChange("normal")}>Normal</Button><Button type="button" size="sm" variant={targetMode === "emergency" ? "default" : "ghost"} aria-pressed={targetMode === "emergency"} onClick={() => onTargetModeChange("emergency")}>Notfall</Button></div>
        </div></div></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {mode === "list" ? <>
          <div className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-medium text-slate-600">Suche<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Helfernummer" /></label><Filter label="Abschnitt" value={sectionFilter} onChange={setSectionFilter} options={[{ value: "all", label: "Alle Abschnitte" }, ...workspace.sections.map((section) => ({ value: section.id, label: section.name }))]} /><Filter label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Alle Status" }, ...Object.entries(marshalStatusLabels).map(([value, label]) => ({ value, label }))]} /></div>
          <div className="hidden overflow-x-auto lg:block"><table className="min-w-[820px] w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Nr.</th><th className="p-3">Name</th><th className="p-3">Posten</th><th className="p-3">Rolle</th><th className="p-3">Status</th><th className="p-3">Bemerkung</th></tr></thead><tbody>
            {leaderRows.map(({ section, leader, historicalLeaders, assignment, showMain }) => {
              const mainRow = <tr key={`leader-slot:${section.id}`} className="border-b bg-violet-50/50 align-top"><td className="p-3 font-semibold text-violet-700">{section.leaderCode}</td><td className="p-3"><MarshalSectionLeaderEditor workspace={workspace} day={day} section={section} canWrite={canWrite} busy={busy} onSave={onSave} onPersonOpen={onPersonOpen} /></td><td className="p-3 font-semibold">{section.leaderCode}</td><td className="p-3">Abschnittsleitung</td><td className="p-3">{leader ? <StatusSelect value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy || !leader.isActive} onChange={(status) => void onSave(leader, status, `leader:${section.id}`)} /> : <StatusBadge status="not_asked" />}</td><td className="p-3 text-slate-500">{assignment?.note ?? "—"}</td></tr>;
              const historicalRows = historicalLeaders.map((person) => { const historicalAssignment = person.assignments.find((item) => item.dayId === day.id); return <tr key={`leader-history:${section.id}:${person.id}`} className="border-b bg-slate-50 text-slate-600"><td className="p-3">{section.leaderCode}</td><td className="p-3"><button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button><span className="ml-2 text-xs font-semibold text-red-700">Kein Einsatz</span></td><td className="p-3">{section.leaderCode}</td><td className="p-3">Historische Abschnittsleitung</td><td className="p-3"><StatusBadge status={historicalAssignment?.commitmentStatus ?? "not_asked"} /></td><td className="p-3">{historicalAssignment?.note ?? "—"}</td></tr>; });
              return [...(showMain ? [mainRow] : []), ...historicalRows];
            })}
            {people.filter((person) => person.assignments.find((item) => item.dayId === day.id)?.role !== "section_leader").map((person) => {
            const assignment = person.assignments.find((item) => item.dayId === day.id);
            const assignmentValue = assignment?.postId ? `post:${assignment.postId}` : assignment?.role === "section_leader" && assignment.sectionId ? `leader:${assignment.sectionId}` : "none";
            return <tr key={person.id} className={cn("border-b align-top", (person.noDeployment || !person.isActive) && "bg-red-50 text-red-900")}><td className="p-3 text-slate-500">{person.helperNumber}</td><td className="p-3"><button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button>{person.noDeployment ? <span className="ml-2 text-xs font-semibold">⚠ kein Einsatz</span> : !person.isActive && <span className="ml-2 text-xs font-semibold">Inaktiv</span>}</td><td className="p-3"><AssignmentSelect value={assignmentValue} workspace={workspace} day={day} targetMode={targetMode} currentPersonId={person.id} disabled={!canWrite || busy || !person.isActive || person.noDeployment} onChange={(value) => void onSave(person, assignment?.commitmentStatus ?? "pending", value)} /></td><td className="p-3">{assignment?.role === "section_leader" ? "Abschnittsleitung" : assignment?.postId ? "Posten" : "—"}</td><td className="p-3"><StatusSelect value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy || !person.isActive || person.noDeployment} onChange={(status) => void onSave(person, status, assignmentValue === "none" ? "" : assignmentValue)} /></td><td className="p-3 text-slate-500">{assignment?.note ?? person.participation.note ?? "—"}</td></tr>;
          })}</tbody></table></div>
          <div className="grid gap-3 lg:hidden">
            {leaderRows.filter((row) => row.showMain).map(({ section, leader, assignment }) => <article key={`mobile-leader:${section.id}`} className="min-w-0 rounded-xl border border-violet-200 bg-violet-50/50 p-3"><strong className="text-sm text-violet-800">{section.leaderCode} · {section.name}</strong><div className="mt-2"><MarshalSectionLeaderEditor workspace={workspace} day={day} section={section} canWrite={canWrite} busy={busy} onSave={onSave} onPersonOpen={onPersonOpen} /></div>{leader && <div className="mt-2"><StatusSelect value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy || !leader.isActive} onChange={(status) => void onSave(leader, status, `leader:${section.id}`)} /></div>}{assignment?.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{assignment.note}</p>}</article>)}
            {people.filter((person) => person.assignments.find((item) => item.dayId === day.id)?.role !== "section_leader").map((person) => { const assignment = person.assignments.find((item) => item.dayId === day.id); const assignmentValue = assignment?.postId ? `post:${assignment.postId}` : "none"; return <article key={`mobile:${person.id}`} className={cn("min-w-0 rounded-xl border p-3", (person.noDeployment || !person.isActive) && "border-red-300 bg-red-50 text-red-900")}><button type="button" className="min-h-10 break-words text-left font-semibold text-blue-700" onClick={() => onPersonOpen(person)}>{person.helperNumber} · {person.lastName}, {person.firstName}</button><div className="mt-2 grid gap-2 sm:grid-cols-2"><AssignmentSelect value={assignmentValue} workspace={workspace} day={day} targetMode={targetMode} currentPersonId={person.id} disabled={!canWrite || busy || !person.isActive || person.noDeployment} onChange={(value) => void onSave(person, assignment?.commitmentStatus ?? "pending", value)} /><StatusSelect value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy || !person.isActive || person.noDeployment} onChange={(status) => void onSave(person, status, assignmentValue === "none" ? "" : assignmentValue)} /></div>{(assignment?.note ?? person.participation.note) && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{assignment?.note ?? person.participation.note}</p>}</article>; })}
          </div>
          {people.filter((person) => person.assignments.find((item) => item.dayId === day.id)?.role !== "section_leader").length === 0 && leaderRows.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Keine Einträge entsprechen den Filtern.</p>}
        </> : mode === "overview" ? <MarshalPlanningOverview workspace={workspace} day={day} targetMode={targetMode} canWrite={canWrite} busy={busy} onAssign={onSave} onReplace={onReplace} /> : <MarshalPlanningMap workspace={workspace} day={day} targetMode={targetMode} canWrite={canWrite} busy={busy} onAssign={onSave} onReplace={onReplace} />}
      </CardContent>
    </Card>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="grid gap-1 text-xs font-medium text-slate-600">{label}<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-950" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function StatusSelect({ value, disabled, onChange }: { value: MarshalCommitmentStatus; disabled: boolean; onChange: (status: MarshalCommitmentStatus) => void }) { return <select aria-label="Zusage" className="h-10 rounded-md border bg-white px-2 text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MarshalCommitmentStatus)}>{Object.entries(marshalStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>; }
function AssignmentSelect({ value, workspace, day, targetMode, currentPersonId, disabled, onChange }: { value: string; workspace: MarshalWorkspace; day: MarshalDay; targetMode: PlanningTargetMode; currentPersonId: string; disabled: boolean; onChange: (value: string) => void }) {
  return <select aria-label="Posten oder Funktion" className="h-10 min-w-48 rounded-md border bg-white px-2 text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="none">Nicht eingeteilt</option>{workspace.sections.map((section) => {
    const occupied = workspace.people.some((person) => person.id !== currentPersonId && !person.noDeployment && person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id));
    return <option key={section.id} value={`leader:${section.id}`} disabled={occupied}>{section.leaderCode} – {section.name}{occupied ? " (besetzt)" : ""}</option>;
  })}{workspace.posts.filter((post) => post.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((post) => {
    const assignedPeople = workspace.people.filter((person) => !person.noDeployment && person.assignments.some((assignment) => assignment.dayId === day.id && assignment.postId === post.id));
    const currentIsAssigned = assignedPeople.some((person) => person.id === currentPersonId);
    const full = assignedPeople.length >= getPostTarget(post, targetMode) && !currentIsAssigned;
    return <option key={post.id} value={`post:${post.id}`} disabled={full}>Posten {post.code}{full ? " (Sollplätze belegt)" : ""}</option>;
  })}</select>;
}
