import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MarshalPerson, MarshalPersonInput, MarshalWorkspace } from "@/types/admin-marshals";

const EMPTY_DRAFT = { helperNumber: "", firstName: "", lastName: "", email: "", phone: "", shirtSize: "", activityAreas: "", note: "" };

type Props = {
  workspace: MarshalWorkspace;
  canWrite: boolean;
  busy: boolean;
  onPersonOpen: (person: MarshalPerson) => void;
  onCreate: (input: MarshalPersonInput) => Promise<boolean>;
  onDelete: (person: MarshalPerson) => Promise<boolean>;
};

export function MarshalStammdatenView({ workspace, canWrite, busy, onPersonOpen, onCreate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("all");
  const [active, setActive] = useState("all");
  const [onlyNoDeployment, setOnlyNoDeployment] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [deletePerson, setDeletePerson] = useState<MarshalPerson | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const areas = useMemo(() => [...new Set(workspace.people.flatMap((person) => person.activityAreas))].sort((a, b) => a.localeCompare(b, "de")), [workspace.people]);
  const term = search.trim().toLocaleLowerCase("de");
  const people = workspace.people.filter((person) => (!term || `${person.helperNumber} ${person.lastName} ${person.firstName} ${person.email ?? ""}`.toLocaleLowerCase("de").includes(term)) && (area === "all" || person.activityAreas.includes(area)) && (active === "all" || (active === "active" ? person.isActive : !person.isActive)) && (!onlyNoDeployment || person.noDeployment)).sort((a, b) => a.helperNumber - b.helperNumber);

  async function createPerson() {
    const saved = await onCreate({ helperNumber: Number(draft.helperNumber), firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), email: draft.email || null, phone: draft.phone || null, shirtSize: draft.shirtSize || null, activityAreas: draft.activityAreas.split(/[;,]/).map((item) => item.trim()).filter(Boolean), note: draft.note || null });
    if (saved) setDraft(EMPTY_DRAFT);
  }
  async function confirmDelete() {
    if (!deletePerson || deleteConfirmation !== "DSGVO-LÖSCHEN") return;
    const deleted = await onDelete(deletePerson);
    if (deleted) { setDeletePerson(null); setDeleteConfirmation(""); }
  }

  return <>
    <Card><CardHeader className="p-4 sm:p-6"><CardTitle>Helferstammdaten</CardTitle><p className="mt-1 text-sm text-slate-600">{workspace.people.length} Personen im geladenen Arbeitsbereich.</p></CardHeader><CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      <div className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-5"><label className="grid gap-1 text-xs font-medium text-slate-600 xl:col-span-2">Suche<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Nummer oder E-Mail" /></label><label className="grid gap-1 text-xs font-medium text-slate-600">Bereich<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={area} onChange={(event) => setArea(event.target.value)}><option value="all">Alle Bereiche</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-600">Aktiv<select className="h-10 rounded-md border bg-white px-3 text-sm font-normal" value={active} onChange={(event) => setActive(event.target.value)}><option value="all">Aktiv und inaktiv</option><option value="active">Nur aktiv</option><option value="inactive">Nur inaktiv</option></select></label><label className="flex min-h-10 items-center gap-2 self-end rounded-md border bg-white px-3 text-sm"><input type="checkbox" checked={onlyNoDeployment} onChange={(event) => setOnlyNoDeployment(event.target.checked)} />Kein Einsatz</label></div>
      {canWrite && <details className="rounded-xl border bg-slate-50/60 p-4"><summary className="cursor-pointer font-medium"><Plus className="mr-2 inline h-4 w-4" />Neue Person</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([[
        "helperNumber", "Helfernummer", "number"], ["firstName", "Vorname", "text"], ["lastName", "Nachname", "text"], ["email", "E-Mail", "email"], ["phone", "Telefon", "tel"], ["shirtSize", "T-Shirt", "text"], ["activityAreas", "Bereiche", "text"], ["note", "Bemerkung", "text"]] as const).map(([key, label, type]) => <label key={key} className="grid gap-1 text-xs font-medium text-slate-600">{label}<Input type={type} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}<Button type="button" disabled={busy || !draft.helperNumber || !draft.firstName || !draft.lastName} onClick={() => void createPerson()}>Speichern</Button></div></details>}
      <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><th className="p-3">Nr.</th><th className="p-3">Name</th><th className="p-3">Bereiche</th><th className="p-3">T-Shirt</th><th className="p-3">Bemerkung</th><th className="p-3">Status</th><th className="p-3">Aktionen</th></tr></thead><tbody>{people.map((person) => <tr key={person.id} className={cn("border-b align-top", person.noDeployment && "bg-red-50 text-red-900")}><td className="p-3 text-slate-500">{person.helperNumber}</td><td className="p-3"><button type="button" className="font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}</button></td><td className="p-3">{person.activityAreas.join(", ") || "—"}</td><td className="p-3">{person.shirtSize ?? "—"}</td><td className="max-w-72 whitespace-pre-wrap p-3 text-slate-600">{person.note ?? "—"}</td><td className="p-3">{person.noDeployment ? <Badge className="bg-red-100 text-red-900"><AlertTriangle className="mr-1 h-3 w-3" />Kein Einsatz</Badge> : person.isActive ? <Badge className="bg-green-100 text-green-900">Aktiv</Badge> : <Badge variant="secondary">Inaktiv</Badge>}</td><td className="p-3"><div className="flex gap-1"><Button type="button" size="sm" variant="outline" onClick={() => onPersonOpen(person)}>Bearbeiten</Button>{canWrite && <Button type="button" size="sm" variant="ghost" className="text-red-700" aria-label={`${person.firstName} ${person.lastName} endgültig löschen`} onClick={() => setDeletePerson(person)}><Trash2 className="h-4 w-4" /></Button>}</div></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 md:hidden">{people.map((person) => <article key={person.id} className={cn("rounded-xl border p-4", person.noDeployment && "border-red-300 bg-red-50 text-red-900")}><div className="flex items-start justify-between gap-2"><button type="button" className="text-left font-semibold text-blue-700" onClick={() => onPersonOpen(person)}>{person.lastName}, {person.firstName}<span className="block text-xs font-normal text-slate-500">Nr. {person.helperNumber}</span></button>{person.noDeployment && <AlertTriangle className="h-5 w-5 text-red-600" />}</div><p className="mt-2 text-sm">{person.activityAreas.join(", ") || "Keine Bereiche"} · Shirt {person.shirtSize ?? "—"}</p><p className="mt-1 text-sm text-slate-600">{person.note ?? "Keine Bemerkung"}</p><div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => onPersonOpen(person)}>Bearbeiten</Button>{canWrite && <Button type="button" size="sm" variant="ghost" className="text-red-700" onClick={() => setDeletePerson(person)}><Trash2 className="h-4 w-4" /><span className="sr-only">Endgültig löschen</span></Button>}</div></article>)}</div>
      {people.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Keine Personen entsprechen den Filtern.</p>}
    </CardContent></Card>
    {deletePerson && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="marshal-delete-title" aria-describedby="marshal-delete-description" className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><h2 id="marshal-delete-title" className="text-lg font-semibold text-red-800">Person nach DSGVO endgültig löschen?</h2><p id="marshal-delete-description" className="mt-2 text-sm leading-6 text-slate-600"><strong>{deletePerson.firstName} {deletePerson.lastName}</strong> und alle verknüpften Teilnahmen, Einsätze und Schulungsdaten werden unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.</p><label className="mt-4 grid gap-1 text-sm font-medium">Zur Bestätigung „DSGVO-LÖSCHEN“ eingeben<Input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => { setDeletePerson(null); setDeleteConfirmation(""); }}>Abbrechen</Button><Button type="button" variant="destructive" disabled={busy || deleteConfirmation !== "DSGVO-LÖSCHEN"} onClick={() => void confirmDelete()}><Trash2 className="mr-2 h-4 w-4" />Endgültig löschen</Button></div></section></div>}
  </>;
}
