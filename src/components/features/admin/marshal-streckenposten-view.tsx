import { useEffect, useRef, useState } from "react";
import { List, Map, MapPinned, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { statusForTargetSelection } from "@/components/features/admin/marshal-assignment-helpers";
import { DoubleBookingWarning, EventAssignmentBadges, sameDayConflicts } from "@/components/features/admin/marshal-event-assignment-indicators";
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

type SortMode = "post" | "name" | "helperNumber" | "status";

export function MarshalStreckenpostenView({ workspace, day, dayKey, canWrite, busy, targetMode, onTargetModeChange, onDayChange, onPersonOpen, onListSave, onSave, onReplace }: Props) {
  const [mode, setMode] = useState<"list" | "overview" | "map">("list");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("post");
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
  const serverAssignmentForDay = (person: MarshalPerson, dayId: string) => {
    const assignment = person.assignments.find((item) => item.dayId === dayId);
    return {
      assignmentValue: assignment?.postId ? `post:${assignment.postId}` : "none",
      status: assignment?.commitmentStatus ?? ("not_asked" as MarshalCommitmentStatus),
    };
  };

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
    setOptimisticAssignments((current) => ({
      ...current,
      [key]: {
        assignmentValue: keepAssignment && assignmentValue ? assignmentValue : "none",
        status: nextStatus,
      },
    }));
    savingRowsRef.current.add(key);
    setSavingRows((current) => new Set(current).add(key));
    let saved = false;
    try {
      saved = await onListSave(person, requestedStatus, assignmentValue === "none" ? "" : assignmentValue);
    } finally {
      if (!saved)
        setOptimisticAssignments((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      savingRowsRef.current.delete(key);
      setSavingRows((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
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
  const people = workspace.people
    .filter((person) => {
      const assignment = person.assignments.find((item) => item.dayId === day.id);
      const isTrackHelper = person.activityAreas.some((area) => trackAreaAliases.has(normalizeArea(area)));
      if (!isTrackHelper || assignment?.role === "section_leader") return false;
      const matchesTerm = !term || `${person.helperNumber} ${person.lastName} ${person.firstName} ${assignment?.functionCode ?? ""}`.toLocaleLowerCase("de").includes(term);
      const matchesStatus = statusFilter === "all" || (assignment?.commitmentStatus ?? "not_asked") === statusFilter;
      const matchesSection = sectionFilter === "all" || assignment?.sectionId === sectionFilter;
      return matchesTerm && matchesStatus && matchesSection;
    })
    .sort((a, b) => {
      const aa = a.assignments.find((item) => item.dayId === day.id);
      const ba = b.assignments.find((item) => item.dayId === day.id);
      if (sortMode === "name")
        return (
          a.lastName.localeCompare(b.lastName, "de", { sensitivity: "base" }) ||
          a.firstName.localeCompare(b.firstName, "de", {
            sensitivity: "base",
          }) ||
          a.helperNumber - b.helperNumber
        );
      if (sortMode === "helperNumber") return a.helperNumber - b.helperNumber;
      if (sortMode === "status") {
        const statusOrder: Record<MarshalCommitmentStatus, number> = {
          accepted: 0,
          pending: 1,
          tentative: 2,
          declined: 3,
          not_asked: 4,
        };
        const ar = aa ? statusOrder[aa.commitmentStatus] : 5;
        const br = ba ? statusOrder[ba.commitmentStatus] : 5;
        return ar - br || a.lastName.localeCompare(b.lastName, "de", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "de", { sensitivity: "base" });
      }
      const ap = workspace.posts.find((post) => post.id === aa?.postId)?.sortOrder ?? 9999;
      const bp = workspace.posts.find((post) => post.id === ba?.postId)?.sortOrder ?? 9999;
      return ap - bp || a.helperNumber - b.helperNumber;
    });
  const staffing = workspace.days.map((summaryDay) => {
    const target = workspace.posts.filter((post) => post.isActive).reduce((sum, post) => sum + getPostTarget(post, targetMode), 0);
    const assignments = workspace.people.map((person) => (summaryDay.id === day.id ? displayedAssignment(person) : serverAssignmentForDay(person, summaryDay.id))).filter((item) => item.assignmentValue !== "none" && !["declined", "not_asked"].includes(item.status));
    const accepted = assignments.filter((item) => item.status === "accepted").length;
    return {
      day: summaryDay,
      target,
      assigned: assignments.length,
      accepted,
      dot: assignments.length < target ? "bg-red-500" : accepted < target ? "bg-amber-500" : "bg-emerald-500",
    };
  });

  return (
    <section className="min-w-0 bg-white" aria-labelledby="streckenposten-title">
      <header className="border-b border-slate-200 px-3 py-4 sm:px-4 xl:px-0 xl:pt-0">
        <h1 id="streckenposten-title" className="text-xl font-semibold tracking-tight text-slate-900">
          Streckenposten
        </h1>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
          <ControlGroup label="Veranstaltungstag">
            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-0.5" role="group" aria-label="Veranstaltungstag">
              {(["saturday", "sunday"] as const).map((key) => (
                <Button key={key} type="button" size="sm" variant={dayKey === key ? "default" : "ghost"} className="min-h-10 px-1 sm:px-2" aria-pressed={dayKey === key} onClick={() => onDayChange(key)}>
                  {key === "saturday" ? "Samstag" : "Sonntag"}
                </Button>
              ))}
            </div>
          </ControlGroup>
          <ControlGroup label="Darstellung" className="col-span-2 row-start-2 sm:col-span-1 sm:row-auto">
            <div className="grid grid-cols-3 rounded-md bg-slate-100 p-0.5" role="group" aria-label="Darstellung">
              <Button type="button" size="sm" variant={mode === "list" ? "default" : "ghost"} className="min-h-10 px-1" aria-pressed={mode === "list"} onClick={() => setMode("list")}>
                <List className="mr-1 h-4 w-4 shrink-0" />
                Liste
              </Button>
              <Button type="button" size="sm" variant={mode === "overview" ? "default" : "ghost"} className="min-h-10 px-1" aria-pressed={mode === "overview"} onClick={() => setMode("overview")}>
                <MapPinned className="mr-1 h-4 w-4 shrink-0" />
                <span className="truncate">Übersicht</span>
              </Button>
              <Button type="button" size="sm" variant={mode === "map" ? "default" : "ghost"} className="min-h-10 px-1" aria-pressed={mode === "map"} onClick={() => setMode("map")}>
                <Map className="mr-1 h-4 w-4 shrink-0" />
                Karte
              </Button>
            </div>
          </ControlGroup>
          <ControlGroup label="Sollbesetzung">
            <div className="grid grid-cols-2 rounded-md bg-slate-100 p-0.5" role="group" aria-label="Sollbesetzung">
              <Button type="button" size="sm" variant={targetMode === "normal" ? "default" : "ghost"} className="min-h-10 px-1 sm:px-2" aria-pressed={targetMode === "normal"} onClick={() => onTargetModeChange("normal")}>
                Normal
              </Button>
              <Button type="button" size="sm" variant={targetMode === "emergency" ? "default" : "ghost"} className="min-h-10 px-1 sm:px-2" aria-pressed={targetMode === "emergency"} onClick={() => onTargetModeChange("emergency")}>
                Notfall
              </Button>
            </div>
          </ControlGroup>
        </div>
      </header>
      <div className="space-y-4 px-3 py-4 sm:px-4 xl:px-0">
        {mode === "list" ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-slate-50 px-3 py-2 text-xs" aria-label="Besetzungsübersicht">
              {staffing.map((item) => (
                <span key={item.day.id} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", item.dot)} aria-hidden="true" />
                  <strong>{item.day.dayKey === "saturday" ? "Sa" : "So"}</strong>
                  <span>
                    {item.assigned}/{item.target} besetzt
                  </span>
                  <span className="text-slate-500">· {item.accepted} bestätigt</span>
                </span>
              ))}
            </div>
            <div className="grid gap-3 border-y border-slate-200 py-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Suche
                <span className="relative">
                  <Input className="h-10 pr-10 text-base sm:text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Helfernummer" />
                  {search && (
                    <button type="button" className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Suche leeren" onClick={() => setSearch("")}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </label>
              <Filter
                label="Abschnitt"
                value={sectionFilter}
                onChange={setSectionFilter}
                options={[
                  { value: "all", label: "Alle Abschnitte" },
                  ...workspace.sections.map((section) => ({
                    value: section.id,
                    label: section.name,
                  })),
                ]}
              />
              <Filter label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Alle Status" }, ...Object.entries(marshalStatusLabels).map(([value, label]) => ({ value, label }))]} />
            </div>
            <div className="flex justify-end">
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Sortierung
                <select className="h-11 min-w-52 rounded-md border bg-white px-3 text-base font-normal text-slate-950 sm:text-sm" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                  <option value="post">Nach Posten</option>
                  <option value="name">Nach Name (A→Z)</option>
                  <option value="helperNumber">Nach Helfernummer</option>
                  <option value="status">Nach Status</option>
                </select>
              </label>
            </div>
            <div className="min-w-0 border-y border-slate-200 bg-white text-sm">
              <div className="hidden grid-cols-[5rem_minmax(12rem,1fr)_minmax(12rem,1fr)_10rem] gap-3 border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>Nr.</span>
                <span>Name</span>
                <span>Posten</span>
                <span>Status</span>
              </div>
              {people.map((person) => {
                const assignment = person.assignments.find((item) => item.dayId === day.id);
                const displayed = displayedAssignment(person);
                const conflicts =
                  displayed.assignmentValue !== "none"
                    ? sameDayConflicts(workspace, person, day.eventDate, {
                        dayId: day.id,
                      })
                    : [];
                const key = rowKey(person.id);
                const disabled = !canWrite || busy || savingRows.has(key) || !person.isActive || person.noDeployment;
                return (
                  <div key={person.id} className={cn("grid gap-3 border-b p-3 last:border-b-0 md:grid-cols-[5rem_minmax(12rem,1fr)_minmax(12rem,1fr)_10rem] md:items-center md:gap-3 md:py-2", (person.noDeployment || !person.isActive) && "bg-red-50 text-red-900")}>
                    <span className="hidden text-slate-500 md:block">{person.helperNumber}</span>
                    <div className="min-w-0">
                      <button type="button" className="break-words text-left font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>
                        {person.lastName}, {person.firstName}
                      </button>
                      <EventAssignmentBadges person={person} workspace={workspace} />
                      <span className="ml-1 text-xs text-slate-500 md:hidden">#{person.helperNumber}</span>
                      {person.noDeployment ? <span className="ml-2 text-xs font-semibold">⚠ kein Einsatz</span> : !person.isActive && <span className="ml-2 text-xs font-semibold">Inaktiv</span>}
                      {assignment?.note && (
                        <span className="block truncate text-xs text-slate-500" title={assignment.note}>
                          {assignment.note}
                        </span>
                      )}
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:contents">
                      <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600 md:contents">
                        <span className="md:sr-only">Posten</span>
                        <span className="flex min-w-0 items-center">
                          <AssignmentSelect value={displayed.assignmentValue} workspace={workspace} day={day} targetMode={targetMode} currentPersonId={person.id} disabled={disabled} displayedAssignment={displayedAssignment} onChange={(value) => void saveOptimistically(person, displayed.status, value)} />
                          <DoubleBookingWarning labels={conflicts} day={day} />
                        </span>
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600 md:contents">
                        <span className="md:sr-only">Status</span>
                        <StatusSelect value={displayed.status} disabled={disabled} onChange={(status) => void saveOptimistically(person, status, displayed.assignmentValue)} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            {people.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Keine Streckenposten-Helfer entsprechen den Filtern.</p>}
          </>
        ) : mode === "overview" ? (
          <MarshalPlanningOverview workspace={workspace} day={day} targetMode={targetMode} canWrite={canWrite} busy={busy} onAssign={onSave} onReplace={onReplace} />
        ) : (
          <MarshalPlanningMap workspace={workspace} day={day} targetMode={targetMode} canWrite={canWrite} busy={busy} onAssign={onSave} onReplace={onReplace} />
        )}
      </div>
    </section>
  );
}

function ControlGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-0.5 text-[11px] font-semibold text-slate-600 sm:text-xs">{label}</p>
      {children}
    </div>
  );
}
function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <select className="h-10 min-w-0 rounded-md border bg-white px-3 text-base font-normal text-slate-950 sm:text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function StatusSelect({ value, disabled, onChange }: { value: MarshalCommitmentStatus; disabled: boolean; onChange: (status: MarshalCommitmentStatus) => void }) {
  return (
    <select aria-label="Zusage" className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-base sm:text-sm md:h-9" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MarshalCommitmentStatus)}>
      {Object.entries(marshalStatusLabels).map(([status, label]) => (
        <option key={status} value={status}>
          {label}
        </option>
      ))}
    </select>
  );
}
function AssignmentSelect({ value, workspace, day, targetMode, currentPersonId, disabled, displayedAssignment, onChange }: { value: string; workspace: MarshalWorkspace; day: MarshalDay; targetMode: PlanningTargetMode; currentPersonId: string; disabled: boolean; displayedAssignment: (person: MarshalPerson) => { assignmentValue: string }; onChange: (value: string) => void }) {
  return (
    <select aria-label="Streckenposten" className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-base sm:text-sm md:h-9" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="none">Nicht eingeteilt</option>
      {workspace.posts
        .filter((post) => post.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((post) => {
          const assignedPeople = workspace.people.filter((person) => !person.noDeployment && displayedAssignment(person).assignmentValue === `post:${post.id}`);
          const currentIsAssigned = assignedPeople.some((person) => person.id === currentPersonId);
          const full = assignedPeople.length >= getPostTarget(post, targetMode) && !currentIsAssigned;
          return (
            <option key={post.id} value={`post:${post.id}`} disabled={full}>
              Posten {post.code}
              {full ? " (Sollplätze belegt)" : ""}
            </option>
          );
        })}
    </select>
  );
}

function normalizeArea(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
}
