import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  canExport: boolean;
  onPrint: (params: { type: "attendance" | "section"; dayId: string; sectionId?: string }) => Promise<void>;
};

export function MarshalDruckView({ workspace, canExport, onPrint }: Props) {
  return <Card><CardHeader className="p-4 sm:p-6"><CardTitle>Drucklisten</CardTitle><p className="mt-1 text-sm text-slate-600">Anwesenheits- und Abschnittslisten nach Veranstaltungstag.</p></CardHeader><CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-2">{workspace.days.map((day) => <section key={day.id} className="rounded-xl border bg-slate-50 p-4"><h3 className="font-semibold">{day.label}</h3><p className="text-xs text-slate-500">{formatDate(day.eventDate)}</p><div className="mt-4 grid gap-2"><Button type="button" variant="outline" className="justify-start" disabled={!canExport} onClick={() => void onPrint({ type: "attendance", dayId: day.id })}><Download className="mr-2 h-4 w-4" />Anwesenheitsliste</Button>{workspace.sections.map((section) => <Button key={section.id} type="button" variant="outline" className="justify-start" disabled={!canExport} onClick={() => void onPrint({ type: "section", dayId: day.id, sectionId: section.id })}><Download className="mr-2 h-4 w-4" />{section.name}</Button>)}</div></section>)}</CardContent></Card>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
