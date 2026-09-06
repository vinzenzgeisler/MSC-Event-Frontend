export type MarshalCommitmentStatus = "not_asked" | "pending" | "accepted" | "declined" | "tentative";

export type MarshalEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  isCurrent: boolean;
  marshalSetupState?: "missing" | "ready";
  marshalSourceEventId?: string | null;
};

export type MarshalDay = { id: string; eventId: string; dayKey: "saturday" | "sunday"; label: string; eventDate: string };
export type MarshalSection = { id: string; eventId: string; code: string; name: string; leaderCode: string; leaderTargetStaff?: number; sortOrder: number };
export type MarshalPost = {
  id: string;
  eventId: string;
  sectionId: string;
  code: string;
  description: string | null;
  targetStaff: number;
  /** Optional until every backend environment exposes the planning fields. */
  emergencyTargetStaff?: number;
  /** Schematic coordinate (0–1000); null uses the deterministic fallback. */
  mapX?: number | null;
  /** Schematic coordinate (0–1000); null uses the deterministic fallback. */
  mapY?: number | null;
  isActive: boolean;
  sortOrder: number;
};
export type MarshalAssignment = {
  id: string; participationId: string; dayId: string; commitmentStatus: MarshalCommitmentStatus;
  role: "marshal" | "section_leader" | "special" | null; sectionId: string | null; postId: string | null;
  functionCode: string | null; note: string | null;
};
export type MarshalParticipation = {
  id: string; eventId: string; personId: string; contactOwner: string | null; wish: string | null;
  note: string | null; shirtSizeSnapshot: string | null;
};
export type MarshalPerson = {
  id: string; helperNumber: number; firstName: string; lastName: string; street: string | null; zip: string | null;
  city: string | null; birthdate: string | null; phone: string | null; email: string | null; shirtSize: string | null;
  clubMember: boolean; licenseNumber: string | null; vehicleRegistration: string | null; activityAreas: string[];
  note: string | null; isActive: boolean; noDeployment: boolean; participation: MarshalParticipation; assignments: MarshalAssignment[];
};
export type MarshalTraining = {
  id: string; eventId: string; sessionType: "training" | "briefing"; title: string; sessionDate: string;
  location: string | null; note: string | null;
};
export type MarshalTrainingParticipant = { id: string; sessionId: string; personId: string; attendanceStatus: "registered" | "attended" | "absent" | "excused"; note: string | null };
export type MarshalQualification = { id: string; personId: string; qualificationType: string; number: string | null; validFrom: string | null; validUntil: string | null; note: string | null };
export type MarshalWorkspace = {
  people: MarshalPerson[]; days: MarshalDay[]; sections: MarshalSection[]; posts: MarshalPost[];
  trainings: MarshalTraining[]; trainingParticipants: MarshalTrainingParticipant[]; qualifications: MarshalQualification[];
  areas: MarshalHelperArea[]; areaShifts: MarshalAreaShift[]; shiftAssignments: MarshalShiftAssignment[];
  areaAssignments: MarshalAreaAssignment[];
  revision?: string;
  updatedAt?: string;
};

export type MarshalStructurePreview = {
  sourceEvent: Pick<MarshalEvent, "id" | "name" | "startsAt" | "endsAt">;
  targetEvent: Pick<MarshalEvent, "id" | "name" | "startsAt" | "endsAt">;
  sections: number;
  posts: Array<{
    code: string;
    sectionCode: string;
    description: string | null;
    targetStaff: number;
    emergencyTargetStaff: number;
    assignedStaff: 0;
  }>;
  areas: number;
  shifts: Array<{ areaCode: string; label: string; sourceDate: string; targetDate: string }>;
};

export type MarshalHelperArea = {
  id: string;
  eventId: string;
  code: string;
  name: string;
  areaType: "setup" | "general";
  dayScope: "saturday" | "sunday" | null;
  sortOrder: number;
  responsibleLabel: string | null;
};

export type MarshalAreaShift = {
  id: string;
  areaId: string;
  label: string;
  shiftDate: string;
  sortOrder: number;
};

export type MarshalShiftAssignment = {
  id: string;
  participationId: string;
  shiftId: string;
  commitmentStatus: MarshalCommitmentStatus;
  note: string | null;
};

export type MarshalAreaAssignment = {
  id: string;
  participationId: string;
  areaId: string;
  commitmentStatus: MarshalCommitmentStatus;
  note: string | null;
};

export type MarshalPersonInput = {
  firstName: string;
  lastName: string;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  birthdate?: string | null;
  phone?: string | null;
  email?: string | null;
  shirtSize?: string | null;
  clubMember?: boolean;
  licenseNumber?: string | null;
  vehicleRegistration?: string | null;
  activityAreas?: string[];
  note?: string | null;
  isActive?: boolean;
  noDeployment?: boolean;
};

export type MarshalPersonPatch = Partial<MarshalPersonInput> & {
  isActive?: boolean;
  noDeployment?: boolean;
};

export type MarshalInitialEventAssignment =
  | { kind: "none" }
  | { kind: "area"; areaId: string; commitmentStatus: MarshalCommitmentStatus }
  | { kind: "track"; dayId: string; commitmentStatus: MarshalCommitmentStatus };

export type MarshalDayAssignmentInput = {
  dayId: string;
  commitmentStatus: MarshalCommitmentStatus;
  role?: "marshal" | "section_leader" | "special" | null;
  sectionId?: string | null;
  postId?: string | null;
  functionCode?: string | null;
  note?: string | null;
};

export type MarshalAssignmentInput = {
  eventId: string;
  contactOwner?: string | null;
  wish?: string | null;
  note?: string | null;
  shirtSizeSnapshot?: string | null;
  days: MarshalDayAssignmentInput[];
};

export type MarshalAreaConfigAreaInput = Omit<MarshalHelperArea, "id" | "eventId">;
export type MarshalAreaConfigShiftInput = {
  areaCode: string;
  label: string;
  shiftDate: string;
  sortOrder: number;
};

export type MarshalAreaConfigInput = {
  eventId: string;
  areas: MarshalAreaConfigAreaInput[];
  shifts: MarshalAreaConfigShiftInput[];
};

export type MarshalPrintParams = {
  eventId: string;
  type: "attendance" | "section" | "training" | "area" | "shirt_statistics";
  dayId?: string;
  sectionId?: string;
  trainingId?: string;
  areaId?: string;
  shiftId?: string;
  orientation?: "portrait";
  sort?: "name" | "post_name";
};

export type MarshalPostConfigInput = {
  sectionCode: string;
  code: string;
  description: string | null;
  targetStaff: number;
  emergencyTargetStaff: number;
  mapX: number | null;
  mapY: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type MarshalSectionConfigInput = {
  code: string;
  name: string;
  leaderCode: string;
  leaderTargetStaff: number;
  sortOrder: number;
};

export type MarshalImportPreview = {
  sha256: string;
  summary: { people: number; lauferPeople?: number; newPeople: number; updatedPeople: number; eventParticipations: number; historicalAssignments: number; trainings: number; trainingParticipants: number; conflicts: number };
  conflicts: Array<{ sheet: string; row: number; message: string }>;
};
