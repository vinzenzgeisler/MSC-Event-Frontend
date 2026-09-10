import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Download, Plus, UserPlus, Users } from "lucide-react";
import { MarshalTrainingRegistrationDialog } from "@/components/features/admin/marshal-training-registration-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MarshalDay, MarshalPerson, MarshalTraining, MarshalTrainingParticipant, MarshalWorkspace } from "@/types/admin-marshals";

type Attendance = MarshalTrainingParticipant["attendanceStatus"];
type AttendanceFilter = Attendance | "all" | "unregistered";
type PersonGroup = "track_saturday" | "track_sunday" | "track_both" | "all";
type DayKey = MarshalDay["dayKey"];

export type BulkTrainingRegistrationResult = {
  succeededPersonIds: string[];
  skipped: Array<{ personId: string; message: string }>;
  failed: Array<{ personId: string; message: string }>;
};

type Props = {
  workspace: MarshalWorkspace;
  canWrite: boolean;
  canExport: boolean;
  busy: boolean;
  onCreate: (draft: { sessionType: "training" | "briefing"; title: string; sessionDate: string; location: string | null }) => Promise<boolean>;
  onAttendance: (trainingId: string, person: MarshalPerson, status: Attendance) => Promise<boolean>;
  onAttendanceDelete: (trainingId: string, person: MarshalPerson) => Promise<boolean>;
  onRegisterAccepted: (trainingId: string, people: MarshalPerson[], dayKeys: DayKey[]) => Promise<BulkTrainingRegistrationResult>;
  onPrint: (trainingId: string) => Promise<void>;
  onPersonOpen: (person: MarshalPerson) => void;
};

const attendanceLabels: Record<AttendanceFilter, string> = { all: "Alle Status", unregistered: "Nicht angemeldet", registered: "Angemeldet", attended: "Anwesend", absent: "Nicht anwesend", excused: "Entschuldigt" };
const groupLabels: Record<PersonGroup, string> = { track_saturday: "Streckenposten Samstag", track_sunday: "Streckenposten Sonntag", track_both: "Streckenposten beide Tage", all: "Alle Personen" };

export function MarshalSchulungView({ workspace, canWrite, canExport, busy, onCreate, onAttendance, onAttendanceDelete, onRegisterAccepted, onPrint, onPersonOpen }: Props) {
  const trainings = useMemo(() => [...workspace.trainings].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.title.localeCompare(b.title, "de")), [workspace.trainings]);
  const [selectedId, setSelectedId] = useState("");
  const [personGroup, setPersonGroup] = useState<PersonGroup>("track_saturday");
  const [search, setSearch] = useState("");
  const [attendance, setAttendance] = useState<AttendanceFilter>("all");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [draft, setDraft] = useState({ sessionType: "training" as "training" | "briefing", title: "", sessionDate: "", location: "" });

  useEffect(() => { if (!trainings.some((item) => item.id === selectedId)) setSelectedId(trainings[0]?.id ?? ""); }, [selectedId, trainings]);

  const selectedTraining = trainings.find((item) => item.id === selectedId) ?? null;
  const selectedDayKeys = dayKeysForGroup(personGroup);
  const selectedDayIds = new Set(workspace.days.filter((day) => selectedDayKeys.includes(day.dayKey)).map((day) => day.id));
  const trainingById = new Map(trainings.map((training) => [training.id, training]));
  const selectedParticipants = workspace.trainingParticipants.filter((participant) => participant.sessionId === selectedId);
  const selectedParticipantByPerson = new Map(selectedParticipants.map((participant) => [participant.personId, participant]));
  const otherTrainingsByPerson = new Map<string, MarshalTraining[]>();
  workspace.trainingParticipants.forEach((participant) => {
    if (participant.sessionId === selectedId) return;
    const training = trainingById.get(participant.sessionId);
    if (!training) return;
    const current = otherTrainingsByPerson.get(participant.personId) ?? [];
    if (!current.some((item) => item.id === training.id)) otherTrainingsByPerson.set(participant.personId, [...current, training]);
  });

  const peopleInGroup = workspace.people.filter((person) => personGroup === "all" || (person.isActive && !person.noDeployment && person.assignments.some((assignment) => selectedDayIds.has(assignment.dayId) && assignment.commitmentStatus === "accepted"))).sort(sortPeople);
  const term = search.trim().toLocaleLowerCase("de");
  const people = peopleInGroup.filter((person) => {
    const participant = selectedParticipantByPerson.get(person.id);
    return (!term || `${person.helperNumber} ${person.firstName} ${person.lastName} ${person.licenseNumber ?? ""}`.toLocaleLowerCase("de").includes(term)) && (attendance === "all" || (participant?.attendanceStatus ?? "unregistered") === attendance);
  });
  const candidates = peopleInGroup.filter((person) => !selectedParticipantByPerson.has(person.id) && !otherTrainingsByPerson.has(person.id));
  const alreadyAssignedElsewhere = peopleInGroup.filter((person) => !selectedParticipantByPerson.has(person.id) && otherTrainingsByPerson.has(person.id)).map((person) => ({ person, trainingTitles: (otherTrainingsByPerson.get(person.id) ?? []).map(trainingLabel) }));
  const protectedCount = peopleInGroup.filter((person) => selectedParticipantByPerson.has(person.id)).length;

  async function create() {
    const saved = await onCreate({ ...draft, title: draft.title.trim(), location: draft.location.trim() || null });
    if (saved) setDraft({ sessionType: "training", title: "", sessionDate: "", location: "" });
  }
  function changeTraining(trainingId: string) { setSelectedId(trainingId); setAttendance("all"); setPreviewOpen(false); }

  return <div className="space-y-4">
    <Card>
      <CardHeader className="p-4 sm:p-5"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div><CardTitle>Schulungen und Einweisungen</CardTitle><p className="mt-1 text-sm text-slate-600">Termin wählen, Streckenposten prüfen und Teilnehmerstatus verwalten.</p></div>{selectedTraining && <Badge variant="outline" className="mt-1 w-fit bg-white">{selectedTraining.sessionType === "training" ? "Lizenzschulung" : "Einweisung"}</Badge>}</div></CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.2fr)_minmax(230px,1fr)_auto] xl:items-end">
          <FieldLabel label="Termin"><select className="h-11 min-w-0 rounded-md border bg-white px-3 text-base font-normal sm:text-sm" value={selectedId} onChange={(event) => changeTraining(event.target.value)}><option value="">Kein Termin</option>{trainings.map((item) => <option key={item.id} value={item.id}>{trainingLabel(item)}</option>)}</select></FieldLabel>
          <FieldLabel label="Personengruppe"><select className="h-11 min-w-0 rounded-md border bg-white px-3 text-base font-normal sm:text-sm" value={personGroup} onChange={(event) => { setPersonGroup(event.target.value as PersonGroup); setPreviewOpen(false); }}><option value="track_saturday">Streckenposten Samstag</option><option value="track_sunday">Streckenposten Sonntag</option><option value="track_both">Streckenposten beide Tage</option><option value="all">Alle Personen</option></select></FieldLabel>
          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row xl:col-span-1 xl:justify-end">
            {canWrite && selectedTraining && personGroup !== "all" && <Button type="button" className="min-h-11 min-w-0" disabled={busy || peopleInGroup.length === 0} onClick={() => setPreviewOpen(true)}><UserPlus className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Zuordnung prüfen ({candidates.length} neu)</span></Button>}
            {canExport && selectedTraining && <Button type="button" variant="outline" className="min-h-11 min-w-0" disabled={busy} onClick={() => void onPrint(selectedTraining.id)}><Download className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">PDF ({selectedParticipants.length})</span></Button>}
          </div>
        </div>
        {selectedTraining ? <div className="grid gap-2 rounded-lg border bg-slate-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><InfoItem icon={<CalendarDays className="h-4 w-4" />} label="Datum" value={formatDate(selectedTraining.sessionDate)} /><InfoItem label="Ort" value={selectedTraining.location || "Nicht angegeben"} /><InfoItem icon={<Users className="h-4 w-4" />} label="Terminteilnehmer" value={String(selectedParticipants.length)} /><InfoItem label="Auswahl" value={`${peopleInGroup.length} · ${groupLabels[personGroup]}`} /></div> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">Noch kein Schulungs- oder Einweisungstermin vorhanden. Lege unten einen Termin an.</p>}
      </CardContent>
    </Card>

    {selectedTraining && <Card><CardHeader className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Teilnehmer und Status</CardTitle><span className="text-sm text-slate-500">{people.length} von {peopleInGroup.length} sichtbar</span></div></CardHeader><CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
      <div className="grid gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-2"><FieldLabel label="Suche"><Input className="h-11 bg-white text-base sm:text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Nummer oder Lizenz" /></FieldLabel><FieldLabel label="Teilnahmestatus"><select className="h-11 rounded-md border bg-white px-3 text-base font-normal sm:text-sm" value={attendance} onChange={(event) => setAttendance(event.target.value as AttendanceFilter)}>{Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FieldLabel></div>
      <div className="hidden overflow-hidden rounded-lg border lg:block"><table className="w-full table-fixed text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="w-[30%] p-3">Name</th><th className="w-[19%] p-3">Einsatztag</th><th className="w-[17%] p-3">DMSB-Lizenz</th><th className="w-[34%] p-3">Teilnahmestatus</th></tr></thead><tbody>{people.map((person) => <PersonTableRow key={person.id} person={person} workspace={workspace} selectedTraining={selectedTraining} participant={selectedParticipantByPerson.get(person.id)} otherTrainings={otherTrainingsByPerson.get(person.id) ?? []} canWrite={canWrite} busy={busy} onAttendance={onAttendance} onAttendanceDelete={onAttendanceDelete} onPersonOpen={onPersonOpen} />)}</tbody></table></div>
      <div className="grid gap-3 lg:hidden">{people.map((person) => <PersonCard key={person.id} person={person} workspace={workspace} selectedTraining={selectedTraining} participant={selectedParticipantByPerson.get(person.id)} otherTrainings={otherTrainingsByPerson.get(person.id) ?? []} canWrite={canWrite} busy={busy} onAttendance={onAttendance} onAttendanceDelete={onAttendanceDelete} onPersonOpen={onPersonOpen} />)}</div>
      {people.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Keine Personen entsprechen der gewählten Gruppe und den Filtern.</p>}
    </CardContent></Card>}

    {canWrite && <details className="rounded-xl border bg-white shadow-sm"><summary className="min-h-12 cursor-pointer list-none px-4 py-3 font-medium marker:hidden sm:px-5"><Plus className="mr-2 inline h-4 w-4" />Neuen Termin anlegen</summary><div className="grid gap-3 border-t p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4 lg:items-end"><FieldLabel label="Art"><select className="h-11 rounded-md border bg-white px-3 text-base font-normal sm:text-sm" value={draft.sessionType} onChange={(event) => setDraft({ ...draft, sessionType: event.target.value as "training" | "briefing" })}><option value="training">Lizenzschulung</option><option value="briefing">Einweisung</option></select></FieldLabel><FieldLabel label="Titel"><Input className="h-11 text-base sm:text-sm" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></FieldLabel><FieldLabel label="Datum"><Input className="h-11 text-base sm:text-sm" type="date" value={draft.sessionDate} onChange={(event) => setDraft({ ...draft, sessionDate: event.target.value })} /></FieldLabel><FieldLabel label="Ort (optional)"><Input className="h-11 text-base sm:text-sm" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></FieldLabel><Button type="button" className="min-h-11 sm:col-span-2 lg:col-span-4 lg:w-fit" disabled={busy || !draft.title.trim() || !draft.sessionDate} onClick={() => void create()}><Plus className="mr-2 h-4 w-4" />Termin anlegen</Button></div></details>}
    {previewOpen && selectedTraining && <MarshalTrainingRegistrationDialog training={selectedTraining} groupLabel={groupLabels[personGroup]} candidates={candidates} alreadyAssignedElsewhere={alreadyAssignedElsewhere} protectedCount={protectedCount} busy={busy} onConfirm={(selectedPeople) => onRegisterAccepted(selectedTraining.id, selectedPeople, selectedDayKeys)} onClose={() => setPreviewOpen(false)} />}
  </div>;
}

type PersonStatusProps = { person: MarshalPerson; workspace: MarshalWorkspace; selectedTraining: MarshalTraining; participant?: MarshalTrainingParticipant; otherTrainings: MarshalTraining[]; canWrite: boolean; busy: boolean; onAttendance: Props["onAttendance"]; onAttendanceDelete: Props["onAttendanceDelete"]; onPersonOpen: Props["onPersonOpen"] };

function PersonTableRow(props: PersonStatusProps) {
  const { person, workspace, selectedTraining, participant, otherTrainings, onPersonOpen } = props;
  return <tr className={cn("border-b align-top last:border-0", (!person.isActive || person.noDeployment) && "bg-slate-50 text-slate-600")}><td className="min-w-0 p-3"><PersonName person={person} onOpen={onPersonOpen} />{otherTrainings.length > 0 && <OtherTrainingNotice trainings={otherTrainings} />}</td><td className="p-3"><DayBadges person={person} workspace={workspace} /></td><td className="break-words p-3">{person.licenseNumber || "—"}</td><td className="p-3"><AttendanceSelect training={selectedTraining} person={person} participant={participant} canWrite={props.canWrite} busy={props.busy} onAttendance={props.onAttendance} onAttendanceDelete={props.onAttendanceDelete} /></td></tr>;
}

function PersonCard(props: PersonStatusProps) {
  const { person, workspace, selectedTraining, participant, otherTrainings, onPersonOpen } = props;
  return <article className={cn("min-w-0 rounded-xl border p-4", (!person.isActive || person.noDeployment) && "bg-slate-50 text-slate-600")}><PersonName person={person} onOpen={onPersonOpen} /><div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm"><div className="min-w-0"><p className="text-xs font-medium text-slate-500">Einsatztag</p><div className="mt-1"><DayBadges person={person} workspace={workspace} /></div></div><div className="min-w-0"><p className="text-xs font-medium text-slate-500">DMSB-Lizenz</p><p className="mt-1 break-words font-medium">{person.licenseNumber || "—"}</p></div></div>{otherTrainings.length > 0 && <OtherTrainingNotice trainings={otherTrainings} />}<div className="mt-3"><p className="mb-1 text-xs font-medium text-slate-500">Teilnahmestatus</p><AttendanceSelect training={selectedTraining} person={person} participant={participant} canWrite={props.canWrite} busy={props.busy} onAttendance={props.onAttendance} onAttendanceDelete={props.onAttendanceDelete} /></div></article>;
}

function AttendanceSelect({ training, person, participant, canWrite, busy, onAttendance, onAttendanceDelete }: { training: MarshalTraining; person: MarshalPerson; participant?: MarshalTrainingParticipant; canWrite: boolean; busy: boolean; onAttendance: Props["onAttendance"]; onAttendanceDelete: Props["onAttendanceDelete"] }) {
  return <select aria-label={`Teilnahmestatus für ${person.firstName} ${person.lastName}`} className="h-11 w-full min-w-0 rounded-md border bg-white px-3 text-base text-slate-950 disabled:bg-slate-100 sm:text-sm" value={participant?.attendanceStatus ?? ""} disabled={!canWrite || busy} onChange={(event) => { if (event.target.value) void onAttendance(training.id, person, event.target.value as Attendance); else void onAttendanceDelete(training.id, person); }}><option value="">Nicht angemeldet</option><option value="registered">Angemeldet</option><option value="attended">Anwesend</option><option value="absent">Nicht anwesend</option><option value="excused">Entschuldigt</option></select>;
}

function PersonName({ person, onOpen }: { person: MarshalPerson; onOpen: (person: MarshalPerson) => void }) { return <button type="button" className="min-w-0 break-words text-left font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onOpen(person)}>{person.lastName}, {person.firstName}<span className="ml-2 text-xs font-normal text-slate-500">Nr. {person.helperNumber}</span>{!person.isActive && <span className="block text-xs font-normal text-slate-500">Inaktiver Stammdatensatz</span>}{person.noDeployment && <span className="block text-xs font-normal text-red-700">Kein Einsatz</span>}</button>; }
function DayBadges({ person, workspace }: { person: MarshalPerson; workspace: MarshalWorkspace }) { const acceptedDayKeys = workspace.days.filter((day) => person.assignments.some((assignment) => assignment.dayId === day.id && assignment.commitmentStatus === "accepted")).map((day) => day.dayKey); return acceptedDayKeys.length > 0 ? <span className="flex flex-wrap gap-1">{acceptedDayKeys.map((dayKey) => <Badge key={dayKey} variant="outline" className="bg-white font-normal">{dayKey === "saturday" ? "Samstag" : "Sonntag"}</Badge>)}</span> : <span className="text-slate-400">—</span>; }
function OtherTrainingNotice({ trainings }: { trainings: MarshalTraining[] }) { return <p className="mt-1 break-words text-xs text-amber-700">Weiterer Termin: {trainings.map((training) => training.title).join(", ")}</p>; }
function FieldLabel({ label, children }: { label: string; children: ReactNode }) { return <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">{label}{children}</label>; }
function InfoItem({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) { return <div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 shrink-0 text-slate-400">{icon}</span><span className="min-w-0"><span className="block text-xs text-slate-500">{label}</span><strong className="block break-words font-medium text-slate-900">{value}</strong></span></div>; }
function dayKeysForGroup(group: PersonGroup): DayKey[] { if (group === "track_saturday") return ["saturday"]; if (group === "track_sunday") return ["sunday"]; if (group === "track_both") return ["saturday", "sunday"]; return []; }
function sortPeople(a: MarshalPerson, b: MarshalPerson) { return a.lastName.localeCompare(b.lastName, "de", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "de", { sensitivity: "base" }) || a.helperNumber - b.helperNumber; }
function trainingLabel(training: MarshalTraining) { return `${formatDate(training.sessionDate)} · ${training.title}`; }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
