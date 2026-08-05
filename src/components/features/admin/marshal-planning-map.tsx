import { useEffect, useMemo, useRef, useState } from "react";
import { TriangleAlert, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

/**
 * Uses saved 0–1000 coordinates when both are valid. Otherwise posts are
 * distributed deterministically in their section lane. The fallback is a
 * schematic planning layout, not traced geography.
 */
export function getPostMapPosition(
  post: MarshalPost,
  sections: MarshalSection[],
  posts: MarshalPost[],
) {
  const savedCoordinates = getPostMapCoordinates(post);
  if (savedCoordinates.mapX !== null && savedCoordinates.mapY !== null) {
    return {
      x: savedCoordinates.mapX,
      y: savedCoordinates.mapY,
      isFallback: false,
    };
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
  const postIndex = Math.max(
    0,
    sectionPosts.findIndex((item) => item.id === post.id),
  );
  const laneWidth = 840 / Math.max(sortedSections.length, 1);
  const x = 80 + laneWidth * sectionIndex + laneWidth / 2;
  const y =
    sectionPosts.length <= 1
      ? 500
      : 160 + (680 * postIndex) / (sectionPosts.length - 1);

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
  if (mode === "normal") return normal;
  return Math.min(
    normal,
    positiveInteger(post.emergencyTargetStaff, normal),
  );
}

export function getPostStaffingState(
  postId: string,
  dayId: string,
  people: MarshalPerson[],
  target: number,
): PostStaffingState {
  let accepted = 0;
  let pending = 0;
  for (const person of people) {
    const assignment = person.assignments.find(
      (item) => item.dayId === dayId && item.postId === postId,
    );
    if (assignment?.commitmentStatus === "accepted") accepted += 1;
    if (
      assignment?.commitmentStatus === "pending" ||
      assignment?.commitmentStatus === "tentative"
    ) {
      pending += 1;
    }
  }
  return {
    accepted,
    pending,
    target,
    level:
      accepted < target ? "unfilled" : accepted > target ? "overfilled" : "met",
  };
}

function isMapCoordinate(value: number | null | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1000
  );
}

function positiveInteger(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

type MarshalPlanningMapProps = {
  workspace: MarshalWorkspace;
  day: MarshalDay;
  targetMode: PlanningTargetMode;
  canWrite: boolean;
  busy: boolean;
  onAssign: (
    person: MarshalPerson,
    status: MarshalCommitmentStatus,
    assignmentValue: string,
  ) => void;
};

export function MarshalPlanningMap({
  workspace,
  day,
  targetMode,
  canWrite,
  busy,
  onAssign,
}: MarshalPlanningMapProps) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [helperId, setHelperId] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const posts = useMemo(
    () =>
      workspace.posts
        .filter((post) => post.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    [workspace.posts],
  );
  const sections = useMemo(
    () =>
      [...workspace.sections].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
      ),
    [workspace.sections],
  );
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;

  useEffect(() => {
    if (selectedPost) panelRef.current?.focus();
  }, [selectedPost]);

  useEffect(() => {
    setSelectedPostId(null);
    setHelperId("");
  }, [day.id]);

  const selectedAssignments = selectedPost
    ? workspace.people
        .map((person) => ({
          person,
          assignment: person.assignments.find(
            (item) => item.dayId === day.id && item.postId === selectedPost.id,
          ),
        }))
        .filter(
          (item): item is typeof item & { assignment: NonNullable<typeof item.assignment> } =>
            Boolean(item.assignment),
        )
        .sort((a, b) => a.person.helperNumber - b.person.helperNumber)
    : [];
  const eligiblePeople = selectedPost
    ? workspace.people
        .filter((person) => {
          if (!person.isActive) return false;
          const assignment = person.assignments.find((item) => item.dayId === day.id);
          return (
            assignment &&
            ["accepted", "pending", "tentative"].includes(
              assignment.commitmentStatus,
            ) &&
            assignment.postId !== selectedPost.id
          );
        })
        .sort((a, b) => a.helperNumber - b.helperNumber)
    : [];
  const selectedHelper = eligiblePeople.find((person) => person.id === helperId);

  function assignSelectedHelper() {
    if (!selectedPost || !selectedHelper) return;
    const assignment = selectedHelper.assignments.find((item) => item.dayId === day.id);
    if (!assignment) return;
    onAssign(
      selectedHelper,
      assignment.commitmentStatus,
      `post:${selectedPost.id}`,
    );
    setHelperId("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2 text-xs text-slate-600">
          <span>Schematische Abschnittsansicht</span>
          <div className="flex flex-wrap gap-2" aria-label="Legende">
            <LegendDot className="bg-amber-500" label="Unter Soll" />
            <LegendDot className="bg-emerald-600" label="Soll erreicht" />
            <LegendDot className="bg-red-600" label="Über Soll" />
            <LegendDot className="bg-amber-100 ring-2 ring-amber-500" label="Offen/Vielleicht" />
          </div>
        </div>
        <svg
          className="block aspect-[5/3] min-h-[360px] w-full"
          viewBox="0 0 1000 600"
          role="group"
          aria-label={`Postenkarte für ${day.label}`}
        >
          <defs>
            <pattern id="marshal-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1000" height="600" fill="#f8fafc" />
          <rect width="1000" height="600" fill="url(#marshal-map-grid)" />
          {sections.map((section, index) => {
            const laneWidth = 840 / Math.max(sections.length, 1);
            const x = 80 + index * laneWidth;
            return (
              <g key={section.id} aria-hidden="true">
                <rect
                  x={x + 6}
                  y="45"
                  width={Math.max(laneWidth - 12, 1)}
                  height="510"
                  rx="18"
                  fill={index % 2 === 0 ? "#eff6ff" : "#f1f5f9"}
                  stroke="#cbd5e1"
                  strokeDasharray="8 7"
                />
                <text
                  x={x + laneWidth / 2}
                  y="72"
                  textAnchor="middle"
                  fill="#475569"
                  fontSize="15"
                  fontWeight="700"
                >
                  {section.name}
                </text>
              </g>
            );
          })}
          {posts.map((post) => {
            const position = getPostMapPosition(post, sections, posts);
            const x = position.x;
            const y = position.y * 0.6;
            const target = getPostTarget(post, targetMode);
            const state = getPostStaffingState(post.id, day.id, workspace.people, target);
            const selected = selectedPostId === post.id;
            const color =
              state.level === "unfilled"
                ? "#d97706"
                : state.level === "overfilled"
                  ? "#dc2626"
                  : "#059669";
            const label = `${post.code}: ${state.accepted} von ${target} bestätigt${state.pending ? `, ${state.pending} offen oder vielleicht` : ""}`;
            return (
              <g
                key={post.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                className="cursor-pointer outline-none focus-visible:[&>circle:first-of-type]:stroke-blue-700"
                onClick={() => setSelectedPostId(post.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedPostId(post.id);
                  }
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={selected ? 30 : 27}
                  fill={color}
                  stroke={selected ? "#1d4ed8" : "#ffffff"}
                  strokeWidth={selected ? 7 : 5}
                />
                {state.pending > 0 && (
                  <circle
                    cx={x + 21}
                    cy={y - 21}
                    r="10"
                    fill="#fef3c7"
                    stroke="#d97706"
                    strokeWidth="4"
                  />
                )}
                <text
                  x={x}
                  y={y - 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize="13"
                  fontWeight="800"
                  pointerEvents="none"
                >
                  {post.code}
                </text>
                <text
                  x={x}
                  y={y + 14}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {state.accepted}/{target}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="border-t bg-white px-3 py-2 text-xs text-slate-500">
          Positionen ohne gespeicherte Koordinaten werden geordnet im jeweiligen Abschnitt angezeigt.
        </p>
      </div>

      {selectedPost ? (
        <aside
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby="marshal-post-panel-title"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="marshal-post-panel-title" className="text-lg font-semibold text-slate-950">
                Posten {selectedPost.code}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {selectedPost.description || "Streckenposten"}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Postendetails schließen"
              onClick={() => setSelectedPostId(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2">
            <TargetMetric label="Normal" value={getPostTarget(selectedPost, "normal")} />
            <TargetMetric label="Notfall" value={getPostTarget(selectedPost, "emergency")} />
          </dl>

          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Zugewiesene Helfer ({selectedAssignments.length})
            </h4>
            {selectedAssignments.length ? (
              <ul className="mt-2 space-y-2">
                {selectedAssignments.map(({ person, assignment }) => (
                  <li
                    key={person.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      !person.isActive && "border-red-300 bg-red-50 text-red-900",
                      ["pending", "tentative"].includes(assignment.commitmentStatus) &&
                        "border-amber-300 bg-amber-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {person.firstName} {person.lastName}
                      </span>
                      <StatusBadge status={assignment.commitmentStatus} />
                    </div>
                    {!person.isActive && (
                      <div className="mt-1 text-xs font-semibold">Inaktiv · kein Einsatz mehr</div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                Noch niemand zugewiesen.
              </p>
            )}
          </div>

          {canWrite && (
            <div className="mt-5 border-t pt-4">
              <h4 className="text-sm font-semibold text-slate-900">Helfer direkt zuweisen</h4>
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900" role="note">
                <TriangleAlert className="mr-1 inline h-4 w-4" />
                Offen oder Vielleicht darf geplant werden, zählt aber nicht zur bestätigten Besetzung.
              </div>
              <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor="marshal-map-helper">
                Aktiver Helfer mit Zusage, Offen oder Vielleicht
              </label>
              <select
                id="marshal-map-helper"
                className="mt-1 h-11 w-full rounded-md border bg-white px-3 text-sm"
                value={helperId}
                disabled={busy || eligiblePeople.length === 0}
                onChange={(event) => setHelperId(event.target.value)}
              >
                <option value="">Helfer wählen</option>
                {eligiblePeople.map((person) => {
                  const assignment = person.assignments.find((item) => item.dayId === day.id);
                  return (
                    <option key={person.id} value={person.id}>
                      {person.helperNumber} · {person.firstName} {person.lastName}
                      {assignment ? ` · ${commitmentLabels[assignment.commitmentStatus]}` : ""}
                    </option>
                  );
                })}
              </select>
              {selectedHelper && (() => {
                const status = selectedHelper.assignments.find((item) => item.dayId === day.id)?.commitmentStatus;
                return status === "pending" || status === "tentative" ? (
                  <p className="mt-2 text-xs font-semibold text-amber-800">
                    Achtung: Diese Zuweisung bleibt unbestätigt.
                  </p>
                ) : null;
              })()}
              <Button
                className="mt-3 w-full"
                disabled={!selectedHelper || busy}
                onClick={assignSelectedHelper}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Diesem Posten zuweisen
              </Button>
            </div>
          )}
        </aside>
      ) : (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Posten auf der Karte wählen, um Besetzung und Zuweisung zu öffnen.
        </div>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function TargetMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">Soll {label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: MarshalCommitmentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0",
        status === "accepted" && "border-emerald-300 bg-emerald-50 text-emerald-800",
        (status === "pending" || status === "tentative") &&
          "border-amber-300 bg-amber-100 text-amber-900",
        (status === "declined" || status === "not_asked") &&
          "border-slate-300 bg-slate-50 text-slate-600",
      )}
    >
      {commitmentLabels[status]}
    </Badge>
  );
}
