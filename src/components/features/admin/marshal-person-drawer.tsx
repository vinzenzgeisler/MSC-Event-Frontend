import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/features/admin/marshal-status";
import { canonicalizeMarshalAreas, MarshalAreaMultiSelect } from "@/components/features/admin/marshal-area-multi-select";
import type { MarshalPerson, MarshalPersonPatch, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  person: MarshalPerson | null;
  workspace: MarshalWorkspace;
  eventName: string;
  canWrite: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (personId: string, patch: MarshalPersonPatch) => Promise<boolean>;
};

export function MarshalPersonDrawer({ person, workspace, eventName, canWrite, busy, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<MarshalPerson | null>(person);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => setDraft(person ? { ...person, activityAreas: canonicalizeMarshalAreas(person.activityAreas, workspace.areas) } : null), [person, workspace.areas]);
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
    if (!current) return;
    const saved = await onSave(current.id, {
      firstName: current.firstName, lastName: current.lastName, street: current.street, zip: current.zip, city: current.city,
      birthdate: current.birthdate, phone: current.phone, email: current.email, shirtSize: current.shirtSize,
      licenseNumber: current.licenseNumber, vehicleRegistration: current.vehicleRegistration,
      activityAreas: current.activityAreas, note: current.note, isActive: current.isActive, noDeployment: current.noDeployment,
    });
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
          <section aria-labelledby="marshal-person-masterdata"><h3 id="marshal-person-masterdata" className="mb-3 font-semibold">Stammdaten</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(({ key, label, type = "text" }) => <label key={key} className="grid gap-1 text-xs font-medium text-slate-600">{label}<Input type={type} value={draft[key] ?? ""} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
              <div className="sm:col-span-2"><MarshalAreaMultiSelect areas={workspace.areas} value={draft.activityAreas} disabled={!canWrite} onChange={(activityAreas) => setDraft({ ...draft, activityAreas })} /></div>
              <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">Bemerkungen<textarea className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm font-normal text-slate-950 disabled:bg-slate-50" value={draft.note ?? ""} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={draft.isActive} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />Aktiver Stammdatensatz</label>
              <label className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm ${draft.noDeployment ? "border-red-300 bg-red-50 text-red-900" : ""}`}><input type="checkbox" checked={draft.noDeployment} disabled={!canWrite} onChange={(event) => setDraft({ ...draft, noDeployment: event.target.checked })} /><AlertTriangle className="h-4 w-4" />Kein Einsatz mehr</label>
            </div>
            {canWrite && <Button type="button" className="mt-4 w-full sm:w-auto" disabled={busy || !draft.firstName || !draft.lastName} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />Änderungen speichern</Button>}
          </section>
          <section aria-labelledby="marshal-person-history"><h3 id="marshal-person-history" className="font-semibold">Einsatzhistorie</h3><p className="mt-1 text-xs text-slate-500">Geladene Veranstaltung: {eventName}</p>
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
