import type { MarshalPerson, MarshalWorkspace } from "@/types/admin-marshals";
import { hasAcceptedMarshalTrackAssignment } from "@/components/features/admin/marshal-assignment-helpers";

export type MarshalShirtStatistic = {
  areaId: string;
  areaName: string;
  peopleCount: number;
  sizes: Array<{ size: string; count: number }>;
};

const shirtSizeOrder = ["KINDER", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "6XL"];

export function getMarshalShirtSize(person: MarshalPerson): string | null {
  return cleanShirtSize(person.shirtSize);
}

export function buildMarshalShirtStatistics(workspace: MarshalWorkspace): MarshalShirtStatistic[] {
  const trackPeople = new Set(
    workspace.people
      .filter((person) => person.isActive && !person.noDeployment && hasAcceptedMarshalTrackAssignment(person))
      .map((person) => person.participation.id),
  );
  const counted = new Set<string>();
  const groups: Array<{ areaId: string; areaName: string; people: MarshalPerson[] }> = [];

  const trackHelpers = workspace.people.filter((person) => trackPeople.has(person.participation.id));
  trackHelpers.forEach((person) => counted.add(person.participation.id));
  groups.push({ areaId: "track", areaName: "Streckenposten", people: trackHelpers });

  const sortedAreas = [...workspace.areas].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
  for (const area of sortedAreas) {
    const shiftIds = new Set(workspace.areaShifts.filter((shift) => shift.areaId === area.id).map((shift) => shift.id));
    const participationIds = new Set([
      ...workspace.areaAssignments
        .filter((assignment) => assignment.areaId === area.id && assignment.commitmentStatus === "accepted")
        .map((assignment) => assignment.participationId),
      ...workspace.shiftAssignments
        .filter((assignment) => shiftIds.has(assignment.shiftId) && assignment.commitmentStatus === "accepted")
        .map((assignment) => assignment.participationId),
    ]);
    const people = workspace.people.filter((person) => person.isActive && !person.noDeployment && participationIds.has(person.participation.id) && !counted.has(person.participation.id));
    people.forEach((person) => counted.add(person.participation.id));
    const dayLabel = area.dayScope === "saturday" ? "Samstag" : area.dayScope === "sunday" ? "Sonntag" : null;
    groups.push({ areaId: area.id, areaName: dayLabel ? `${area.name} · ${dayLabel}` : area.name, people });
  }

  return groups.map((group) => {
    const counts = new Map<string, number>();
    group.people.forEach((person) => {
      const size = getMarshalShirtSize(person) ?? "Ohne Größenangabe";
      counts.set(size, (counts.get(size) ?? 0) + 1);
    });
    return {
      areaId: group.areaId,
      areaName: group.areaName,
      peopleCount: group.people.length,
      sizes: [...counts.entries()]
        .map(([size, count]) => ({ size, count }))
        .sort((a, b) => shirtSizeRank(a.size) - shirtSizeRank(b.size) || a.size.localeCompare(b.size, "de", { numeric: true })),
    };
  });
}

function cleanShirtSize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const validSize = /^(?:(?:H|D|K|HERREN|DAMEN|KINDER)\s*[-/ ]\s*)?(?:XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|[2-6]XL|\d{2,3}(?:\s*\/\s*\d{2,3})?)$/i;
  return validSize.test(trimmed) ? trimmed : null;
}

function shirtSizeRank(size: string) {
  const normalized = size.toLocaleUpperCase("de").replace(/^([HDK])[- /]/, "");
  const rank = shirtSizeOrder.indexOf(normalized);
  return rank === -1 ? shirtSizeOrder.length : rank;
}
