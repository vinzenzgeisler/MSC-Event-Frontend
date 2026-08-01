export type MarshalCommitmentStatus = "not_asked" | "pending" | "accepted" | "declined" | "tentative";

export type MarshalDay = { id: string; eventId: string; dayKey: "saturday" | "sunday"; label: string; eventDate: string };
export type MarshalSection = { id: string; eventId: string; code: string; name: string; leaderCode: string; sortOrder: number };
export type MarshalPost = { id: string; eventId: string; sectionId: string; code: string; description: string | null; targetStaff: number; isActive: boolean; sortOrder: number };
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
  note: string | null; isActive: boolean; participation: MarshalParticipation; assignments: MarshalAssignment[];
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
};

export type MarshalImportPreview = {
  sha256: string;
  summary: { people: number; newPeople: number; updatedPeople: number; eventParticipations: number; historicalAssignments: number; trainings: number; trainingParticipants: number; conflicts: number };
  conflicts: Array<{ sheet: string; row: number; message: string }>;
};
