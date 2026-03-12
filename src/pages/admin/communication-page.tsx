import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { outboxStatusClasses, outboxStatusLabel, paymentStatusLabel } from "@/lib/admin-status";
import { adminEntriesService } from "@/services/admin-entries.service";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";
import { communicationService } from "@/services/communication.service";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import type {
  AdminEntriesFilter,
  BroadcastForm,
  MailRecipientSearchItem,
  MailTemplate,
  MailTemplateComposerField,
  MailTemplatePlaceholder,
  MailTemplatePreview,
  OutboxItem,
  ResolveRecipientsResult
} from "@/types/admin";

const initialForm: BroadcastForm = {
  classId: "all",
  acceptanceStatus: "all",
  registrationStatus: "all",
  paymentStatus: "all",
  templateKey: "",
  subjectOverride: ""
};

const OUTBOX_PREVIEW_LIMIT = 10;
const TEMPLATE_DRAFTS_STORAGE_KEY = "msc.communication.template-drafts.v1";
const OUTBOX_STATUS_ORDER = ["failed", "sending", "queued", "sent"] as const;
const ATTACHMENT_MAX_FILES = 3;
const ATTACHMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const QUICK_ACTION_PAGE_LIMIT = 100;

type TemplateDrafts = Record<string, { subject: string; body: string; data?: Record<string, string> }>;
type StaticTemplateOption = { key: string; label: string };
type RecipientTarget = { id: string; label: string; previewEntryId?: string };
type RecipientSearchItem = MailRecipientSearchItem;
type RecipientMode = "filter" | "individual" | "combined";
type ToastTone = "success" | "error" | "info";

type OutboxGroup = {
  key: string;
  subject: string;
  createdAt: string;
  createdAtRaw: string;
  templateId?: string;
  templateVersion?: number;
  sendAfter?: string;
  counts: Record<OutboxItem["status"], number>;
  items: OutboxItem[];
};

function toMinuteBucket(value: string): number {
  const parsed = new Date(value);
  const ts = Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
  return Math.floor(ts / 60000);
}

function outboxGroupKey(item: OutboxItem): string {
  const batchId = (item.batchId ?? "").trim();
  if (batchId) {
    return `batch:${batchId}`;
  }
  const subject = item.subject ?? "";
  const templateId = item.templateId ?? "";
  const templateVersion = item.templateVersion ?? "";
  const sendAfter = item.sendAfter ?? "";
  return `heur:${templateId}:${templateVersion}:${subject}:${sendAfter}:${toMinuteBucket(item.createdAtRaw)}`;
}

function emptyOutboxCounts(): Record<OutboxItem["status"], number> {
  return { queued: 0, sending: 0, sent: 0, failed: 0 };
}

function parseEmailList(value: string) {
  const parts = value
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  parts.forEach((email) => {
    if (seen.has(email)) {
      return;
    }
    seen.add(email);
    unique.push(email);
  });

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    valid: unique.filter((email) => emailPattern.test(email)),
    invalid: unique.filter((email) => !emailPattern.test(email))
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyTextToHtml(value: string) {
  const source = value.trim();
  if (!source) {
    return "";
  }
  return source
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function normalizeTemplateOption(template: MailTemplate): StaticTemplateOption {
  return {
    key: template.key,
    label: template.label || template.key
  };
}

function isCampaignTemplate(template: MailTemplate) {
  if (template.scope === "campaign") {
    return true;
  }
  if (Array.isArray(template.channels) && template.channels.includes("campaign")) {
    return true;
  }
  return false;
}

function getCommunicationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().toLowerCase() === "failed to fetch") {
    return "API nicht erreichbar. Bitte Verbindung, CORS und API-Deployment prüfen.";
  }
  return getApiErrorMessage(error, fallback);
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function getMissingPlaceholdersMessage(error: ApiError): string | null {
  const code = (error.code ?? "").trim().toUpperCase();
  if (code !== "MISSING_REQUIRED_PLACEHOLDERS") {
    return null;
  }

  const details = error.details ?? {};
  const missing = readStringList(
    (details.missingPlaceholders as unknown) ??
      (details.missing as unknown) ??
      (details.requiredPlaceholders as unknown) ??
      (details.placeholders as unknown)
  );

  const recipientCandidates = [
    details.recipient,
    details.toEmail,
    details.email,
    details.recipientEmail,
    details.driverEmail
  ];
  const recipient = recipientCandidates.find((item) => typeof item === "string" && item.trim());
  const recipientText = typeof recipient === "string" ? recipient.trim() : "";

  if (missing.length === 0) {
    return recipientText
      ? `Pflicht-Platzhalter fehlen beim Versand für ${recipientText}.`
      : "Pflicht-Platzhalter fehlen beim Versand.";
  }

  return recipientText
    ? `Pflicht-Platzhalter fehlen beim Versand für ${recipientText}: ${missing.join(", ")}.`
    : `Pflicht-Platzhalter fehlen beim Versand: ${missing.join(", ")}.`;
}

function dynamicFieldLabel(key: string, fields: MailTemplateComposerField[]) {
  return fields.find((field) => field.key === key)?.label ?? key;
}

function defaultTemplateDataFromComposer(template: MailTemplate | null | undefined): Record<string, string> {
  if (!template?.composer?.enabled || !Array.isArray(template.composer.fields)) {
    return {};
  }
  return template.composer.fields.reduce<Record<string, string>>((acc, field) => {
    if (typeof field.defaultValue === "string" && field.defaultValue.length > 0) {
      acc[field.key] = field.defaultValue;
    }
    return acc;
  }, {});
}

function hasStructuredComposer(template: MailTemplate | null | undefined) {
  if (!template?.composer?.enabled) {
    return false;
  }
  return Array.isArray(template.composer.fields) && template.composer.fields.length > 0;
}

function fieldInputType(field: MailTemplateComposerField): "text" | "url" | "date" {
  const key = (field.key || "").toLowerCase();
  if (key.includes("date") || key.includes("deadline")) {
    return "date";
  }
  return field.type === "url" ? "url" : "text";
}

function uniqueRecipientsPreview(items: OutboxItem[], limit: number) {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const email = (item.recipient ?? "").trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    unique.push(email);
    if (unique.length >= limit) break;
  }
  return unique;
}

function normalizeOverrideComparison(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export function AdminCommunicationPage() {
  const { roles } = useAuth();
  const canManageCommunication = hasPermission(roles, "communication.write");
  const [form, setForm] = useState<BroadcastForm>(initialForm);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("combined");
  const [quickActionBusy, setQuickActionBusy] = useState<null | "verification" | "payment">(null);
  const [quickActionConfirm, setQuickActionConfirm] = useState<null | {
    kind: "verification" | "payment";
    label: string;
    entryIds: string[];
    finalCount: number;
  }>(null);
  const [confirmingQuickAction, setConfirmingQuickAction] = useState(false);
  const [includeEntryContext, setIncludeEntryContext] = useState(true);
  const [templateBody, setTemplateBody] = useState("");
  const [templateDataDraft, setTemplateDataDraft] = useState<Record<string, string>>({});
  const templateDraftsRef = useRef<TemplateDrafts>({});
  const [additionalEmailsInput, setAdditionalEmailsInput] = useState("");
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [recipientSearchResults, setRecipientSearchResults] = useState<RecipientSearchItem[]>([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [selectedDriverTargets, setSelectedDriverTargets] = useState<RecipientTarget[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [eventName, setEventName] = useState("");
  const [templateOptions, setTemplateOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [templatesByKey, setTemplatesByKey] = useState<Map<string, MailTemplate>>(new Map());
  const [templatePlaceholders, setTemplatePlaceholders] = useState<MailTemplatePlaceholder[]>([]);
  const [backendPreview, setBackendPreview] = useState<MailTemplatePreview | null>(null);
  const [resolvedRecipients, setResolvedRecipients] = useState<ResolveRecipientsResult | null>(null);
  const [outboxExpanded, setOutboxExpanded] = useState(false);
  const [expandedOutboxGroups, setExpandedOutboxGroups] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [loadingOutbox, setLoadingOutbox] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentUploadIds, setAttachmentUploadIds] = useState<string[]>([]);
  const [attachmentDrafts, setAttachmentDrafts] = useState<Array<{ uploadId: string; fileName: string; fileSizeBytes: number }>>([]);
  const previewErrorToastRef = useRef("");
  const recipientSearchErrorToastRef = useRef("");
  const searchRequestRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string, tone: ToastTone = "error") => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const loadOutbox = async (options?: { silentError?: boolean }) => {
    if (!options?.silentError) {
      setLoadingOutbox(true);
    }
    try {
      setOutbox(await communicationService.listOutbox());
    } catch (error) {
      if (!options?.silentError) {
        showToast(getCommunicationErrorMessage(error, "Postausgang konnte nicht geladen werden."));
      }
    } finally {
      if (!options?.silentError) {
        setLoadingOutbox(false);
      }
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const templates = await communicationService.listTemplates();
      const campaignTemplates = templates.filter((item) => item.isActive !== false && isCampaignTemplate(item));
      const nextTemplatesByKey = new Map(campaignTemplates.map((item) => [item.key, item]));
      const mappedOptions = campaignTemplates.map(normalizeTemplateOption);
      setTemplateOptions(mappedOptions);
      setTemplatesByKey(nextTemplatesByKey);
      if (form.templateKey && !nextTemplatesByKey.has(form.templateKey)) {
        setForm((prev) => ({ ...prev, templateKey: "", subjectOverride: "" }));
        setTemplateBody("");
        setTemplateDataDraft({});
      }
    } catch (error) {
      showToast(getCommunicationErrorMessage(error, "Mail-Templates konnten nicht geladen werden."));
      setTemplateOptions([]);
      setTemplatesByKey(new Map());
    } finally {
      setLoadingTemplates(false);
    }
  };

  const resolveSubject = (subject: string) => {
    if (!subject.includes("{{")) {
      return subject;
    }
    const fallback = eventName.trim() || "Aktuelles Event";
    return subject.replace(/\{\{\s*eventName\s*\}\}/gi, fallback);
  };

  const selectedTemplate = useMemo(() => {
    if (!form.templateKey) {
      return null;
    }
    return templatesByKey.get(form.templateKey) ?? null;
  }, [form.templateKey, templatesByKey]);
  const composerFields = useMemo(() => {
    if (!selectedTemplate?.composer?.enabled) {
      return [] as MailTemplateComposerField[];
    }
    return Array.isArray(selectedTemplate.composer.fields) ? selectedTemplate.composer.fields : [];
  }, [selectedTemplate]);
  const structuredComposerTemplate = useMemo(() => hasStructuredComposer(selectedTemplate), [selectedTemplate]);
  const placeholderDrivenKeys = useMemo(() => {
    const allowed = selectedTemplate?.composer?.allowedPlaceholders ?? [];
    const required = selectedTemplate?.composer?.requiredPlaceholders ?? [];
    return new Set<string>([...allowed, ...required].map((key) => (key ?? "").trim().toLowerCase()).filter(Boolean));
  }, [selectedTemplate]);
  const requiredDynamicFields = useMemo(() => composerFields.filter((field) => field.required).map((field) => field.key), [composerFields]);
  const missingRequiredDynamicFields = useMemo(
    () => requiredDynamicFields.filter((fieldKey) => !(templateDataDraft[fieldKey] ?? "").trim()),
    [requiredDynamicFields, templateDataDraft]
  );
  const sendBlockedByTemplateData = missingRequiredDynamicFields.length > 0;

  const additionalRecipients = useMemo(() => parseEmailList(additionalEmailsInput), [additionalEmailsInput]);
  const selectedDriverPersonIds = useMemo(() => selectedDriverTargets.map((target) => target.id), [selectedDriverTargets]);
  const selectedEntryIds = useMemo(
    () => selectedDriverTargets.map((target) => target.previewEntryId).filter((id): id is string => Boolean(id)),
    [selectedDriverTargets]
  );
  const subjectOverrideValue = useMemo(() => {
    const current = normalizeOverrideComparison(form.subjectOverride);
    if (!current) {
      return undefined;
    }
    if (!selectedTemplate) {
      return current;
    }
    const templateDefault = normalizeOverrideComparison(selectedTemplate.subject ?? "");
    return current === templateDefault ? undefined : current;
  }, [form.subjectOverride, selectedTemplate]);
  const bodyOverrideValue = useMemo(() => {
    if (structuredComposerTemplate) {
      return undefined;
    }
    const current = normalizeOverrideComparison(templateBody);
    if (!current) {
      return undefined;
    }
    if (!selectedTemplate) {
      return current;
    }
    const templateDefault = normalizeOverrideComparison(selectedTemplate.bodyText ?? "");
    return current === templateDefault ? undefined : current;
  }, [selectedTemplate, structuredComposerTemplate, templateBody]);
  const bodyHtmlOverrideValue = useMemo(() => {
    if (!bodyOverrideValue) {
      return undefined;
    }
    return bodyTextToHtml(templateBody) || undefined;
  }, [bodyOverrideValue, templateBody]);
  const templateDataValue = useMemo(() => {
    const payload = Object.entries(templateDataDraft).reduce<Record<string, string>>((acc, [key, rawValue]) => {
      if (typeof rawValue !== "string") {
        return acc;
      }
      const trimmed = rawValue.trim();
      if (!trimmed) {
        return acc;
      }
      acc[key] = rawValue;
      return acc;
    }, {});
    return Object.keys(payload).length > 0 ? payload : undefined;
  }, [templateDataDraft]);
  const allowFilterRecipients = recipientMode === "filter" || recipientMode === "combined";
  const allowIndividualRecipients = recipientMode === "individual" || recipientMode === "combined";
  const previewEntryId = useMemo(() => {
    if (!allowIndividualRecipients) {
      return undefined;
    }
    return selectedDriverTargets.find((item) => item.previewEntryId)?.previewEntryId;
  }, [allowIndividualRecipients, selectedDriverTargets]);
  const templateExistsInBackend = useMemo(() => {
    if (!form.templateKey) {
      return true;
    }
    return templatesByKey.has(form.templateKey);
  }, [form.templateKey, templatesByKey]);
  const availableCampaignTemplateKeys = useMemo(() => {
    const fromBackend = new Set<string>();
    templatesByKey.forEach((template) => {
      if (isCampaignTemplate(template)) {
        fromBackend.add(template.key);
      }
    });
    return fromBackend;
  }, [templatesByKey]);
  const sendBlockedByRecipientSelection = allowIndividualRecipients && !allowFilterRecipients && selectedDriverPersonIds.length === 0 && additionalRecipients.valid.length === 0;
  const sendBlockedByMissingPlaceholders = Boolean(
    backendPreview && backendPreview.missingPlaceholders && backendPreview.missingPlaceholders.length > 0
  );
  const attachmentTotalBytes = useMemo(
    () => attachmentDrafts.reduce((sum, item) => sum + item.fileSizeBytes, 0),
    [attachmentDrafts]
  );
  const recipientSearchActive = recipientSearchQuery.trim().length >= 2;
  const outboxGroups = useMemo<OutboxGroup[]>(() => {
    const groupsByKey = new Map<string, OutboxGroup>();
    const order: string[] = [];

    outbox.forEach((item) => {
      const key = outboxGroupKey(item);
      const existing = groupsByKey.get(key);
      if (existing) {
        existing.items.push(item);
        existing.counts[item.status] += 1;
        return;
      }

      const group: OutboxGroup = {
        key,
        subject: item.subject,
        createdAt: item.createdAt,
        createdAtRaw: item.createdAtRaw,
        templateId: item.templateId,
        templateVersion: item.templateVersion,
        sendAfter: item.sendAfter,
        counts: emptyOutboxCounts(),
        items: [item]
      };
      group.counts[item.status] += 1;
      groupsByKey.set(key, group);
      order.push(key);
    });

    return order.map((key) => groupsByKey.get(key)!).filter(Boolean);
  }, [outbox]);

  const hiddenOutboxCount = Math.max(outboxGroups.length - OUTBOX_PREVIEW_LIMIT, 0);
  const visibleOutboxGroups = outboxExpanded ? outboxGroups : outboxGroups.slice(0, OUTBOX_PREVIEW_LIMIT);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEMPLATE_DRAFTS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as TemplateDrafts;
      if (parsed && typeof parsed === "object") {
        templateDraftsRef.current = parsed;
      }
    } catch {
      templateDraftsRef.current = {};
    }
  }, []);

  useEffect(() => {
    void loadOutbox();
    void loadTemplates();

    const refreshTimer = window.setInterval(() => {
      void loadOutbox({ silentError: true });
    }, 15000);

    adminMetaService
      .getCurrentEvent()
      .then((event) => setEventName(event.name ?? ""))
      .catch(() => setEventName(""));

    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getCommunicationErrorMessage(error, "Klassen konnten nicht geladen werden.")));

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (!form.templateKey) {
      setTemplatePlaceholders([]);
      setBackendPreview(null);
      setResolvedRecipients(null);
      return;
    }

    let cancelled = false;
    setLoadingPlaceholders(true);
    communicationService
      .listTemplatePlaceholders(form.templateKey)
      .then((items) => {
        if (!cancelled) {
          setTemplatePlaceholders(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplatePlaceholders([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPlaceholders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.templateKey]);

  useEffect(() => {
    if (!form.templateKey) {
      setBackendPreview(null);
      previewErrorToastRef.current = "";
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingPreview(true);
      communicationService
        .previewTemplate({
          templateKey: form.templateKey,
          entryId: previewEntryId,
          templateData: templateDataValue,
          subjectOverride: subjectOverrideValue,
          bodyOverride: bodyOverrideValue,
          bodyHtmlOverride: bodyHtmlOverrideValue,
          renderOptions: {
            showBadge: false,
            mailLabel: null,
            includeEntryContext
          },
          previewMode: "draft",
          attachmentUploadIds
        })
        .then((result) => {
          if (!cancelled) {
            setBackendPreview(result);
            previewErrorToastRef.current = "";
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setBackendPreview(null);
            const message = getCommunicationErrorMessage(error, "Preview konnte nicht geladen werden.");
            if (previewErrorToastRef.current !== message) {
              showToast(message);
              previewErrorToastRef.current = message;
            }
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingPreview(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attachmentUploadIds, bodyHtmlOverrideValue, bodyOverrideValue, form.templateKey, includeEntryContext, previewEntryId, subjectOverrideValue, templateDataValue]);

  useEffect(() => {
    const key = form.templateKey.trim();
    if (!key) {
      return;
    }
    const existing = templateDraftsRef.current[key];
    const hasEqualData =
      JSON.stringify(existing?.data ?? {}) === JSON.stringify(templateDataDraft ?? {});
    if (existing && existing.subject === form.subjectOverride && existing.body === templateBody && hasEqualData) {
      return;
    }
    const next: TemplateDrafts = {
      ...templateDraftsRef.current,
      [key]: {
        subject: form.subjectOverride,
        body: templateBody,
        data: templateDataDraft
      }
    };
    templateDraftsRef.current = next;
    window.localStorage.setItem(TEMPLATE_DRAFTS_STORAGE_KEY, JSON.stringify(next));
  }, [form.subjectOverride, form.templateKey, templateBody, templateDataDraft]);

  useEffect(() => {
    if (!selectedTemplate?.composer?.enabled) {
      return;
    }
    const defaults = defaultTemplateDataFromComposer(selectedTemplate);
    if (Object.keys(defaults).length === 0) {
      return;
    }
    setTemplateDataDraft((prev) => {
      const merged = { ...defaults, ...prev };
      if (JSON.stringify(merged) === JSON.stringify(prev)) {
        return prev;
      }
      return merged;
    });
  }, [selectedTemplate]);

  useEffect(() => {
    setResolvedRecipients(null);
  }, [
    additionalEmailsInput,
    allowFilterRecipients,
    allowIndividualRecipients,
    form.acceptanceStatus,
    form.classId,
    form.registrationStatus,
    form.paymentStatus,
    recipientMode,
    selectedDriverPersonIds
  ]);

  useEffect(() => {
    if (!allowIndividualRecipients) {
      setRecipientSearchResults([]);
      setSearchingRecipients(false);
      recipientSearchErrorToastRef.current = "";
      return;
    }

    const query = recipientSearchQuery.trim();
    if (query.length < 2) {
      setRecipientSearchResults([]);
      setSearchingRecipients(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setSearchingRecipients(true);
    const timer = window.setTimeout(() => {
      communicationService
        .searchRecipients({
          query,
          classId: allowFilterRecipients && form.classId !== "all" ? form.classId : undefined,
          acceptanceStatus: allowFilterRecipients && form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
          paymentStatus: allowFilterRecipients && form.paymentStatus !== "all" ? form.paymentStatus : undefined,
          limit: 20
        })
        .then((recipients) => {
          if (searchRequestRef.current !== requestId) {
            return;
          }
          setRecipientSearchResults(recipients);
          recipientSearchErrorToastRef.current = "";
        })
        .catch((error) => {
          if (searchRequestRef.current !== requestId) {
            return;
          }
          setRecipientSearchResults([]);
          const message = getCommunicationErrorMessage(error, "Fahrersuche fehlgeschlagen.");
          if (recipientSearchErrorToastRef.current !== message) {
            showToast(message);
            recipientSearchErrorToastRef.current = message;
          }
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) {
            setSearchingRecipients(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    allowFilterRecipients,
    allowIndividualRecipients,
    form.acceptanceStatus,
    form.classId,
    form.paymentStatus,
    recipientSearchQuery
  ]);

  const addDriverTarget = (candidate: RecipientSearchItem) => {
    setSelectedDriverTargets((prev) => {
      if (prev.some((item) => item.id === candidate.driverPersonId)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: candidate.driverPersonId,
          label: `${candidate.driverName}${candidate.driverEmail ? ` (${candidate.driverEmail})` : ""}`,
          previewEntryId: candidate.entryId
        }
      ];
    });
  };

  const removeDriverTarget = (id: string) => {
    setSelectedDriverTargets((prev) => prev.filter((item) => item.id !== id));
  };

  const applyTemplateSelection = (nextTemplateKey: string) => {
    if (nextTemplateKey === form.templateKey) {
      return;
    }

    if (!nextTemplateKey) {
      setForm((prev) => ({ ...prev, templateKey: "", subjectOverride: "" }));
      setTemplateBody("");
      setTemplateDataDraft({});
      setIncludeEntryContext(true);
      setAttachmentUploadIds([]);
      setAttachmentDrafts([]);
      return;
    }

    const template = templatesByKey.get(nextTemplateKey);
    if (!template) {
      showToast("Template ist nicht verfügbar.");
      return;
    }

    const fromDraft = templateDraftsRef.current[nextTemplateKey];
    if (fromDraft) {
      const defaults = defaultTemplateDataFromComposer(template);
      const isStructured = hasStructuredComposer(template);
      setForm((prev) => ({ ...prev, templateKey: nextTemplateKey, subjectOverride: fromDraft.subject }));
      setTemplateBody(isStructured ? template.bodyText : fromDraft.body);
      setTemplateDataDraft({ ...defaults, ...(fromDraft.data ?? {}) });
      setIncludeEntryContext(template.renderOptions?.includeEntryContextDefault ?? true);
      return;
    }

    setForm((prev) => ({
      ...prev,
      templateKey: nextTemplateKey,
      subjectOverride: template.subject
    }));
    setTemplateBody(template.bodyText);
    setTemplateDataDraft(defaultTemplateDataFromComposer(template));
    setIncludeEntryContext(template.renderOptions?.includeEntryContextDefault ?? true);
    setAttachmentUploadIds([]);
    setAttachmentDrafts([]);
  };

  const resolveRecipients = async () => {
    if (!form.templateKey) {
      showToast("Bitte zuerst ein Template wählen.");
      return;
    }
    if (additionalRecipients.invalid.length > 0) {
      showToast("Zusätzliche E-Mails enthalten ungültige Adressen.");
      return;
    }
    if (sendBlockedByRecipientSelection) {
      showToast("Bitte mindestens einen Fahrer oder eine zusätzliche E-Mail auswählen.");
      return;
    }

    setResolvingRecipients(true);
    try {
      const result = await communicationService.resolveBroadcastRecipients({
        classId: allowFilterRecipients && form.classId !== "all" ? form.classId : undefined,
        acceptanceStatus: allowFilterRecipients && form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
        registrationStatus: allowFilterRecipients && form.registrationStatus !== "all" ? form.registrationStatus : undefined,
        paymentStatus: allowFilterRecipients && form.paymentStatus !== "all" ? form.paymentStatus : undefined,
        additionalEmails: additionalRecipients.valid,
        driverPersonIds: allowIndividualRecipients ? selectedDriverPersonIds : undefined,
        entryIds: allowIndividualRecipients ? selectedEntryIds : undefined
      });
      setResolvedRecipients(result);
      showToast(`Empfänger aufgelöst: ${result.finalCount}`, "info");
    } catch (error) {
      setResolvedRecipients(null);
      showToast(getCommunicationErrorMessage(error, "Empfänger konnten nicht aufgelöst werden."));
    } finally {
      setResolvingRecipients(false);
    }
  };

  const queueBroadcast = async () => {
    if (!canManageCommunication) {
      return;
    }
    const templateKey = form.templateKey.trim();
    if (!templateKey) {
      showToast("Template ist erforderlich.");
      return;
    }
    if (!availableCampaignTemplateKeys.has(templateKey)) {
      showToast("Auf der Kampagnenseite sind nur Kampagnen-Templates erlaubt.");
      return;
    }

    if (additionalRecipients.invalid.length > 0) {
      showToast("Zusätzliche E-Mails enthalten ungültige Adressen.");
      return;
    }
    if (sendBlockedByRecipientSelection) {
      showToast("Bitte mindestens einen Fahrer oder eine zusätzliche E-Mail auswählen.");
      return;
    }
    if (!templateExistsInBackend) {
      showToast("Dieses Template ist im Backend nicht verfügbar.");
      return;
    }
    if (sendBlockedByMissingPlaceholders) {
      showToast("Pflicht-Platzhalter fehlen im Preview. Versand ist blockiert.");
      return;
    }
    if (sendBlockedByTemplateData) {
      showToast(`Bitte Pflichtfeld ausfüllen: ${missingRequiredDynamicFields.map((key) => dynamicFieldLabel(key, composerFields)).join(", ")}.`);
      return;
    }

    setQueueing(true);
    try {
      const result = await communicationService.sendMail({
        templateKey,
        subjectOverride: subjectOverrideValue,
        bodyOverride: bodyOverrideValue,
        bodyHtmlOverride: bodyHtmlOverrideValue,
        templateData: templateDataValue,
        renderOptions: {
          showBadge: false,
          mailLabel: null,
          includeEntryContext
        },
        additionalEmails: additionalRecipients.valid,
        driverPersonIds: allowIndividualRecipients ? selectedDriverPersonIds : undefined,
        entryIds: allowIndividualRecipients ? selectedEntryIds : undefined,
        filters: {
          classId: allowFilterRecipients && form.classId !== "all" ? form.classId : undefined,
          acceptanceStatus: allowFilterRecipients && form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
          registrationStatus: allowFilterRecipients && form.registrationStatus !== "all" ? form.registrationStatus : undefined,
          paymentStatus: allowFilterRecipients && form.paymentStatus !== "all" ? form.paymentStatus : undefined
        },
        attachmentUploadIds
      });

      showToast(`Mailversand eingeplant (${result.queued} Empfänger).`, "success");
      await loadOutbox();
      if (!resolvedRecipients) {
        await resolveRecipients();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const code = (error.code ?? "").trim().toUpperCase();
        if (code === "TEMPLATE_NOT_ALLOWED_IN_CAMPAIGN") {
          showToast("Dieses Template ist ein Prozess-Template und kann nur in der Detailansicht versendet werden.");
          return;
        }
        const missingPlaceholdersMessage = getMissingPlaceholdersMessage(error);
        if (missingPlaceholdersMessage) {
          showToast(missingPlaceholdersMessage);
          return;
        }
      }
      showToast(getCommunicationErrorMessage(error, "Mailversand konnte nicht gestartet werden."));
    } finally {
      setQueueing(false);
    }
  };

  const collectQuickActionEntryIds = async (kind: "verification" | "payment") => {
    const filter: AdminEntriesFilter =
      kind === "payment"
        ? {
            query: "",
            classId: "all",
            acceptanceStatus: "accepted",
            paymentStatus: "due",
            checkinIdVerified: "all",
            sortBy: "createdAt",
            sortDir: "desc"
          }
        : {
            query: "",
            classId: "all",
            acceptanceStatus: "all",
            paymentStatus: "all",
            checkinIdVerified: "all",
            sortBy: "createdAt",
            sortDir: "desc"
          };

    const entryIds: string[] = [];
    let cursor: string | undefined;
    let safety = 0;

    while (safety < 80) {
      safety += 1;
      const page = await adminEntriesService.listEntriesPage(filter, {
        cursor,
        limit: QUICK_ACTION_PAGE_LIMIT
      });

      for (const row of page.entries) {
        if (kind === "verification" && row.confirmationMailVerified) {
          continue;
        }
        entryIds.push(row.id);
      }

      if (!page.meta.hasMore || !page.meta.nextCursor) {
        break;
      }
      cursor = page.meta.nextCursor;
    }

    return Array.from(new Set(entryIds));
  };

  const runQuickAction = async (kind: "verification" | "payment") => {
    if (!canManageCommunication) {
      showToast("Nur Admin-Rollen dürfen Mails senden.");
      return;
    }
    if (quickActionBusy) {
      return;
    }

    setQuickActionBusy(kind);
    try {
      setQuickActionConfirm(null);
      const entryIds = await collectQuickActionEntryIds(kind);
      if (entryIds.length < 1) {
        showToast("Keine passenden Empfänger gefunden.", "info");
        return;
      }

      const label = kind === "verification" ? "Erneute Verifizierung" : "Zahlungserinnerung";
      setQuickActionConfirm({
        kind,
        label,
        entryIds,
        finalCount: entryIds.length
      });
    } catch (error) {
      showToast(getCommunicationErrorMessage(error, "Quick-Aktion fehlgeschlagen."));
    } finally {
      setQuickActionBusy(null);
    }
  };

  const uploadAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    if (!form.templateKey) {
      showToast("Bitte zuerst ein Kampagnen-Template auswählen.");
      return;
    }

    const nextFiles = Array.from(files);
    if (attachmentDrafts.length + nextFiles.length > ATTACHMENT_MAX_FILES) {
      showToast(`Maximal ${ATTACHMENT_MAX_FILES} PDF-Dateien erlaubt.`);
      return;
    }

    const invalidType = nextFiles.find((file) => file.type !== "application/pdf");
    if (invalidType) {
      showToast(`Nur PDF erlaubt: ${invalidType.name}`);
      return;
    }

    const tooLarge = nextFiles.find((file) => file.size > ATTACHMENT_MAX_FILE_BYTES);
    if (tooLarge) {
      showToast(`Datei zu groß (max 5 MB): ${tooLarge.name}`);
      return;
    }

    const incomingTotal = nextFiles.reduce((sum, file) => sum + file.size, 0);
    if (attachmentTotalBytes + incomingTotal > ATTACHMENT_MAX_TOTAL_BYTES) {
      showToast("Gesamtgröße der Anhänge darf 15 MB nicht überschreiten.");
      return;
    }

    setUploadingAttachment(true);
    try {
      const uploaded: Array<{ uploadId: string; fileName: string; fileSizeBytes: number }> = [];
      for (const file of nextFiles) {
        const init = await communicationService.initAttachmentUpload({
          name: file.name,
          size: file.size,
          contentType: "application/pdf"
        });
        await communicationService.uploadAttachmentBinary(init.uploadUrl, init.requiredHeaders, file);
        const finalized = await communicationService.finalizeAttachmentUpload(init.uploadId, init.eventId);
        uploaded.push({
          uploadId: finalized.uploadId,
          fileName: finalized.fileName,
          fileSizeBytes: finalized.fileSizeBytes
        });
      }
      setAttachmentDrafts((prev) => [...prev, ...uploaded]);
      setAttachmentUploadIds((prev) => [...prev, ...uploaded.map((item) => item.uploadId)]);
      showToast(`Anhänge hochgeladen: ${uploaded.length}`, "success");
    } catch (error) {
      showToast(getCommunicationErrorMessage(error, "Anhang konnte nicht hochgeladen werden."));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = (uploadId: string) => {
    setAttachmentDrafts((prev) => prev.filter((item) => item.uploadId !== uploadId));
    setAttachmentUploadIds((prev) => prev.filter((item) => item !== uploadId));
  };

  const toggleOutboxGroup = (key: string) => {
    setExpandedOutboxGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const retryFailedOutboxItems = async (items: OutboxItem[]) => {
    const failed = items.filter((item) => item.status === "failed");
    if (failed.length === 0) {
      showToast("Keine fehlgeschlagenen Einträge in dieser Gruppe.", "info");
      return;
    }

    const confirmed = window.confirm(`Fehlgeschlagene Einträge erneut senden (${failed.length})?`);
    if (!confirmed) {
      return;
    }

    try {
      for (const item of failed) {
        await communicationService.retryOutbox(item.id);
      }
      showToast("Fehlgeschlagene Outbox-Einträge wurden erneut eingeplant.", "success");
      await loadOutbox();
    } catch (error) {
      showToast(getCommunicationErrorMessage(error, "Retry fehlgeschlagen."));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Kommunikation</h1>
        <Button asChild type="button" size="sm" variant="outline">
          <Link to="/admin/communication/design-lab">Mail-Design-Lab öffnen</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Kampagne erstellen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-900">Quick-Aktionen</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canManageCommunication || loadingTemplates || Boolean(quickActionBusy)}
                onClick={() => void runQuickAction("verification")}
              >
                {quickActionBusy === "verification" ? "Wird vorbereitet..." : "Erneute Verifizierung senden"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canManageCommunication || loadingTemplates || Boolean(quickActionBusy)}
                onClick={() => void runQuickAction("payment")}
              >
                {quickActionBusy === "payment" ? "Wird vorbereitet..." : "Offene Zahlungen erinnern"}
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-sm font-semibold text-slate-900">1. Empfänger definieren</div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={recipientMode === "filter" ? "default" : "outline"}
                onClick={() => setRecipientMode("filter")}
              >
                Nur Filter
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recipientMode === "individual" ? "default" : "outline"}
                onClick={() => setRecipientMode("individual")}
              >
                Nur Fahrerauswahl
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recipientMode === "combined" ? "default" : "outline"}
                onClick={() => setRecipientMode("combined")}
              >
                Filter + Fahrerauswahl
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Klasse</Label>
                <Select value={form.classId} onValueChange={(next) => setForm((prev) => ({ ...prev, classId: next }))}>
                  <SelectTrigger className="text-base md:text-sm" disabled={!allowFilterRecipients}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {classOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.acceptanceStatus}
                  onValueChange={(next) => setForm((prev) => ({ ...prev, acceptanceStatus: next as BroadcastForm["acceptanceStatus"] }))}
                >
                  <SelectTrigger className="text-base md:text-sm" disabled={!allowFilterRecipients}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="pending">Offen</SelectItem>
                    <SelectItem value="shortlist">Vorauswahl</SelectItem>
                    <SelectItem value="accepted">Zugelassen</SelectItem>
                    <SelectItem value="rejected">Abgelehnt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Verifizierung</Label>
                <Select
                  value={form.registrationStatus}
                  onValueChange={(next) =>
                    setForm((prev) => ({ ...prev, registrationStatus: next as BroadcastForm["registrationStatus"] }))
                  }
                >
                  <SelectTrigger className="text-base md:text-sm" disabled={!allowFilterRecipients}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="submitted_unverified">Unverifiziert</SelectItem>
                    <SelectItem value="submitted_verified">Verifiziert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Zahlung</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(next) => setForm((prev) => ({ ...prev, paymentStatus: next as BroadcastForm["paymentStatus"] }))}
                >
                  <SelectTrigger className="text-base md:text-sm" disabled={!allowFilterRecipients}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="due">{paymentStatusLabel("due")}</SelectItem>
                    <SelectItem value="paid">{paymentStatusLabel("paid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Zusätzliche E-Mails (optional)</Label>
              <textarea
                className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={additionalEmailsInput}
                onChange={(event) => setAdditionalEmailsInput(event.target.value)}
                placeholder="mail1@example.com, mail2@example.com"
              />
              <p className="text-xs text-slate-500">
                Zusätzlich gültig: {additionalRecipients.valid.length}
                {additionalRecipients.invalid.length > 0 ? ` · Ungültig: ${additionalRecipients.invalid.length}` : ""}
              </p>
            </div>

            <div className="space-y-2" aria-disabled={!allowIndividualRecipients}>
              <Label>Fahrer suchen und auswählen</Label>
              <div className="relative">
                <Input
                  value={recipientSearchQuery}
                  onChange={(event) => setRecipientSearchQuery(event.target.value)}
                  placeholder="Name oder E-Mail suchen"
                  disabled={!allowIndividualRecipients}
                  className="pr-9"
                />
                {searchingRecipients && allowIndividualRecipients && (
                  <Loader2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              {!allowIndividualRecipients ? (
                <p className="text-xs text-slate-500">Fahrersuche ist in diesem Modus deaktiviert.</p>
              ) : recipientSearchActive && !searchingRecipients && recipientSearchResults.length === 0 ? (
                <p className="text-xs text-slate-500">Keine Treffer.</p>
              ) : null}
              {allowIndividualRecipients && recipientSearchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border bg-white">
                  {recipientSearchResults.map((item) => {
                    const driverSelected = selectedDriverPersonIds.includes(item.driverPersonId);
                    return (
                      <div key={item.driverPersonId} className="border-t px-3 py-2 first:border-t-0">
                        <div className="text-sm font-medium text-slate-900">
                          {item.driverName}
                          {item.driverEmail ? ` (${item.driverEmail})` : ""}
                        </div>
                        <div className="text-xs text-slate-600">
                          {item.className} · #{item.startNumber}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={driverSelected ? "default" : "outline"}
                            disabled={driverSelected}
                            onClick={() => addDriverTarget(item)}
                          >
                            {driverSelected ? "Fahrer gewählt" : "Fahrer wählen"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-md border bg-white p-2">
              <div className="text-xs font-medium text-slate-700">Ausgewählte Fahrer ({selectedDriverTargets.length})</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selectedDriverTargets.length === 0 && <span className="text-xs text-slate-500">Keine</span>}
                {selectedDriverTargets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => removeDriverTarget(target.id)}
                    className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                    title="Entfernen"
                  >
                    {target.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
              <Button type="button" size="sm" variant="outline" disabled={!form.templateKey || resolvingRecipients} onClick={() => void resolveRecipients()}>
                {resolvingRecipients ? "Prüfe Empfänger..." : "Empfänger prüfen"}
              </Button>
            </div>
            {resolvedRecipients && (
              <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
                <div>Finale Empfänger: {resolvedRecipients.finalCount}</div>
                <div>Duplikate entfernt: {resolvedRecipients.duplicatesRemoved}</div>
                {resolvedRecipients.invalidEmails.length > 0 && (
                  <div className="mt-1 text-xs text-amber-700">Ungültige E-Mails: {resolvedRecipients.invalidEmails.join(", ")}</div>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-sm font-semibold text-slate-900">2. Vorlage & Inhalt</div>
            <div className="space-y-1">
              <Label>Template</Label>
              <Select value={form.templateKey || "__none__"} onValueChange={(next) => applyTemplateSelection(next === "__none__" ? "" : next)}>
                <SelectTrigger className="text-base md:text-sm" disabled={loadingTemplates || templateOptions.length === 0}>
                  <SelectValue placeholder={loadingTemplates ? "Templates laden..." : "Template wählen"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Template wählen</SelectItem>
                  {templateOptions.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingTemplates && templateOptions.length === 0 && <p className="text-xs text-slate-500">Keine aktiven Kampagnen-Templates verfügbar.</p>}
            </div>
            {selectedTemplate && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 text-xs text-slate-600">
                <span>{selectedTemplate.label}</span>
                <Badge variant="outline">{selectedTemplate.status}</Badge>
                <span>Version {selectedTemplate.version}</span>
              </div>
            )}
            <label className="flex items-start gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeEntryContext}
                onChange={(event) => setIncludeEntryContext(event.target.checked)}
                disabled={!form.templateKey}
              />
              <span>
                Entry-Kontext anzeigen (Klasse/Startnummer/Fahrzeug/Nenngeld), sofern verfügbar.
                <span className="mt-0.5 block text-xs text-slate-500">Schaltet den kompakten Erinnerungsblock im Mail-Header an/aus.</span>
              </span>
            </label>
            <div className="space-y-1">
              <Label>Betreff</Label>
              <Input
                value={form.subjectOverride}
                onChange={(event) => setForm((prev) => ({ ...prev, subjectOverride: event.target.value }))}
                placeholder="Betreff mit Platzhaltern"
                disabled={!form.templateKey}
              />
            </div>
            {!structuredComposerTemplate && (
              <div className="space-y-1">
                <Label>Text</Label>
                <textarea
                  className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={templateBody}
                  onChange={(event) => setTemplateBody(event.target.value)}
                  placeholder="Mailinhalt"
                  disabled={!form.templateKey}
                />
              </div>
            )}
            {form.templateKey && (
              <div className="space-y-2 rounded-md border bg-white p-3">
                <div className="text-sm font-medium text-slate-900">Dynamische Inhalte</div>
                <div className="text-xs text-slate-600">
                  Diese Felder werden direkt vom Backend-Template gerendert. Für strukturierte Templates ist dies die zentrale Inhaltsquelle.
                </div>
                {composerFields.length === 0 ? (
                  <div className="text-xs text-slate-500">Für dieses Template sind keine Composer-Felder hinterlegt.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {composerFields.map((field) => {
                      const value = templateDataDraft[field.key] ?? "";
                      const placeholderDriven = placeholderDrivenKeys.has(field.key.toLowerCase());
                      return (
                        <div key={field.key} className={field.multiline ? "space-y-1 md:col-span-2" : "space-y-1"}>
                          <Label>
                            {field.label}
                            {field.required ? " *" : ""}
                          </Label>
                          {field.multiline ? (
                            <textarea
                              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={value}
                              onChange={(event) =>
                                setTemplateDataDraft((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value
                                }))
                              }
                              placeholder={field.placeholder}
                              disabled={!form.templateKey}
                            />
                          ) : (
                            <Input
                              type={fieldInputType(field)}
                              value={value}
                              onChange={(event) =>
                                setTemplateDataDraft((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value
                                }))
                              }
                              placeholder={field.placeholder}
                              disabled={!form.templateKey}
                            />
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span>{field.helpText}</span>
                            {placeholderDriven ? <span className="font-mono">{`{{${field.key}}}`}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {missingRequiredDynamicFields.length > 0 && (
                  <div className="text-xs text-amber-700">
                    Fehlende Pflichtfelder: {missingRequiredDynamicFields.map((key) => dynamicFieldLabel(key, composerFields)).join(", ")}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2 rounded-md border bg-white p-3">
              <div className="text-sm font-medium text-slate-900">Anhänge (PDF)</div>
              <div className="text-xs text-slate-600">Max. 3 Dateien, max. 5 MB pro Datei, max. 15 MB gesamt.</div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="application/pdf"
                  multiple
                  disabled={!form.templateKey || uploadingAttachment || attachmentDrafts.length >= ATTACHMENT_MAX_FILES}
                  onChange={(event) => {
                    const files = event.target.files;
                    void uploadAttachments(files);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="text-xs text-slate-600">
                Dateien: {attachmentDrafts.length}/{ATTACHMENT_MAX_FILES} · Gesamt: {(attachmentTotalBytes / (1024 * 1024)).toFixed(2)} MB
              </div>
              {attachmentDrafts.length > 0 ? (
                <div className="space-y-1">
                  {attachmentDrafts.map((item) => (
                    <div key={item.uploadId} className="flex items-center justify-between gap-2 rounded border bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.fileName}</div>
                        <div>{(item.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</div>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => removeAttachment(item.uploadId)}>
                        Entfernen
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Keine Anhänge ausgewählt.</div>
              )}
            </div>
            <details className="rounded-md border bg-white p-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium text-slate-900">Platzhalter-Hilfe</summary>
              <div className="mt-3 space-y-2">
                {!form.templateKey && <div className="text-xs text-slate-500">Template wählen, um Platzhalter zu sehen.</div>}
                {form.templateKey && loadingPlaceholders && <div className="text-xs text-slate-500">Lade Platzhalter...</div>}
                {form.templateKey && !loadingPlaceholders && templatePlaceholders.length === 0 && (
                  <div className="text-xs text-slate-500">Keine Platzhalter hinterlegt.</div>
                )}
                {templatePlaceholders.map((item) => (
                  <div key={item.name} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="font-mono text-xs text-slate-900">{`{{${item.name}}}`}</div>
                    <div className="text-xs text-slate-600">{item.description}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.required ? "Pflicht" : "Optional"} · Beispiel: <span className="font-mono">{item.example || "-"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-sm font-semibold text-slate-900">3. Preview prüfen (Backend-Rendering)</div>
            {loadingPreview ? (
              <div className="rounded-md border bg-white p-3 text-sm text-slate-500">Lade Preview...</div>
            ) : backendPreview ? (
              <>
                <div className="rounded-md border bg-white p-3">
                  <div className="text-xs uppercase text-slate-500">Betreff</div>
                  <div className="mt-1 font-medium text-slate-900">{backendPreview.subjectRendered || "-"}</div>
                </div>
                <div className="rounded-md border bg-white p-2">
                  <iframe
                    title="Mail HTML Preview"
                    srcDoc={backendPreview.htmlDocument}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    className="h-[460px] w-full rounded border-0"
                  />
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <p>
                    Anhänge:{" "}
                    {Array.isArray(backendPreview.attachments) && backendPreview.attachments.length > 0
                      ? backendPreview.attachments.map((item) => item.fileName).join(", ")
                      : "-"}
                  </p>
                  <p>Warnungen: {backendPreview.warnings.join(" | ") || "-"}</p>
                  <p>Verwendet: {backendPreview.usedPlaceholders.join(", ") || "-"}</p>
                  <p>Fehlend: {backendPreview.missingPlaceholders.join(", ") || "-"}</p>
                  <p>Unbekannt: {backendPreview.unknownPlaceholders.join(", ") || "-"}</p>
                </div>
              </>
            ) : (
              <div className="rounded-md border bg-white p-3 text-sm text-slate-500">Keine Preview verfügbar.</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-slate-900">
            <div className="mb-2 text-sm font-semibold">4. Versand starten</div>
            {canManageCommunication ? (
              <Button
                className="w-full border border-slate-200 bg-white text-slate-900 hover:bg-yellow-300 md:w-auto"
                type="button"
                disabled={
                  queueing ||
                  uploadingAttachment ||
                  !form.templateKey ||
                  !templateExistsInBackend ||
                  sendBlockedByRecipientSelection ||
                  sendBlockedByMissingPlaceholders ||
                  sendBlockedByTemplateData
                }
                onClick={() => void queueBroadcast()}
              >
                {queueing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird eingeplant...
                  </>
                ) : (
                  "Mailversand einplanen"
                )}
              </Button>
            ) : (
              <div className="text-sm text-slate-600">Nur Admin-Rollen dürfen Broadcasts starten.</div>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Postausgang</CardTitle>
            <Button type="button" size="sm" variant="outline" disabled={loadingOutbox} onClick={() => void loadOutbox()}>
              {loadingOutbox ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lädt...
                </>
              ) : (
                "Aktualisieren"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 md:hidden">
                {visibleOutboxGroups.map((group) => {
                  const expanded = Boolean(expandedOutboxGroups[group.key]);
                  const total = group.items.length;
                  const recipientSample = uniqueRecipientsPreview(group.items, 2);
                  const recipientLine =
                    total === 1
                      ? recipientSample[0] ?? "-"
                      : `${recipientSample.join(", ")}${group.items.length > recipientSample.length ? ", ..." : ""}`;
                  const badges = OUTBOX_STATUS_ORDER.filter((status) => group.counts[status] > 0).map((status) => (
                    <Badge key={status} className={outboxStatusClasses(status)} variant="outline">
                      {outboxStatusLabel(status)}: {group.counts[status]}
                    </Badge>
                  ));

                  return (
                    <div key={group.key} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{resolveSubject(group.subject)}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {group.createdAt} · {total} Empfänger
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-700">{recipientLine}</div>
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => toggleOutboxGroup(group.key)}>
                          {expanded ? "Zuklappen" : "Details"}
                        </Button>
                      </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>

                  {group.counts.failed > 0 && canManageCommunication && (
                    <div className="mt-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void retryFailedOutboxItems(group.items)}>
                        Fehlgeschlagene erneut senden
                      </Button>
                    </div>
                  )}

                  {expanded && (
                    <div className="mt-3 max-h-64 overflow-y-auto rounded-md border bg-white">
                      {group.items.map((item) => (
                        <div key={item.id} className="border-t px-3 py-2 first:border-t-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-xs text-slate-700">{item.recipient}</div>
                            <Badge className={outboxStatusClasses(item.status)} variant="outline">
                              {outboxStatusLabel(item.status)}
                            </Badge>
                          </div>
                          {item.error ? <div className="mt-1 text-xs text-destructive">{item.error}</div> : null}
                          {item.status === "failed" && canManageCommunication && (
                            <div className="mt-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await communicationService.retryOutbox(item.id);
                                    showToast("Outbox-Eintrag wurde erneut eingeplant.", "success");
                                    await loadOutbox();
                                  } catch (error) {
                                    showToast(getCommunicationErrorMessage(error, "Retry fehlgeschlagen."));
                                  }
                                }}
                              >
                                Erneut senden
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Empfänger</th>
                  <th className="px-3 py-2">Betreff</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Erstellt</th>
                  <th className="px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {visibleOutboxGroups.map((group) => {
                  const expanded = Boolean(expandedOutboxGroups[group.key]);
                  const total = group.items.length;
                  const recipientSample = uniqueRecipientsPreview(group.items, 2);
                  const recipientLine =
                    total === 1
                      ? recipientSample[0] ?? "-"
                      : `${recipientSample.join(", ")}${group.items.length > recipientSample.length ? ", ..." : ""}`;
                  const badges = OUTBOX_STATUS_ORDER.filter((status) => group.counts[status] > 0).map((status) => (
                    <Badge key={status} className={outboxStatusClasses(status)} variant="outline">
                      {outboxStatusLabel(status)}: {group.counts[status]}
                    </Badge>
                  ));

                  return (
                    <Fragment key={group.key}>
                      <tr className="border-t">
                        <td className="px-3 py-2">
                          {total === 1 ? (
                            <div className="font-medium text-slate-900">{recipientLine}</div>
                          ) : (
                            <>
                              <div className="font-medium text-slate-900">{total} Empfänger</div>
                              <div className="mt-0.5 text-xs text-slate-500">{recipientLine}</div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2">{resolveSubject(group.subject)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1.5">{badges}</div>
                        </td>
                        <td className="px-3 py-2">{group.createdAt}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => toggleOutboxGroup(group.key)}>
                              {expanded ? "Zuklappen" : "Details"}
                            </Button>
                            {group.counts.failed > 0 && canManageCommunication ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => void retryFailedOutboxItems(group.items)}>
                                Fehlgeschlagene erneut senden
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-t">
                          <td colSpan={5} className="px-3 py-3">
                            <div className="max-h-72 overflow-y-auto rounded-md border bg-white">
                              <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-left text-slate-600">
                                  <tr>
                                    <th className="px-3 py-2">Empfänger</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Erstellt</th>
                                    <th className="px-3 py-2">Aktion</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.items.map((item) => (
                                    <tr key={item.id} className="border-t">
                                      <td className="px-3 py-2">{item.recipient}</td>
                                      <td className="px-3 py-2">
                                        <Badge className={outboxStatusClasses(item.status)} variant="outline">
                                          {outboxStatusLabel(item.status)}
                                        </Badge>
                                        {item.error ? <div className="mt-1 text-xs text-destructive">{item.error}</div> : null}
                                      </td>
                                      <td className="px-3 py-2">{item.createdAt}</td>
                                      <td className="px-3 py-2">
                                        {item.status === "failed" && canManageCommunication ? (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                              try {
                                                await communicationService.retryOutbox(item.id);
                                                showToast("Outbox-Eintrag wurde erneut eingeplant.", "success");
                                                await loadOutbox();
                                              } catch (error) {
                                                showToast(getCommunicationErrorMessage(error, "Retry fehlgeschlagen."));
                                              }
                                            }}
                                          >
                                            Erneut senden
                                          </Button>
                                        ) : (
                                          "-"
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hiddenOutboxCount > 0 && !outboxExpanded && (
            <Button type="button" variant="outline" onClick={() => setOutboxExpanded(true)}>
              Weitere {hiddenOutboxCount} Einträge anzeigen
            </Button>
          )}
          {outboxExpanded && outboxGroups.length > OUTBOX_PREVIEW_LIMIT && (
            <Button type="button" variant="outline" onClick={() => setOutboxExpanded(false)}>
              Auf letzte {OUTBOX_PREVIEW_LIMIT} Einträge reduzieren
            </Button>
          )}
        </CardContent>
      </Card>

      {toast && (
        <div
          className={[
            "fixed right-4 top-4 z-40 rounded-md border px-3 py-2 text-sm shadow-sm",
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : toast.tone === "info"
                ? "border-slate-200 bg-white text-slate-800"
                : "border-red-200 bg-red-50 text-red-800"
          ].join(" ")}
        >
          {toast.message}
        </div>
      )}

      {quickActionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">{quickActionConfirm.label} senden?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Diese Aktion plant den Versand an <span className="font-semibold text-slate-900">{quickActionConfirm.finalCount}</span>{" "}
              Empfänger ein.
            </p>
            <div className="mt-3 rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div>Typ: {quickActionConfirm.kind === "verification" ? "Erneute Verifizierung (Prozessmail)" : "Zahlungserinnerung"}</div>
              <div>Einträge: {quickActionConfirm.entryIds.length}</div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={confirmingQuickAction}
                onClick={() => setQuickActionConfirm(null)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={confirmingQuickAction}
                onClick={async () => {
                  setConfirmingQuickAction(true);
                  try {
                    let queuedTotal = 0;
                    let skippedTotal = 0;
                    for (const entryId of quickActionConfirm.entryIds) {
                      const result =
                        quickActionConfirm.kind === "verification"
                          ? await communicationService.queueVerificationMailForEntry(entryId, { allowDuplicate: true })
                          : await communicationService.queuePaymentReminderForEntry(entryId, { allowDuplicate: true });
                      queuedTotal += result.queued;
                      skippedTotal += result.skipped;
                    }
                    showToast(
                      `Quick-Aktion eingeplant: ${queuedTotal} gesendet${skippedTotal > 0 ? `, ${skippedTotal} übersprungen` : ""}.`,
                      "success"
                    );
                    setQuickActionConfirm(null);
                    await loadOutbox();
                  } catch (error) {
                    showToast(getCommunicationErrorMessage(error, "Quick-Aktion fehlgeschlagen."));
                  } finally {
                    setConfirmingQuickAction(false);
                  }
                }}
              >
                {confirmingQuickAction ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird eingeplant…
                  </>
                ) : (
                  "Ja, senden"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
