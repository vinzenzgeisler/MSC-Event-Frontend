import { useMemo, useState } from "react";
import { List, Map, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarshalTrackSvg, type TrackLeader, type TrackPost } from "@/components/features/admin/marshal-track-svg";
import { marshalStatusLabels, StatusBadge } from "@/components/features/admin/marshal-status";
import { cn } from "@/lib/utils";
import type { MarshalCommitmentStatus, MarshalDay, MarshalPerson, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  day: MarshalDay;
  dayKey: "saturday" | "sunday";
  canWrite: boolean;
  busy: boolean;
  onDayChange: (day: "saturday" | "sunday") => void;
  onPersonOpen: (person: MarshalPerson) => void;
  onSave: (person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string) => Promise<boolean>;
};

export function MarshalStreckenpostenView({ workspace, day, dayKey, canWrite, busy, onDayChange, onPersonOpen, onSave }: Props) {
  const [mode, setMode] = useState<"list" | "map">("list");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [quickPersonId, setQuickPersonId] = useState("");

  const trackPosts: TrackPost[] = useMemo(() => workspace.posts.filter((post) => post.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((post) => ({
    ...post,
    staffCount: workspace.people.filter((person) => person.assignments.some((assignment) => assignment.dayId === day.id && assignment.postId === post.id && assignment.commitmentStatus === "accepted")).length,
    target: post.targetStaff,
  })), [day.id, workspace.people, workspace.posts]);
  const leaders: TrackLeader[] = useMemo(() => [...workspace.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => ({
    section,
    staffCount: workspace.people.filter((person) => person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id && assignment.commitmentStatus === "accepted")).length,
    target: 1,
  })), [day.id, workspace.people, workspace.sections]);
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
  const selectedPost = selectedMarker?.startsWith("post:") ? workspace.posts.find((post) => `post:${post.id}` === selectedMarker) : undefined;
  const selectedSection = selectedMarker?.startsWith("leader:") ? workspace.sections.find((section) => `leader:${section.id}` === selectedMarker) : undefined;
  const assigned = workspace.people.filter((person) => person.assignments.some((assignment) => assignment.dayId === day.id && (selectedPost ? assignment.postId === selectedPost.id : selectedSection ? assignment.role === "section_leader" && assignment.sectionId === selectedSection.id : false)));
  const available = workspace.people.filter((person) => person.isActive && !person.noDeployment && !assigned.some((item) => item.id === person.id));

  async function quickAssign() {
    const person = workspace.people.find((item) => item.id === quickPersonId);
    if (!person || !selectedMarker) return;
    const saved = await onSave(person, "accepted", selectedMarker);
    if (saved) setQuickPersonId("");
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><CardTitle>Streckenposten</CardTitle><p className="mt-1 text-sm text-slate-600">Zusagen, Abschnittsleitungen und Postenbesetzung.</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Veranstaltungstag">{(["saturday", "sunday"] as const).map((key) => <Button key={key} type="button" size="sm" variant={dayKey === key ? "default" : "ghost"} aria-pressed={dayKey === key} onClick={() => onDayChange(key)}>{key === "saturday" ? "Samstag" : "Sonntag"}</Button>)}</div>
          <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Darstellung"><Button type="button" size="sm" variant={mode === "list" ? "default" : "ghost"} aria-pressed={mode === "list"} onClick={() => setMode("list")}><List className="mr-1.5 h-4 w-4" />Liste</Button><Button type="button" size="sm" variant={mode === "map" ? "default" : "ghost"} aria-pressed={mode === "map"} onClick={() => setMode("map")}><Map className="mr-1.5 h-4 w-4" />Karte</Button></div>
        </div></div></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {mode === "list" ? <>
          <div className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-medium text-slate-600">Suche<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Helfernummer" /></label><Filter label="Abschnitt" value={sectionFilter} onChange={setSectionFilter} options={[{ value: "all", label: "Alle Abschnitte" }, ...workspace.sections.map((section) => ({ value: section.id, label: section.name }))]} /><Filter label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Alle Status" }, ...Object.entries(marshalStatusLabels).map(([value, label]) => ({ value, label }))]} /></div>
          <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Nr.</th><th className="p-3">Name</th><th className="p-3">Posten</th><th className="p-3">Rolle</th><th className="p-3">Status</th><th className="p-3">Bemerkung</th></tr></thead><tbody>
            {[...workspace.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => {
              const leader = workspace.people.find((person) => person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id));
              const assignment = leader?.assignments.find((item) => item.dayId === day.id);
              return <tr key={`leader-slot:${section.id}`} className="border-b bg-violet-50/50 align-top"><td className="p-3 font-semibold text-violet-700">{section.leaderCode}</td><td className="p-3">{leader ? <button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(leader)}>{leader.lastName}, {leader.firstName}</button> : canWrite ? <select aria-label={`${section.leaderCode} besetzen`} className="h-10 min-w-52 rounded-md border bg-white px-2 text-sm" value="" disabled={busy} onChange={(event) => { const person = workspace.people.find((item) => item.id === event.target.value); if (person) void onSave(person, "accepted", `leader:${section.id}`); }}><option value="">Abschnittsleitung wählen …</option>{workspace.people.filter((person) => person.isActive && !person.noDeployment).map((person) => <option key={person.id} value={person.id}>{person.helperNumber} · {person.lastName}, {person.firstName}</option>)}</select> : "Nicht besetzt"}</td><td className="p-3 font-semibold">{section.leaderCode}</td><td className="p-3">Abschnittsleitung</td><td className="p-3">{leader ? <StatusSelect value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy || leader.noDeployment} onChange={(status) => void onSave(leader, status, `leader:${section.id}`)} /> : <StatusBadge status="not_asked" />}</td><td className="p-3 text-slate-500">{assignment?.note ?? "—"}</td></tr>;
            })}
            {people.filter((person) => person.assignments.find((item) => item.dayId === day.id)?.role !== "section_leader").map((person) => {
            const assignment = person.assignments.find((item) => item.dayId === day.id);
            const assignmentValue = assignment?.postId ? `post:${assignment.postId}` : assignment?.role === "section_leader" && assignment.sectionId ? `leader:${assignment.sectionId}` : "none";
            return <tr key={person.id} className={cn("border-b align-top", person.noDeployment && "bg-red-50 text-red-900")}><td className="p-3 text-slate-500">{person.helperNumber}</td><td className="p-3"><button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button>{person.noDeployment && <span className="ml-2 text-xs font-semibold">⚠ kein Einsatz</span>}</td><td className="p-3"><AssignmentSelect value={assignmentValue} workspace={workspace} disabled={!canWrite || busy || person.noDeployment} onChange={(value) => void onSave(person, assignment?.commitmentStatus ?? "pending", value)} /></td><td className="p-3">{assignment?.role === "section_leader" ? "Abschnittsleitung" : assignment?.postId ? "Posten" : "—"}</td><td className="p-3"><StatusSelect value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy || person.noDeployment} onChange={(status) => void onSave(person, status, assignmentValue === "none" ? "" : assignmentValue)} /></td><td className="p-3 text-slate-500">{assignment?.note ?? person.participation.note ?? "—"}</td></tr>;
          })}</tbody></table></div>{people.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Keine Helfer entsprechen den Filtern; die Abschnittsleiter-Slots bleiben zur direkten Besetzung sichtbar.</p>}
        </> : <>
          <div className="overflow-hidden rounded-xl border bg-slate-50"><MarshalTrackSvg className="h-auto min-w-[720px] w-full" posts={trackPosts} sections={workspace.sections} leaders={leaders} selectedMarker={selectedMarker} onPostClick={(post) => setSelectedMarker(`post:${post.id}`)} onLeaderClick={(leader) => setSelectedMarker(`leader:${leader.section.id}`)} /></div>
          <section className="rounded-xl border p-4" aria-live="polite"><h3 className="font-semibold">{selectedPost ? `Posten ${selectedPost.code}` : selectedSection ? selectedSection.leaderCode : "Markierung wählen"}</h3>{!selectedPost && !selectedSection ? <p className="mt-1 text-sm text-slate-500">Posten oder Abschnittsleitung auf der Karte auswählen.</p> : <><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{assigned.map((person) => <button type="button" key={person.id} className="rounded-lg border p-3 text-left hover:bg-slate-50" onClick={() => onPersonOpen(person)}><strong>{person.lastName}, {person.firstName}</strong><div className="mt-1"><StatusBadge status={person.assignments.find((item) => item.dayId === day.id)?.commitmentStatus ?? "not_asked"} /></div></button>)}</div>{assigned.length === 0 && <p className="mt-2 text-sm text-red-700">Noch niemand zugewiesen.</p>}{canWrite && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="marshal-quick-assign">Person zuweisen</label><select id="marshal-quick-assign" className="h-10 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm" value={quickPersonId} onChange={(event) => setQuickPersonId(event.target.value)}><option value="">Person hinzufügen …</option>{available.map((person) => <option key={person.id} value={person.id}>{person.helperNumber} · {person.lastName}, {person.firstName}</option>)}</select><Button type="button" disabled={!quickPersonId || busy} onClick={() => void quickAssign()}><UserPlus className="mr-2 h-4 w-4" />Zuweisen</Button></div>}</>}</section>
        </>}
      </CardContent>
    </Card>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="grid gap-1 text-xs font-medium text-slate-600">{label}<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal text-slate-950" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function StatusSelect({ value, disabled, onChange }: { value: MarshalCommitmentStatus; disabled: boolean; onChange: (status: MarshalCommitmentStatus) => void }) { return <select aria-label="Zusage" className="h-10 rounded-md border bg-white px-2 text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MarshalCommitmentStatus)}>{Object.entries(marshalStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>; }
function AssignmentSelect({ value, workspace, disabled, onChange }: { value: string; workspace: MarshalWorkspace; disabled: boolean; onChange: (value: string) => void }) { return <select aria-label="Posten oder Funktion" className="h-10 min-w-48 rounded-md border bg-white px-2 text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="none">Nicht eingeteilt</option>{workspace.sections.map((section) => <option key={section.id} value={`leader:${section.id}`}>{section.leaderCode} – {section.name}</option>)}{workspace.posts.filter((post) => post.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((post) => <option key={post.id} value={`post:${post.id}`}>Posten {post.code}</option>)}</select>; }
