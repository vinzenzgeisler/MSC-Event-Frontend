import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { outboxStatusClasses, outboxStatusLabel, paymentStatusLabel } from "@/lib/admin-status";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";
import { communicationService } from "@/services/communication.service";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import type {
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
  paymentStatus: "all",
  templateKey: "",
  subjectOverride: ""
};

const OUTBOX_PREVIEW_LIMIT = 10;
const TEMPLATE_DRAFTS_STORAGE_KEY = "msc.communication.template-drafts.v1";

type TemplateDrafts = Record<string, { subject: string; body: string; data?: Record<string, string> }>;
type StaticTemplateOption = { key: string; label: string };
type RecipientTarget = { id: string; label: string; previewEntryId?: string };
type RecipientSearchItem = MailRecipientSearchItem;
type RecipientMode = "filter" | "individual" | "combined";
type ToastTone = "success" | "error" | "info";

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

function fieldInputType(field: MailTemplateComposerField): "text" | "url" | "date" {
  const key = (field.key || "").toLowerCase();
  if (key.includes("date") || key.includes("deadline")) {
    return "date";
  }
  return field.type === "url" ? "url" : "text";
}

export function AdminCommunicationPage() {
  const { roles } = useAuth();
  const canManageCommunication = hasPermission(roles, "communication.write");
  const [form, setForm] = useState<BroadcastForm>(initialForm);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("combined");
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
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [loadingOutbox, setLoadingOutbox] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);
  const [queueing, setQueueing] = useState(false);
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
  const requiredDynamicFields = useMemo(() => composerFields.filter((field) => field.required).map((field) => field.key), [composerFields]);
  const missingRequiredDynamicFields = useMemo(
    () => requiredDynamicFields.filter((fieldKey) => !(templateDataDraft[fieldKey] ?? "").trim()),
    [requiredDynamicFields, templateDataDraft]
  );
  const sendBlockedByTemplateData = missingRequiredDynamicFields.length > 0;

  const additionalRecipients = useMemo(() => parseEmailList(additionalEmailsInput), [additionalEmailsInput]);
  const selectedDriverPersonIds = useMemo(() => selectedDriverTargets.map((target) => target.id), [selectedDriverTargets]);
  const subjectOverrideValue = useMemo(() => form.subjectOverride.trim() || undefined, [form.subjectOverride]);
  const bodyOverrideValue = useMemo(() => templateBody.trim() || undefined, [templateBody]);
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
  const recipientSearchActive = recipientSearchQuery.trim().length >= 2;
  const hiddenOutboxCount = Math.max(outbox.length - OUTBOX_PREVIEW_LIMIT, 0);
  const visibleOutbox = outboxExpanded ? outbox : outbox.slice(0, OUTBOX_PREVIEW_LIMIT);

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
            mailLabel: null
          },
          previewMode: "draft"
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
  }, [bodyHtmlOverrideValue, bodyOverrideValue, form.templateKey, previewEntryId, subjectOverrideValue, templateDataValue]);

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
      setForm((prev) => ({ ...prev, templateKey: nextTemplateKey, subjectOverride: fromDraft.subject }));
      setTemplateBody(fromDraft.body);
      setTemplateDataDraft({ ...defaults, ...(fromDraft.data ?? {}) });
      return;
    }

    setForm((prev) => ({
      ...prev,
      templateKey: nextTemplateKey,
      subjectOverride: template.subject
    }));
    setTemplateBody(template.bodyText);
    setTemplateDataDraft(defaultTemplateDataFromComposer(template));
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
        paymentStatus: allowFilterRecipients && form.paymentStatus !== "all" ? form.paymentStatus : undefined,
        additionalEmails: additionalRecipients.valid,
        driverPersonIds: allowIndividualRecipients ? selectedDriverPersonIds : undefined
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
          mailLabel: null
        },
        additionalEmails: additionalRecipients.valid,
        driverPersonIds: allowIndividualRecipients ? selectedDriverPersonIds : undefined,
        filters: {
          classId: allowFilterRecipients && form.classId !== "all" ? form.classId : undefined,
          acceptanceStatus: allowFilterRecipients && form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
          paymentStatus: allowFilterRecipients && form.paymentStatus !== "all" ? form.paymentStatus : undefined
        }
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

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-slate-900">Kommunikation</h1>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Kampagne erstellen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
            <div className="grid gap-2 md:grid-cols-3">
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
            <div className="space-y-1">
              <Label>Betreff</Label>
              <Input
                value={form.subjectOverride}
                onChange={(event) => setForm((prev) => ({ ...prev, subjectOverride: event.target.value }))}
                placeholder="Betreff mit Platzhaltern"
                disabled={!form.templateKey}
              />
            </div>
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
            {form.templateKey && (
              <div className="space-y-2 rounded-md border bg-white p-3">
                <div className="text-sm font-medium text-slate-900">Dynamische Inhalte</div>
                {composerFields.length === 0 ? (
                  <div className="text-xs text-slate-500">Für dieses Template sind keine Composer-Felder hinterlegt.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {composerFields.map((field) => {
                      const value = templateDataDraft[field.key] ?? "";
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
                          {field.helpText ? <p className="text-xs text-slate-500">{field.helpText}</p> : null}
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
                  <p>Warnungen: {backendPreview.warnings.join(" | ") || "-"}</p>
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
                disabled={queueing || !form.templateKey || !templateExistsInBackend || sendBlockedByRecipientSelection || sendBlockedByMissingPlaceholders || sendBlockedByTemplateData}
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
            {visibleOutbox.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="font-medium text-slate-900">{resolveSubject(item.subject)}</div>
                <div className="text-xs text-slate-600">{item.recipient}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge className={outboxStatusClasses(item.status)} variant="outline">
                    {outboxStatusLabel(item.status)}
                  </Badge>
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
                    <span className="text-xs text-slate-500">{item.createdAt}</span>
                  )}
                </div>
                {item.error && <div className="mt-2 text-xs text-destructive">{item.error}</div>}
              </div>
            ))}
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
                {visibleOutbox.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.recipient}</td>
                    <td className="px-3 py-2">{resolveSubject(item.subject)}</td>
                    <td className="px-3 py-2">
                      <Badge className={outboxStatusClasses(item.status)} variant="outline">
                        {outboxStatusLabel(item.status)}
                      </Badge>
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
          {hiddenOutboxCount > 0 && !outboxExpanded && (
            <Button type="button" variant="outline" onClick={() => setOutboxExpanded(true)}>
              Weitere {hiddenOutboxCount} Einträge anzeigen
            </Button>
          )}
          {outboxExpanded && outbox.length > OUTBOX_PREVIEW_LIMIT && (
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
    </div>
  );
}
