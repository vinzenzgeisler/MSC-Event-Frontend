import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Plus, RefreshCw, Save, UsersRound } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminMarshalsService } from "@/services/admin-marshals.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { MarshalCommitmentStatus, MarshalImportPreview, MarshalPerson, MarshalWorkspace } from "@/types/admin-marshals";

type View = "people" | "saturday" | "sunday" | "prints" | "training" | "config" | "import";
type MarshalEvent = { id: string; name: string; startsAt: string; endsAt: string; status: string; isCurrent: boolean };
const statusLabels: Record<MarshalCommitmentStatus, string> = { not_asked: "Nicht angefragt", pending: "Offen", accepted: "Zugesagt", declined: "Abgesagt", tentative: "Vielleicht" };
const inputClass = "h-9 rounded-md border bg-white px-2 text-sm";

const emptyPerson = { helperNumber: "", firstName: "", lastName: "", street: "", zip: "", city: "", birthdate: "", phone: "", email: "", shirtSize: "", licenseNumber: "", activityAreas: "Strecke", note: "" };

export function AdminMarshalsPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "marshals.write");
  const canExport = hasPermission(roles, "marshals.export");
  const [events, setEvents] = useState<MarshalEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [workspace, setWorkspace] = useState<MarshalWorkspace | null>(null);
  const [view, setView] = useState<View>("people");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("Strecke");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [personDraft, setPersonDraft] = useState(emptyPerson);
  const [editingPerson, setEditingPerson] = useState<MarshalPerson | null>(null);
  const [selectedTrainingId, setSelectedTrainingId] = useState("");
  const [trainingDraft, setTrainingDraft] = useState({ sessionType: "training" as "training" | "briefing", title: "", sessionDate: "", location: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState("");
  const [importPreview, setImportPreview] = useState<MarshalImportPreview | null>(null);
  const [postTargets, setPostTargets] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!eventId) return;
    setBusy(true); setError("");
    try {
      const data = await adminMarshalsService.getWorkspace(eventId, search || undefined, area === "all" ? undefined : area);
      setWorkspace(data);
      setPostTargets(Object.fromEntries(data.posts.map((post) => [post.id, post.targetStaff])));
      if (!selectedTrainingId && data.trainings[0]) setSelectedTrainingId(data.trainings[0].id);
    } catch (cause) { setError(getApiErrorMessage(cause, "Streckenposten konnten nicht geladen werden.")); }
    finally { setBusy(false); }
  }, [area, eventId, search, selectedTrainingId]);

  useEffect(() => {
    adminMarshalsService.listEvents().then(({ events: items }) => {
      setEvents(items);
      const stored = localStorage.getItem("msc_marshal_event_id");
      const selected = items.find((item) => item.id === stored) ?? items.find((item) => item.isCurrent) ?? items[0];
      if (selected) setEventId(selected.id);
    }).catch((cause) => setError(getApiErrorMessage(cause, "Veranstaltungen konnten nicht geladen werden.")));
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (eventId) localStorage.setItem("msc_marshal_event_id", eventId); }, [eventId]);

  const selectedEvent = events.find((item) => item.id === eventId);
  const day = workspace?.days.find((item) => item.dayKey === (view === "sunday" ? "sunday" : "saturday"));
  const currentTraining = workspace?.trainings.find((item) => item.id === selectedTrainingId);
  const people = workspace?.people ?? [];

  async function saveDay(person: MarshalPerson, commitmentStatus: MarshalCommitmentStatus, assignmentValue: string) {
    if (!day) return;
    const post = workspace?.posts.find((item) => `post:${item.id}` === assignmentValue);
    const section = workspace?.sections.find((item) => `leader:${item.id}` === assignmentValue);
    setBusy(true); setError("");
    try {
      await adminMarshalsService.saveAssignment(person.id, {
        eventId, contactOwner: person.participation.contactOwner, wish: person.participation.wish, note: person.participation.note,
        shirtSizeSnapshot: person.participation.shirtSizeSnapshot ?? person.shirtSize,
        days: [{ dayId: day.id, commitmentStatus, role: post ? "marshal" : section ? "section_leader" : assignmentValue ? "special" : null, sectionId: post?.sectionId ?? section?.id ?? null, postId: post?.id ?? null, functionCode: section?.leaderCode ?? null }]
      });
      setNotice("Einsatz gespeichert."); await load();
    } catch (cause) { setError(getApiErrorMessage(cause, "Einsatz konnte nicht gespeichert werden.")); }
    finally { setBusy(false); }
  }

  async function savePerson() {
    const draft = editingPerson ? {
      firstName: editingPerson.firstName, lastName: editingPerson.lastName, street: editingPerson.street, zip: editingPerson.zip,
      city: editingPerson.city, birthdate: editingPerson.birthdate, phone: editingPerson.phone, email: editingPerson.email,
      shirtSize: editingPerson.shirtSize, licenseNumber: editingPerson.licenseNumber, activityAreas: editingPerson.activityAreas, note: editingPerson.note, isActive: editingPerson.isActive
    } : {
      helperNumber: Number(personDraft.helperNumber), firstName: personDraft.firstName, lastName: personDraft.lastName,
      street: personDraft.street || null, zip: personDraft.zip || null, city: personDraft.city || null,
      birthdate: personDraft.birthdate || null, phone: personDraft.phone || null, email: personDraft.email || null,
      shirtSize: personDraft.shirtSize || null, licenseNumber: personDraft.licenseNumber || null, activityAreas: personDraft.activityAreas.split(/[;,]/).map((value) => value.trim()).filter(Boolean), note: personDraft.note || null
    };
    setBusy(true); setError("");
    try {
      if (editingPerson) await adminMarshalsService.updatePerson(editingPerson.id, draft); else await adminMarshalsService.createPerson(draft);
      setNotice("Helferstammdaten gespeichert."); setEditingPerson(null); setPersonDraft(emptyPerson); await load();
    } catch (cause) { setError(getApiErrorMessage(cause, "Helfer konnte nicht gespeichert werden.")); }
    finally { setBusy(false); }
  }

  async function createTraining() {
    setBusy(true); setError("");
    try {
      await adminMarshalsService.createTraining({ eventId, ...trainingDraft, location: trainingDraft.location || null });
      setTrainingDraft({ sessionType: "training", title: "", sessionDate: "", location: "" }); setNotice("Termin angelegt."); await load();
    } catch (cause) { setError(getApiErrorMessage(cause, "Termin konnte nicht angelegt werden.")); }
    finally { setBusy(false); }
  }

  async function previewImport() {
    if (!importFile) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await adminMarshalsService.previewImport(eventId, importFile); setImportPreview(result.response); setImportData(result.dataBase64); }
    catch (cause) { setError(getApiErrorMessage(cause, "Excel-Vorschau konnte nicht erstellt werden.")); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!importFile || !importPreview || !importData) return;
    setBusy(true); setError("");
    try { await adminMarshalsService.commitImport(eventId, importFile.name, importData, importPreview.sha256); setNotice("Excel-Import vollständig übernommen."); setImportPreview(null); setImportData(""); await load(); }
    catch (cause) { setError(getApiErrorMessage(cause, "Excel-Import konnte nicht übernommen werden.")); }
    finally { setBusy(false); }
  }

  async function saveConfig() {
    if (!workspace) return;
    setBusy(true); setError("");
    try {
      await adminMarshalsService.saveConfig({ eventId, sections: workspace.sections.map(({ code, name, leaderCode, sortOrder }) => ({ code, name, leaderCode, sortOrder })), posts: workspace.posts.map((post) => ({ sectionCode: workspace.sections.find((section) => section.id === post.sectionId)?.code ?? "4", code: post.code, description: post.description, targetStaff: postTargets[post.id] ?? post.targetStaff, isActive: post.isActive, sortOrder: post.sortOrder })) });
      setNotice("Postenkonfiguration gespeichert."); await load();
    } catch (cause) { setError(getApiErrorMessage(cause, "Konfiguration konnte nicht gespeichert werden.")); }
    finally { setBusy(false); }
  }

  const tabs = useMemo(() => [
    ["people", "Personen"], ["saturday", `Zusage & Einsatz Samstag${selectedEvent ? ` ${selectedEvent.startsAt.slice(0, 4)}` : ""}`],
    ["sunday", `Zusage & Einsatz Sonntag${selectedEvent ? ` ${selectedEvent.startsAt.slice(0, 4)}` : ""}`], ["prints", "Drucklisten"],
    ["training", "Schulungen & Lizenzen"], ["config", "Konfiguration"], ["import", "Excel-Import"]
  ] as Array<[View, string]>, [selectedEvent]);

  return <div className="space-y-4">
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" />Streckenposten</CardTitle><p className="mt-1 text-sm text-slate-600">Helferstammdaten, Zusagen, Einsätze, Abschnittsleiter, Schulungen und Drucklisten.</p></div><div className="flex gap-2"><Select value={eventId} onValueChange={setEventId}><SelectTrigger className="w-72"><SelectValue placeholder="Veranstaltung wählen" /></SelectTrigger><SelectContent>{events.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} ({item.startsAt.slice(0, 4)})</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button></div></div></CardHeader></Card>
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    <div className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <Button key={key} size="sm" variant={view === key ? "default" : "outline"} onClick={() => setView(key)}>{label}</Button>)}</div>

    {view === "people" && <Card><CardHeader><div className="flex flex-wrap items-end justify-between gap-3"><div><CardTitle>Helferstammdaten</CardTitle><p className="text-sm text-slate-600">{people.length} Datensätze in der gewählten Veranstaltung</p></div><div className="flex gap-2"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder Helfernummer" className="w-60" /><Select value={area} onValueChange={setArea}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Strecke">Strecke</SelectItem><SelectItem value="all">Alle Bereiche</SelectItem></SelectContent></Select></div></div></CardHeader><CardContent className="space-y-4">
      {canWrite && <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium"><Plus className="mr-2 inline h-4 w-4" />Neuen Helfer anlegen</summary><div className="mt-3 grid gap-2 md:grid-cols-4">{Object.entries(personDraft).map(([key, value]) => <Input key={key} type={key === "birthdate" ? "date" : key === "helperNumber" ? "number" : "text"} value={value} placeholder={key} onChange={(event) => setPersonDraft((current) => ({ ...current, [key]: event.target.value }))} />)}<Button onClick={() => void savePerson()} disabled={busy || !personDraft.helperNumber || !personDraft.firstName || !personDraft.lastName}><Save className="mr-2 h-4 w-4" />Speichern</Button></div></details>}
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Nr.</th><th className="p-2">Name</th><th className="p-2">Anschrift</th><th className="p-2">Kontakt</th><th className="p-2">Geburtstag</th><th className="p-2">Shirt</th><th className="p-2">Bereiche</th><th className="p-2">Lizenz</th><th className="p-2"></th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className="border-b align-top"><td className="p-2">{person.helperNumber}</td><td className="p-2 font-medium">{person.firstName} {person.lastName}</td><td className="p-2">{person.street}<br />{person.zip} {person.city}</td><td className="p-2">{person.phone}<br />{person.email}</td><td className="p-2">{person.birthdate ?? "–"}</td><td className="p-2">{person.shirtSize ?? "–"}</td><td className="p-2">{person.activityAreas.join(", ")}</td><td className="p-2">{person.licenseNumber ?? "–"}</td><td className="p-2">{canWrite && <Button size="sm" variant="outline" onClick={() => setEditingPerson(person)}>Bearbeiten</Button>}</td></tr>)}</tbody></table></div>
      {editingPerson && <div className="rounded-md border bg-slate-50 p-4"><div className="mb-3 flex justify-between"><strong>{editingPerson.firstName} {editingPerson.lastName} bearbeiten</strong><Button size="sm" variant="outline" onClick={() => setEditingPerson(null)}>Schließen</Button></div><div className="grid gap-2 md:grid-cols-4"><Input value={editingPerson.firstName} onChange={(event) => setEditingPerson({ ...editingPerson, firstName: event.target.value })} placeholder="Vorname" /><Input value={editingPerson.lastName} onChange={(event) => setEditingPerson({ ...editingPerson, lastName: event.target.value })} placeholder="Nachname" /><Input value={editingPerson.street ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, street: event.target.value })} placeholder="Straße" /><Input value={editingPerson.zip ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, zip: event.target.value })} placeholder="PLZ" /><Input value={editingPerson.city ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, city: event.target.value })} placeholder="Ort" /><Input value={editingPerson.phone ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, phone: event.target.value })} placeholder="Telefon" /><Input value={editingPerson.email ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, email: event.target.value })} placeholder="E-Mail" /><Input value={editingPerson.shirtSize ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, shirtSize: event.target.value })} placeholder="Shirt" /><Input value={editingPerson.licenseNumber ?? ""} onChange={(event) => setEditingPerson({ ...editingPerson, licenseNumber: event.target.value })} placeholder="DMSB-Lizenz" /><Button onClick={() => void savePerson()}><Save className="mr-2 h-4 w-4" />Änderungen speichern</Button></div></div>}
    </CardContent></Card>}

    {(view === "saturday" || view === "sunday") && <Card><CardHeader><CardTitle>{day?.label ?? "Tag"}: Zusagen und Einsatzplanung</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Nr.</th><th className="p-2">Name</th><th className="p-2">PLZ / Wohnort</th><th className="p-2">Shirt</th><th className="p-2">Zusage</th><th className="p-2">Posten / Funktion</th></tr></thead><tbody>{people.map((person) => { const assignment = person.assignments.find((item) => item.dayId === day?.id); const selected = assignment?.postId ? `post:${assignment.postId}` : assignment?.role === "section_leader" && assignment.sectionId ? `leader:${assignment.sectionId}` : "none"; return <tr key={person.id} className="border-b"><td className="p-2">{person.helperNumber}</td><td className="p-2 font-medium">{person.firstName} {person.lastName}</td><td className="p-2">{person.zip} {person.city}</td><td className="p-2">{person.participation.shirtSizeSnapshot ?? person.shirtSize ?? "–"}</td><td className="p-2"><select className={inputClass} value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy} onChange={(event) => void saveDay(person, event.target.value as MarshalCommitmentStatus, selected === "none" ? "" : selected)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-2"><select className={`${inputClass} min-w-52`} value={selected} disabled={!canWrite || busy} onChange={(event) => void saveDay(person, assignment?.commitmentStatus ?? "accepted", event.target.value === "none" ? "" : event.target.value)}><option value="none">Noch nicht zugewiesen</option>{workspace?.sections.map((section) => <option key={`leader:${section.id}`} value={`leader:${section.id}`}>{section.leaderCode} – {section.name}</option>)}{workspace?.posts.map((post) => <option key={`post:${post.id}`} value={`post:${post.id}`}>{post.code}{post.description ? ` – ${post.description}` : ""}</option>)}</select></td></tr>; })}</tbody></table></div></CardContent></Card>}

    {view === "prints" && <Card><CardHeader><CardTitle>Drucklisten (A4 quer)</CardTitle></CardHeader><CardContent className="space-y-4">{workspace?.days.map((printDay) => <div key={printDay.id} className="rounded-md border p-3"><strong>{printDay.label} {printDay.eventDate}</strong><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={!canExport} onClick={() => void adminMarshalsService.downloadPrint({ eventId, type: "attendance", dayId: printDay.id })}><Download className="mr-2 h-4 w-4" />Anwesenheitsliste</Button>{workspace.sections.map((section) => <Button key={section.id} variant="outline" disabled={!canExport} onClick={() => void adminMarshalsService.downloadPrint({ eventId, type: "section", dayId: printDay.id, sectionId: section.id })}><Download className="mr-2 h-4 w-4" />{section.name}</Button>)}</div></div>)}</CardContent></Card>}

    {view === "training" && <div className="grid gap-4 xl:grid-cols-[360px_1fr]"><Card><CardHeader><CardTitle>Schulung / Einweisung</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={selectedTrainingId} onValueChange={setSelectedTrainingId}><SelectTrigger><SelectValue placeholder="Termin wählen" /></SelectTrigger><SelectContent>{workspace?.trainings.map((item) => <SelectItem key={item.id} value={item.id}>{item.sessionDate} – {item.title}</SelectItem>)}</SelectContent></Select>{currentTraining && canExport && <Button variant="outline" onClick={() => void adminMarshalsService.downloadPrint({ eventId, type: "training", trainingId: currentTraining.id })}><Download className="mr-2 h-4 w-4" />Teilnehmerliste</Button>}{canWrite && <div className="space-y-2 border-t pt-3"><Label>Neuer Termin</Label><Select value={trainingDraft.sessionType} onValueChange={(value: "training" | "briefing") => setTrainingDraft({ ...trainingDraft, sessionType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="training">Lizenzschulung</SelectItem><SelectItem value="briefing">Einweisung</SelectItem></SelectContent></Select><Input value={trainingDraft.title} onChange={(event) => setTrainingDraft({ ...trainingDraft, title: event.target.value })} placeholder="Titel" /><Input type="date" value={trainingDraft.sessionDate} onChange={(event) => setTrainingDraft({ ...trainingDraft, sessionDate: event.target.value })} /><Input value={trainingDraft.location} onChange={(event) => setTrainingDraft({ ...trainingDraft, location: event.target.value })} placeholder="Ort" /><Button onClick={() => void createTraining()} disabled={!trainingDraft.title || !trainingDraft.sessionDate}>Anlegen</Button></div>}</CardContent></Card><Card><CardHeader><CardTitle>Teilnehmer und Lizenzstatus</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Name</th><th className="p-2">DMSB-Lizenz</th><th className="p-2">Anwesenheit</th></tr></thead><tbody>{people.map((person) => { const participant = workspace?.trainingParticipants.find((item) => item.sessionId === selectedTrainingId && item.personId === person.id); return <tr key={person.id} className="border-b"><td className="p-2">{person.firstName} {person.lastName}</td><td className="p-2">{person.licenseNumber ?? workspace?.qualifications.find((item) => item.personId === person.id)?.number ?? "–"}</td><td className="p-2"><select className={inputClass} value={participant?.attendanceStatus ?? "registered"} disabled={!canWrite || !selectedTrainingId} onChange={(event) => void adminMarshalsService.saveTrainingParticipant(selectedTrainingId, person.id, event.target.value as "registered" | "attended" | "absent" | "excused").then(load)}><option value="registered">Angemeldet</option><option value="attended">Anwesend</option><option value="absent">Nicht anwesend</option><option value="excused">Entschuldigt</option></select></td></tr>; })}</tbody></table></div></CardContent></Card></div>}

    {view === "config" && <Card><CardHeader><div className="flex justify-between"><div><CardTitle>Abschnitte und Posten</CardTitle><p className="text-sm text-slate-600">Vier organisatorische Abschnitte; 5/1–5/3 bleiben historisch Abschnitt 4 zugeordnet. Besetzung wird als Ist/Soll gezeigt.</p></div>{canWrite && <Button onClick={() => void saveConfig()}><Save className="mr-2 h-4 w-4" />Konfiguration speichern</Button>}</div></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2">{workspace?.sections.map((section) => <div key={section.id} className="rounded-md border p-3"><div className="mb-2 flex justify-between"><strong>{section.name}</strong><Badge>{section.leaderCode}</Badge></div><div className="space-y-2">{workspace.posts.filter((post) => post.sectionId === section.id).map((post) => { const target = postTargets[post.id] ?? post.targetStaff; const counts = workspace.days.map((configDay) => people.filter((person) => person.assignments.some((assignment) => assignment.dayId === configDay.id && assignment.postId === post.id && assignment.commitmentStatus === "accepted")).length); return <div key={post.id} className="grid grid-cols-[60px_1fr_150px_70px] items-center gap-2"><span>{post.code}</span><span className="text-sm text-slate-600">{post.description || "Streckenposten"}</span><span className="flex gap-1 text-xs">{workspace.days.map((configDay, index) => <Badge key={configDay.id} className={counts[index] < target ? "bg-amber-100 text-amber-900" : counts[index] > target ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}>{configDay.label.slice(0, 2)} {counts[index]}/{target}</Badge>)}</span><Input type="number" min={1} max={20} value={target} disabled={!canWrite} onChange={(event) => setPostTargets((current) => ({ ...current, [post.id]: Number(event.target.value) }))} /></div>; })}</div></div>)}</CardContent></Card>}

    {view === "import" && <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Excel-Import</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600">Die Arbeitsmappe wird zuerst nur analysiert. Erst nach Prüfung der Zusammenfassung wird sie idempotent übernommen.</p><Input type="file" accept=".xlsx" onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setImportPreview(null); setImportData(""); }} />{canWrite && <Button onClick={() => void previewImport()} disabled={!importFile || busy}>Dry-run starten</Button>}{importPreview && <div className="rounded-md border bg-slate-50 p-4"><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Personen" value={importPreview.summary.people} /><Metric label="Neu" value={importPreview.summary.newPeople} /><Metric label="Aktualisiert" value={importPreview.summary.updatedPeople} /><Metric label="Teilnahmen" value={importPreview.summary.eventParticipations} /><Metric label="Termine" value={importPreview.summary.trainings} /><Metric label="Prüffälle" value={importPreview.summary.conflicts} /></div>{importPreview.conflicts.length > 0 && <ul className="mt-3 max-h-40 overflow-auto text-sm text-amber-800">{importPreview.conflicts.map((item, index) => <li key={`${item.sheet}-${item.row}-${index}`}>{item.sheet}, Zeile {item.row}: {item.message}</li>)}</ul>}<Button className="mt-4" onClick={() => void commitImport()} disabled={busy}>Geprüften Import übernehmen</Button></div>}</CardContent></Card>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded border bg-white p-2"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold">{value}</div></div>; }
