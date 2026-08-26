import type { ReactNode } from "react";
import { GraduationCap, Import, Printer, Settings2, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MarshalEvent, MarshalWorkspace } from "@/types/admin-marshals";

export type SidebarView =
  | "track_saturday" | "track_sunday"
  | "setup_fl1" | "setup_fl2"
  | "general_saturday" | "general_sunday"
  | "stammdaten" | "schulung" | "druck" | "import" | "config";

type Props = {
  workspace: MarshalWorkspace | null;
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  events: MarshalEvent[];
  selectedEvent: string | null;
  onEventChange: (id: string) => void;
};

export function MarshalSidebar({ workspace, activeView, onViewChange, events, selectedEvent, onEventChange }: Props) {
  const getTrackStaffing = (dayKey: "saturday" | "sunday") => {
    const day = workspace?.days.find((item) => item.dayKey === dayKey);
    if (!workspace || !day) return { accepted: 0, total: 0 };
    const accepted = workspace.people.filter((person) => !person.noDeployment).reduce((sum, person) => sum + person.assignments.filter(
      (assignment) => assignment.dayId === day.id && assignment.commitmentStatus === "accepted" && Boolean(assignment.postId),
    ).length, 0);
    const total = workspace.posts.filter((post) => post.isActive).reduce((sum, post) => sum + post.targetStaff, 0);
    return { accepted, total };
  };

  const getAreaCount = (areaCode: string) => {
    if (!workspace) return 0;
    const area = workspace.areas.find((item) => item.code === areaCode);
    if (!area) return 0;
    const shiftIds = new Set(workspace.areaShifts.filter((shift) => shift.areaId === area.id).map((shift) => shift.id));
    const eligibleParticipationIds = new Set(workspace.people.filter((person) => !person.noDeployment).map((person) => person.participation.id));
    const participationIds = new Set([
      ...workspace.areaAssignments.filter((item) => item.areaId === area.id && item.commitmentStatus === "accepted").map((item) => item.participationId),
      ...workspace.shiftAssignments.filter((item) => shiftIds.has(item.shiftId) && item.commitmentStatus === "accepted").map((item) => item.participationId),
    ].filter((participationId) => eligibleParticipationIds.has(participationId)));
    return participationIds.size;
  };

  return (
    <aside aria-label="Bereichsnavigation der Helferverwaltung" className="flex w-full flex-shrink-0 flex-col border-b border-slate-200 bg-white shadow-sm lg:sticky lg:top-2 lg:h-[calc(100vh-6rem)] lg:w-64 lg:border-b-0 lg:border-r">
      <div className="border-b border-slate-200 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Helferverwaltung</p>
        <Select value={selectedEvent ?? ""} onValueChange={onEventChange}>
          <SelectTrigger className="h-10 w-full text-sm"><SelectValue placeholder="Event wählen" /></SelectTrigger>
          <SelectContent>{events.map((event) => <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <nav className="grid flex-1 gap-3 overflow-y-auto p-2 sm:grid-cols-2 lg:block lg:space-y-5" aria-label="Helferbereiche">
        <div>
          <SectionTitle>Einteilungen</SectionTitle>
          <SubTitle>Streckenposten</SubTitle>
          <NavItem active={activeView === "track_saturday"} onClick={() => onViewChange("track_saturday")} label="Samstag" badge={<StaffingBar {...getTrackStaffing("saturday")} />} />
          <NavItem active={activeView === "track_sunday"} onClick={() => onViewChange("track_sunday")} label="Sonntag" badge={<StaffingBar {...getTrackStaffing("sunday")} />} />

          <SubTitle>Aufbau</SubTitle>
          {(["setup_fl1", "setup_fl2"] as const).map((code) => {
            const area = workspace?.areas.find((item) => item.code === code);
            return <NavItem key={code} active={activeView === code} onClick={() => onViewChange(code)} label={area?.name ?? (code === "setup_fl1" ? "Fahrerlager 1" : "Fahrerlager 2")} badge={<CountBadge count={getAreaCount(code)} />} />;
          })}

          <SubTitle>Allg. Helfer</SubTitle>
          <NavItem active={activeView === "general_saturday"} onClick={() => onViewChange("general_saturday")} label="Samstag" badge={<CountBadge count={getAreaCount("general_saturday")} />} />
          <NavItem active={activeView === "general_sunday"} onClick={() => onViewChange("general_sunday")} label="Sonntag" badge={<CountBadge count={getAreaCount("general_sunday")} />} />
        </div>

        <div>
          <SectionTitle>Verwaltung</SectionTitle>
          <NavItem active={activeView === "stammdaten"} onClick={() => onViewChange("stammdaten")} label={`Stammdaten (${workspace?.people.length ?? 0})`} icon={<Users className="h-4 w-4" />} />
          <NavItem active={activeView === "schulung"} onClick={() => onViewChange("schulung")} label="Schulungen" icon={<GraduationCap className="h-4 w-4" />} />
        </div>
      </nav>

      <div className="grid grid-cols-3 gap-1 border-t border-slate-200 p-2 lg:block lg:space-y-0.5">
        <NavItem active={activeView === "druck"} onClick={() => onViewChange("druck")} label="Drucken" icon={<Printer className="h-4 w-4" />} />
        <NavItem active={activeView === "import"} onClick={() => onViewChange("import")} label="Import" icon={<Import className="h-4 w-4" />} />
        <NavItem active={activeView === "config"} onClick={() => onViewChange("config")} label="Konfiguration" icon={<Settings2 className="h-4 w-4" />} />
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</p>;
}

function SubTitle({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-2 pb-1 pt-1 text-xs font-medium text-slate-500">{children}</p>;
}

function NavItem({ active, onClick, label, badge, icon }: { active: boolean; onClick: () => void; label: string; badge?: ReactNode; icon?: ReactNode }) {
  return (
    <button type="button" aria-current={active ? "page" : undefined} onClick={onClick} className={cn("flex min-h-10 w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-100")}>
      <span className="flex min-w-0 items-center gap-2">{icon}<span className="truncate">{label}</span></span>
      {badge && <span className="ml-1 flex-shrink-0">{badge}</span>}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{count} P</span>;
}

function StaffingBar({ accepted, total }: { accepted: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((accepted / total) * 100)) : 0;
  const color = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400";
  return <div className="flex items-center gap-1" title={`${accepted} von ${total} Sollplätzen besetzt`} aria-label={`${accepted} von ${total} Sollplätzen besetzt`}><div className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200" aria-hidden="true"><div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} /></div><span className="text-[10px] text-slate-500">{accepted}/{total}</span></div>;
}
