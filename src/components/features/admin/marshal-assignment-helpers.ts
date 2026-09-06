import type { MarshalAreaAssignment, MarshalCommitmentStatus, MarshalPerson, MarshalShiftAssignment } from "@/types/admin-marshals";

const TRACK_AREA_ALIASES = new Set(["strecke", "streckenposten", "team strecke", "team streckenposten", "track", "marshal"]);
const ACTIVE_ASSIGNMENT_STATUSES = new Set<MarshalCommitmentStatus>(["accepted", "pending", "tentative"]);

export function normalizeMarshalActivityArea(value: string): string {
  return value.trim().replace(/[\s_-]+/g, " ").toLocaleLowerCase("de");
}

export function isMarshalTrackActivityArea(value: string): boolean {
  return TRACK_AREA_ALIASES.has(normalizeMarshalActivityArea(value));
}

export function isMarshalTrackHelper(person: Pick<MarshalPerson, "activityAreas">): boolean {
  return person.activityAreas.some(isMarshalTrackActivityArea);
}

export function hasAcceptedMarshalTrackAssignment(
  person: Pick<MarshalPerson, "activityAreas" | "assignments">,
  dayId?: string,
): boolean {
  const hasTrackMasterArea = person.activityAreas.some(isMarshalTrackActivityArea);
  if (!hasTrackMasterArea) return false;
  return person.assignments.some((assignment) => (
    (!dayId || assignment.dayId === dayId)
      && assignment.commitmentStatus === "accepted"
  ));
}

export function getSetupAreaMemberParticipationIds(
  areaId: string,
  shiftIds: ReadonlySet<string>,
  areaAssignments: MarshalAreaAssignment[],
  shiftAssignments: MarshalShiftAssignment[],
): Set<string> {
  const participationIds = new Set(
    areaAssignments.filter((assignment) => assignment.areaId === areaId).map((assignment) => assignment.participationId),
  );
  shiftAssignments.forEach((assignment) => {
    if (shiftIds.has(assignment.shiftId)) participationIds.add(assignment.participationId);
  });
  return participationIds;
}

export function isMarshalEventAreaAssignment(
  areaType: string,
  commitmentStatus: MarshalCommitmentStatus,
): boolean {
  return areaType === "setup" || ACTIVE_ASSIGNMENT_STATUSES.has(commitmentStatus);
}

export function isMarshalShirtRelevantAreaAssignment(
  areaType: string,
  commitmentStatus: MarshalCommitmentStatus,
): boolean {
  return areaType === "setup" || commitmentStatus === "accepted";
}

export function statusForTargetSelection(status: MarshalCommitmentStatus, assignmentValue: string): MarshalCommitmentStatus {
  const hasTarget = assignmentValue !== "" && assignmentValue !== "none";
  return hasTarget && (status === "not_asked" || status === "declined") ? "pending" : status;
}
