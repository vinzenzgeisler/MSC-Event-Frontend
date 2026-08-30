import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { MarshalImportPreview } from "@/types/admin-marshals";

type Props = {
  canWrite: boolean;
  busy: boolean;
  onPreview: (file: File) => Promise<{ response: MarshalImportPreview; dataBase64: string } | null>;
  onCommit: (file: File, preview: MarshalImportPreview, dataBase64: string) => Promise<boolean>;
};

export function MarshalImportView({ canWrite, busy, onPreview, onCommit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MarshalImportPreview | null>(null);
  const [dataBase64, setDataBase64] = useState("");
  async function previewFile() { if (!file) return; const result = await onPreview(file); if (result) { setPreview(result.response); setDataBase64(result.dataBase64); } }
  async function commit() { if (!file || !preview || !dataBase64) return; const saved = await onCommit(file, preview, dataBase64); if (saved) { setPreview(null); setDataBase64(""); setFile(null); } }
  return <Card><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Excel-Import</CardTitle></CardHeader><CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0"><label className="grid gap-1 text-sm font-medium">Excel-Arbeitsmappe (.xlsx)<Input type="file" accept=".xlsx" className="h-auto min-h-11 py-2" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setDataBase64(""); }} /></label>{canWrite && <Button type="button" disabled={!file || busy} onClick={() => void previewFile()}><Upload className="mr-2 h-4 w-4" />Prüfen</Button>}{preview && <section className="rounded-xl border bg-slate-50 p-4" aria-live="polite"><h3 className="font-semibold">Importvorschau</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8"><Metric label="Personen" value={preview.summary.people} /><Metric label="Team Laufer" value={preview.summary.lauferPeople ?? 0} /><Metric label="Neu" value={preview.summary.newPeople} /><Metric label="Aktualisiert" value={preview.summary.updatedPeople} /><Metric label="Teilnahmen" value={preview.summary.eventParticipations} /><Metric label="Termine" value={preview.summary.trainings} /><Metric label="Teilnehmer" value={preview.summary.trainingParticipants} /><Metric label="Prüffälle" value={preview.summary.conflicts} /></div>{preview.conflicts.length > 0 && <ul className="mt-4 max-h-52 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{preview.conflicts.map((item, index) => <li key={`${item.sheet}-${item.row}-${index}`}>{item.sheet}, Zeile {item.row}: {item.message}</li>)}</ul>}<Button type="button" className="mt-4" disabled={busy} onClick={() => void commit()}>Import übernehmen</Button></section>}</CardContent></Card>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border bg-white p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold">{value}</div></div>; }
