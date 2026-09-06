import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/features/admin/marshal-status";
import { canonicalizeMarshalAreas, MarshalAreaMultiSelect } from "@/components/features/admin/marshal-area-multi-select";
import { MarshalShirtSizeInput } from "@/components/features/admin/marshal-shirt-size-input";
import type { MarshalCommitmentStatus, MarshalPerson, MarshalPersonPatch, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  person: MarshalPerson | null;
  workspace: MarshalWorkspace;
  canWrite: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (personId: string, patch: MarshalPersonPatch) => Promise<boolean>;
  onSaveEventNote: (person: MarshalPerson, note: string | null) => Promise<boolean>;
};

export function MarshalPersonDrawer({ person, workspace, canWrite, busy, onClose, onSave, onSaveEventNote }: Props) {
  const [draft, setDraft] = useState<MarshalPerson | null>(person);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => setDraft(person ? { ...person, participation: { ...person.participation }, assignments: person.assignments.map((assignment) => ({ ...assignment })), activityAreas: canonicalizeMarshalAreas(person.activityAreas, workspace.areas) } : null), [person, workspace.areas]);
  useEffect(() => {
    if (!person) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && drawerRef.current) {
        const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose, person]);

  if (!person || !draft) return null;

  // Compact event assignment entries for the summary card
  const einsatzEntries: Array<{ id: string; label: string; dayLabel: string; status: MarshalCommitmentStatus }> = [];
  for (const assignment of draft.assignments) {
    const assignDay = workspace.days.find((d) => d.id === assignment.dayId);
    const dayShort = assignDay?.dayKey === "saturday" ? "Sa" : assignDay?.dayKey === "sunday" ? "So" : (assignDay?.label ?? "");
    let label: string;
    if (assignment.postId) {
      const post = workspace.posts.find((p) => p.id === assignment.postId);
      label = post ? `Posten ${post.code}` : "Posten";
    } else if (assignment.role === "section_leader" && assignment.functionCode) {
      label = assignment.functionCode;
    } else if (assignment.sectionId) {
      const section = workspace.sections.find((s) => s.id === assignment.sectionId);
      label = section?.name ?? "Abschnitt";
    } else {
      label = "Eingeteilt";
    }
    einsatzEntries.push({ id: assignment.id, label, dayLabel: dayShort, status: assignment.commitmentStatus });
  }
  for (const aAssign of workspace.areaAssignments) {
    if (aAssign.participationId !== draft.participation.id) continue;
    const area = workspace.areas.find((a) => a.id === aAssign.areaId);
    einsatzEntries.push({ id: aAssign.id, label: area?.name ?? "Bereich", dayLabel: "", status: aAssign.commitmentStatus });
  }
  for (const sAssign of workspace.shiftAssignments) {
    if (sAssign.participationId !== draft.participation.id) continue;
    const shift = workspace.areaShifts.find((s) => s.id === sAssign.shiftId);
    const area = workspace.areas.find((a) => a.id === shift?.areaId);
    einsatzEntries.push({ id: sAssign.id, label: area ? `${area.name}${shift ? ` ${shift.label}` : ""}` : "Schicht", dayLabel: "", status: sAssign.commitmentStatus });
  }

  const dayHistory = draft.assignments.map((assignment) => {
    const day = workspace.days.find((item) => item.id === assignment.dayId);
    const post = workspace.posts.find((item) => item.id === assignment.postId);
    const section = workspace.sections.find((item) => item.id === assignment.sectionId);
    return { id: assignment.id, title: day?.label ?? "Veranstaltungstag", detail: post ? `Posten ${post.code}` : assignment.functionCode ?? section?.name ?? "Noch nicht eingeteilt", status: assignment.commitmentStatus };
  });
  const areaHistory = workspace.areaAssignments.filter((item) => item.participationId === draft.participation.id).map((assignment) => ({
    id: assignment.id,
    title: workspace.areas.find((area) => area.id === assignment.areaId)?.name ?? "Helferbereich",
    detail: assignment.note || "Allgemeiner Einsatz",
    status: assignment.commitmentStatus,
  }));
  const shiftHistory = workspace.shiftAssignments.filter((item) => item.participationId === draft.participation.id).map((assignment) => {
    const shift = workspace.areaShifts.find((item) => item.id === assignment.shiftId);
    const area = workspace.areas.find((item) => item.id === shift?.areaId);
    return { id: assignment.id, title: area?.name ?? "Aufbau", detail: shift ? `${shift.label} · ${formatDate(shift.shiftDate)}` : "Schicht", status: assignment.commitmentStatus };
  });
  const history = [...dayHistory, ...areaHistory, ...shiftHistory];
  const fields: Array<{ key: "firstName" | "lastName" | "street" | "zip" | "city" | "birthdate" | "phone" | "email" | "shirtSize" | "licenseNumber" | "vehicleRegistration"; label: string; type?: string }> = [
    { key: "firstName", label: "Vorname" }, { key: "lastName", label: "Nachname" },
    { key: "street", label: "Straße" }, { key: "zip", label: "PLZ" }, { key: "city", label: "Ort" },
    { key: "birthdate", label: "Geburtsdatum", type: "date" }, { key: "phone", label: "Telefon", type: "tel" },
    { key: "email", label: "E-Mail", type: "email" }, { key: "shirtSize", label: "T-Shirt" },
    { key: "licenseNumber", label: "Lizenznummer" }, { key: "vehicleRegistration", label: "Kennzeichen" },
  ];

  async function save() {
    const current = draft;
    if (!current || !person) return;
    const patch = buildPersonPatch(person, current);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    const saved = await onSave(current.id, patch);
    if (saved) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="marshal-person-drawer-title" className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white/95 p-4 backdrop-blur">
          <div><h2 id="marshal-person-drawer-title" className="text-lg font-semibold">{draft.firstName} {draft.lastName}</h2><p className="text-sm text-slate-500">Helfernummer {draft.helperNumber}</p></div>
          <Button ref={closeButtonRef} type="button" size="sm" variant="ghost" aria-label="Personendetails schließen" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="space-y-6 p-4 sm:p-6">
          <section aria-labelledby="marshal-person-event-card" className="rounded-lg border bg-slate-50 p-3">
            <h3 id="marshal-person-event-card" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Einsätze dieser Veranstaltung</h3>
            {einsatzEntries.length === 0
              ? <p className="text-xs text-slate-400">Noch keine Einsätze in dieser Veranstaltung</p>
              : <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                  {einsatzEntries.map((entry) => (
                    <li key={entry.id} className="flex min-w-0 items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{entry.label}{entry.dayLabel && <span className="ml-1 text-slate-400">{entry.dayLabel}</span>}</span>
                      <StatusBadge status={entry.status} />
                    </li>
                  ))}
                </ul>}
          </section>
          <section aria-labelledby="marshal-person-masterdata" className="border-t pt-4"><h3 id="marshal-person-masterdata" className="mb-3 font-semibold">Stammdaten</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(({ key, label, type = "text" }) => <label key={key} className="grid gap-1 text-xs font-medium text-slate-600">{label}{key === "shirtSize" ? <MarshalShirtSizeInput value={draft[key] ?? ""} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /> : <Input type={type} value={draft[key] ?? ""} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />}</label>)}
              <div className="sm:col-span-2"><MarshalAreaMultiSelect areas={workspace.areas} value={draft.activityAreas} disabled={!canWrite} onChange={(activityAreas) => setDraft({ ...draft, activityAreas })} /></div>
              <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">Bemerkungen (Stammdaten)<textarea className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm font-normal text-slate-950 disabled:bg-slate-50" value={draft.note ?? ""} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={draft.clubMember} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, clubMember: event.target.checked })} />Vereinsmitglied</label>
              <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={draft.isActive} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />Aktiver Stammdatensatz</label>
              <label className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm ${draft.noDeployment ? "border-red-300 bg-red-50 text-red-900" : ""}`}><input type="checkbox" checked={draft.noDeployment} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, noDeployment: event.target.checked })} /><AlertTriangle className="h-4 w-4" />Kein Einsatz mehr</label>
            </div>
            {canWrite && <Button type="button" className="mt-4 w-full sm:w-auto" disabled={busy || !draft.firstName || !draft.lastName} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />Änderungen speichern</Button>}
          </section>
          <section aria-labelledby="marshal-person-event-note" className="border-t pt-6"><h3 id="marshal-person-event-note" className="mb-3 font-semibold">Veranstaltungsnotiz</h3>
            <textarea aria-label="Veranstaltungsnotiz" className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-950 disabled:bg-slate-50" value={draft.participation.note ?? ""} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, participation: { ...draft.participation, note: event.target.value } })} />
            {canWrite && <Button type="button" variant="outline" className="mt-3 w-full sm:w-auto" disabled={busy} onClick={() => void onSaveEventNote(draft, draft.participation.note?.trim() || null)}><Save className="mr-2 h-4 w-4" />Veranstaltungsnotiz speichern</Button>}
          </section>
          <section aria-labelledby="marshal-person-history"><h3 id="marshal-person-history" className="font-semibold">Einsatzhistorie</h3>
            {history.length ? <ul className="mt-3 space-y-2">{history.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><strong className="text-sm">{item.title}</strong><p className="text-xs text-slate-500">{item.detail}</p></div><StatusBadge status={item.status} /></li>)}</ul> : <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-slate-500">Für diese Veranstaltung liegen noch keine Einsätze vor.</p>}
          </section>
        </div>
      </aside>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

const nullableTextFields = ["street", "zip", "city", "birthdate", "phone", "email", "shirtSize", "licenseNumber", "vehicleRegistration", "note"] as const;

function buildPersonPatch(original: MarshalPerson, current: MarshalPerson): MarshalPersonPatch {
  const patch: MarshalPersonPatch = {};
  const firstName = current.firstName.trim();
  const lastName = current.lastName.trim();

  if (firstName !== original.firstName) patch.firstName = firstName;
  if (lastName !== original.lastName) patch.lastName = lastName;

  for (const field of nullableTextFields) {
    const value = current[field]?.trim() || null;
    if (value !== original[field]) patch[field] = value;
  }

  if (JSON.stringify(current.activityAreas) !== JSON.stringify(original.activityAreas)) patch.activityAreas = current.activityAreas;
  if (current.clubMember !== original.clubMember) patch.clubMember = current.clubMember;
  if (current.isActive !== original.isActive) patch.isActive = current.isActive;
  if (current.noDeployment !== original.noDeployment) patch.noDeployment = current.noDeployment;

  return patch;
}
