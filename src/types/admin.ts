import type {
  AcceptanceStatus,
  ExportJobStatus,
  Id,
  OutboxStatus,
  PaymentStatus,
  RegistrationStatus,
  TechStatus,
  VehicleType
} from "@/types/common";

export type AdminEntryListItemDto = {
  id: Id;
  name: string;
  className: string;
  startNumber: string | null;
  acceptanceStatus: AcceptanceStatus;
  paymentStatus: PaymentStatus;
  checkinIdVerified: boolean;
  createdAt: string;
};

export type AdminEntriesListResponseDto = {
  ok: boolean;
  entries: AdminEntryListItemDto[];
  meta: {
    total: number;
  };
};

export type AdminEntryListItem = {
  id: Id;
  name: string;
  classLabel: string;
  startNumber: string;
  status: AcceptanceStatus;
  payment: PaymentStatus;
  checkin: "offen" | "bestätigt";
  createdAt: string;
};

export type AdminEntriesFilter = {
  query: string;
  classId: string;
  acceptanceStatus: "all" | AcceptanceStatus;
  paymentStatus: "all" | PaymentStatus;
  checkinIdVerified: "all" | "true" | "false";
};

export type AdminEntryDetailDto = {
  ids: {
    entryId: Id;
    eventId: Id;
    classId: Id;
    driverPersonId: Id;
    codriverPersonId: Id | null;
    vehicleId: Id;
    backupOfEntryId: Id | null;
  };
  className: string;
  registrationStatus: RegistrationStatus;
  acceptanceStatus: AcceptanceStatus;
  startNumberNorm: string | null;
  isBackupVehicle: boolean;
  relatedEntryIds: Id[];
  person: {
    driver: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    };
  };
  vehicle: {
    vehicleType: VehicleType;
    make: string | null;
    model: string | null;
    year: number | null;
    displacementCcm: number | null;
    engineType: string | null;
    cylinders: number | null;
    brakes: string | null;
    ownerName: string | null;
    vehicleHistory: string | null;
    imageS3Key: string | null;
  };
  payment: {
    totalCents: number;
    paidAmountCents: number;
    amountOpenCents: number;
    paymentStatus: PaymentStatus;
  };
  checkin: {
    checkinIdVerified: boolean;
    checkinIdVerifiedAt: string | null;
    checkinIdVerifiedBy: string | null;
    techStatus: TechStatus;
    techCheckedAt: string | null;
    techCheckedBy: string | null;
  };
  documents: Array<{
    id: Id;
    type: string;
    status: string;
    createdAt: string;
  }>;
  specialNotes: string | null;
  consent: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    mediaAccepted: boolean;
    consentVersion: string | null;
    consentCapturedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminEntryHistoryItem = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
};

export type AdminEntryDetailViewModel = {
  id: Id;
  headline: string;
  classLabel: string;
  startNumber: string;
  status: AcceptanceStatus;
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;
  checkinVerified: boolean;
  driver: {
    name: string;
    email: string;
  };
  vehicle: {
    label: string;
    facts: string[];
  };
  payment: {
    totalCents: number;
    paidAmountCents: number;
    amountOpenCents: number;
    status: PaymentStatus;
  };
  consent: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    mediaAccepted: boolean;
    consentVersion: string | null;
    consentCapturedAt: string | null;
  };
  documents: Array<{
    id: string;
    type: string;
    status: string;
  }>;
  relatedEntryIds: Id[];
  notes: string;
  history: AdminEntryHistoryItem[];
};

export type BroadcastForm = {
  classId: string;
  acceptanceStatus: "all" | AcceptanceStatus;
  paymentStatus: "all" | PaymentStatus;
  templateKey: string;
  subjectOverride: string;
};

export type OutboxItemDto = {
  id: Id;
  toEmail: string;
  subject: string;
  status: OutboxStatus;
  errorLast: string | null;
  createdAt: string;
};

export type OutboxItem = {
  id: Id;
  recipient: string;
  subject: string;
  status: OutboxStatus;
  error: string;
  createdAt: string;
};

export type AdminExportType = "entries_csv" | "startlist_csv" | "participants_csv" | "payments_open_csv" | "checkin_status_csv";

export type ExportCreateForm = {
  type: AdminExportType;
  classId: string;
  acceptanceStatus: "all" | AcceptanceStatus;
  format: "csv";
};

export type ExportJobDto = {
  id: Id;
  type: AdminExportType;
  status: ExportJobStatus;
  createdAt: string;
};

export type ExportJob = {
  id: Id;
  type: AdminExportType;
  status: ExportJobStatus;
  createdAt: string;
};
