import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarshalConfirmDialog } from "@/components/features/admin/marshal-confirm-dialog";
import { MarshalAreaMultiSelect } from "@/components/features/admin/marshal-area-multi-select";
import { marshalStatusLabels } from "@/components/features/admin/marshal-status";
import { cn } from "@/lib/utils";
import type { MarshalCommitmentStatus, MarshalInitialEventAssignment, MarshalPerson, MarshalPersonInput, MarshalWorkspace } from "@/types/admin-marshals";

const EMPTY_DRAFT = { firstName: "", lastName: "", street: "", zip: "", city: "", birthdate: "", email: "", phone: "", shirtSize: "", activityAreas: [] as string[], note: "", eventAssignment: "none", commitmentStatus: "pending" as MarshalCommitmentStatus };

type SortKey = "helperNumber" | "lastName" | "firstName" | "area" | "status";
type SortDirection = "asc" | "desc";
type SortValue = `${SortKey}:${SortDirection}`;

const DEFAULT_SORT: SortValue = "helperNumber:asc";
const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });
const activeAssignmentStatuses = new Set(["accepted", "pending", "tentative"]);
const EINSATZ_LABEL_MAX_LENGTH = 45;

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "helperNumber:asc", label: "Helfernummer (aufsteigend)" },
  { value: "helperNumber:desc", label: "Helfernummer (absteigend)" },
  { value: "lastName:asc", label: "Nachname (A–Z)" },
  { value: "lastName:desc", label: "Nachname (Z–A)" },
  { value: "firstName:asc", label: "Vorname (A–Z)" },
  { value: "firstName:desc", label: "Vorname (Z–A)" },
  { value: "area:asc", label: "Bereich (A–Z)" },
  { value: "area:desc", label: "Bereich (Z–A)" },
  { value: "status:asc", label: "Status (A–Z)" },
  { value: "status:desc", label: "Status (Z–A)" },
];

function buildEventAssignmentLabels(person: MarshalPerson, workspace: MarshalWorkspace): string[] {
  const labels: string[] = [];

  person.assignments
    .filter((assignment) => activeAssignmentStatuses.has(assignment.commitmentStatus))
    .forEach((assignment) => {
      const day = workspace.days.find((item) => item.id === assignment.dayId);
      const dayLabel = day?.dayKey === "saturday" ? "Sa" : day?.dayKey === "sunday" ? "So" : "";
      const post = workspace.posts.find((item) => item.id === assignment.postId);
      const section = workspace.sections.find((item) => item.id === assignment.sectionId);
      const assignmentLabel = post ? `SP ${post.code}` : section?.leaderCode ?? assignment.functionCode?.trim();
      if (assignmentLabel) labels.push([assignmentLabel, dayLabel].filter(Boolean).join(" "));
    });

  workspace.areaAssignments
    .filter((assignment) => assignment.participationId === person.participation.id && activeAssignmentStatuses.has(assignment.commitmentStatus))
    .forEach((assignment) => {
      const area = workspace.areas.find((item) => item.id === assignment.areaId);
      if (area) labels.push(area.name);
    });

  workspace.shiftAssignments
    .filter((assignment) => assignment.participationId === person.participation.id && activeAssignmentStatuses.has(assignment.commitmentStatus))
    .forEach((assignment) => {
      const shift = workspace.areaShifts.find((item) => item.id === assignment.shiftId);
      const area = workspace.areas.find((item) => item.id === shift?.areaId);
      if (shift && area) labels.push(`${area.name} ${shift.label}`);
    });

  return [...new Set(labels)];
}

function buildFullEinsatzLabel(person: MarshalPerson, workspace: MarshalWorkspace): string {
  return buildEventAssignmentLabels(person, workspace).join(" · ");
}

export function buildEinsatzLabel(person: MarshalPerson, workspace: MarshalWorkspace): string {
  const label = buildFullEinsatzLabel(person, workspace);
  return label.length > EINSATZ_LABEL_MAX_LENGTH ? `${label.slice(0, EINSATZ_LABEL_MAX_LENGTH - 1)}…` : label;
}

type Props = {
  workspace: MarshalWorkspace;
  canWrite: boolean;
  busy: boolean;
  onPersonOpen: (person: MarshalPerson) => void;
  onCreate: (input: MarshalPersonInput, initialAssignment: MarshalInitialEventAssignment) => Promise<boolean>;
  onDelete: (person: MarshalPerson) => Promise<boolean>;
};

export function MarshalStammdatenView({ workspace, canWrite, busy, onPersonOpen, onCreate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("all");
  const [active, setActive] = useState("all");
  const [onlyNoDeployment, setOnlyNoDeployment] = useState(false);
  const [eventAssignment, setEventAssignment] = useState("all");
  const [sort, setSort] = useState<SortValue>(DEFAULT_SORT);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [deletePerson, setDeletePerson] = useState<MarshalPerson | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const areas = useMemo(() => [...new Set(workspace.people.flatMap((person) => person.activityAreas))].sort((a, b) => a.localeCompare(b, "de")), [workspace.people]);
  const term = search.trim().toLocaleLowerCase("de");
  const people = useMemo(() => {
    const [sortKey, sortDirection] = sort.split(":") as [SortKey, SortDirection];
    const direction = sortDirection === "asc" ? 1 : -1;
    const getTextValue = (person: MarshalPerson): string => {
      if (sortKey === "lastName") return person.lastName;
      if (sortKey === "firstName") return person.firstName;
      if (sortKey === "area") return [...person.activityAreas].sort(collator.compare).join(", ");
      return person.noDeployment ? "Kein Einsatz" : person.isActive ? "Aktiv" : "Inaktiv";
    };

    return workspace.people
      .filter((person) => (!term || `${person.helperNumber} ${person.lastName} ${person.firstName} ${person.email ?? ""}`.toLocaleLowerCase("de").includes(term))
        && (area === "all" || person.activityAreas.includes(area))
        && (active === "all" || (active === "active" ? person.isActive : !person.isActive))
        && (!onlyNoDeployment || person.noDeployment)
        && (eventAssignment === "all" || (eventAssignment === "assigned" ? buildEventAssignmentLabels(person, workspace).length > 0 : buildEventAssignmentLabels(person, workspace).length === 0)))
      .sort((a, b) => {
        const comparison = sortKey === "helperNumber"
          ? a.helperNumber - b.helperNumber
          : collator.compare(getTextValue(a), getTextValue(b));
        return comparison * direction || a.helperNumber - b.helperNumber;
      });
  }, [active, area, eventAssignment, onlyNoDeployment, sort, term, workspace]);
  const einsatzLabels = useMemo(() => new Map(workspace.people.map((person) => [person.id, {
    compact: buildEinsatzLabel(person, workspace),
    full: buildFullEinsatzLabel(person, workspace),
    labels: buildEventAssignmentLabels(person, workspace),
  }])), [workspace]);
  async function createPerson() {
    const [kind, id] = draft.eventAssignment.split(":", 2);
    const initialAssignment: MarshalInitialEventAssignment = kind === "area" && id
      ? { kind: "area", areaId: id, commitmentStatus: draft.commitmentStatus }
      : kind === "track" && id
        ? { kind: "track", dayId: id, commitmentStatus: draft.commitmentStatus }
        : { kind: "none" };
    const saved = await onCreate({ firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), street: draft.street.trim() || null, zip: draft.zip.trim() || null, city: draft.city.trim() || null, birthdate: draft.birthdate || null, email: draft.email.trim() || null, phone: draft.phone.trim() || null, shirtSize: draft.shirtSize.trim() || null, activityAreas: draft.activityAreas, note: draft.note.trim() || null }, initialAssignment);
    if (saved) setDraft(EMPTY_DRAFT);
  }
  async function confirmDelete() {
    if (!deletePerson || deleteConfirmation !== "DSGVO-LÖSCHEN") return;
    const deleted = await onDelete(deletePerson);
    if (deleted) { setDeletePerson(null); setDeleteConfirmation(""); }
  }

  return <>
    <Card><CardHeader className="p-4 sm:p-6"><CardTitle>Helferstammdaten</CardTitle></CardHeader><CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      <div className="rounded-xl border bg-slate-50 p-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><label className="grid gap-1 text-xs font-medium text-slate-600 xl:col-span-2">Suche<span className="relative"><Input className="pr-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Nummer oder E-Mail" />{search && <button type="button" aria-label="Suche leeren" className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded text-slate-500 hover:bg-slate-100" onClick={() => setSearch("")}><X className="h-4 w-4" /></button>}</span></label><label className="grid gap-1 text-xs font-medium text-slate-600">Standardbereich<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={area} onChange={(event) => setArea(event.target.value)}><option value="all">Alle Standardbereiche</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-600">Diese Veranstaltung<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={eventAssignment} onChange={(event) => setEventAssignment(event.target.value)}><option value="all">Alle Zuordnungen</option><option value="assigned">Mit Zuordnung</option><option value="unassigned">Noch ohne Zuordnung</option></select></label><label className="grid gap-1 text-xs font-medium text-slate-600">Stammdatenstatus<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={active} onChange={(event) => setActive(event.target.value)}><option value="all">Aktiv und inaktiv</option><option value="active">Nur aktiv</option><option value="inactive">Nur inaktiv</option></select></label><label className="flex min-h-10 items-center gap-2 self-end rounded-md border bg-white px-3 text-sm"><input type="checkbox" checked={onlyNoDeployment} onChange={(event) => setOnlyNoDeployment(event.target.checked)} />Kein Einsatz</label></div>
        <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end sm:justify-between lg:hidden"><label className="grid flex-1 gap-1 text-xs font-medium text-slate-600"><span className="flex items-center gap-1"><SlidersHorizontal className="h-3.5 w-3.5" />Sortieren</span><select className="h-11 rounded-md border bg-white px-3 text-base font-normal sm:text-sm" value={sort} onChange={(event) => setSort(event.target.value as SortValue)}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
        {(search || area !== "all" || active !== "all" || eventAssignment !== "all" || onlyNoDeployment) && <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs"><span className="font-medium text-slate-600">Aktive Filter</span>{search && <FilterChip label={`Suche: ${search}`} onRemove={() => setSearch("")} />}{area !== "all" && <FilterChip label={`Standard: ${area}`} onRemove={() => setArea("all")} />}{eventAssignment !== "all" && <FilterChip label={eventAssignment === "assigned" ? "Mit Veranstaltungszuordnung" : "Ohne Veranstaltungszuordnung"} onRemove={() => setEventAssignment("all")} />}{active !== "all" && <FilterChip label={active === "active" ? "Aktiv" : "Inaktiv"} onRemove={() => setActive("all")} />}{onlyNoDeployment && <FilterChip label="Kein Einsatz" onRemove={() => setOnlyNoDeployment(false)} />}<Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setSearch(""); setArea("all"); setActive("all"); setEventAssignment("all"); setOnlyNoDeployment(false); }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Alle zurücksetzen</Button></div>}
      </div>
      {canWrite && <details className="rounded-xl border bg-slate-50/60 p-4"><summary className="min-h-10 cursor-pointer py-2 font-medium"><Plus className="mr-2 inline h-4 w-4" />Neue Person</summary><div className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([[
        "firstName", "Vorname", "text"], ["lastName", "Nachname", "text"], ["street", "Straße und Hausnummer", "text"], ["zip", "PLZ", "text"], ["city", "Ort", "text"], ["birthdate", "Geburtstag", "date"], ["email", "E-Mail", "email"], ["phone", "Telefon", "tel"], ["shirtSize", "T-Shirt-Größe", "text"], ["note", "Bemerkung", "text"]] as const).map(([key, label, type]) => <label key={key} className={cn("grid gap-1 text-xs font-medium text-slate-600", key === "note" && "sm:col-span-2")}>{label}{key === "firstName" || key === "lastName" ? <span className="sr-only"> (Pflichtfeld)</span> : null}<Input type={type} value={draft[key]} required={key === "firstName" || key === "lastName"} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}</div><MarshalAreaMultiSelect areas={workspace.areas} value={draft.activityAreas} onChange={(activityAreas) => setDraft({ ...draft, activityAreas })} /><div className="grid gap-3 rounded-lg border bg-white p-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium text-slate-600">Direkte Zuordnung in dieser Veranstaltung<select className="h-11 rounded-md border bg-white px-3 text-sm font-normal" value={draft.eventAssignment} onChange={(event) => setDraft({ ...draft, eventAssignment: event.target.value })}><option value="none">Noch keine Zuordnung</option><optgroup label="Streckenposten">{workspace.days.map((day) => <option key={day.id} value={`track:${day.id}`}>Streckenposten · {day.label}</option>)}</optgroup><optgroup label="Helferbereiche">{[...workspace.areas].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => <option key={item.id} value={`area:${item.id}`}>{item.name}</option>)}</optgroup></select></label><label className="grid gap-1 text-xs font-medium text-slate-600">Status der Zuordnung<select className="h-11 rounded-md border bg-white px-3 text-sm font-normal disabled:bg-slate-100" value={draft.commitmentStatus} disabled={draft.eventAssignment === "none"} onChange={(event) => setDraft({ ...draft, commitmentStatus: event.target.value as MarshalCommitmentStatus })}>{Object.entries(marshalStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><Button type="button" className="min-h-11 w-full sm:w-auto" disabled={busy || !draft.firstName.trim() || !draft.lastName.trim()} onClick={() => void createPerson()}>Person anlegen</Button></div></details>}
      <div className="hidden overflow-x-auto lg:block"><table className="min-w-[1100px] w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><SortableHeading label="Nr." sortKey="helperNumber" value={sort} onChange={setSort} /><SortableHeading label="Name" sortKey="lastName" value={sort} onChange={setSort} /><SortableHeading label="Standardbereiche" sortKey="area" value={sort} onChange={setSort} /><th className="p-3">Zuordnung in der gewählten Veranstaltung</th><th className="p-3">T-Shirt</th><th className="p-3">Bemerkung</th><SortableHeading label="Status" sortKey="status" value={sort} onChange={setSort} /><th className="p-3">Aktionen</th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className={cn("border-b align-top", person.noDeployment && "bg-red-50 text-red-900")}><td className="p-3 text-slate-500">{person.helperNumber}</td><td className="p-3"><button type="button" className="min-h-10 font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button></td><td className="p-3">{person.activityAreas.length ? <div className="flex max-w-64 flex-wrap gap-1">{person.activityAreas.map((item) => <Badge key={item} variant="outline" className="bg-white font-medium">{item}</Badge>)}</div> : "—"}</td><td className="max-w-80 p-3"><EventAssignmentBadges labels={einsatzLabels.get(person.id)?.labels ?? []} /></td><td className="p-3">{person.shirtSize ?? "—"}</td><td className="max-w-72 whitespace-pre-wrap p-3 text-slate-600">{person.note ?? "—"}</td><td className="p-3">{person.noDeployment ? <Badge className="bg-red-100 text-red-900"><AlertTriangle className="mr-1 h-3 w-3" />Kein Einsatz</Badge> : person.isActive ? <Badge className="bg-green-100 text-green-900">Aktiv</Badge> : <Badge variant="secondary">Inaktiv</Badge>}</td><td className="p-3"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => onPersonOpen(person)}>Bearbeiten</Button>{canWrite && <Button type="button" size="sm" variant="ghost" className="text-red-700" aria-label={`${person.firstName} ${person.lastName} endgültig löschen`} onClick={() => setDeletePerson(person)}><Trash2 className="h-4 w-4" /></Button>}</div></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 md:grid-cols-2 lg:hidden">{people.map((person) => <article key={person.id} className={cn("min-w-0 rounded-xl border p-4", person.noDeployment && "border-red-300 bg-red-50 text-red-900")}><div className="flex items-start justify-between gap-2"><button type="button" className="min-h-10 min-w-0 break-words text-left font-semibold text-blue-700" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}<span className="block text-xs font-normal text-slate-500">Nr. {person.helperNumber}</span></button>{person.noDeployment && <AlertTriangle className="h-5 w-5 text-red-600" />}</div><div className="mt-3 border-t pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Standardbereiche</p><div className="mt-1 flex flex-wrap gap-1">{person.activityAreas.length ? person.activityAreas.map((item) => <Badge key={item} variant="outline" className="bg-white font-medium">{item}</Badge>) : <span className="text-sm text-slate-400">Keine</span>}</div></div><div className="mt-3 border-t pt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Diese Veranstaltung</p><div className="mt-1"><EventAssignmentBadges labels={einsatzLabels.get(person.id)?.labels ?? []} /></div></div><p className="mt-3 text-sm">T-Shirt {person.shirtSize ?? "—"}</p>{person.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{person.note}</p>}<div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" className="min-h-10 flex-1" onClick={() => onPersonOpen(person)}>Bearbeiten</Button>{canWrite && <Button type="button" size="sm" variant="ghost" className="min-h-10 text-red-700" onClick={() => setDeletePerson(person)}><Trash2 className="h-4 w-4" /><span className="sr-only">Endgültig löschen</span></Button>}</div></article>)}</div>
      {people.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Keine Personen entsprechen den Filtern.</p>}
    </CardContent></Card>
    {deletePerson && <MarshalConfirmDialog title="Person nach DSGVO endgültig löschen?" description={<><strong>{deletePerson.firstName} {deletePerson.lastName}</strong> und alle verknüpften Teilnahmen, Einsätze und Schulungsdaten werden unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.</>} confirmLabel={<><Trash2 className="mr-2 h-4 w-4" />Endgültig löschen</>} confirmDisabled={busy || deleteConfirmation !== "DSGVO-LÖSCHEN"} onConfirm={() => void confirmDelete()} onCancel={() => { setDeletePerson(null); setDeleteConfirmation(""); }}><label className="mt-4 grid gap-1 text-sm font-medium">Zur Bestätigung „DSGVO-LÖSCHEN“ eingeben<Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label></MarshalConfirmDialog>}
  </>;
}

function SortableHeading({ label, sortKey, value, onChange }: { label: string; sortKey: SortKey; value: SortValue; onChange: (value: SortValue) => void }) {
  const [activeKey, direction] = value.split(":") as [SortKey, SortDirection];
  const active = activeKey === sortKey;
  return <th className="p-1"><button type="button" className={cn("flex min-h-10 w-full items-center gap-1 rounded px-2 text-left hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active && "text-blue-700")} onClick={() => onChange(`${sortKey}:${active && direction === "asc" ? "desc" : "asc"}`)}>{label}{active && (direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}</button></th>;
}

function EventAssignmentBadges({ labels }: { labels: string[] }) {
  if (labels.length === 0) return <span className="text-sm text-slate-400">Noch keine Zuordnung</span>;
  return <div className="flex flex-wrap gap-1">{labels.map((label) => <Badge key={label} variant="outline" className="border-blue-200 bg-blue-50 font-medium text-blue-800">{label}</Badge>)}</div>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 pl-2.5 pr-1 text-blue-800"><span className="max-w-52 truncate">{label}</span><button type="button" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" aria-label={`${label} entfernen`} onClick={onRemove}><X className="h-3.5 w-3.5" /></button></span>;
}
