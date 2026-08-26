import { useEffect, useMemo, useRef, useState } from "react";
import { Replace, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarshalTrackSvg, type TrackLeader, type TrackPost } from "@/components/features/admin/marshal-track-svg";
import { MarshalSectionLeaderEditor, MarshalSectionLeaderGrid } from "@/components/features/admin/marshal-section-leader-editor";
import { MarshalInfoPopover } from "@/components/features/admin/marshal-info-popover";
import type {
  MarshalCommitmentStatus,
  MarshalDay,
  MarshalPerson,
  MarshalPost,
  MarshalSection,
  MarshalWorkspace,
} from "@/types/admin-marshals";

export type PlanningTargetMode = "normal" | "emergency";
export type StaffingLevel = "unfilled" | "met" | "overfilled";

export type PostStaffingState = {
  accepted: number;
  pending: number;
  target: number;
  level: StaffingLevel;
};

const commitmentLabels: Record<MarshalCommitmentStatus, string> = {
  not_asked: "Nicht angefragt",
  pending: "Offen",
  accepted: "Zugesagt",
  declined: "Abgesagt",
  tentative: "Vielleicht",
};

type AssignmentAction = (
  person: MarshalPerson,
  status: MarshalCommitmentStatus,
  assignmentValue: string,
  allowOccupied?: boolean,
) => Promise<boolean>;

type ReplacementAction = (
  currentPerson: MarshalPerson,
  replacementPerson: MarshalPerson,
  postId: string,
) => Promise<boolean>;

type PlanningProps = {
  workspace: MarshalWorkspace;
  day: MarshalDay;
  targetMode: PlanningTargetMode;
  canWrite: boolean;
  busy: boolean;
  onAssign: AssignmentAction;
  onReplace: ReplacementAction;
};

/** Saved coordinates are normalized local plan coordinates, never geography. */
export function getPostMapPosition(
  post: MarshalPost,
  sections: MarshalSection[],
  posts: MarshalPost[],
) {
  const savedCoordinates = getPostMapCoordinates(post);
  if (savedCoordinates.mapX !== null && savedCoordinates.mapY !== null) {
    return { x: savedCoordinates.mapX, y: savedCoordinates.mapY, isFallback: false };
  }

  const sortedSections = [...sections].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
  const sectionIndex = Math.max(
    0,
    sortedSections.findIndex((section) => section.id === post.sectionId),
  );
  const sectionPosts = posts
    .filter((item) => item.isActive && item.sectionId === post.sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const postIndex = Math.max(0, sectionPosts.findIndex((item) => item.id === post.id));
  const laneWidth = 840 / Math.max(sortedSections.length, 1);
  const x = 80 + laneWidth * sectionIndex + laneWidth / 2;
  const y = sectionPosts.length <= 1 ? 500 : 140 + (720 * postIndex) / (sectionPosts.length - 1);
  return { x, y, isFallback: true };
}

export function getPostMapCoordinates(post: MarshalPost) {
  if (isMapCoordinate(post.mapX) && isMapCoordinate(post.mapY)) {
    return { mapX: post.mapX, mapY: post.mapY };
  }
  return { mapX: null, mapY: null };
}

export function getPostTarget(post: MarshalPost, mode: PlanningTargetMode) {
  const normal = positiveInteger(post.targetStaff, 1);
  return mode === "normal"
    ? normal
    : Math.min(normal, positiveInteger(post.emergencyTargetStaff, normal));
}

export function getPostStaffingState(
  postId: string,
  dayId: string,
  people: MarshalPerson[],
  target: number,
): PostStaffingState {
  let accepted = 0;
  let pending = 0;
  let assigned = 0;
  for (const person of people) {
    if (person.noDeployment) continue;
    const assignment = person.assignments.find(
      (item) => item.dayId === dayId && item.postId === postId,
    );
    if (assignment) assigned += 1;
    if (assignment?.commitmentStatus === "accepted") accepted += 1;
    if (assignment?.commitmentStatus === "pending" || assignment?.commitmentStatus === "tentative") pending += 1;
  }
  return {
    accepted,
    pending,
    target,
    level: assigned > target ? "overfilled" : accepted < target ? "unfilled" : "met",
  };
}

function isMapCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1000;
}

function positiveInteger(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function sortedPlanningData(workspace: MarshalWorkspace) {
  return {
    posts: [...workspace.posts]
      .filter((post) => post.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    sections: [...workspace.sections].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
    ),
  };
}

export function MarshalPlanningOverview(props: PlanningProps) {
  const { workspace, day, targetMode } = props;
  const { posts, sections } = useMemo(() => sortedPlanningData(workspace), [workspace]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => setSelectedPostId(null), [day.id]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>Vier-Abschnitt-Übersicht</span>
          <StaffingLegend />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => (
            <section key={section.id} className="min-w-0 rounded-xl border border-dashed border-slate-300 bg-white/80 p-3">
              <h3 className="break-words text-sm font-semibold text-slate-800">{section.name}</h3>
              <div className="mt-2"><MarshalSectionLeaderEditor workspace={workspace} day={day} section={section} canWrite={props.canWrite} busy={props.busy} onSave={props.onAssign} /></div>
              <div className="mt-3 grid gap-2">
                {posts.filter((post) => post.sectionId === section.id).map((post) => (
                  <PostButton
                    key={post.id}
                    post={post}
                    state={getPostStaffingState(post.id, day.id, workspace.people, getPostTarget(post, targetMode))}
                    selected={post.id === selectedPostId}
                    onClick={() => setSelectedPostId(post.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <PostPlanningPanel
        {...props}
        post={posts.find((post) => post.id === selectedPostId) ?? null}
        onClose={() => setSelectedPostId(null)}
      />
    </div>
  );
}

export function MarshalPlanningMap(props: PlanningProps) {
  const { workspace, day, targetMode } = props;
  const { posts, sections } = useMemo(() => sortedPlanningData(workspace), [workspace]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => setSelectedPostId(null), [day.id]);
  const trackPosts = posts.map((post): TrackPost => {
    const state = getPostStaffingState(post.id, day.id, workspace.people, getPostTarget(post, targetMode));
    return { ...post, target: state.target, staffCount: state.accepted, overfilled: state.level === "overfilled" };
  });
  const trackLeaders = sections.map((section): TrackLeader => ({
    section,
    target: 1,
    staffCount: workspace.people.filter((person) => !person.noDeployment && person.assignments.some((assignment) => assignment.dayId === day.id && assignment.role === "section_leader" && assignment.sectionId === section.id && assignment.commitmentStatus === "accepted")).length,
  }));

  return (
    <div className="space-y-4">
      <MarshalSectionLeaderGrid workspace={workspace} day={day} canWrite={props.canWrite} busy={props.busy} onSave={props.onAssign} />
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2 text-xs text-slate-600">
          <MarshalInfoPopover label="Information zur Streckenkarte">Gespeicherte Postenkoordinaten werden bevorzugt.</MarshalInfoPopover>
          <StaffingLegend />
        </div>
        <MarshalTrackSvg
          className="h-auto w-full min-w-0"
          posts={trackPosts}
          sections={sections}
          leaders={trackLeaders}
          selectedMarker={selectedPostId ? `post:${selectedPostId}` : null}
          onPostClick={(post) => setSelectedPostId(post.id)}
        />
      </div>
      <PostPlanningPanel
        {...props}
        post={posts.find((post) => post.id === selectedPostId) ?? null}
        onClose={() => setSelectedPostId(null)}
      />
    </div>
  );
}

function PostButton({ post, state, selected, onClick }: { post: MarshalPost; state: PostStaffingState; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border bg-white p-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected && "border-blue-600 ring-1 ring-blue-600",
      )}
    >
      <span className={cn("h-3 w-3 shrink-0 rounded-full", staffingColor(state.level))} />
      <span className="min-w-0 flex-1">
        <strong className="block break-words">{post.code}</strong>
        <span className="block break-words text-xs text-slate-500">{post.description || "Streckenposten"}</span>
      </span>
      <span className="shrink-0 text-xs font-semibold">{state.accepted}/{state.target}{state.pending ? ` +${state.pending}` : ""}</span>
    </button>
  );
}

function PostPlanningPanel({ post, workspace, day, targetMode, canWrite, busy, onAssign, onReplace, onClose }: PlanningProps & { post: MarshalPost | null; onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (post) panelRef.current?.focus();
  }, [post]);

  if (!post) {
    return <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">Posten wählen, um die festen Helferplätze zu bearbeiten.</div>;
  }

  const target = getPostTarget(post, targetMode);
  const allAssignments = workspace.people
    .map((person) => ({ person, assignment: person.assignments.find((item) => item.dayId === day.id && item.postId === post.id) }))
    .filter((item): item is typeof item & { assignment: NonNullable<typeof item.assignment> } => Boolean(item.assignment))
    .sort((a, b) => a.person.helperNumber - b.person.helperNumber);
  const assignments = allAssignments.filter((item) => !item.person.noDeployment);
  const excludedAssignments = allAssignments.filter((item) => item.person.noDeployment);
  const slots = Array.from({ length: target }, (_, index) => assignments[index] ?? null);
  const overflow = assignments.slice(target);
  const eligiblePeople = workspace.people
    .filter((person) => {
      if (!person.isActive || person.noDeployment) return false;
      const assignment = person.assignments.find((item) => item.dayId === day.id);
      return Boolean(assignment && ["accepted", "pending", "tentative"].includes(assignment.commitmentStatus) && assignment.postId !== post.id);
    })
    .sort((a, b) => a.helperNumber - b.helperNumber);

  return (
    <aside ref={panelRef} tabIndex={-1} aria-labelledby="marshal-post-panel-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="marshal-post-panel-title" className="text-lg font-semibold">Posten {post.code}</h3>
          <p className="mt-1 text-sm text-slate-600">{post.description || "Streckenposten"} · Soll {targetMode === "normal" ? "Normal" : "Notfall"}: {target}</p>
        </div>
        <Button size="sm" variant="ghost" aria-label="Postendetails schließen" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot, index) => slot ? (
          <FilledSlot
            key={slot.person.id}
            label={`Platz ${index + 1}`}
            item={slot}
            post={post}
            eligiblePeople={eligiblePeople}
            canWrite={canWrite}
            busy={busy}
            onAssign={onAssign}
            onReplace={onReplace}
          />
        ) : (
          <EmptySlot key={`empty-${index}`} label={`Platz ${index + 1}`} post={post} day={day} eligiblePeople={eligiblePeople} canWrite={canWrite} busy={busy} onAssign={onAssign} />
        ))}
      </div>
      {overflow.length > 0 && (
        <section className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3" aria-label="Überbesetzung">
          <h4 className="font-semibold text-red-900">Über Soll ({overflow.length})</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {overflow.map((item, index) => (
              <FilledSlot key={item.person.id} label={`Überhang ${index + 1}`} item={item} post={post} eligiblePeople={eligiblePeople} canWrite={canWrite} busy={busy} onAssign={onAssign} onReplace={onReplace} overflow />
            ))}
          </div>
        </section>
      )}
      {excludedAssignments.length > 0 && (
        <section className="mt-5 rounded-xl border border-slate-300 bg-slate-50 p-3" aria-label="Historische Zuweisungen ohne Einsatzfreigabe">
          <h4 className="font-semibold text-slate-800">Zählt nicht zur Besetzung ({excludedAssignments.length})</h4>
          <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {excludedAssignments.map((item) => <FilledSlot key={item.person.id} label="Kein Einsatz" item={item} post={post} eligiblePeople={eligiblePeople} canWrite={canWrite} busy={busy} onAssign={onAssign} onReplace={onReplace} />)}
          </div>
        </section>
      )}
    </aside>
  );
}

type AssignedItem = { person: MarshalPerson; assignment: MarshalPerson["assignments"][number] };

function FilledSlot({ label, item, post, eligiblePeople, canWrite, busy, onAssign, onReplace, overflow = false }: {
  label: string; item: AssignedItem; post: MarshalPost; eligiblePeople: MarshalPerson[]; canWrite: boolean; busy: boolean; onAssign: AssignmentAction; onReplace: ReplacementAction; overflow?: boolean;
}) {
  const [replacementId, setReplacementId] = useState("");
  const replacement = eligiblePeople.find((person) => person.id === replacementId);
  const disabled = !canWrite || busy || !item.person.isActive || item.person.noDeployment;
  useEffect(() => {
    setReplacementId("");
  }, [item.person.id, post.id]);
  useEffect(() => {
    if (replacementId && !replacement) setReplacementId("");
  }, [replacement, replacementId]);
  return (
    <div className={cn("rounded-lg border p-3", overflow ? "border-red-300 bg-white" : "bg-slate-50", !item.person.isActive && "border-red-400 bg-red-50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><span className="text-xs font-semibold uppercase text-slate-500">{label}</span><div className="break-words font-medium">{item.person.firstName} {item.person.lastName}</div></div>
        {item.person.noDeployment ? <Badge className="bg-red-100 text-red-900">Kein Einsatz</Badge> : !item.person.isActive && <Badge className="bg-red-100 text-red-900">Inaktiv</Badge>}
      </div>
      <label className="mt-3 grid gap-1 text-xs font-medium text-slate-600">Zusage
        <CommitmentSelect value={item.assignment.commitmentStatus} disabled={disabled} onChange={(status) => void onAssign(item.person, status, `post:${post.id}`)} />
      </label>
      {canWrite && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <Button type="button" size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void onAssign(item.person, item.assignment.commitmentStatus, "")}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Zuweisung entfernen
          </Button>
          {!item.person.noDeployment && <><label className="grid gap-1 text-xs font-medium text-slate-600">Helfer ersetzen
            <select className="h-10 w-full rounded-md border bg-white px-2 text-sm" value={replacementId} disabled={busy || eligiblePeople.length === 0} onChange={(event) => setReplacementId(event.target.value)}>
              <option value="">Ersatz wählen</option>
              {eligiblePeople.map((person) => <option key={person.id} value={person.id}>{person.helperNumber} · {person.firstName} {person.lastName}</option>)}
            </select>
          </label>
          <Button type="button" size="sm" className="w-full" disabled={!replacement || busy} onClick={() => replacement && void onReplace(item.person, replacement, post.id).then((saved) => saved && setReplacementId(""))}>
            <Replace className="mr-1.5 h-4 w-4" /> Ersetzen
          </Button></>}
        </div>
      )}
    </div>
  );
}

function EmptySlot({ label, post, day, eligiblePeople, canWrite, busy, onAssign }: { label: string; post: MarshalPost; day: MarshalDay; eligiblePeople: MarshalPerson[]; canWrite: boolean; busy: boolean; onAssign: AssignmentAction }) {
  const [helperId, setHelperId] = useState("");
  const helper = eligiblePeople.find((person) => person.id === helperId);
  const assignment = helper?.assignments.find((item) => item.dayId === day.id);
  useEffect(() => {
    setHelperId("");
  }, [day.id, post.id]);
  useEffect(() => {
    if (helperId && !helper) setHelperId("");
  }, [helper, helperId]);
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <p className="mt-1 text-sm text-slate-500">Noch frei</p>
      {canWrite && <><label className="mt-3 grid gap-1 text-xs font-medium text-slate-600">Helfer auswählen
        <select className="h-10 w-full rounded-md border bg-white px-2 text-sm" value={helperId} disabled={busy || eligiblePeople.length === 0} onChange={(event) => setHelperId(event.target.value)}>
          <option value="">Helfer wählen</option>
          {eligiblePeople.map((person) => <option key={person.id} value={person.id}>{person.helperNumber} · {person.firstName} {person.lastName} · {commitmentLabels[person.assignments.find((item) => item.dayId === day.id)?.commitmentStatus ?? "not_asked"]}</option>)}
        </select>
      </label>
      <Button type="button" size="sm" className="mt-2 w-full" disabled={!helper || !assignment || busy} onClick={() => helper && assignment && void onAssign(helper, assignment.commitmentStatus, `post:${post.id}`).then((saved) => saved && setHelperId(""))}>Platz besetzen</Button></>}
    </div>
  );
}

function CommitmentSelect({ value, disabled, onChange }: { value: MarshalCommitmentStatus; disabled: boolean; onChange: (value: MarshalCommitmentStatus) => void }) {
  return <select className="h-10 w-full rounded-md border bg-white px-2 text-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MarshalCommitmentStatus)}>{Object.entries(commitmentLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>;
}

function StaffingLegend() {
  return <div className="flex flex-wrap gap-2" aria-label="Legende"><LegendDot className="bg-amber-500" label="Unter Soll" /><LegendDot className="bg-emerald-600" label="Soll erreicht" /><LegendDot className="bg-red-600" label="Über Soll" /><span>+ = Offen/Vielleicht</span></div>;
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", className)} />{label}</span>;
}

function staffingColor(level: StaffingLevel) {
  return level === "unfilled" ? "bg-amber-500" : level === "overfilled" ? "bg-red-600" : "bg-emerald-600";
}
