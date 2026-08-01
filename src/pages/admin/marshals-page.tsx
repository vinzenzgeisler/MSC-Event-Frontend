import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
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
    if (!eventId) { setError("Bitte zuerst eine Veranstaltung wählen."); return; }
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
    ["people", "Personen"],
    ["saturday", `Zusage Sa.${selectedEvent ? ` ${selectedEvent.startsAt.slice(0, 4)}` : ""}`],
    ["sunday", `Zusage So.${selectedEvent ? ` ${selectedEvent.startsAt.slice(0, 4)}` : ""}`],
    ["prints", "Drucklisten"],
    ["training", "Schulungen"],
    ["config", "Konfiguration"],
    ["import", "Excel-Import"],
  ] as Array<[View, string]>, [selectedEvent]);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5" />
                Streckenposten
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">Helferstammdaten, Zusagen, Einsätze, Abschnittsleiter, Schulungen und Drucklisten.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Native select for best mobile compatibility */}
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground sm:w-64"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                {events.length === 0 && <option value="" disabled>Veranstaltung wählen</option>}
                {events.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.startsAt.slice(0, 4)})</option>
                ))}
              </select>
              <Button variant="outline" onClick={() => void load()} disabled={busy} className="w-full sm:w-auto">
                <RefreshCw className="mr-2 h-4 w-4" />Aktualisieren
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {/* Tab navigation — horizontal scroll, no wrapping */}
      <div className="relative">
        <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-none">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "flex-none whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                view === key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900 active:text-slate-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PERSONEN */}
      {view === "people" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div>
                <CardTitle>Helferstammdaten</CardTitle>
                <p className="text-sm text-slate-600">{people.length} Datensätze in der gewählten Veranstaltung</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name oder Helfernummer" className="w-full sm:w-60" />
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strecke">Strecke</SelectItem>
                    <SelectItem value="all">Alle Bereiche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {canWrite && (
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer font-medium"><Plus className="mr-2 inline h-4 w-4" />Neuen Helfer anlegen</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {Object.entries(personDraft).map(([key, value]) => (
                    <Input key={key} type={key === "birthdate" ? "date" : key === "helperNumber" ? "number" : "text"} value={value} placeholder={key}
                      onChange={(e) => setPersonDraft((c) => ({ ...c, [key]: e.target.value }))} />
                  ))}
                  <Button onClick={() => void savePerson()} disabled={busy || !personDraft.helperNumber || !personDraft.firstName || !personDraft.lastName}>
                    <Save className="mr-2 h-4 w-4" />Speichern
                  </Button>
                </div>
              </details>
            )}

            {/* Mobile: cards; Desktop: table */}
            <div className="block sm:hidden space-y-2">
              {people.map((person) => (
                <div key={person.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold">{person.helperNumber} · {person.firstName} {person.lastName}</span>
                      <div className="text-slate-500">{person.zip} {person.city}</div>
                      <div className="text-slate-500">{person.phone}</div>
                    </div>
                    {canWrite && <Button size="sm" variant="outline" onClick={() => setEditingPerson(person)}>Bearbeiten</Button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Nr.</th><th className="p-2">Name</th><th className="p-2">Anschrift</th>
                    <th className="p-2">Kontakt</th><th className="p-2">Geburtstag</th><th className="p-2">Shirt</th>
                    <th className="p-2">Bereiche</th><th className="p-2">Lizenz</th><th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id} className="border-b align-top">
                      <td className="p-2">{person.helperNumber}</td>
                      <td className="p-2 font-medium">{person.firstName} {person.lastName}</td>
                      <td className="p-2">{person.street}<br />{person.zip} {person.city}</td>
                      <td className="p-2">{person.phone}<br />{person.email}</td>
                      <td className="p-2">{person.birthdate ?? "–"}</td>
                      <td className="p-2">{person.shirtSize ?? "–"}</td>
                      <td className="p-2">{person.activityAreas.join(", ")}</td>
                      <td className="p-2">{person.licenseNumber ?? "–"}</td>
                      <td className="p-2">{canWrite && <Button size="sm" variant="outline" onClick={() => setEditingPerson(person)}>Bearbeiten</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingPerson && (
              <div className="rounded-md border bg-slate-50 p-4">
                <div className="mb-3 flex justify-between">
                  <strong>{editingPerson.firstName} {editingPerson.lastName} bearbeiten</strong>
                  <Button size="sm" variant="outline" onClick={() => setEditingPerson(null)}>Schließen</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  <Input value={editingPerson.firstName} onChange={(e) => setEditingPerson({ ...editingPerson, firstName: e.target.value })} placeholder="Vorname" />
                  <Input value={editingPerson.lastName} onChange={(e) => setEditingPerson({ ...editingPerson, lastName: e.target.value })} placeholder="Nachname" />
                  <Input value={editingPerson.street ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, street: e.target.value })} placeholder="Straße" />
                  <Input value={editingPerson.zip ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, zip: e.target.value })} placeholder="PLZ" />
                  <Input value={editingPerson.city ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, city: e.target.value })} placeholder="Ort" />
                  <Input value={editingPerson.phone ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, phone: e.target.value })} placeholder="Telefon" />
                  <Input value={editingPerson.email ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, email: e.target.value })} placeholder="E-Mail" />
                  <Input value={editingPerson.shirtSize ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, shirtSize: e.target.value })} placeholder="Shirt" />
                  <Input value={editingPerson.licenseNumber ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, licenseNumber: e.target.value })} placeholder="DMSB-Lizenz" />
                  <Button onClick={() => void savePerson()}><Save className="mr-2 h-4 w-4" />Änderungen speichern</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ZUSAGE & EINSATZ (SA / SO) */}
      {(view === "saturday" || view === "sunday") && (
        <Card>
          <CardHeader>
            <CardTitle>{day?.label ?? "Tag"}: Zusagen und Einsatzplanung</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: cards */}
            <div className="block md:hidden space-y-3">
              {people.map((person) => {
                const assignment = person.assignments.find((a) => a.dayId === day?.id);
                const selected = assignment?.postId ? `post:${assignment.postId}` : assignment?.role === "section_leader" && assignment.sectionId ? `leader:${assignment.sectionId}` : "none";
                return (
                  <div key={person.id} className="rounded-md border p-3 text-sm space-y-2">
                    <div className="font-medium">{person.helperNumber} · {person.firstName} {person.lastName}</div>
                    <div className="text-slate-500">{person.zip} {person.city} · Shirt: {person.participation.shirtSizeSnapshot ?? person.shirtSize ?? "–"}</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Zusage</label>
                        <select className={`${inputClass} w-full`} value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy}
                          onChange={(e) => void saveDay(person, e.target.value as MarshalCommitmentStatus, selected === "none" ? "" : selected)}>
                          {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Posten / Funktion</label>
                        <select className={`${inputClass} w-full`} value={selected} disabled={!canWrite || busy}
                          onChange={(e) => void saveDay(person, assignment?.commitmentStatus ?? "accepted", e.target.value === "none" ? "" : e.target.value)}>
                          <option value="none">Noch nicht zugewiesen</option>
                          {workspace?.sections.map((s) => <option key={`leader:${s.id}`} value={`leader:${s.id}`}>{s.leaderCode} – {s.name}</option>)}
                          {workspace?.posts.map((p) => <option key={`post:${p.id}`} value={`post:${p.id}`}>{p.code}{p.description ? ` – ${p.description}` : ""}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">Nr.</th><th className="p-2">Name</th><th className="p-2">PLZ / Wohnort</th>
                    <th className="p-2">Shirt</th><th className="p-2">Zusage</th><th className="p-2">Posten / Funktion</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const assignment = person.assignments.find((a) => a.dayId === day?.id);
                    const selected = assignment?.postId ? `post:${assignment.postId}` : assignment?.role === "section_leader" && assignment.sectionId ? `leader:${assignment.sectionId}` : "none";
                    return (
                      <tr key={person.id} className="border-b">
                        <td className="p-2">{person.helperNumber}</td>
                        <td className="p-2 font-medium">{person.firstName} {person.lastName}</td>
                        <td className="p-2">{person.zip} {person.city}</td>
                        <td className="p-2">{person.participation.shirtSizeSnapshot ?? person.shirtSize ?? "–"}</td>
                        <td className="p-2">
                          <select className={inputClass} value={assignment?.commitmentStatus ?? "not_asked"} disabled={!canWrite || busy}
                            onChange={(e) => void saveDay(person, e.target.value as MarshalCommitmentStatus, selected === "none" ? "" : selected)}>
                            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <select className={`${inputClass} min-w-52`} value={selected} disabled={!canWrite || busy}
                            onChange={(e) => void saveDay(person, assignment?.commitmentStatus ?? "accepted", e.target.value === "none" ? "" : e.target.value)}>
                            <option value="none">Noch nicht zugewiesen</option>
                            {workspace?.sections.map((s) => <option key={`leader:${s.id}`} value={`leader:${s.id}`}>{s.leaderCode} – {s.name}</option>)}
                            {workspace?.posts.map((p) => <option key={`post:${p.id}`} value={`post:${p.id}`}>{p.code}{p.description ? ` – ${p.description}` : ""}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DRUCKLISTEN */}
      {view === "prints" && (
        <Card>
          <CardHeader><CardTitle>Drucklisten (A4 quer)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {workspace?.days.map((printDay) => (
              <div key={printDay.id} className="rounded-md border p-3">
                <strong>{printDay.label} {printDay.eventDate}</strong>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="outline" disabled={!canExport} onClick={() => void adminMarshalsService.downloadPrint({ eventId, type: "attendance", dayId: printDay.id })}>
                    <Download className="mr-2 h-4 w-4" />Anwesenheitsliste
                  </Button>
                  {workspace.sections.map((section) => (
                    <Button key={section.id} variant="outline" disabled={!canExport} onClick={() => void adminMarshalsService.downloadPrint({ eventId, type: "section", dayId: printDay.id, sectionId: section.id })}>
                      <Download className="mr-2 h-4 w-4" />{section.name}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SCHULUNGEN & LIZENZEN */}
      {view === "training" && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader><CardTitle>Schulung / Einweisung</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedTrainingId} onValueChange={setSelectedTrainingId}>
                <SelectTrigger><SelectValue placeholder="Termin wählen" /></SelectTrigger>
                <SelectContent>
                  {workspace?.trainings.map((item) => <SelectItem key={item.id} value={item.id}>{item.sessionDate} – {item.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {currentTraining && canExport && (
                <Button variant="outline" onClick={() => void adminMarshalsService.downloadPrint({ eventId, type: "training", trainingId: currentTraining.id })}>
                  <Download className="mr-2 h-4 w-4" />Teilnehmerliste
                </Button>
              )}
              {canWrite && (
                <div className="space-y-2 border-t pt-3">
                  <Label>Neuer Termin</Label>
                  <Select value={trainingDraft.sessionType} onValueChange={(v: "training" | "briefing") => setTrainingDraft({ ...trainingDraft, sessionType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="training">Lizenzschulung</SelectItem>
                      <SelectItem value="briefing">Einweisung</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={trainingDraft.title} onChange={(e) => setTrainingDraft({ ...trainingDraft, title: e.target.value })} placeholder="Titel" />
                  <Input type="date" value={trainingDraft.sessionDate} onChange={(e) => setTrainingDraft({ ...trainingDraft, sessionDate: e.target.value })} />
                  <Input value={trainingDraft.location} onChange={(e) => setTrainingDraft({ ...trainingDraft, location: e.target.value })} placeholder="Ort" />
                  <Button onClick={() => void createTraining()} disabled={!trainingDraft.title || !trainingDraft.sessionDate}>Anlegen</Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Teilnehmer und Lizenzstatus</CardTitle></CardHeader>
            <CardContent>
              {/* Mobile: cards */}
              <div className="block sm:hidden space-y-2">
                {people.map((person) => {
                  const participant = workspace?.trainingParticipants.find((p) => p.sessionId === selectedTrainingId && p.personId === person.id);
                  return (
                    <div key={person.id} className="rounded-md border p-3 text-sm space-y-1">
                      <div className="font-medium">{person.firstName} {person.lastName}</div>
                      <div className="text-slate-500">Lizenz: {person.licenseNumber ?? workspace?.qualifications.find((q) => q.personId === person.id)?.number ?? "–"}</div>
                      <select className={`${inputClass} w-full`} value={participant?.attendanceStatus ?? "registered"} disabled={!canWrite || !selectedTrainingId}
                        onChange={(e) => void adminMarshalsService.saveTrainingParticipant(selectedTrainingId, person.id, e.target.value as "registered" | "attended" | "absent" | "excused").then(load)}>
                        <option value="registered">Angemeldet</option>
                        <option value="attended">Anwesend</option>
                        <option value="absent">Nicht anwesend</option>
                        <option value="excused">Entschuldigt</option>
                      </select>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Name</th><th className="p-2">DMSB-Lizenz</th><th className="p-2">Anwesenheit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => {
                      const participant = workspace?.trainingParticipants.find((p) => p.sessionId === selectedTrainingId && p.personId === person.id);
                      return (
                        <tr key={person.id} className="border-b">
                          <td className="p-2">{person.firstName} {person.lastName}</td>
                          <td className="p-2">{person.licenseNumber ?? workspace?.qualifications.find((q) => q.personId === person.id)?.number ?? "–"}</td>
                          <td className="p-2">
                            <select className={inputClass} value={participant?.attendanceStatus ?? "registered"} disabled={!canWrite || !selectedTrainingId}
                              onChange={(e) => void adminMarshalsService.saveTrainingParticipant(selectedTrainingId, person.id, e.target.value as "registered" | "attended" | "absent" | "excused").then(load)}>
                              <option value="registered">Angemeldet</option>
                              <option value="attended">Anwesend</option>
                              <option value="absent">Nicht anwesend</option>
                              <option value="excused">Entschuldigt</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KONFIGURATION */}
      {view === "config" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div>
                <CardTitle>Abschnitte und Posten</CardTitle>
                <p className="text-sm text-slate-600">Vier organisatorische Abschnitte; 5/1–5/3 bleiben historisch Abschnitt 4 zugeordnet. Besetzung wird als Ist/Soll gezeigt.</p>
              </div>
              {canWrite && (
                <Button onClick={() => void saveConfig()} className="w-full sm:w-auto">
                  <Save className="mr-2 h-4 w-4" />Konfiguration speichern
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {workspace?.sections.map((section) => (
              <div key={section.id} className="rounded-md border p-3">
                <div className="mb-2 flex justify-between">
                  <strong>{section.name}</strong>
                  <Badge>{section.leaderCode}</Badge>
                </div>
                <div className="space-y-2">
                  {workspace.posts.filter((p) => p.sectionId === section.id).map((post) => {
                    const target = postTargets[post.id] ?? post.targetStaff;
                    const counts = workspace.days.map((d) => people.filter((p) => p.assignments.some((a) => a.dayId === d.id && a.postId === post.id && a.commitmentStatus === "accepted")).length);
                    return (
                      <div key={post.id} className="grid grid-cols-[48px_1fr] gap-2 items-start sm:grid-cols-[60px_1fr_150px_70px] sm:items-center">
                        <span className="text-sm font-mono">{post.code}</span>
                        <span className="text-sm text-slate-600 sm:truncate">{post.description || "Streckenposten"}</span>
                        <div className="col-span-2 sm:col-span-1 flex gap-1 flex-wrap">
                          {workspace.days.map((d, i) => (
                            <Badge key={d.id} className={cn("text-xs", counts[i] < target ? "bg-amber-100 text-amber-900" : counts[i] > target ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900")}>
                              {d.label.slice(0, 2)} {counts[i]}/{target}
                            </Badge>
                          ))}
                        </div>
                        <Input type="number" min={1} max={20} value={target} disabled={!canWrite}
                          onChange={(e) => setPostTargets((c) => ({ ...c, [post.id]: Number(e.target.value) }))}
                          className="w-full sm:w-auto" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* EXCEL-IMPORT */}
      {view === "import" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />Excel-Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Die Arbeitsmappe wird zuerst nur analysiert. Erst nach Prüfung der Zusammenfassung wird sie idempotent übernommen.</p>
            {!eventId && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Bitte zuerst oben eine Veranstaltung wählen.
              </div>
            )}
            <Input
              type="file"
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportPreview(null); setImportData(""); }}
            />
            {canWrite && (
              <Button onClick={() => void previewImport()} disabled={!importFile || !eventId || busy}>
                Dry-run starten
              </Button>
            )}
            {importPreview && (
              <div className="rounded-md border bg-slate-50 p-4">
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="Personen" value={importPreview.summary.people} />
                  <Metric label="Neu" value={importPreview.summary.newPeople} />
                  <Metric label="Aktualisiert" value={importPreview.summary.updatedPeople} />
                  <Metric label="Teilnahmen" value={importPreview.summary.eventParticipations} />
                  <Metric label="Termine" value={importPreview.summary.trainings} />
                  <Metric label="Prüffälle" value={importPreview.summary.conflicts} />
                </div>
                {importPreview.conflicts.length > 0 && (
                  <ul className="mt-3 max-h-40 overflow-auto text-sm text-amber-800">
                    {importPreview.conflicts.map((item, i) => (
                      <li key={`${item.sheet}-${item.row}-${i}`}>{item.sheet}, Zeile {item.row}: {item.message}</li>
                    ))}
                  </ul>
                )}
                <Button className="mt-4" onClick={() => void commitImport()} disabled={busy}>Geprüften Import übernehmen</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-white p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
