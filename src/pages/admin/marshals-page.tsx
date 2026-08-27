import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { statusForTargetSelection } from "@/components/features/admin/marshal-assignment-helpers";
import { MarshalAufbauView } from "@/components/features/admin/marshal-aufbau-view";
import { MarshalConfigView } from "@/components/features/admin/marshal-config-view";
import { MarshalDruckView } from "@/components/features/admin/marshal-druck-view";
import { MarshalGeneralView } from "@/components/features/admin/marshal-general-view";
import { MarshalImportView } from "@/components/features/admin/marshal-import-view";
import { MarshalPersonDrawer } from "@/components/features/admin/marshal-person-drawer";
import { getPostTarget, type PlanningTargetMode } from "@/components/features/admin/marshal-planning-map";
import { MarshalSchulungView } from "@/components/features/admin/marshal-schulung-view";
import { MarshalSidebar, type SidebarView } from "@/components/features/admin/marshal-sidebar";
import { MarshalStammdatenView } from "@/components/features/admin/marshal-stammdaten-view";
import { MarshalStreckenpostenView } from "@/components/features/admin/marshal-streckenposten-view";
import { EmptyState } from "@/components/state/empty-state";
import { LoadingState } from "@/components/state/loading-state";
import { cn } from "@/lib/utils";
import { adminMarshalsService } from "@/services/admin-marshals.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type {
  MarshalAreaConfigAreaInput,
  MarshalAreaConfigShiftInput,
  MarshalAssignmentInput,
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
  const [loadedWorkspace, setLoadedWorkspace] = useState<{ eventId: string; data: MarshalWorkspace } | null>(null);
  const [view, setView] = useState<SidebarView>("track_saturday");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [planningTargetMode, setPlanningTargetMode] = useState<PlanningTargetMode>("normal");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadSequence = useRef(0);
  const assignmentSaves = useRef(new Set<string>());
  const activeEventId = useRef(eventId);
  activeEventId.current = eventId;
  const workspace = loadedWorkspace?.eventId === eventId ? loadedWorkspace.data : null;

  const loadWorkspace = useCallback(async (targetEventId: string) => {
    if (!targetEventId) return;
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const data = await adminMarshalsService.getWorkspace(targetEventId);
      if (sequence !== loadSequence.current) return;
      setLoadedWorkspace({ eventId: targetEventId, data: { ...data, areas: data.areas ?? [], areaShifts: data.areaShifts ?? [], shiftAssignments: data.shiftAssignments ?? [], areaAssignments: data.areaAssignments ?? [] } });
    } catch (cause) {
      if (sequence !== loadSequence.current) return;
      setError(getApiErrorMessage(cause, "Helferverwaltung konnte nicht geladen werden."));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    adminMarshalsService.listEvents().then(({ events: items }) => {
      setEvents(items);
      const stored = localStorage.getItem("msc_marshal_event_id");
      const selected = items.find((item) => item.id === stored) ?? items.find((item) => item.isCurrent) ?? items[0];
      if (selected) setEventId(selected.id); else setLoading(false);
    }).catch((cause) => { setError(getApiErrorMessage(cause, "Veranstaltungen konnten nicht geladen werden.")); setLoading(false); });
  }, []);
  useEffect(() => { if (eventId) { localStorage.setItem("msc_marshal_event_id", eventId); void loadWorkspace(eventId); } }, [eventId, loadWorkspace]);
  useEffect(() => {
    if (!error && !notice) return;
    const timeout = window.setTimeout(() => { setError(""); setNotice(""); }, 5000);
    return () => window.clearTimeout(timeout);
  }, [error, notice]);

  async function runAction(action: () => Promise<unknown>, success: string, fallback: string, reload = true): Promise<boolean> {
    const operationEventId = eventId;
    setBusy(true); setError(""); setNotice("");
    try {
      await action();
      if (activeEventId.current !== operationEventId) return true;
      setNotice(success);
      if (reload) await loadWorkspace(operationEventId);
      return true;
    }
    catch (cause) {
      if (activeEventId.current === operationEventId) setError(getApiErrorMessage(cause, fallback));
      return false;
    }
    finally { setBusy(false); }
  }

  function resolveDaySave(person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string, allowOverfill = false) {
    if (!workspace) return false;
    const scopedPerson = workspace.people.find((item) => item.id === person.id);
    if (!scopedPerson) return false;
    const dayKey = view === "track_sunday" ? "sunday" : "saturday";
    const day = workspace.days.find((item) => item.dayKey === dayKey);
    if (!day) return false;
    const existingDayAssignment = scopedPerson.assignments.find((assignment) => assignment.dayId === day.id);
    const nextStatus = statusForTargetSelection(status, assignmentValue);
    const keepAssignment = nextStatus !== "declined" && nextStatus !== "not_asked";
    const post = keepAssignment ? workspace.posts.find((item) => assignmentValue === `post:${item.id}`) : undefined;
    const section = keepAssignment ? workspace.sections.find((item) => assignmentValue === `leader:${item.id}`) : undefined;
    if ((post || section) && (!scopedPerson.isActive || scopedPerson.noDeployment)) {
      setError("Inaktive Personen oder Personen mit „Kein Einsatz“ können nicht neu eingeteilt werden.");
      return false;
    }
    if (post && !allowOverfill) {
      const alreadyAssigned = existingDayAssignment?.postId === post.id;
      const assignedCount = workspace.people.filter((item) => !item.noDeployment && item.assignments.some((assignment) => assignment.dayId === day.id && assignment.postId === post.id)).length;
      if (!alreadyAssigned && assignedCount >= getPostTarget(post, planningTargetMode)) {
        setError(`Posten ${post.code} hat im gewählten Sollmodus keine freien Plätze.`);
        return false;
      }
    }
    if (section && !allowOverfill) {
      const alreadyAssigned = scopedPerson.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id);
      const occupied = workspace.people.some((item) => item.id !== scopedPerson.id && !item.noDeployment && item.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id));
      if (!alreadyAssigned && occupied) {
        setError(`${section.leaderCode} ist bereits besetzt.`);
        return false;
      }
    }
    return { scopedPerson, day, payload: {
      eventId,
      days: [{ dayId: day.id, commitmentStatus: nextStatus, role: (post ? "marshal" : section ? "section_leader" : null) as "marshal" | "section_leader" | "special" | null, sectionId: post?.sectionId ?? section?.id ?? null, postId: post?.id ?? null, functionCode: section?.leaderCode ?? null }],
    } as MarshalAssignmentInput };
  }

  async function saveDay(person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string, allowOccupied = false) {
    const resolved = resolveDaySave(person, status, assignmentValue, allowOccupied);
    if (!resolved) return false;
    return runAction(() => adminMarshalsService.saveAssignment(resolved.scopedPerson.id, resolved.payload), "Einsatz gespeichert.", "Einsatz konnte nicht gespeichert werden.");
  }

  async function saveListDay(person: MarshalPerson, status: MarshalCommitmentStatus, assignmentValue: string) {
    const resolved = resolveDaySave(person, status, assignmentValue);
    if (!resolved) return false;
    const operationEventId = eventId;
    const operationKey = `${operationEventId}:${resolved.day.id}:${resolved.scopedPerson.id}`;
    if (assignmentSaves.current.has(operationKey)) return false;
    assignmentSaves.current.add(operationKey);
    setError(""); setNotice("");
    try {
      await adminMarshalsService.saveAssignment(resolved.scopedPerson.id, resolved.payload);
      if (activeEventId.current !== operationEventId) return true;
      setNotice("Einsatz gespeichert.");
      await loadWorkspace(operationEventId);
      return true;
    } catch (cause) {
      if (activeEventId.current === operationEventId) setError(getApiErrorMessage(cause, "Einsatz konnte nicht gespeichert werden."));
      return false;
    } finally {
      assignmentSaves.current.delete(operationKey);
    }
  }

  async function replacePostHelper(currentPerson: MarshalPerson, replacementPerson: MarshalPerson, postId: string) {
    if (!workspace) return false;
    const dayKey = view === "track_sunday" ? "sunday" : "saturday";
    const day = workspace.days.find((item) => item.dayKey === dayKey);
    const current = workspace.people.find((person) => person.id === currentPerson.id);
    const replacement = workspace.people.find((person) => person.id === replacementPerson.id);
    const currentAssignment = current?.assignments.find((assignment) => assignment.dayId === day?.id);
    const replacementAssignment = replacement?.assignments.find((assignment) => assignment.dayId === day?.id);
    if (!day || !current || !replacement || !currentAssignment || !replacementAssignment || replacement.noDeployment) return false;
    const operationEventId = eventId;
    const assignReplacement = resolveDaySave(replacement, replacementAssignment.commitmentStatus, `post:${postId}`, true);
    const removeCurrent = resolveDaySave(current, currentAssignment.commitmentStatus, "", true);
    if (!assignReplacement || !removeCurrent) return false;
    const rollbackReplacement = { ...assignReplacement.payload, days: [{
      dayId: replacementAssignment.dayId,
      commitmentStatus: replacementAssignment.commitmentStatus,
      role: replacementAssignment.role as "marshal" | "section_leader" | "special" | null | undefined,
      sectionId: replacementAssignment.sectionId,
      postId: replacementAssignment.postId,
      functionCode: replacementAssignment.functionCode,
      note: replacementAssignment.note,
    }] };

    setBusy(true); setError(""); setNotice("");
    try {
      await adminMarshalsService.saveAssignment(replacement.id, assignReplacement.payload);
      try {
        await adminMarshalsService.saveAssignment(current.id, removeCurrent.payload);
      } catch {
        let rolledBack = false;
        try {
          await adminMarshalsService.saveAssignment(replacement.id, rollbackReplacement);
          rolledBack = true;
        } catch {
          rolledBack = false;
        }
        await loadWorkspace(operationEventId);
        if (activeEventId.current === operationEventId) setError(rolledBack ? "Helfer konnte nicht ersetzt werden. Der ursprüngliche Zustand wurde wiederhergestellt." : "Helfer konnte nicht ersetzt und der Ersatz nicht zurückgesetzt werden. Manuelle Prüfung erforderlich.");
        return false;
      }
      await loadWorkspace(operationEventId);
      if (activeEventId.current === operationEventId) setNotice("Helfer ersetzt.");
      return true;
    } catch (cause) {
      if (activeEventId.current === operationEventId) setError(getApiErrorMessage(cause, "Helfer konnte nicht ersetzt werden."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveShift(person: MarshalPerson, shiftId: string, status: MarshalCommitmentStatus) {
    return runAction(() => adminMarshalsService.upsertShiftAssignment(person.id, { eventId, shiftId, commitmentStatus: status }), "Schicht gespeichert.", "Schicht konnte nicht gespeichert werden.");
  }
  function saveArea(person: MarshalPerson, areaId: string, status: MarshalCommitmentStatus, note: string | null) {
    return runAction(() => adminMarshalsService.upsertAreaAssignment(person.id, { eventId, areaId, commitmentStatus: status, note }), "Bereichseinsatz gespeichert.", "Bereichseinsatz konnte nicht gespeichert werden.");
  }
  function removeArea(person: MarshalPerson, areaId: string) {
    return runAction(() => adminMarshalsService.deleteAreaAssignment(person.id, eventId, areaId), "Bereichszuordnung entfernt.", "Bereichszuordnung konnte nicht entfernt werden.");
  }
  function savePerson(personId: string, patch: MarshalPersonPatch) { return runAction(() => adminMarshalsService.updatePerson(personId, patch), "Stammdaten gespeichert.", "Stammdaten konnten nicht gespeichert werden."); }
  function createPerson(input: MarshalPersonInput) { return runAction(() => adminMarshalsService.createPerson(input), "Person angelegt.", "Person konnte nicht angelegt werden."); }
  function deletePerson(person: MarshalPerson) { return runAction(() => adminMarshalsService.deletePerson(person.id), "Person und verknüpfte Daten wurden endgültig gelöscht.", "Person konnte nicht gelöscht werden."); }
  function createTraining(draft: { sessionType: "training" | "briefing"; title: string; sessionDate: string; location: string | null }) { return runAction(() => adminMarshalsService.createTraining({ eventId, ...draft }), "Schulungstermin angelegt.", "Schulungstermin konnte nicht angelegt werden."); }
  function saveAttendance(trainingId: string, person: MarshalPerson, status: MarshalTrainingParticipant["attendanceStatus"]) { return runAction(() => adminMarshalsService.saveTrainingParticipant(trainingId, person.id, status), "Anwesenheit gespeichert.", "Anwesenheit konnte nicht gespeichert werden."); }
  async function print(params: { type: "attendance" | "section" | "area"; dayId?: string; sectionId?: string; areaId?: string; shiftId?: string }) { await runAction(() => adminMarshalsService.downloadPrint({ eventId, ...params }), "Druckliste erstellt.", "Druckliste konnte nicht erstellt werden.", false); }
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
  const selectedPerson = workspace?.people.find((person) => person.id === selectedPersonId) ?? null;
  const activeDayKey: "saturday" | "sunday" = view === "track_sunday" || view === "general_sunday" ? "sunday" : "saturday";
  const activeDay = workspace?.days.find((day) => day.dayKey === activeDayKey);
  const areaForView = workspace?.areas.find((area) => area.code === view);

  return <div className="mx-auto max-w-[1800px] pb-8">
    {(error || notice) && <div className="fixed right-4 top-4 z-[80] w-[min(24rem,calc(100vw-2rem))]" aria-live="polite" aria-atomic="true"><div className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm shadow-lg", error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")} role={error ? "alert" : "status"}><span className="min-w-0 flex-1 break-words">{error || notice}</span><button type="button" className="rounded p-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label="Meldung schließen" onClick={() => { setError(""); setNotice(""); }}><X className="h-4 w-4" /></button></div></div>}
    <div className="flex min-w-0 flex-col sm:overflow-hidden sm:rounded-xl sm:border sm:bg-slate-100/60 xl:min-h-[680px] xl:flex-row">
      <MarshalSidebar workspace={workspace} activeView={view} onViewChange={(nextView) => { setSelectedPersonId(null); setView(nextView); }} events={events} selectedEvent={eventId || null} onEventChange={(id) => { loadSequence.current += 1; setSelectedPersonId(null); setLoadedWorkspace(null); setLoading(true); setEventId(id); }} />
      <main className="min-w-0 flex-1 sm:p-4 lg:p-6">
        {loading && !workspace ? <LoadingState label="Helferarbeitsbereich wird geladen …" /> : !eventId ? <EmptyState message="Keine Veranstaltung verfügbar." /> : !workspace ? <EmptyState message="Für diese Veranstaltung konnten keine Helferdaten geladen werden." /> : <>
          {(view === "track_saturday" || view === "track_sunday") && activeDay && <MarshalStreckenpostenView workspace={workspace} day={activeDay} dayKey={activeDayKey} canWrite={canWrite} busy={busy} targetMode={planningTargetMode} onTargetModeChange={setPlanningTargetMode} onDayChange={(day) => { setSelectedPersonId(null); setView(day === "saturday" ? "track_saturday" : "track_sunday"); }} onPersonOpen={(person) => setSelectedPersonId(person.id)} onListSave={saveListDay} onSave={saveDay} onReplace={replacePostHelper} />}
          {(view === "setup_fl1" || view === "setup_fl2") && (areaForView ? <MarshalAufbauView workspace={workspace} area={areaForView} canWrite={canWrite} busy={busy} onPersonOpen={(person) => setSelectedPersonId(person.id)} onAddPerson={(person) => saveArea(person, areaForView.id, "not_asked", null)} onRemovePerson={(person) => removeArea(person, areaForView.id)} onSaveShift={saveShift} /> : <EmptyState message="Der Aufbau-Bereich ist in dieser Veranstaltung noch nicht verfügbar." />)}
          {(view === "general_saturday" || view === "general_sunday") && (areaForView ? <MarshalGeneralView workspace={workspace} area={areaForView} dayKey={activeDayKey} canWrite={canWrite} busy={busy} onDayChange={(day) => { setSelectedPersonId(null); setView(day === "saturday" ? "general_saturday" : "general_sunday"); }} onPersonOpen={(person) => setSelectedPersonId(person.id)} onSave={(person, status, note) => saveArea(person, areaForView.id, status, note)} onRemove={(person) => removeArea(person, areaForView.id)} /> : <EmptyState message="Der allgemeine Helferbereich ist in dieser Veranstaltung noch nicht verfügbar." />)}
          {view === "stammdaten" && <MarshalStammdatenView workspace={workspace} canWrite={canWrite} busy={busy} onPersonOpen={(person) => setSelectedPersonId(person.id)} onCreate={createPerson} onDelete={deletePerson} />}
          {view === "schulung" && <MarshalSchulungView workspace={workspace} canWrite={canWrite} canExport={canExport} busy={busy} onCreate={createTraining} onAttendance={saveAttendance} onPrint={printTraining} onPersonOpen={(person) => setSelectedPersonId(person.id)} />}
          {view === "druck" && <MarshalDruckView workspace={workspace} canExport={canExport} onPrint={print} />}
          {view === "import" && <MarshalImportView canWrite={canWrite} busy={busy} onPreview={previewImport} onCommit={commitImport} />}
          {view === "config" && <MarshalConfigView workspace={workspace} canWrite={canWrite} busy={busy} onSavePosts={savePostConfig} onSaveAreas={saveAreaConfig} onReset={resetAssignments} />}
        </>}
      </main>
    </div>
    {workspace && <MarshalPersonDrawer person={selectedPerson} workspace={workspace} eventName={selectedEvent?.name ?? "Gewählte Veranstaltung"} canWrite={canWrite} busy={busy} onClose={() => setSelectedPersonId(null)} onSave={savePerson} />}
  </div>;
}
