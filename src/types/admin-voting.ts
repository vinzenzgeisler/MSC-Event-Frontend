export type VotingMode = "auto" | "forced_open" | "forced_closed";
export type CandidateOverrideState = "auto" | "pinned" | "hidden";

export type EventHubConfig = {
  eventId: string;
  votingOpensAt: string | null;
  votingClosesAt: string | null;
  votingMode: VotingMode;
  venueLat: string | null;
  venueLng: string | null;
};

export type VotingResultEntry = {
  rank: number;
  entryId: string;
  startNumberNorm: string | null;
  driverName: string;
  voteCount: number;
  percent: number;
};

export type VotingResultsClass = {
  classId: string;
  className: string;
  entries: VotingResultEntry[];
};

export type VotingResults = {
  classes: VotingResultsClass[];
  invalidVoteCount: number;
};

export type CandidateExclusionReason =
  | "processing_restricted"
  | "objection_flag"
  | "publication_name_protected"
  | "hidden"
  | null;

export type AdminCandidate = {
  entryId: string;
  classId: string;
  className: string;
  startNumberNorm: string | null;
  driverName: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  overrideState: CandidateOverrideState;
  featured: boolean;
  eligible: boolean;
  exclusionReason: CandidateExclusionReason;
};
