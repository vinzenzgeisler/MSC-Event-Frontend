import type { MarshalAreaAssignment, MarshalCommitmentStatus, MarshalShiftAssignment } from "@/types/admin-marshals";

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

export function statusForTargetSelection(status: MarshalCommitmentStatus, assignmentValue: string): MarshalCommitmentStatus {
  const hasTarget = assignmentValue !== "" && assignmentValue !== "none";
  return hasTarget && (status === "not_asked" || status === "declined") ? "pending" : status;
}
