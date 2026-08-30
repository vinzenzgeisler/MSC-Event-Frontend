import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarshalConfirmDialog } from "@/components/features/admin/marshal-confirm-dialog";
import type { MarshalAreaConfigAreaInput, MarshalAreaConfigShiftInput, MarshalEvent, MarshalPostConfigInput, MarshalStructurePreview, MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  canWrite: boolean;
  busy: boolean;
  onSavePosts: (posts: MarshalPostConfigInput[]) => Promise<boolean>;
  onSaveAreas: (areas: MarshalAreaConfigAreaInput[], shifts: MarshalAreaConfigShiftInput[]) => Promise<boolean>;
  onReset: () => Promise<boolean>;
  events: MarshalEvent[];
  currentEvent: MarshalEvent;
  onPreviewStructure: (sourceEventId: string) => Promise<MarshalStructurePreview | null>;
  onInitializeEvent: (sourceEventId: string) => Promise<boolean>;
};

export function MarshalConfigView({ workspace, canWrite, busy, onSavePosts, onSaveAreas, onReset, events, currentEvent, onPreviewStructure, onInitializeEvent }: Props) {
  const [postDrafts, setPostDrafts] = useState<MarshalPostConfigInput[]>([]);
  const [areas, setAreas] = useState<MarshalAreaConfigAreaInput[]>([]);
  const [shifts, setShifts] = useState<MarshalAreaConfigShiftInput[]>([]);
  const [newShiftArea, setNewShiftArea] = useState("");
  const [newShiftDate, setNewShiftDate] = useState("");
  const [newShiftLabel, setNewShiftLabel] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [sourceEventId, setSourceEventId] = useState("");
  const [structurePreview, setStructurePreview] = useState<MarshalStructurePreview | null>(null);
  const hasInvalidCoordinates = postDrafts.some((post) => (post.mapX === null) !== (post.mapY === null));
  const hasInvalidShifts = shifts.some((shift, index) => !shift.label.trim() || !shift.shiftDate || shifts.some((other, otherIndex) => otherIndex !== index && other.areaCode === shift.areaCode && other.shiftDate === shift.shiftDate));
  const isConfigured = currentEvent.marshalSetupState === "ready" || workspace.posts.length > 0 || workspace.sections.length > 0 || workspace.areas.length > 0;
  const sourceEvents = events
    .filter((event) => event.id !== currentEvent.id && event.startsAt < currentEvent.startsAt)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  useEffect(() => {
    setPostDrafts([...workspace.posts].sort((a, b) => a.sortOrder - b.sortOrder).map((post) => ({ sectionCode: workspace.sections.find((section) => section.id === post.sectionId)?.code ?? "4", code: post.code, description: post.description, targetStaff: post.targetStaff, emergencyTargetStaff: Math.min(post.targetStaff, post.emergencyTargetStaff ?? post.targetStaff), mapX: post.mapX ?? null, mapY: post.mapY ?? null, isActive: post.isActive, sortOrder: post.sortOrder })));
    setAreas([...workspace.areas].sort((a, b) => a.sortOrder - b.sortOrder).map(({ code, name, areaType, dayScope, sortOrder, responsibleLabel }) => ({ code, name, areaType, dayScope, sortOrder, responsibleLabel })));
    setShifts(workspace.areaShifts.map((shift) => ({ areaCode: workspace.areas.find((area) => area.id === shift.areaId)?.code ?? "", label: shift.label, shiftDate: shift.shiftDate, sortOrder: shift.sortOrder })).filter((shift) => shift.areaCode).sort((a, b) => a.areaCode.localeCompare(b.areaCode) || a.sortOrder - b.sortOrder));
    setNewShiftArea(workspace.areas.find((area) => area.areaType === "setup")?.code ?? "");
  }, [workspace]);

  function addShift() {
    if (!newShiftArea || !newShiftDate || !newShiftLabel.trim()) return;
    const nextOrder = Math.max(-1, ...shifts.filter((shift) => shift.areaCode === newShiftArea).map((shift) => shift.sortOrder)) + 1;
    setShifts([...shifts, { areaCode: newShiftArea, label: newShiftLabel.trim(), shiftDate: newShiftDate, sortOrder: nextOrder }]);
    setNewShiftDate(""); setNewShiftLabel("");
  }
  async function reset() { if (resetConfirmation !== "EINTEILUNGEN ZURÜCKSETZEN") return; const saved = await onReset(); if (saved) { setResetOpen(false); setResetConfirmation(""); } }

  async function previewStructure() {
    if (!sourceEventId) return;
    setStructurePreview(await onPreviewStructure(sourceEventId));
  }

  async function initializeEvent() {
    if (!sourceEventId || !structurePreview) return;
    const saved = await onInitializeEvent(sourceEventId);
    if (saved) setStructurePreview(null);
  }

  return <>
    <div className="space-y-4">
      <Card className={isConfigured ? "border-emerald-200 bg-emerald-50/30" : "border-blue-200 bg-blue-50/30"}>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg">{isConfigured ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5 text-blue-600" />}{isConfigured ? "Helferstruktur vorbereitet" : "Helferstruktur für dieses Event vorbereiten"}</CardTitle>
        </CardHeader>
        {!isConfigured && <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-medium text-slate-600">Vorlagen-Event<select className="h-11 rounded-md border bg-white px-3 text-base font-normal sm:text-sm" value={sourceEventId} disabled={!canWrite || busy} onChange={(event) => { setSourceEventId(event.target.value); setStructurePreview(null); }}><option value="">Event auswählen</option>{sourceEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
              <Button type="button" variant="outline" disabled={!canWrite || busy || !sourceEventId} onClick={() => void previewStructure()}>Vorschau laden</Button>
            </div>
            {sourceEvents.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">Es ist noch kein anderes Event als Vorlage verfügbar.</p>}
            {structurePreview && <section className="rounded-xl border bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">Übernahme aus {structurePreview.sourceEvent.name}</h3><p className="mt-1 text-sm text-slate-600">{structurePreview.sections} Abschnitte · {structurePreview.posts.length} Posten · {structurePreview.areas} Bereiche · {structurePreview.shifts.length} Schichten</p></div><Button type="button" disabled={busy} onClick={() => void initializeEvent()}><Copy className="mr-2 h-4 w-4" />Struktur übernehmen</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{structurePreview.posts.map((post) => <div key={`${post.sectionCode}:${post.code}`} className="rounded-lg border bg-slate-50 p-3 text-sm"><strong>Posten {post.code}</strong><p className="text-slate-600">Soll {post.targetStaff} · Notfall {post.emergencyTargetStaff}</p></div>)}</div>{structurePreview.shifts.length > 0 && <div className="mt-4 border-t pt-3"><h4 className="text-sm font-semibold">Schichtdaten</h4><ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">{structurePreview.shifts.map((shift) => <li key={`${shift.areaCode}:${shift.label}:${shift.targetDate}`}>{shift.label}: {formatConfigDate(shift.targetDate)}</li>)}</ul></div>}</section>}
          </>
        </CardContent>}
      </Card>
      <Card><CardHeader className="p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Bereiche und Schichten</CardTitle></div>{canWrite && <Button type="button" disabled={busy || hasInvalidShifts || areas.some((area) => !area.name.trim())} onClick={() => void onSaveAreas(areas, shifts)}><Save className="mr-2 h-4 w-4" />Bereiche speichern</Button>}</div></CardHeader><CardContent className="space-y-5 p-4 pt-0 sm:p-6 sm:pt-0">{hasInvalidShifts && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">Schichten eines Bereichs benötigen eindeutige Datumswerte und eine Bezeichnung.</p>}<div className="grid gap-4 lg:grid-cols-2">{areas.map((area, areaIndex) => <section key={area.code} className="rounded-xl border p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium text-slate-600">Name<Input value={area.name} disabled={!canWrite} onChange={(event) => setAreas(areas.map((item, index) => index === areaIndex ? { ...item, name: event.target.value } : item))} /></label><label className="grid gap-1 text-xs font-medium text-slate-600">Verantwortlich<Input value={area.responsibleLabel ?? ""} disabled={!canWrite} onChange={(event) => setAreas(areas.map((item, index) => index === areaIndex ? { ...item, responsibleLabel: event.target.value || null } : item))} /></label></div><p className="mt-2 text-xs text-slate-500">Code: {area.code} · {area.areaType === "setup" ? "Aufbau" : area.dayScope === "saturday" ? "Samstag" : "Sonntag"}</p>{area.areaType === "setup" && <div className="mt-4 space-y-2"><h3 className="text-sm font-semibold">Schichten</h3>{shifts.filter((shift) => shift.areaCode === area.code).map((shift) => { const shiftIndex = shifts.indexOf(shift); return <div key={`${shift.areaCode}-${shift.shiftDate}-${shiftIndex}`} className="grid gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_150px_auto]"><label className="grid gap-1 text-xs text-slate-500">Bezeichnung<Input value={shift.label} disabled={!canWrite} onChange={(event) => setShifts(shifts.map((item, index) => index === shiftIndex ? { ...item, label: event.target.value } : item))} /></label><label className="grid gap-1 text-xs text-slate-500">Datum<Input type="date" value={shift.shiftDate} disabled={!canWrite} onChange={(event) => setShifts(shifts.map((item, index) => index === shiftIndex ? { ...item, shiftDate: event.target.value } : item))} /></label>{canWrite && <Button type="button" size="sm" variant="ghost" className="self-end text-red-700" aria-label={`Schicht ${shift.label} entfernen`} onClick={() => setShifts(shifts.filter((_, index) => index !== shiftIndex))}><Trash2 className="h-4 w-4" /></Button>}</div>; })}{!shifts.some((shift) => shift.areaCode === area.code) && <p className="text-sm text-slate-500">Noch keine Schichten.</p>}</div>}</section>)}</div>{canWrite && <section className="rounded-xl border border-dashed p-4"><h3 className="font-semibold">Schicht hinzufügen</h3><div className="mt-3 grid gap-2 sm:grid-cols-4 sm:items-end"><label className="grid gap-1 text-xs font-medium text-slate-600">Bereich<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={newShiftArea} onChange={(event) => setNewShiftArea(event.target.value)}>{areas.filter((area) => area.areaType === "setup").map((area) => <option key={area.code} value={area.code}>{area.name}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-600">Datum<Input type="date" value={newShiftDate} onChange={(event) => setNewShiftDate(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium text-slate-600">Bezeichnung<Input value={newShiftLabel} onChange={(event) => setNewShiftLabel(event.target.value)} placeholder="z. B. Mittwoch Aufbau" /></label><Button type="button" disabled={!newShiftArea || !newShiftDate || !newShiftLabel.trim()} onClick={addShift}><Plus className="mr-2 h-4 w-4" />Hinzufügen</Button></div></section>}</CardContent></Card>
      <Card><CardHeader className="p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Abschnitte, Posten und Kartenkoordinaten</CardTitle></div>{canWrite && <Button type="button" disabled={busy || hasInvalidCoordinates} onClick={() => void onSavePosts(postDrafts)}><Save className="mr-2 h-4 w-4" />Posten speichern</Button>}</div></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">{hasInvalidCoordinates && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">X- und Y-Koordinate müssen immer gemeinsam gesetzt oder beide leer gelassen werden.</p>}<div className="overflow-x-auto"><table className="min-w-[880px] w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Posten</th><th className="p-3">Beschreibung</th><th className="p-3">Soll</th><th className="p-3">Notfall</th><th className="p-3">X</th><th className="p-3">Y</th><th className="p-3">Aktiv</th></tr></thead><tbody>{postDrafts.map((post, index) => <tr key={post.code} className="border-b"><td className="p-3 font-semibold">{post.code}</td><td className="p-2"><Input value={post.description ?? ""} disabled={!canWrite} onChange={(event) => updatePost(index, { description: event.target.value || null })} /></td><td className="p-2"><Input aria-label={`Sollbesetzung ${post.code}`} type="number" min={1} max={20} value={post.targetStaff} disabled={!canWrite} onChange={(event) => updatePost(index, { targetStaff: Math.max(1, Number(event.target.value) || 1) })} /></td><td className="p-2"><Input aria-label={`Notfallbesetzung ${post.code}`} type="number" min={1} max={post.targetStaff} value={post.emergencyTargetStaff} disabled={!canWrite} onChange={(event) => updatePost(index, { emergencyTargetStaff: Math.min(post.targetStaff, Math.max(1, Number(event.target.value) || 1)) })} /></td><td className="p-2"><CoordinateInput label={`X-Koordinate ${post.code}`} value={post.mapX} disabled={!canWrite} max={1000} onChange={(mapX) => updatePost(index, { mapX })} /></td><td className="p-2"><CoordinateInput label={`Y-Koordinate ${post.code}`} value={post.mapY} disabled={!canWrite} max={1000} onChange={(mapY) => updatePost(index, { mapY })} /></td><td className="p-3"><input aria-label={`${post.code} aktiv`} type="checkbox" checked={post.isActive} disabled={!canWrite} onChange={(event) => updatePost(index, { isActive: event.target.checked })} /></td></tr>)}</tbody></table></div></CardContent></Card>
      {canWrite && <Card className="border-red-200"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-red-800"><AlertTriangle className="h-5 w-5" />Gefahrenbereich</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 p-4 pt-0 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pt-0"><Button type="button" variant="destructive" className="shrink-0" onClick={() => setResetOpen(true)}><RotateCcw className="mr-2 h-4 w-4" />Einteilungen zurücksetzen</Button></CardContent></Card>}
    </div>
    {resetOpen && <MarshalConfirmDialog title="Alle Event-Einteilungen zurücksetzen?" description="Alle Tages-, Bereichs- und Schichtzuweisungen dieser Veranstaltung verlieren Status, Posten und Funktion. Stammdaten bleiben unberührt." confirmLabel={<><RotateCcw className="mr-2 h-4 w-4" />Jetzt zurücksetzen</>} confirmDisabled={busy || resetConfirmation !== "EINTEILUNGEN ZURÜCKSETZEN"} onConfirm={() => void reset()} onCancel={() => { setResetOpen(false); setResetConfirmation(""); }}><label className="mt-4 grid gap-1 text-sm font-medium">Zur Bestätigung „EINTEILUNGEN ZURÜCKSETZEN“ eingeben<Input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} /></label></MarshalConfirmDialog>}
  </>;

  function updatePost(index: number, patch: Partial<MarshalPostConfigInput>) { setPostDrafts(postDrafts.map((post, itemIndex) => itemIndex === index ? { ...post, ...patch, emergencyTargetStaff: Math.min(patch.targetStaff ?? post.targetStaff, patch.emergencyTargetStaff ?? post.emergencyTargetStaff) } : post)); }
}

function CoordinateInput({ label, value, disabled, max, onChange }: { label: string; value: number | null; disabled: boolean; max: number; onChange: (value: number | null) => void }) { return <Input aria-label={label} type="number" min={0} max={max} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value === "" ? null : Math.min(max, Math.max(0, Number(event.target.value) || 0)))} />; }

function formatConfigDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
