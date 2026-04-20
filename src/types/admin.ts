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
  eventId?: Id;
  classId?: Id;
  groupId?: Id | null;
  groupSize?: number | null;
  vehicleId?: Id;
  name?: string;
  className?: string;
  startNumber?: string | null;
  startNumberNorm?: string | null;
  driverPersonId?: Id;
  driverFirstName?: string | null;
  driverLastName?: string | null;
  driverEmail?: string | null;
  orgaCode?: string | null;
  vehicleLabel: string;
  vehicleThumbUrl: string | null;
  acceptanceStatus: AcceptanceStatus;
  paymentStatus: PaymentStatus | null;
  checkinIdVerified: boolean;
  confirmationMailVerified?: boolean;
  confirmationMailSent: boolean;
  internalNote?: string | null;
  driverNote?: string | null;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  deletedByDisplay?: string | null;
  deletedBy?: string | null;
  deleteReason?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type AdminEntriesListResponseDto = {
  ok: boolean;
  entries: AdminEntryListItemDto[];
  meta: ListMeta;
};

export type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type AdminEntryListItem = {
  id: Id;
  classId?: Id;
  name: string;
  orgaCode: string;
  driverPersonIdRaw: string;
  driverEmailRaw: string;
  groupIdRaw: string;
  groupSizeRaw: number;
  classLabel: string;
  startNumber: string;
  vehicleLabel: string;
  vehicleThumbUrl: string | null;
  status: AcceptanceStatus;
  registrationStatus: RegistrationStatus;
  payment: PaymentStatus;
  checkin: "offen" | "bestätigt";
  confirmationMailSent: boolean;
  confirmationMailVerified: boolean;
  driverNote: string;
  createdAt: string;
  createdAtRaw: string;
  updatedAtRaw: string;
  driverFirstNameRaw: string;
  driverLastNameRaw: string;
  classNameRaw: string;
  startNumberNormRaw: string;
};

export type AdminEntriesPageResult = {
  entries: AdminEntryListItem[];
  meta: ListMeta;
};

export type AdminDeletedEntryListItem = {
  id: Id;
  classId?: Id;
  name: string;
  classLabel: string;
  startNumber: string;
  vehicleLabel: string;
  status: AcceptanceStatus;
  payment: PaymentStatus;
  deletedAt: string;
  deletedBy: string;
  deleteReason: string;
};

export type AdminDeletedEntriesPageResult = {
  entries: AdminDeletedEntryListItem[];
  meta: ListMeta;
};

export type AdminEntriesFilter = {
  query: string;
  classId: string;
  acceptanceStatus: "all" | AcceptanceStatus;
  registrationStatus: "all" | RegistrationStatus;
  paymentStatus: "all" | PaymentStatus;
  checkinIdVerified: "all" | "true" | "false";
  sortBy: "createdAt" | "updatedAt" | "driverLastName" | "driverFirstName" | "className" | "startNumberNorm";
  sortDir: "asc" | "desc";
};

export type AdminEntryDetailDto = {
  ids: {
    entryId: Id;
    eventId: Id;
    classId: Id;
    driverPersonId: Id;
    codriverPersonId: Id | null;
    vehicleId: Id;
    backupOfEntryId?: Id | null;
    backupVehicleId?: Id | null;
  };
  className: string;
  registrationStatus: RegistrationStatus;
  acceptanceStatus: AcceptanceStatus;
  orgaCode?: string | null;
  startNumberNorm: string | null;
  isBackupVehicle: boolean;
  relatedEntryIds: Id[];
  vehicleLabel?: string;
  vehicleThumbUrl?: string | null;
  confirmationMailSent?: boolean;
  confirmationMailVerified?: boolean;
  person: {
    driver: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      birthdate: string | null;
      country?: string | null;
      phone: string | null;
      street: string | null;
      zip: string | null;
      city: string | null;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
      motorsportHistory?: string | null;
    };
    codriver?: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      birthdate: string | null;
      country?: string | null;
      phone: string | null;
      street: string | null;
      zip: string | null;
      city: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
      motorsportHistory?: string | null;
    } | null;
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
  backupVehicle?: {
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
  } | null;
  backupVehicleThumbUrl?: string | null;
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
  internalNote?: string | null;
  driverNote?: string | null;
  consent: {
    termsAccepted: boolean;
    privacyAccepted: boolean;
    waiverAccepted?: boolean;
    mediaAccepted: boolean;
    clubInfoAccepted?: boolean;
    guardian?: {
      fullName: string | null;
      email: string | null;
      phone: string | null;
      consentAccepted: boolean;
    } | null;
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
  eventId: Id;
  classId: Id;
  headline: string;
  classLabel: string;
  startNumber: string;
  orgaCode: string;
  status: AcceptanceStatus;
  paymentStatus: PaymentStatus;
  registrationStatus: RegistrationStatus;
  createdAt: string;
  isBackupVehicle: boolean;
  checkinVerified: boolean;
  driver: {
    name: string;
    email: string;
    birthdate: string;
    country: string;
    phone: string;
    street: string;
    zip: string;
    city: string;
    addressLine: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    motorsportHistory: string;
  };
  codriver: {
    assigned: boolean;
    label: string;
    firstName: string;
    lastName: string;
    email: string;
    birthdate: string;
    country: string;
    phone: string;
    street: string;
    zip: string;
    city: string;
    addressLine: string;
  };
  vehicle: {
    label: string;
    thumbUrl: string | null;
    type: VehicleType;
    make: string;
    model: string;
    year: string;
    displacementCcm: string;
    cylinders: string;
    ownerName: string;
    vehicleHistory: string;
  };
  backupVehicle: {
    assigned: boolean;
    label: string;
    thumbUrl: string | null;
    type: VehicleType;
    make: string;
    model: string;
    year: string;
    displacementCcm: string;
    cylinders: string;
    ownerName: string;
    vehicleHistory: string;
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
    waiverAccepted: boolean;
    mediaAccepted: boolean;
    clubInfoAccepted: boolean;
    guardian: {
      present: boolean;
      fullName: string;
      email: string;
      phone: string;
      consentAccepted: boolean;
    };
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
  confirmationMailSent: boolean;
  confirmationMailVerified: boolean;
  internalNote: string;
  driverNote: string;
  history: AdminEntryHistoryItem[];
};

export type BroadcastForm = {
  classId: string;
  acceptanceStatus: "all" | AcceptanceStatus;
  registrationStatus: "all" | "submitted_unverified" | "submitted_verified";
  paymentStatus: "all" | PaymentStatus;
  templateKey: string;
  subjectOverride: string;
};

export type MailTemplateStatus = "draft" | "published";
export type MailTemplateScope = "process" | "campaign";
export type MailTemplateChannel = "campaign" | "detail" | "quick_action";
export type MailTemplateComposerField = {
  key: string;
  label: string;
  type: "text" | "url";
  required: boolean;
  multiline: boolean;
  placeholder: string;
  helpText: string;
  defaultValue?: string;
};

export type MailTemplateComposer = {
  enabled: boolean;
  fields: MailTemplateComposerField[];
  allowedPlaceholders: string[];
  requiredPlaceholders: string[];
};

export type MailTemplateRenderOptions = {
  showBadgeDefault: boolean;
  defaultMailLabel: string | null;
  includeEntryContextDefault?: boolean;
};

export type MailRenderOptionsInput = {
  showBadge?: boolean;
  mailLabel?: string | null;
  includeEntryContext?: boolean;
};

export type MailTemplate = {
  key: string;
  label: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  version: number;
  status: MailTemplateStatus;
  updatedAt: string | null;
  updatedBy: string | null;
  isActive: boolean;
  scope: MailTemplateScope;
  channels: MailTemplateChannel[];
  composer: MailTemplateComposer;
  renderOptions: MailTemplateRenderOptions;
};

export type MailTemplatePlaceholder = {
  name: string;
  required: boolean;
  description: string;
  example: string;
};

export type MailTemplatePreview = {
  ok: true;
  templateKey: string;
  subjectRendered: string;
  bodyTextRendered: string;
  bodyHtmlRendered: string;
  htmlDocument: string;
  usedPlaceholders: string[];
  missingPlaceholders: string[];
  unknownPlaceholders: string[];
  warnings: string[];
  attachments: MailAttachmentDescriptor[];
};

export type MailAttachmentDescriptor = {
  fileName: string;
  contentType: "application/pdf";
  fileSizeBytes: number | null;
};

export type MailAttachmentUploadInitResponse = {
  ok: true;
  uploadId: string;
  eventId: string;
  fileName: string;
  contentType: "application/pdf";
  fileSizeBytes: number;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

export type MailAttachmentUploadFinalizeResponse = {
  ok: true;
  uploadId: string;
  eventId: string;
  fileName: string;
  contentType: "application/pdf";
  fileSizeBytes: number;
  status: "finalized";
};

export type ResolveRecipientsResult = {
  ok: true;
  resolvedRecipients: string[];
  invalidEmails: string[];
  duplicatesRemoved: number;
  finalCount: number;
};

export type MailRecipientSearchItem = {
  driverPersonId: string;
  driverName: string;
  driverEmail: string;
  entryId: string;
  className: string;
  startNumber: string;
};

export type OutboxItemDto = {
  id: Id;
  eventId?: Id | null;
  batchId?: string | null;
  toEmail: string;
  subject: string;
  status: OutboxStatus;
  templateId?: string;
  templateVersion?: number;
  attemptCount?: number;
  maxAttempts?: number;
  sendAfter?: string;
  errorLast: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type OutboxItem = {
  id: Id;
  batchId?: string | null;
  recipient: string;
  subject: string;
  status: OutboxStatus;
  error: string;
  createdAt: string;
  createdAtRaw: string;
  templateId?: string;
  templateVersion?: number;
  attemptCount?: number;
  maxAttempts?: number;
  sendAfter?: string;
};

export type EntryMailAction = "payment_reminder" | "registration_confirmation";

export type AdminExportType = "entries_csv" | "startlist_csv" | "participants_csv" | "payments_open_csv" | "checkin_status_csv";

export type ExportCreateForm = {
  type: AdminExportType;
  classId: string;
  acceptanceStatus: "all" | AcceptanceStatus;
  format: "csv";
};

export type ExportJobDto = {
  id: Id;
  eventId?: Id;
  type: AdminExportType;
  filters?: Record<string, unknown>;
  status: ExportJobStatus;
  s3Key?: string | null;
  errorLast?: string | null;
  createdBy?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type ExportJob = {
  id: Id;
  type: AdminExportType;
  status: ExportJobStatus;
  createdAt: string;
};
