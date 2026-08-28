import type {
  MarshalDay,
  MarshalPerson,
  MarshalWorkspace,
} from "@/types/admin-marshals";

const activeStatuses = new Set(["accepted", "pending", "tentative"]);

export function isConcreteEventAssignment(
  assignment: MarshalPerson["assignments"][number],
) {
  return Boolean(
    assignment.postId ||
      assignment.sectionId ||
      assignment.functionCode?.trim(),
  );
}

export function dayAbbreviation(day: MarshalDay | undefined) {
  if (!day) return "?";
  return day.dayKey === "saturday" ? "Sa" : "So";
}

function assignmentLabel(
  person: MarshalPerson,
  assignment: MarshalPerson["assignments"][number],
  workspace: MarshalWorkspace,
) {
  const day = workspace.days.find((item) => item.id === assignment.dayId);
  const post = workspace.posts.find((item) => item.id === assignment.postId);
  const section = workspace.sections.find(
    (item) => item.id === assignment.sectionId,
  );
  let detail = assignment.functionCode?.trim() || "Einsatz";
  if (post) detail = `SP ${post.code}`;
  else if (assignment.role === "section_leader" && section)
    detail = `AL${section.code}`;
  else if (assignment.role === "marshal" && section)
    detail = `SP ${section.code}`;
  return `${detail} ${dayAbbreviation(day)}`;
}

export function EventAssignmentBadges({
  person,
  workspace,
}: {
  person: MarshalPerson;
  workspace: MarshalWorkspace;
}) {
  const labels = person.assignments
    .filter(
      (assignment) =>
        activeStatuses.has(assignment.commitmentStatus) &&
        isConcreteEventAssignment(assignment),
    )
    .map((assignment) => assignmentLabel(person, assignment, workspace));
  if (!labels.length) return null;
  return (
    <span className="ml-2 inline-flex max-w-full flex-wrap items-center gap-1 align-middle">
      {labels.slice(0, 2).map((label, index) => (
        <span
          key={`${label}-${index}`}
          className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-600"
        >
          {label}
        </span>
      ))}
      {labels.length > 2 && (
        <span className="text-[10px] font-medium text-slate-500">
          +{labels.length - 2}
        </span>
      )}
    </span>
  );
}

export function sameDayConflicts(
  workspace: MarshalWorkspace,
  person: MarshalPerson,
  date: string,
  excluded: { dayId?: string; areaId?: string; shiftId?: string } = {},
) {
  const labels: string[] = [];
  person.assignments
    .filter(
      (assignment) =>
        assignment.dayId !== excluded.dayId &&
        activeStatuses.has(assignment.commitmentStatus) &&
        isConcreteEventAssignment(assignment),
    )
    .forEach((assignment) => {
      const day = workspace.days.find((item) => item.id === assignment.dayId);
      if (day?.eventDate !== date) return;
      const post = workspace.posts.find(
        (item) => item.id === assignment.postId,
      );
      const section = workspace.sections.find(
        (item) => item.id === assignment.sectionId,
      );
      labels.push(
        post
          ? `Posten ${post.code}`
          : assignment.role === "section_leader" && section
            ? `Abschnittsleitung ${section.code}`
            : assignment.functionCode || section?.name || "anderer Einsatz",
      );
    });
  workspace.shiftAssignments
    .filter(
      (assignment) =>
        assignment.shiftId !== excluded.shiftId &&
        assignment.participationId === person.participation.id &&
        activeStatuses.has(assignment.commitmentStatus),
    )
    .forEach((assignment) => {
      const shift = workspace.areaShifts.find(
        (item) => item.id === assignment.shiftId,
      );
      if (shift?.shiftDate === date) labels.push(shift.label);
    });
  workspace.areaAssignments
    .filter(
      (assignment) =>
        assignment.areaId !== excluded.areaId &&
        assignment.participationId === person.participation.id &&
        activeStatuses.has(assignment.commitmentStatus),
    )
    .forEach((assignment) => {
      const area = workspace.areas.find(
        (item) => item.id === assignment.areaId,
      );
      if (
        area?.dayScope &&
        workspace.days.find((day) => day.dayKey === area.dayScope)
          ?.eventDate === date
      )
        labels.push(area.name);
    });
  return [...new Set(labels)];
}

export function DoubleBookingWarning({
  labels,
  day,
}: {
  labels: string[];
  day: MarshalDay | undefined;
}) {
  if (!labels.length) return null;
  const text = `Bereits eingeteilt: ${labels.join(", ")} (${dayAbbreviation(day)})`;
  return (
    <span
      className="ml-1 inline-flex text-sm text-amber-500"
      role="img"
      aria-label={text}
      title={text}
    >
      ⚠
    </span>
  );
}
