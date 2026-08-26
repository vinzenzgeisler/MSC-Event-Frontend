import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarshalWorkspace } from "@/types/admin-marshals";

type PrintParams = { type: "attendance" | "section" | "area"; dayId?: string; sectionId?: string; areaId?: string; shiftId?: string };
type Props = { workspace: MarshalWorkspace; canExport: boolean; onPrint: (params: PrintParams) => Promise<void> };

export function MarshalDruckView({ workspace, canExport, onPrint }: Props) {
  return <Card><CardHeader className="p-4 sm:p-6"><CardTitle>Drucklisten</CardTitle></CardHeader><CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-2">
    {workspace.days.map((day) => <section key={day.id} className="rounded-xl border bg-slate-50 p-4"><h3 className="font-semibold">{day.label}</h3><p className="text-xs text-slate-500">{formatDate(day.eventDate)}</p><div className="mt-4 grid gap-2"><PrintButton disabled={!canExport} onClick={() => void onPrint({ type: "attendance", dayId: day.id })}>Anwesenheitsliste</PrintButton>{workspace.sections.map((section) => <PrintButton key={section.id} disabled={!canExport} onClick={() => void onPrint({ type: "section", dayId: day.id, sectionId: section.id })}>Abschnitt: {section.name}</PrintButton>)}</div></section>)}
    {workspace.areas.map((area) => { const shifts = workspace.areaShifts.filter((shift) => shift.areaId === area.id).sort((a, b) => a.sortOrder - b.sortOrder); return <section key={area.id} className="rounded-xl border bg-slate-50 p-4"><h3 className="font-semibold">{area.name}</h3><div className="mt-4 grid gap-2"><PrintButton disabled={!canExport} onClick={() => void onPrint({ type: "area", areaId: area.id })}>Bereichsliste: {area.name}</PrintButton>{area.areaType === "setup" && shifts.map((shift) => <PrintButton key={shift.id} disabled={!canExport} onClick={() => void onPrint({ type: "area", areaId: area.id, shiftId: shift.id })}>Schicht: {shift.label}</PrintButton>)}</div></section>; })}
  </CardContent></Card>;
}

function PrintButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return <Button type="button" variant="outline" className="min-h-10 justify-start whitespace-normal text-left" disabled={disabled} onClick={onClick}><Download className="mr-2 h-4 w-4 shrink-0" />{children}</Button>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
