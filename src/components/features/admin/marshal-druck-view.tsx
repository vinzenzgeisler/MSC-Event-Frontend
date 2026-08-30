import { CalendarDays, Download, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarshalWorkspace } from "@/types/admin-marshals";

type PrintParams = { type: "attendance" | "section" | "area"; dayId?: string; sectionId?: string; areaId?: string; shiftId?: string };
type Props = { workspace: MarshalWorkspace; canExport: boolean; onPrint: (params: PrintParams) => Promise<void> };

const activeStatuses = new Set(["accepted", "pending", "tentative"]);

export function MarshalDruckView({ workspace, canExport, onPrint }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-950">Druckzentrum</h1>
      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-blue-600" />Veranstaltungstage</CardTitle></CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-2">
          {workspace.days.map((day) => {
            const attendanceCount = workspace.people.filter((person) => person.assignments.some((assignment) => assignment.dayId === day.id && activeStatuses.has(assignment.commitmentStatus))).length;
            return (
              <section key={day.id} className="rounded-xl border bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{day.label}</h2><p className="text-xs text-slate-500">{formatDate(day.eventDate)}</p></div><Count count={attendanceCount} /></div>
                <div className="mt-4 grid gap-2">
                  <PrintItem title="Anwesenheitsliste" count={attendanceCount} disabled={!canExport} onClick={() => void onPrint({ type: "attendance", dayId: day.id })} />
                  {workspace.sections.map((section) => {
                    const count = workspace.people.filter((person) => person.assignments.some((assignment) => assignment.dayId === day.id && assignment.sectionId === section.id && activeStatuses.has(assignment.commitmentStatus))).length;
                    return <PrintItem key={section.id} title={section.name} count={count} disabled={!canExport} onClick={() => void onPrint({ type: "section", dayId: day.id, sectionId: section.id })} />;
                  })}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-blue-600" />Bereiche und Schichten</CardTitle></CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-2">
          {[...workspace.areas].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")).map((area) => {
            const shifts = workspace.areaShifts.filter((shift) => shift.areaId === area.id).sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || a.sortOrder - b.sortOrder);
            const shiftIds = new Set(shifts.map((shift) => shift.id));
            const participationIds = new Set([
              ...workspace.areaAssignments.filter((assignment) => assignment.areaId === area.id && activeStatuses.has(assignment.commitmentStatus)).map((assignment) => assignment.participationId),
              ...workspace.shiftAssignments.filter((assignment) => shiftIds.has(assignment.shiftId) && activeStatuses.has(assignment.commitmentStatus)).map((assignment) => assignment.participationId),
            ]);
            return (
              <section key={area.id} className="rounded-xl border bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-900">{area.name}</h2><Count count={participationIds.size} /></div>
                <div className="mt-4 grid gap-2">
                  <PrintItem title={`Bereichsliste ${area.name}`} count={participationIds.size} disabled={!canExport} onClick={() => void onPrint({ type: "area", areaId: area.id })} />
                  {shifts.map((shift) => {
                    const count = new Set(workspace.shiftAssignments.filter((assignment) => assignment.shiftId === shift.id && activeStatuses.has(assignment.commitmentStatus)).map((assignment) => assignment.participationId)).size;
                    return <PrintItem key={shift.id} title={`${shift.label} · ${formatDate(shift.shiftDate)}`} count={count} disabled={!canExport} onClick={() => void onPrint({ type: "area", areaId: area.id, shiftId: shift.id })} />;
                  })}
                </div>
              </section>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function PrintItem({ title, count, disabled, onClick }: { title: string; count: number; disabled: boolean; onClick: () => void }) {
  return <div className="flex items-center gap-3 rounded-lg border bg-white p-3"><FileText className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" /><h3 className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{title}</h3><Count count={count} /><Button type="button" variant="outline" className="min-h-10 shrink-0" disabled={disabled} onClick={onClick}><Download className="mr-2 h-4 w-4" />PDF</Button></div>;
}

function Count({ count }: { count: number }) { return <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">{count}</span>; }

function formatDate(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
