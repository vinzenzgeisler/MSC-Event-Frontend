import { useEffect, useRef, useState } from "react";
import { List, Map, MapPinned, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { statusForTargetSelection } from "@/components/features/admin/marshal-assignment-helpers";
import { getPostTarget, MarshalPlanningMap, MarshalPlanningOverview, type PlanningTargetMode } from "@/components/features/admin/marshal-planning-map";
import { marshalStatusLabels } from "@/components/features/admin/marshal-status";
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
  onListSave: (person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string) => Promise<boolean>;
  onSave: (person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string, allowOccupied?: boolean) => Promise<boolean>;
  onReplace: (currentPerson: MarshalPerson, replacementPerson: MarshalPerson, postId: string) => Promise<boolean>;
};

export function MarshalStreckenpostenView({ workspace, day, dayKey, canWrite, busy, targetMode, onTargetModeChange, onDayChange, onPersonOpen, onListSave, onSave, onReplace }: Props) {
  const [mode, setMode] = useState<"list" | "overview" | "map">("list");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [optimisticAssignments, setOptimisticAssignments] = useState<Record<string, { assignmentValue: string; status: MarshalCommitmentStatus }>>({});
  const [savingRows, setSavingRows] = useState<Set<string>>(() => new Set());
  const savingRowsRef = useRef(new Set<string>());
  const rowKey = (personId: string) => `${day.id}:${personId}`;
  const serverAssignment = (person: MarshalPerson) => {
    const assignment = person.assignments.find((item) => item.dayId === day.id);
    return {
      assignmentValue: assignment?.postId ? `post:${assignment.postId}` : "none",
      status: assignment?.commitmentStatus ?? ("not_asked" as MarshalCommitmentStatus),
    };
  };
  const displayedAssignment = (person: MarshalPerson) => optimisticAssignments[rowKey(person.id)] ?? serverAssignment(person);

  useEffect(() => {
    setOptimisticAssignments((current) => {
      let changed = false;
      const next = { ...current };
      workspace.people.forEach((person) => {
        const key = rowKey(person.id);
        const optimistic = current[key];
        if (!optimistic) return;
        const server = serverAssignment(person);
        if (server.assignmentValue === optimistic.assignmentValue && server.status === optimistic.status) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [day.id, workspace.people]);

  async function saveOptimistically(person: MarshalPerson, requestedStatus: MarshalCommitmentStatus, assignmentValue: string) {
    const key = rowKey(person.id);
    if (savingRowsRef.current.has(key)) return;
    const nextStatus = statusForTargetSelection(requestedStatus, assignmentValue);
    const keepAssignment = nextStatus !== "declined" && nextStatus !== "not_asked";
    setOptimisticAssignments((current) => ({ ...current, [key]: { assignmentValue: keepAssignment && assignmentValue ? assignmentValue : "none", status: nextStatus } }));
    savingRowsRef.current.add(key);
    setSavingRows((current) => new Set(current).add(key));
    let saved = false;
    try {
      saved = await onListSave(person, requestedStatus, assignmentValue === "none" ? "" : assignmentValue);
    } finally {
      if (!saved) setOptimisticAssignments((current) => { const next = { ...current }; delete next[key]; return next; });
      savingRowsRef.current.delete(key);
      setSavingRows((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }
  const term = search.trim().toLocaleLowerCase("de");
  const trackAreaAliases = new Set(["strecke", "streckenposten", "track", "marshal"]);
  workspace.areas.forEach((area) => {
    if (trackAreaAliases.has(normalizeArea(area.code)) || trackAreaAliases.has(normalizeArea(area.name))) {
      trackAreaAliases.add(normalizeArea(area.code));
      trackAreaAliases.add(normalizeArea(area.name));
    }
  });
  const people = workspace.people.filter((person) => {
    const assignment = person.assignments.find((item) => item.dayId === day.id);
    const isTrackHelper = person.activityAreas.some((area) => trackAreaAliases.has(normalizeArea(area)));
    if (!isTrackHelper || assignment?.role === "section_leader") return false;
    const matchesTerm = !term || `${person.helperNumber} ${person.lastName} ${person.firstName} ${assignment?.functionCode ?? ""}`.toLocaleLowerCase("de").includes(term);
    const matchesStatus = statusFilter === "all" || (assignment?.commitmentStatus ?? "not_asked") === statusFilter;
    const matchesSection = sectionFilter === "all" || assignment?.sectionId === sectionFilter;
    return matchesTerm && matchesStatus && matchesSection;
  }).sort((a, b) => {
    const aa = a.assignments.find((item) => item.dayId === day.id);
    const ba = b.assignments.find((item) => item.dayId === day.id);
    const ap = workspace.posts.find((post) => post.id === aa?.postId)?.sortOrder ?? 9999;
    const bp = workspace.posts.find((post) => post.id === ba?.postId)?.sortOrder ?? 9999;
    return ap - bp || a.helperNumber - b.helperNumber;
  });

  return (
    <Card className="rounded-none border-0 shadow-none sm:rounded-lg sm:border sm:shadow-sm">
      <CardHeader className="p-3 sm:p-6"><div className="flex flex-col gap-4"><CardTitle>Streckenposten</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.2fr)_minmax(12rem,0.8fr)]">
          <ControlGroup label="Veranstaltungstag"><div className="grid grid-cols-2 rounded-lg border bg-slate-50 p-1" role="group" aria-label="Veranstaltungstag">{(["saturday", "sunday"] as const).map((key) => <Button key={key} type="button" variant={dayKey === key ? "default" : "ghost"} className="min-h-11 px-2" aria-pressed={dayKey === key} onClick={() => onDayChange(key)}>{key === "saturday" ? "Samstag" : "Sonntag"}</Button>)}</div></ControlGroup>
          <ControlGroup label="Darstellung"><div className="grid grid-cols-3 rounded-lg border bg-slate-50 p-1" role="group" aria-label="Darstellung"><Button type="button" variant={mode === "list" ? "default" : "ghost"} className="min-h-11 px-1 sm:px-2" aria-pressed={mode === "list"} onClick={() => setMode("list")}><List className="mr-1 h-4 w-4 shrink-0" />Liste</Button><Button type="button" variant={mode === "overview" ? "default" : "ghost"} className="min-h-11 px-1 sm:px-2" aria-pressed={mode === "overview"} onClick={() => setMode("overview")}><MapPinned className="mr-1 h-4 w-4 shrink-0" /><span className="truncate">Übersicht</span></Button><Button type="button" variant={mode === "map" ? "default" : "ghost"} className="min-h-11 px-1 sm:px-2" aria-pressed={mode === "map"} onClick={() => setMode("map")}><Map className="mr-1 h-4 w-4 shrink-0" />Karte</Button></div></ControlGroup>
          <ControlGroup label="Sollbesetzung"><div className="grid grid-cols-2 rounded-lg border bg-slate-50 p-1" role="group" aria-label="Sollbesetzung"><Button type="button" variant={targetMode === "normal" ? "default" : "ghost"} className="min-h-11 px-2" aria-pressed={targetMode === "normal"} onClick={() => onTargetModeChange("normal")}>Normal</Button><Button type="button" variant={targetMode === "emergency" ? "default" : "ghost"} className="min-h-11 px-2" aria-pressed={targetMode === "emergency"} onClick={() => onTargetModeChange("emergency")}>Notfall</Button></div></ControlGroup>
        </div></div></CardHeader>
      <CardContent className="space-y-4 p-3 pt-0 sm:p-6 sm:pt-0">
        {mode === "list" ? <>
          <div className="grid gap-3 rounded-xl border bg-slate-50 p-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-medium text-slate-600">Suche<span className="relative"><Input className="h-11 pr-10 text-base sm:text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Helfernummer" />{search && <button type="button" className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Suche leeren" onClick={() => setSearch("")}><X className="h-4 w-4" /></button>}</span></label><Filter label="Abschnitt" value={sectionFilter} onChange={setSectionFilter} options={[{ value: "all", label: "Alle Abschnitte" }, ...workspace.sections.map((section) => ({ value: section.id, label: section.name }))]} /><Filter label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Alle Status" }, ...Object.entries(marshalStatusLabels).map(([value, label]) => ({ value, label }))]} /></div>
          <div className="overflow-hidden rounded-lg border bg-white text-sm">
            <div className="hidden grid-cols-[5rem_minmax(12rem,1fr)_minmax(12rem,1fr)_10rem] gap-3 border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>Nr.</span><span>Name</span><span>Posten</span><span>Status</span></div>
            {people.map((person) => { const assignment = person.assignments.find((item) => item.dayId === day.id); const displayed = displayedAssignment(person); const key = rowKey(person.id); const disabled = !canWrite || busy || savingRows.has(key) || !person.isActive || person.noDeployment; return <div key={person.id} className={cn("grid gap-3 border-b p-3 last:border-b-0 md:grid-cols-[5rem_minmax(12rem,1fr)_minmax(12rem,1fr)_10rem] md:items-center md:gap-3 md:py-2", (person.noDeployment || !person.isActive) && "bg-red-50 text-red-900")}><span className="hidden text-slate-500 md:block">{person.helperNumber}</span><div className="min-w-0"><button type="button" className="break-words text-left font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button><span className="ml-1 text-xs text-slate-500 md:hidden">#{person.helperNumber}</span>{person.noDeployment ? <span className="ml-2 text-xs font-semibold">⚠ kein Einsatz</span> : !person.isActive && <span className="ml-2 text-xs font-semibold">Inaktiv</span>}{(assignment?.note ?? person.participation.note) && <span className="block truncate text-xs text-slate-500" title={assignment?.note ?? person.participation.note ?? undefined}>{assignment?.note ?? person.participation.note}</span>}</div><div className="grid min-w-0 gap-3 sm:grid-cols-2 md:contents"><label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600 md:contents"><span className="md:sr-only">Posten</span><AssignmentSelect value={displayed.assignmentValue} workspace={workspace} day={day} targetMode={targetMode} currentPersonId={person.id} disabled={disabled} displayedAssignment={displayedAssignment} onChange={(value) => void saveOptimistically(person, displayed.status, value)} /></label><label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600 md:contents"><span className="md:sr-only">Status</span><StatusSelect value={displayed.status} disabled={disabled} onChange={(status) => void saveOptimistically(person, status, displayed.assignmentValue)} /></label></div></div>; })}
          </div>
          {people.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Keine Streckenposten-Helfer entsprechen den Filtern.</p>}
        </> : mode === "overview" ? <MarshalPlanningOverview workspace={workspace} day={day} targetMode={targetMode} canWrite={canWrite} busy={busy} onAssign={onSave} onReplace={onReplace} /> : <MarshalPlanningMap workspace={workspace} day={day} targetMode={targetMode} canWrite={canWrite} busy={busy} onAssign={onSave} onReplace={onReplace} />}
      </CardContent>
    </Card>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) { return <div className="min-w-0"><p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>{children}</div>; }
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="grid gap-1 text-xs font-medium text-slate-600">{label}<select className="h-11 min-w-0 rounded-md border bg-white px-3 text-base font-normal text-slate-950 sm:text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function StatusSelect({ value, disabled, onChange }: { value: MarshalCommitmentStatus; disabled: boolean; onChange: (status: MarshalCommitmentStatus) => void }) { return <select aria-label="Zusage" className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-base sm:text-sm md:h-9" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MarshalCommitmentStatus)}>{Object.entries(marshalStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>; }
function AssignmentSelect({ value, workspace, day, targetMode, currentPersonId, disabled, displayedAssignment, onChange }: { value: string; workspace: MarshalWorkspace; day: MarshalDay; targetMode: PlanningTargetMode; currentPersonId: string; disabled: boolean; displayedAssignment: (person: MarshalPerson) => { assignmentValue: string }; onChange: (value: string) => void }) {
  return <select aria-label="Streckenposten" className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-base sm:text-sm md:h-9" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="none">Nicht eingeteilt</option>{workspace.posts.filter((post) => post.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((post) => {
    const assignedPeople = workspace.people.filter((person) => !person.noDeployment && displayedAssignment(person).assignmentValue === `post:${post.id}`);
    const currentIsAssigned = assignedPeople.some((person) => person.id === currentPersonId);
    const full = assignedPeople.length >= getPostTarget(post, targetMode) && !currentIsAssigned;
    return <option key={post.id} value={`post:${post.id}`} disabled={full}>Posten {post.code}{full ? " (Sollplätze belegt)" : ""}</option>;
  })}</select>;
}

function normalizeArea(value: string) { return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de"); }
