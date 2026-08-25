import { useCallback, useEffect, useState } from "react";
import { RefreshCw, UsersRound } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { MarshalAufbauView } from "@/components/features/admin/marshal-aufbau-view";
import { MarshalConfigView } from "@/components/features/admin/marshal-config-view";
import { MarshalDruckView } from "@/components/features/admin/marshal-druck-view";
import { MarshalGeneralView } from "@/components/features/admin/marshal-general-view";
import { MarshalImportView } from "@/components/features/admin/marshal-import-view";
import { MarshalPersonDrawer } from "@/components/features/admin/marshal-person-drawer";
import { MarshalSchulungView } from "@/components/features/admin/marshal-schulung-view";
import { MarshalSidebar, type SidebarView } from "@/components/features/admin/marshal-sidebar";
import { MarshalStammdatenView } from "@/components/features/admin/marshal-stammdaten-view";
import { MarshalStreckenpostenView } from "@/components/features/admin/marshal-streckenposten-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { cn } from "@/lib/utils";
import { adminMarshalsService } from "@/services/admin-marshals.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type {
  MarshalAreaConfigAreaInput,
  MarshalAreaConfigShiftInput,
  MarshalCommitmentStatus,
  MarshalEvent,
  MarshalImportPreview,
  MarshalPerson,
  MarshalPersonInput,
  MarshalPersonPatch,
  MarshalPostConfigInput,
  MarshalTrainingParticipant,
  MarshalWorkspace,
} from "@/types/admin-marshals";

export function AdminMarshalsPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "marshals.write");
  const canExport = hasPermission(roles, "marshals.export");
  const [events, setEvents] = useState<MarshalEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [workspace, setWorkspace] = useState<MarshalWorkspace | null>(null);
  const [view, setView] = useState<SidebarView>("track_saturday");
  const [selectedPerson, setSelectedPerson] = useState<MarshalPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!eventId) return;
    setLoading(true); setError("");
    try {
      const data = await adminMarshalsService.getWorkspace(eventId);
      setWorkspace({ ...data, areas: data.areas ?? [], areaShifts: data.areaShifts ?? [], shiftAssignments: data.shiftAssignments ?? [], areaAssignments: data.areaAssignments ?? [] });
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Helferverwaltung konnte nicht geladen werden."));
    } finally { setLoading(false); }
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    adminMarshalsService.listEvents().then(({ events: items }) => {
      setEvents(items);
      const stored = localStorage.getItem("msc_marshal_event_id");
      const selected = items.find((item) => item.id === stored) ?? items.find((item) => item.isCurrent) ?? items[0];
      if (selected) setEventId(selected.id); else setLoading(false);
    }).catch((cause) => { setError(getApiErrorMessage(cause, "Veranstaltungen konnten nicht geladen werden.")); setLoading(false); });
  }, []);
  useEffect(() => { if (eventId) { localStorage.setItem("msc_marshal_event_id", eventId); void loadWorkspace(); } }, [eventId, loadWorkspace]);

  async function runAction(action: () => Promise<unknown>, success: string, fallback: string, reload = true): Promise<boolean> {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); if (reload) await loadWorkspace(); return true; }
    catch (cause) { setError(getApiErrorMessage(cause, fallback)); return false; }
    finally { setBusy(false); }
  }

  async function saveDay(person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string) {
    if (!workspace) return false;
    const dayKey = view === "track_sunday" ? "sunday" : "saturday";
    const day = workspace.days.find((item) => item.dayKey === dayKey);
    if (!day) return false;
    const keepAssignment = status !== "declined" && status !== "not_asked";
    const post = keepAssignment ? workspace.posts.find((item) => assignmentValue === `post:${item.id}`) : undefined;
    const section = keepAssignment ? workspace.sections.find((item) => assignmentValue === `leader:${item.id}`) : undefined;
    return runAction(() => adminMarshalsService.saveAssignment(person.id, {
      eventId, contactOwner: person.participation.contactOwner, wish: person.participation.wish,
      note: person.participation.note, shirtSizeSnapshot: person.participation.shirtSizeSnapshot ?? person.shirtSize,
      days: [{ dayId: day.id, commitmentStatus: status, role: post ? "marshal" : section ? "section_leader" : null, sectionId: post?.sectionId ?? section?.id ?? null, postId: post?.id ?? null, functionCode: section?.leaderCode ?? null }],
    }), "Einsatz gespeichert.", "Einsatz konnte nicht gespeichert werden.");
  }

  function saveShift(person: MarshalPerson, shiftId: string, status: MarshalCommitmentStatus) {
    return runAction(() => adminMarshalsService.upsertShiftAssignment(person.id, { eventId, shiftId, commitmentStatus: status }), "Schicht gespeichert.", "Schicht konnte nicht gespeichert werden.");
  }
  function saveArea(person: MarshalPerson, areaId: string, status: MarshalCommitmentStatus, note: string | null) {
    return runAction(() => adminMarshalsService.upsertAreaAssignment(person.id, { eventId, areaId, commitmentStatus: status, note }), "Bereichseinsatz gespeichert.", "Bereichseinsatz konnte nicht gespeichert werden.");
  }
  function savePerson(personId: string, patch: MarshalPersonPatch) { return runAction(() => adminMarshalsService.updatePerson(personId, patch), "Stammdaten gespeichert.", "Stammdaten konnten nicht gespeichert werden."); }
  function createPerson(input: MarshalPersonInput) { return runAction(() => adminMarshalsService.createPerson(input), "Person angelegt.", "Person konnte nicht angelegt werden."); }
  function deletePerson(person: MarshalPerson) { return runAction(() => adminMarshalsService.deletePerson(person.id), "Person und verknüpfte Daten wurden endgültig gelöscht.", "Person konnte nicht gelöscht werden."); }
  function createTraining(draft: { sessionType: "training" | "briefing"; title: string; sessionDate: string; location: string | null }) { return runAction(() => adminMarshalsService.createTraining({ eventId, ...draft }), "Schulungstermin angelegt.", "Schulungstermin konnte nicht angelegt werden."); }
  function saveAttendance(trainingId: string, person: MarshalPerson, status: MarshalTrainingParticipant["attendanceStatus"]) { return runAction(() => adminMarshalsService.saveTrainingParticipant(trainingId, person.id, status), "Anwesenheit gespeichert.", "Anwesenheit konnte nicht gespeichert werden."); }
  async function print(params: { type: "attendance" | "section"; dayId: string; sectionId?: string }) { await runAction(() => adminMarshalsService.downloadPrint({ eventId, ...params }), "Druckliste erstellt.", "Druckliste konnte nicht erstellt werden.", false); }
  async function printTraining(trainingId: string) { await runAction(() => adminMarshalsService.downloadPrint({ eventId, type: "training", trainingId }), "Teilnehmerliste erstellt.", "Teilnehmerliste konnte nicht erstellt werden.", false); }
  function savePostConfig(posts: MarshalPostConfigInput[]) {
    if (!workspace) return Promise.resolve(false);
    return runAction(() => adminMarshalsService.saveConfig({ eventId, sections: workspace.sections.map(({ code, name, leaderCode, sortOrder }) => ({ code, name, leaderCode, sortOrder })), posts }), "Postenkonfiguration gespeichert.", "Postenkonfiguration konnte nicht gespeichert werden.");
  }
  function saveAreaConfig(areas: MarshalAreaConfigAreaInput[], shifts: MarshalAreaConfigShiftInput[]) { return runAction(() => adminMarshalsService.updateAreaConfig({ eventId, areas, shifts }), "Bereiche und Schichten gespeichert.", "Bereiche und Schichten konnten nicht gespeichert werden."); }
  function resetAssignments() { return runAction(() => adminMarshalsService.resetEventAssignments(eventId), "Alle Event-Einteilungen wurden zurückgesetzt.", "Einteilungen konnten nicht zurückgesetzt werden."); }
  async function previewImport(file: File) {
    setBusy(true); setError(""); setNotice("");
    try { return await adminMarshalsService.previewImport(eventId, file); }
    catch (cause) { setError(getApiErrorMessage(cause, "Excel-Vorschau konnte nicht erstellt werden.")); return null; }
    finally { setBusy(false); }
  }
  function commitImport(file: File, preview: MarshalImportPreview, dataBase64: string) { return runAction(() => adminMarshalsService.commitImport(eventId, file.name, dataBase64, preview.sha256), "Excel-Import vollständig übernommen.", "Excel-Import konnte nicht übernommen werden."); }

  const selectedEvent = events.find((event) => event.id === eventId);
  const activeDayKey: "saturday" | "sunday" = view === "track_sunday" || view === "general_sunday" ? "sunday" : "saturday";
  const activeDay = workspace?.days.find((day) => day.dayKey === activeDayKey);
  const areaForView = workspace?.areas.find((area) => area.code === view);

  return <div className="mx-auto max-w-[1800px] pb-8">
    <header className="mb-4 flex flex-col gap-3 rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl"><span className="rounded-lg bg-primary/10 p-2 text-primary"><UsersRound className="h-5 w-5" /></span>Helferverwaltung</h1><p className="mt-1 text-sm text-slate-600">Einteilungen, Stammdaten, Schulungen und Veranstaltungsunterlagen.</p></div><Button type="button" variant="outline" disabled={loading || busy || !eventId} onClick={() => void loadWorkspace()}><RefreshCw className={cn("mr-2 h-4 w-4", (loading || busy) && "animate-spin")} />Aktualisieren</Button></header>
    {error && <div className="mb-4" role="alert"><ErrorState title="Helferverwaltung" message={error} /></div>}
    {notice && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</div>}
    <div className="flex flex-col overflow-hidden rounded-xl border bg-slate-100/60 lg:min-h-[680px] lg:flex-row">
      <MarshalSidebar workspace={workspace} activeView={view} onViewChange={setView} events={events} selectedEvent={eventId || null} onEventChange={(id) => { setSelectedPerson(null); setWorkspace(null); setEventId(id); }} />
      <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
        {loading && !workspace ? <LoadingState label="Helferarbeitsbereich wird geladen …" /> : !eventId ? <EmptyState message="Keine Veranstaltung verfügbar." /> : !workspace ? <EmptyState message="Für diese Veranstaltung konnten keine Helferdaten geladen werden." /> : <>
          {(view === "track_saturday" || view === "track_sunday") && activeDay && <MarshalStreckenpostenView workspace={workspace} day={activeDay} dayKey={activeDayKey} canWrite={canWrite} busy={busy} onDayChange={(day) => setView(day === "saturday" ? "track_saturday" : "track_sunday")} onPersonOpen={setSelectedPerson} onSave={saveDay} />}
          {(view === "setup_fl1" || view === "setup_fl2") && (areaForView ? <MarshalAufbauView workspace={workspace} area={areaForView} canWrite={canWrite} busy={busy} onPersonOpen={setSelectedPerson} onSave={saveShift} /> : <EmptyState message="Der Aufbau-Bereich ist in dieser Veranstaltung noch nicht verfügbar." />)}
          {(view === "general_saturday" || view === "general_sunday") && (areaForView ? <MarshalGeneralView workspace={workspace} area={areaForView} dayKey={activeDayKey} canWrite={canWrite} busy={busy} onDayChange={(day) => setView(day === "saturday" ? "general_saturday" : "general_sunday")} onPersonOpen={setSelectedPerson} onSave={(person, status, note) => saveArea(person, areaForView.id, status, note)} /> : <EmptyState message="Der allgemeine Helferbereich ist in dieser Veranstaltung noch nicht verfügbar." />)}
          {view === "stammdaten" && <MarshalStammdatenView workspace={workspace} canWrite={canWrite} busy={busy} onPersonOpen={setSelectedPerson} onCreate={createPerson} onDelete={deletePerson} />}
          {view === "schulung" && <MarshalSchulungView workspace={workspace} canWrite={canWrite} canExport={canExport} busy={busy} onCreate={createTraining} onAttendance={saveAttendance} onPrint={printTraining} onPersonOpen={setSelectedPerson} />}
          {view === "druck" && <MarshalDruckView workspace={workspace} canExport={canExport} onPrint={print} />}
          {view === "import" && <MarshalImportView canWrite={canWrite} busy={busy} onPreview={previewImport} onCommit={commitImport} />}
          {view === "config" && <MarshalConfigView workspace={workspace} canWrite={canWrite} busy={busy} onSavePosts={savePostConfig} onSaveAreas={saveAreaConfig} onReset={resetAssignments} />}
        </>}
      </main>
    </div>
    {workspace && <MarshalPersonDrawer person={selectedPerson} workspace={workspace} eventName={selectedEvent?.name ?? "Gewählte Veranstaltung"} canWrite={canWrite} busy={busy} onClose={() => setSelectedPerson(null)} onSave={savePerson} />}
  </div>;
}
