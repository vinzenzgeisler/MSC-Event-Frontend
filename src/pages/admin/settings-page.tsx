import { useEffect, useMemo, useState } from "react";
import { Shield, Users, Save, Plus, Trash2, StopCircle, Archive } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";
import { adminIamService } from "@/services/admin-iam.service";
import { adminSettingsService } from "@/services/admin-settings.service";
import type { IamAccount, IamOverview, IamRole } from "@/types/admin-iam";
import type {
  AdminSettingsClass,
  AdminSettingsClassDraft,
  AdminSettingsEntryConfirmationConfig,
  AdminSettingsEntryConfirmationScheduleItem,
  AdminSettingsEvent,
  AdminSettingsEventForm,
  AdminSettingsPricingForm
} from "@/types/admin-settings";
import type { VehicleType } from "@/types/common";

const PRICING_DRAFT_PREFIX = "msc_settings_pricing_draft_";
const SELECTED_EVENT_STORAGE_KEY = "msc_admin_settings_event_id";
const ENTRY_CONFIRMATION_LIST_LIMIT = 12;
const TEXTAREA_CLASS_NAME =
  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const tzOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function entryConfirmationConfigToForm(
  config: AdminSettingsEntryConfirmationConfig
): AdminSettingsEntryConfirmationConfig {
  return {
    ...config,
    importantNotes: [...config.importantNotes],
    scheduleItems: config.scheduleItems.map((item) => ({
      ...item,
      startsAt: toDatetimeLocal(item.startsAt || null),
      endsAt: toDatetimeLocal(item.endsAt || null)
    }))
  };
}

function eventToForm(event: AdminSettingsEvent): AdminSettingsEventForm {
  return {
    name: event.name,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    registrationOpenAt: toDatetimeLocal(event.registrationOpenAt),
    registrationCloseAt: toDatetimeLocal(event.registrationCloseAt),
    entryConfirmationConfig: entryConfirmationConfigToForm(event.entryConfirmationConfig)
  };
}

function createEmptyEntryConfirmationScheduleItem(): AdminSettingsEntryConfirmationScheduleItem {
  return {
    label: "",
    startsAt: "",
    endsAt: "",
    note: ""
  };
}

function createEmptyEntryConfirmationConfig(): AdminSettingsEntryConfirmationConfig {
  return {
    orgaCodePrefix: "",
    organizerName: "",
    organizerAddressLine: "",
    organizerContactEmail: "",
    organizerContactPhone: "",
    websiteUrl: "",
    gateHeadline: "",
    venueName: "",
    venueStreet: "",
    venueZip: "",
    venueCity: "",
    paddockInfo: "",
    arrivalNotes: "",
    accessNotes: "",
    importantNotes: [],
    scheduleItems: [],
    paymentRecipient: "",
    paymentIban: "",
    paymentBic: "",
    paymentBankName: "",
    paymentReferencePrefix: ""
  };
}

function normalizeEntryConfirmationText(value: string) {
  return value.trim();
}

function normalizeImportantNotes(notes: string[]) {
  return notes.map((item) => item.trim()).filter(Boolean);
}

function normalizeScheduleItems(items: AdminSettingsEntryConfirmationScheduleItem[]) {
  return items
    .filter((item) => item.label.trim() || item.startsAt || item.endsAt || item.note.trim())
    .map((item) => ({
      label: item.label.trim(),
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      note: item.note.trim()
    }))
    .filter((item) => item.label);
}

function scheduleItemsEqual(
  left: AdminSettingsEntryConfirmationScheduleItem[],
  right: AdminSettingsEntryConfirmationScheduleItem[]
) {
  const normalizedLeft = normalizeScheduleItems(left);
  const normalizedRight = normalizeScheduleItems(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((item, index) => {
    const other = normalizedRight[index];
    return (
      item.label === other.label &&
      item.startsAt === other.startsAt &&
      item.endsAt === other.endsAt &&
      item.note === other.note
    );
  });
}

function buildEventOverrideConfig(
  config: AdminSettingsEntryConfirmationConfig,
  defaults: AdminSettingsEntryConfirmationConfig
): AdminSettingsEntryConfirmationConfig {
  return {
    orgaCodePrefix:
      normalizeEntryConfirmationText(config.orgaCodePrefix) &&
      normalizeEntryConfirmationText(config.orgaCodePrefix) !== normalizeEntryConfirmationText(defaults.orgaCodePrefix)
        ? normalizeEntryConfirmationText(config.orgaCodePrefix)
        : "",
    organizerName:
      normalizeEntryConfirmationText(config.organizerName) &&
      normalizeEntryConfirmationText(config.organizerName) !== normalizeEntryConfirmationText(defaults.organizerName)
        ? normalizeEntryConfirmationText(config.organizerName)
        : "",
    organizerAddressLine:
      normalizeEntryConfirmationText(config.organizerAddressLine) &&
      normalizeEntryConfirmationText(config.organizerAddressLine) !== normalizeEntryConfirmationText(defaults.organizerAddressLine)
        ? normalizeEntryConfirmationText(config.organizerAddressLine)
        : "",
    organizerContactEmail:
      normalizeEntryConfirmationText(config.organizerContactEmail) &&
      normalizeEntryConfirmationText(config.organizerContactEmail) !== normalizeEntryConfirmationText(defaults.organizerContactEmail)
        ? normalizeEntryConfirmationText(config.organizerContactEmail)
        : "",
    organizerContactPhone:
      normalizeEntryConfirmationText(config.organizerContactPhone) &&
      normalizeEntryConfirmationText(config.organizerContactPhone) !== normalizeEntryConfirmationText(defaults.organizerContactPhone)
        ? normalizeEntryConfirmationText(config.organizerContactPhone)
        : "",
    websiteUrl:
      normalizeEntryConfirmationText(config.websiteUrl) &&
      normalizeEntryConfirmationText(config.websiteUrl) !== normalizeEntryConfirmationText(defaults.websiteUrl)
        ? normalizeEntryConfirmationText(config.websiteUrl)
        : "",
    gateHeadline:
      normalizeEntryConfirmationText(config.gateHeadline) &&
      normalizeEntryConfirmationText(config.gateHeadline) !== normalizeEntryConfirmationText(defaults.gateHeadline)
        ? normalizeEntryConfirmationText(config.gateHeadline)
        : "",
    venueName:
      normalizeEntryConfirmationText(config.venueName) &&
      normalizeEntryConfirmationText(config.venueName) !== normalizeEntryConfirmationText(defaults.venueName)
        ? normalizeEntryConfirmationText(config.venueName)
        : "",
    venueStreet:
      normalizeEntryConfirmationText(config.venueStreet) &&
      normalizeEntryConfirmationText(config.venueStreet) !== normalizeEntryConfirmationText(defaults.venueStreet)
        ? normalizeEntryConfirmationText(config.venueStreet)
        : "",
    venueZip:
      normalizeEntryConfirmationText(config.venueZip) &&
      normalizeEntryConfirmationText(config.venueZip) !== normalizeEntryConfirmationText(defaults.venueZip)
        ? normalizeEntryConfirmationText(config.venueZip)
        : "",
    venueCity:
      normalizeEntryConfirmationText(config.venueCity) &&
      normalizeEntryConfirmationText(config.venueCity) !== normalizeEntryConfirmationText(defaults.venueCity)
        ? normalizeEntryConfirmationText(config.venueCity)
        : "",
    paddockInfo:
      normalizeEntryConfirmationText(config.paddockInfo) &&
      normalizeEntryConfirmationText(config.paddockInfo) !== normalizeEntryConfirmationText(defaults.paddockInfo)
        ? normalizeEntryConfirmationText(config.paddockInfo)
        : "",
    arrivalNotes:
      normalizeEntryConfirmationText(config.arrivalNotes) &&
      normalizeEntryConfirmationText(config.arrivalNotes) !== normalizeEntryConfirmationText(defaults.arrivalNotes)
        ? normalizeEntryConfirmationText(config.arrivalNotes)
        : "",
    accessNotes:
      normalizeEntryConfirmationText(config.accessNotes) &&
      normalizeEntryConfirmationText(config.accessNotes) !== normalizeEntryConfirmationText(defaults.accessNotes)
        ? normalizeEntryConfirmationText(config.accessNotes)
        : "",
    importantNotes: (() => {
      const current = normalizeImportantNotes(config.importantNotes);
      const base = normalizeImportantNotes(defaults.importantNotes);
      return current.join("|") === base.join("|") ? [] : current;
    })(),
    scheduleItems: scheduleItemsEqual(config.scheduleItems, defaults.scheduleItems) ? [] : normalizeScheduleItems(config.scheduleItems),
    paymentRecipient:
      normalizeEntryConfirmationText(config.paymentRecipient) &&
      normalizeEntryConfirmationText(config.paymentRecipient) !== normalizeEntryConfirmationText(defaults.paymentRecipient)
        ? normalizeEntryConfirmationText(config.paymentRecipient)
        : "",
    paymentIban:
      normalizeEntryConfirmationText(config.paymentIban) &&
      normalizeEntryConfirmationText(config.paymentIban) !== normalizeEntryConfirmationText(defaults.paymentIban)
        ? normalizeEntryConfirmationText(config.paymentIban)
        : "",
    paymentBic:
      normalizeEntryConfirmationText(config.paymentBic) &&
      normalizeEntryConfirmationText(config.paymentBic) !== normalizeEntryConfirmationText(defaults.paymentBic)
        ? normalizeEntryConfirmationText(config.paymentBic)
        : "",
    paymentBankName:
      normalizeEntryConfirmationText(config.paymentBankName) &&
      normalizeEntryConfirmationText(config.paymentBankName) !== normalizeEntryConfirmationText(defaults.paymentBankName)
        ? normalizeEntryConfirmationText(config.paymentBankName)
        : "",
    paymentReferencePrefix:
      normalizeEntryConfirmationText(config.paymentReferencePrefix) &&
      normalizeEntryConfirmationText(config.paymentReferencePrefix) !== normalizeEntryConfirmationText(defaults.paymentReferencePrefix)
        ? normalizeEntryConfirmationText(config.paymentReferencePrefix)
        : ""
  };
}

function findInvalidScheduleItem(config: AdminSettingsEntryConfirmationConfig) {
  return config.scheduleItems.find((item) => {
    const hasAnyValue = Boolean(item.label.trim() || item.startsAt || item.endsAt || item.note.trim());
    if (!hasAnyValue) {
      return false;
    }
    if (!item.label.trim()) {
      return true;
    }
    if (item.startsAt && !parseDateTime(item.startsAt)) {
      return true;
    }
    if (item.endsAt && !parseDateTime(item.endsAt)) {
      return true;
    }
    if (item.startsAt && item.endsAt) {
      const startsAt = parseDateTime(item.startsAt);
      const endsAt = parseDateTime(item.endsAt);
      if (!startsAt || !endsAt || startsAt > endsAt) {
        return true;
      }
    }
    return false;
  });
}

function getEntryConfirmationOverrideSections(config: AdminSettingsEntryConfirmationConfig) {
  const sections: string[] = [];

  if (
    config.organizerName.trim() ||
    config.organizerAddressLine.trim() ||
    config.organizerContactEmail.trim() ||
    config.organizerContactPhone.trim() ||
    config.websiteUrl.trim()
  ) {
    sections.push("Veranstalter & Kontakt");
  }

  if (
    config.gateHeadline.trim() ||
    config.venueName.trim() ||
    config.venueStreet.trim() ||
    config.venueZip.trim() ||
    config.venueCity.trim() ||
    config.paddockInfo.trim() ||
    config.arrivalNotes.trim() ||
    config.accessNotes.trim()
  ) {
    sections.push("Veranstaltungsort & Fahrerlager");
  }

  if (config.scheduleItems.length > 0) {
    sections.push("Termine");
  }

  if (config.importantNotes.some((item) => item.trim())) {
    sections.push("Wichtige Hinweise");
  }

  if (
    config.orgaCodePrefix.trim() ||
    config.paymentRecipient.trim() ||
    config.paymentIban.trim() ||
    config.paymentBic.trim() ||
    config.paymentBankName.trim() ||
    config.paymentReferencePrefix.trim()
  ) {
    sections.push("Zahlungsdaten");
  }

  return sections;
}

function hasEntryConfirmationOverrides(config: AdminSettingsEntryConfirmationConfig) {
  return getEntryConfirmationOverrideSections(config).length > 0;
}

type EntryConfirmationEditorProps = {
  mode: "defaults" | "overrides";
  config: AdminSettingsEntryConfirmationConfig;
  disabled: boolean;
  defaults?: AdminSettingsEntryConfirmationConfig;
  onFieldChange: <K extends keyof AdminSettingsEntryConfirmationConfig>(
    key: K,
    value: AdminSettingsEntryConfirmationConfig[K]
  ) => void;
  onImportantNoteChange: (index: number, value: string) => void;
  onAddImportantNote: () => void;
  onRemoveImportantNote: (index: number) => void;
  onScheduleItemChange: (
    index: number,
    key: keyof AdminSettingsEntryConfirmationScheduleItem,
    value: string
  ) => void;
  onAddScheduleItem: () => void;
  onRemoveScheduleItem: (index: number) => void;
};

function EntryConfirmationConfigEditor({
  mode,
  config,
  disabled,
  defaults,
  onFieldChange,
  onImportantNoteChange,
  onAddImportantNote,
  onRemoveImportantNote,
  onScheduleItemChange,
  onAddScheduleItem,
  onRemoveScheduleItem
}: EntryConfirmationEditorProps) {
  const isOverride = mode === "overrides";
  const placeholderFor = <K extends keyof AdminSettingsEntryConfirmationConfig>(key: K) =>
    isOverride ? defaults?.[key] ?? "" : "";

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">Veranstalter & Kontakt</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Veranstalter</Label>
            <Input
              value={config.organizerName}
              placeholder={placeholderFor("organizerName")}
              disabled={disabled}
              onChange={(event) => onFieldChange("organizerName", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Anschrift</Label>
            <Input
              value={config.organizerAddressLine}
              placeholder={placeholderFor("organizerAddressLine")}
              disabled={disabled}
              onChange={(event) => onFieldChange("organizerAddressLine", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Kontakt E-Mail</Label>
            <Input
              type="email"
              value={config.organizerContactEmail}
              placeholder={placeholderFor("organizerContactEmail")}
              disabled={disabled}
              onChange={(event) => onFieldChange("organizerContactEmail", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Kontakt Telefon</Label>
            <Input
              value={config.organizerContactPhone}
              placeholder={placeholderFor("organizerContactPhone")}
              disabled={disabled}
              onChange={(event) => onFieldChange("organizerContactPhone", event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Website</Label>
            <Input
              type="url"
              value={config.websiteUrl}
              placeholder={placeholderFor("websiteUrl")}
              disabled={disabled}
              onChange={(event) => onFieldChange("websiteUrl", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">Veranstaltungsort & Fahrerlager</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Überschrift Anreise</Label>
            <Input
              value={config.gateHeadline}
              placeholder={placeholderFor("gateHeadline")}
              disabled={disabled}
              onChange={(event) => onFieldChange("gateHeadline", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Veranstaltungsstätte</Label>
            <Input
              value={config.venueName}
              placeholder={placeholderFor("venueName")}
              disabled={disabled}
              onChange={(event) => onFieldChange("venueName", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Straße</Label>
            <Input
              value={config.venueStreet}
              placeholder={placeholderFor("venueStreet")}
              disabled={disabled}
              onChange={(event) => onFieldChange("venueStreet", event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>PLZ</Label>
              <Input
                value={config.venueZip}
                placeholder={placeholderFor("venueZip")}
                disabled={disabled}
                onChange={(event) => onFieldChange("venueZip", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Ort</Label>
              <Input
                value={config.venueCity}
                placeholder={placeholderFor("venueCity")}
                disabled={disabled}
                onChange={(event) => onFieldChange("venueCity", event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Hinweise Fahrerlager</Label>
            <textarea
              className={TEXTAREA_CLASS_NAME}
              value={config.paddockInfo}
              placeholder={placeholderFor("paddockInfo")}
              disabled={disabled}
              onChange={(event) => onFieldChange("paddockInfo", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Hinweise Anreise</Label>
            <textarea
              className={TEXTAREA_CLASS_NAME}
              value={config.arrivalNotes}
              placeholder={placeholderFor("arrivalNotes")}
              disabled={disabled}
              onChange={(event) => onFieldChange("arrivalNotes", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Zugang / Zufahrt</Label>
            <textarea
              className={TEXTAREA_CLASS_NAME}
              value={config.accessNotes}
              placeholder={placeholderFor("accessNotes")}
              disabled={disabled}
              onChange={(event) => onFieldChange("accessNotes", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Termine</div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || config.scheduleItems.length >= ENTRY_CONFIRMATION_LIST_LIMIT}
            onClick={onAddScheduleItem}
          >
            <Plus className="mr-2 h-4 w-4" />
            Termin hinzufügen
          </Button>
        </div>
        <div className="space-y-3">
          {config.scheduleItems.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-slate-500">
              {isOverride
                ? "Keine Event-Overrides für Termine gepflegt. Es gelten die globalen Standardtermine."
                : "Noch keine Standardtermine gepflegt."}
            </div>
          ) : (
            config.scheduleItems.map((item, index) => (
              <div key={`schedule-${index}`} className="space-y-3 rounded-md border p-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Bezeichnung</Label>
                    <Input
                      value={item.label}
                      disabled={disabled}
                      onChange={(event) => onScheduleItemChange(index, "label", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Hinweis</Label>
                    <Input
                      value={item.note}
                      disabled={disabled}
                      onChange={(event) => onScheduleItemChange(index, "note", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Beginn</Label>
                    <Input
                      type="datetime-local"
                      value={item.startsAt}
                      disabled={disabled}
                      onChange={(event) => onScheduleItemChange(index, "startsAt", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Ende</Label>
                    <Input
                      type="datetime-local"
                      value={item.endsAt}
                      disabled={disabled}
                      onChange={(event) => onScheduleItemChange(index, "endsAt", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" disabled={disabled} onClick={() => onRemoveScheduleItem(index)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Termin löschen
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Wichtige Hinweise</div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || config.importantNotes.length >= ENTRY_CONFIRMATION_LIST_LIMIT}
            onClick={onAddImportantNote}
          >
            <Plus className="mr-2 h-4 w-4" />
            Hinweis hinzufügen
          </Button>
        </div>
        <div className="space-y-3">
          {config.importantNotes.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-slate-500">
              {isOverride
                ? "Keine Event-Overrides für wichtige Hinweise gepflegt. Es gelten die globalen Standardhinweise."
                : "Noch keine Standardhinweise gepflegt."}
            </div>
          ) : (
            config.importantNotes.map((note, index) => (
              <div key={`note-${index}`} className="flex gap-3">
                <Input value={note} disabled={disabled} onChange={(event) => onImportantNoteChange(index, event.target.value)} />
                <Button type="button" variant="ghost" disabled={disabled} onClick={() => onRemoveImportantNote(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">Zahlungsdaten</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Orga-Code-Präfix</Label>
            <Input
              value={config.orgaCodePrefix}
              placeholder={placeholderFor("orgaCodePrefix")}
              disabled={disabled}
              onChange={(event) => onFieldChange("orgaCodePrefix", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Zahlungsempfänger</Label>
            <Input
              value={config.paymentRecipient}
              placeholder={placeholderFor("paymentRecipient")}
              disabled={disabled}
              onChange={(event) => onFieldChange("paymentRecipient", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Bank</Label>
            <Input
              value={config.paymentBankName}
              placeholder={placeholderFor("paymentBankName")}
              disabled={disabled}
              onChange={(event) => onFieldChange("paymentBankName", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>IBAN</Label>
            <Input
              value={config.paymentIban}
              placeholder={placeholderFor("paymentIban")}
              disabled={disabled}
              onChange={(event) => onFieldChange("paymentIban", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>BIC</Label>
            <Input
              value={config.paymentBic}
              placeholder={placeholderFor("paymentBic")}
              disabled={disabled}
              onChange={(event) => onFieldChange("paymentBic", event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Verwendungszweck-Präfix</Label>
            <Input
              value={config.paymentReferencePrefix}
              placeholder={placeholderFor("paymentReferencePrefix")}
              disabled={disabled}
              onChange={(event) => onFieldChange("paymentReferencePrefix", event.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type PricingRulesSnapshot = {
  earlyDeadline: string;
  lateFeeCents: number;
  secondVehicleDiscountCents: number;
  classRules: Array<{
    classId: string;
    className: string;
    baseFeeCents: number;
  }>;
};

function buildDefaultPricingForm(classes: AdminSettingsClass[]): AdminSettingsPricingForm {
  return {
    earlyDeadline: "",
    lateFeeCents: "0",
    secondVehicleDiscountCents: "0",
    classRules: classes.map((item) => ({
      classId: item.id,
      className: item.name,
      baseFeeCents: "0"
    }))
  };
}

function pricingRulesToForm(rules: PricingRulesSnapshot, classes: AdminSettingsClass[]): AdminSettingsPricingForm {
  const ruleMap = new Map(rules.classRules.map((rule) => [rule.classId, rule]));
  return {
    earlyDeadline: toDatetimeLocal(rules.earlyDeadline),
    lateFeeCents: String(rules.lateFeeCents),
    secondVehicleDiscountCents: String(rules.secondVehicleDiscountCents),
    classRules: classes.map((item) => ({
      classId: item.id,
      className: item.name,
      baseFeeCents: String(ruleMap.get(item.id)?.baseFeeCents ?? 0)
    }))
  };
}

function mergePricingWithClasses(form: AdminSettingsPricingForm, classes: AdminSettingsClass[]): AdminSettingsPricingForm {
  const existing = new Map(form.classRules.map((rule) => [rule.classId, rule]));

  return {
    ...form,
    classRules: classes.map((item) => {
      const current = existing.get(item.id);
      return {
        classId: item.id,
        className: item.name,
        baseFeeCents: current?.baseFeeCents ?? "0"
      };
    })
  };
}

function storageKeyForEvent(eventId: string) {
  return `${PRICING_DRAFT_PREFIX}${eventId}`;
}

function readSelectedEventId() {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(SELECTED_EVENT_STORAGE_KEY);
  return value && value.trim() ? value.trim() : null;
}

function persistSelectedEventId(eventId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (eventId && eventId.trim()) {
    window.localStorage.setItem(SELECTED_EVENT_STORAGE_KEY, eventId.trim());
    return;
  }
  window.localStorage.removeItem(SELECTED_EVENT_STORAGE_KEY);
}

function isNonNegativeInteger(value: string) {
  return /^\d+$/.test(value);
}

function parseDateTime(value: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function asRoleList(value: string[]) {
  const unique = new Set<IamRole>();
  value.forEach((item) => {
    if (item === "admin" || item === "editor" || item === "viewer") {
      unique.add(item);
    }
  });
  return Array.from(unique.values());
}

function rolesEqual(a: IamRole[], b: IamRole[]) {
  if (a.length !== b.length) {
    return false;
  }
  const left = [...a].sort().join("|");
  const right = [...b].sort().join("|");
  return left === right;
}

function getIamCreateUserErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const code = (error.code ?? "").trim().toUpperCase();
    const reason =
      typeof error.details?.reason === "string" ? error.details.reason.trim().toUpperCase() : "";
    const normalized = code || reason;

    if (normalized === "USER_ALREADY_EXISTS") {
      return "Für diese E-Mail existiert bereits ein Account.";
    }
    if (normalized === "PERMISSION_DENIED") {
      return "Du hast keine Berechtigung, Accounts anzulegen.";
    }
    if (normalized === "INVALID_TEMP_PASSWORD") {
      return "Das temporäre Passwort erfüllt die Anforderungen nicht.";
    }
    if (normalized === "ROLE_MAPPING_FAILED") {
      return "Die Rollen konnten dem neuen Account nicht zugeordnet werden.";
    }
    if (normalized === "INVITATION_SEND_FAILED") {
      return "Account wurde erstellt, aber die Einladung konnte nicht gesendet werden.";
    }
  }

  return getApiErrorMessage(error, "IAM-Account konnte nicht angelegt werden.");
}

type SettingsTab = "event" | "confirmation" | "classes" | "iam";

export function AdminSettingsPage() {
  const { roles } = useAuth();
  const canManage = hasPermission(roles, "settings.write");
  const canManageIam = hasPermission(roles, "iam.write");

  const [loading, setLoading] = useState(true);
  const [noCurrentEvent, setNoCurrentEvent] = useState(false);
  const [eventState, setEventState] = useState<AdminSettingsEvent | null>(null);
  const [entryConfirmationDefaults, setEntryConfirmationDefaults] =
    useState<AdminSettingsEntryConfirmationConfig>(createEmptyEntryConfirmationConfig());
  const [eventForm, setEventForm] = useState<AdminSettingsEventForm>({
    name: "",
    startsAt: "",
    endsAt: "",
    registrationOpenAt: "",
    registrationCloseAt: "",
    entryConfirmationConfig: createEmptyEntryConfirmationConfig()
  });
  const [classes, setClasses] = useState<AdminSettingsClass[]>([]);
  const [classDrafts, setClassDrafts] = useState<Record<string, AdminSettingsClassDraft>>({});
  const [newClassDraft, setNewClassDraft] = useState<AdminSettingsClassDraft>({ name: "", vehicleType: "auto" });
  const [pricingForm, setPricingForm] = useState<AdminSettingsPricingForm>(buildDefaultPricingForm([]));
  const [iamOverview, setIamOverview] = useState<IamOverview | null>(null);

  const [savingEvent, setSavingEvent] = useState(false);
  const [savingEntryConfirmationDefaults, setSavingEntryConfirmationDefaults] = useState(false);
  const [creatingInitialEvent, setCreatingInitialEvent] = useState(false);
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [operationBusy, setOperationBusy] = useState<string | null>(null);

  const [eventError, setEventError] = useState("");
  const [entryConfirmationDefaultsError, setEntryConfirmationDefaultsError] = useState("");
  const [classError, setClassError] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [operationsError, setOperationsError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [iamError, setIamError] = useState("");
  const [iamBusyUserId, setIamBusyUserId] = useState<string | null>(null);
  const [iamCreatingUser, setIamCreatingUser] = useState(false);
  const [iamRoleDrafts, setIamRoleDrafts] = useState<Record<string, IamRole[]>>({});
  const [iamCreateForm, setIamCreateForm] = useState({
    email: "",
    roles: ["viewer"] as IamRole[],
    temporaryPassword: "",
    sendInvitation: true
  });

  const [pricingInitializedForEventId, setPricingInitializedForEventId] = useState<string | null>(null);
  const [eventOverridesExpanded, setEventOverridesExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("event");

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const syncIamRoleDrafts = (accounts: IamAccount[]) => {
    setIamRoleDrafts(
      Object.fromEntries(accounts.map((account) => [account.id, asRoleList(account.roles)]))
    );
  };

  const patchIamAccount = (updated: IamAccount) => {
    setIamOverview((prev) => {
      if (!prev) {
        return prev;
      }
      const hasExisting = prev.accounts.some((account) => account.id === updated.id);
      const nextAccounts = hasExisting
        ? prev.accounts.map((account) => (account.id === updated.id ? updated : account))
        : [updated, ...prev.accounts];
      return {
        ...prev,
        accounts: nextAccounts
      };
    });
    setIamRoleDrafts((prev) => ({
      ...prev,
      [updated.id]: asRoleList(updated.roles)
    }));
  };

  const resetEventScopedState = () => {
    setEventState(null);
    setClasses([]);
    setClassDrafts({});
    setNewClassDraft({ name: "", vehicleType: "auto" });
    setPricingForm(buildDefaultPricingForm([]));
    setPricingInitializedForEventId(null);
    setEventOverridesExpanded(false);
  };

  const loadData = async () => {
    setLoading(true);
    setNoCurrentEvent(false);
    setEventError("");
    setEntryConfirmationDefaultsError("");
    setClassError("");
    setPricingError("");
    setOperationsError("");
    setIamError("");

    try {
      const selectedEventId = readSelectedEventId();
      const [defaultsResult, iamResult, eventResult] = await Promise.allSettled([
        adminSettingsService.getEntryConfirmationDefaults(),
        adminIamService.getOverview(),
        selectedEventId ? adminSettingsService.getEvent(selectedEventId) : adminSettingsService.getCurrentEvent()
      ]);

      if (defaultsResult.status === "fulfilled") {
        setEntryConfirmationDefaults(entryConfirmationConfigToForm(defaultsResult.value));
      } else {
        setEntryConfirmationDefaults(createEmptyEntryConfirmationConfig());
        setEntryConfirmationDefaultsError(
          getApiErrorMessage(defaultsResult.reason, "Standarddaten der Nennbestätigung konnten nicht geladen werden.")
        );
      }

      if (iamResult.status === "fulfilled") {
        setIamOverview(iamResult.value);
        syncIamRoleDrafts(iamResult.value.accounts);
      } else {
        setIamOverview(null);
        setIamRoleDrafts({});
        setIamError(getApiErrorMessage(iamResult.reason, "IAM-Übersicht konnte nicht geladen werden."));
      }

      if (eventResult.status === "fulfilled") {
        const event = eventResult.value;
        const [classList, pricingRules] = await Promise.all([
          adminSettingsService.listClasses(event.id),
          adminSettingsService.getPricingRules(event.id).catch(() => null)
        ]);

        const nextEventForm = eventToForm(event);
        persistSelectedEventId(event.id);
        setEventState(event);
        setEventForm(nextEventForm);
        setEventOverridesExpanded(hasEntryConfirmationOverrides(nextEventForm.entryConfirmationConfig));
        setClasses(classList);
        setClassDrafts(
          Object.fromEntries(
            classList.map((item) => [item.id, { name: item.name, vehicleType: item.vehicleType }])
          )
        );

        const key = storageKeyForEvent(event.id);
        const storedDraft = window.localStorage.getItem(key);
        if (storedDraft) {
          try {
            const parsed = JSON.parse(storedDraft) as AdminSettingsPricingForm;
            setPricingForm(mergePricingWithClasses(parsed, classList));
          } catch {
            setPricingForm(pricingRules ? pricingRulesToForm(pricingRules, classList) : buildDefaultPricingForm(classList));
          }
        } else {
          setPricingForm(pricingRules ? pricingRulesToForm(pricingRules, classList) : buildDefaultPricingForm(classList));
        }
        setPricingInitializedForEventId(event.id);
      } else if (
        selectedEventId &&
        eventResult.reason instanceof ApiError &&
        eventResult.reason.status === 404
      ) {
        persistSelectedEventId(null);
        const fallbackEvent = await adminSettingsService.getCurrentEvent().catch(() => null);
        if (fallbackEvent) {
          const [classList, pricingRules] = await Promise.all([
            adminSettingsService.listClasses(fallbackEvent.id),
            adminSettingsService.getPricingRules(fallbackEvent.id).catch(() => null)
          ]);

          const nextEventForm = eventToForm(fallbackEvent);
          persistSelectedEventId(fallbackEvent.id);
          setEventState(fallbackEvent);
          setEventForm(nextEventForm);
          setEventOverridesExpanded(hasEntryConfirmationOverrides(nextEventForm.entryConfirmationConfig));
          setClasses(classList);
          setClassDrafts(
            Object.fromEntries(
              classList.map((item) => [item.id, { name: item.name, vehicleType: item.vehicleType }])
            )
          );

          const key = storageKeyForEvent(fallbackEvent.id);
          const storedDraft = window.localStorage.getItem(key);
          if (storedDraft) {
            try {
              const parsed = JSON.parse(storedDraft) as AdminSettingsPricingForm;
              setPricingForm(mergePricingWithClasses(parsed, classList));
            } catch {
              setPricingForm(
                pricingRules ? pricingRulesToForm(pricingRules, classList) : buildDefaultPricingForm(classList)
              );
            }
          } else {
            setPricingForm(pricingRules ? pricingRulesToForm(pricingRules, classList) : buildDefaultPricingForm(classList));
          }
          setPricingInitializedForEventId(fallbackEvent.id);
        } else {
          resetEventScopedState();
          setNoCurrentEvent(true);
          persistSelectedEventId(null);
        }
      } else if (
        eventResult.reason instanceof ApiError &&
        eventResult.reason.status === 404 &&
        eventResult.reason.code === "NOT_FOUND"
      ) {
        resetEventScopedState();
        setNoCurrentEvent(true);
        persistSelectedEventId(null);
        setEventForm({
          name: "",
          startsAt: "",
          endsAt: "",
          registrationOpenAt: "",
          registrationCloseAt: "",
          entryConfirmationConfig: createEmptyEntryConfirmationConfig()
        });
      } else {
        setEventError(getApiErrorMessage(eventResult.reason, "Einstellungen konnten nicht geladen werden."));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!eventState || pricingInitializedForEventId !== eventState.id) {
      return;
    }
    window.localStorage.setItem(storageKeyForEvent(eventState.id), JSON.stringify(pricingForm));
  }, [eventState, pricingForm, pricingInitializedForEventId]);

  const eventStatusBadge = useMemo(() => {
    if (!eventState) {
      return null;
    }

    const classesByStatus: Record<AdminSettingsEvent["status"], string> = {
      draft: "border-slate-300 bg-slate-100 text-slate-700",
      open: "border-emerald-300 bg-emerald-50 text-emerald-900",
      closed: "border-amber-300 bg-amber-50 text-amber-900",
      archived: "border-rose-300 bg-rose-50 text-rose-900"
    };

    return (
      <Badge variant="outline" className={classesByStatus[eventState.status]}>
        Status: {eventState.status}
      </Badge>
    );
  }, [eventState]);

  const updateDefaultEntryConfirmationField = <K extends keyof AdminSettingsEntryConfirmationConfig>(
    key: K,
    value: AdminSettingsEntryConfirmationConfig[K]
  ) => {
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const updateEventEntryConfirmationField = <K extends keyof AdminSettingsEntryConfirmationConfig>(
    key: K,
    value: AdminSettingsEntryConfirmationConfig[K]
  ) => {
    setEventForm((prev) => ({
      ...prev,
      entryConfirmationConfig: {
        ...prev.entryConfirmationConfig,
        [key]: value
      }
    }));
  };

  const updateDefaultImportantNote = (index: number, value: string) => {
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      importantNotes: prev.importantNotes.map((item, currentIndex) => (currentIndex === index ? value : item))
    }));
  };

  const updateEventImportantNote = (index: number, value: string) => {
    updateEventEntryConfirmationField(
      "importantNotes",
      eventForm.entryConfirmationConfig.importantNotes.map((item, currentIndex) =>
        currentIndex === index ? value : item
      )
    );
  };

  const addDefaultImportantNote = () => {
    if (entryConfirmationDefaults.importantNotes.length >= ENTRY_CONFIRMATION_LIST_LIMIT) {
      return;
    }
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      importantNotes: [...prev.importantNotes, ""]
    }));
  };

  const addEventImportantNote = () => {
    if (eventForm.entryConfirmationConfig.importantNotes.length >= ENTRY_CONFIRMATION_LIST_LIMIT) {
      return;
    }
    updateEventEntryConfirmationField("importantNotes", [...eventForm.entryConfirmationConfig.importantNotes, ""]);
  };

  const removeDefaultImportantNote = (index: number) => {
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      importantNotes: prev.importantNotes.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const removeEventImportantNote = (index: number) => {
    updateEventEntryConfirmationField(
      "importantNotes",
      eventForm.entryConfirmationConfig.importantNotes.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const updateDefaultScheduleItem = (
    index: number,
    key: keyof AdminSettingsEntryConfirmationScheduleItem,
    value: string
  ) => {
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      scheduleItems: prev.scheduleItems.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const updateEventScheduleItem = (
    index: number,
    key: keyof AdminSettingsEntryConfirmationScheduleItem,
    value: string
  ) => {
    updateEventEntryConfirmationField(
      "scheduleItems",
      eventForm.entryConfirmationConfig.scheduleItems.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item
      )
    );
  };

  const addDefaultScheduleItem = () => {
    if (entryConfirmationDefaults.scheduleItems.length >= ENTRY_CONFIRMATION_LIST_LIMIT) {
      return;
    }
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      scheduleItems: [...prev.scheduleItems, createEmptyEntryConfirmationScheduleItem()]
    }));
  };

  const addEventScheduleItem = () => {
    if (eventForm.entryConfirmationConfig.scheduleItems.length >= ENTRY_CONFIRMATION_LIST_LIMIT) {
      return;
    }
    updateEventEntryConfirmationField("scheduleItems", [
      ...eventForm.entryConfirmationConfig.scheduleItems,
      createEmptyEntryConfirmationScheduleItem()
    ]);
  };

  const removeDefaultScheduleItem = (index: number) => {
    setEntryConfirmationDefaults((prev) => ({
      ...prev,
      scheduleItems: prev.scheduleItems.filter((_, currentIndex) => currentIndex !== index)
    }));
  };

  const removeEventScheduleItem = (index: number) => {
    updateEventEntryConfirmationField(
      "scheduleItems",
      eventForm.entryConfirmationConfig.scheduleItems.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const createInitialEvent = async () => {
    setEventError("");

    if (!eventForm.name.trim()) {
      setEventError("Event-Name ist erforderlich.");
      return;
    }

    if (!eventForm.startsAt || !eventForm.endsAt) {
      setEventError("Event-Beginn und Event-Ende sind erforderlich.");
      return;
    }

    if (eventForm.startsAt > eventForm.endsAt) {
      setEventError("Event-Beginn darf nicht nach Event-Ende liegen.");
      return;
    }

    const hasRegistrationOpen = Boolean(eventForm.registrationOpenAt);
    const hasRegistrationClose = Boolean(eventForm.registrationCloseAt);
    if (hasRegistrationOpen !== hasRegistrationClose) {
      setEventError("Anmeldung öffnet/schließt muss vollständig gesetzt werden oder leer bleiben.");
      return;
    }

    if (hasRegistrationOpen && hasRegistrationClose) {
      const registrationOpen = parseDateTime(eventForm.registrationOpenAt);
      const registrationClose = parseDateTime(eventForm.registrationCloseAt);
      if (!registrationOpen || !registrationClose || registrationOpen >= registrationClose) {
        setEventError("Anmeldung öffnen muss vor Anmeldung schließen liegen.");
        return;
      }
    }

    setCreatingInitialEvent(true);

    try {
      const created = await adminSettingsService.createEvent({
        name: eventForm.name.trim(),
        startsAt: eventForm.startsAt,
        endsAt: eventForm.endsAt,
        registrationOpenAt: eventForm.registrationOpenAt,
        registrationCloseAt: eventForm.registrationCloseAt,
        entryConfirmationConfig: eventForm.entryConfirmationConfig
      });
      const nextEventForm = eventToForm(created);
      setNoCurrentEvent(false);
      setEventState(created);
      setEventForm(nextEventForm);
      setEventOverridesExpanded(hasEntryConfirmationOverrides(nextEventForm.entryConfirmationConfig));
      setClasses([]);
      setClassDrafts({});
      setPricingForm(buildDefaultPricingForm([]));
      setPricingInitializedForEventId(created.id);
      showToast("Event angelegt.");
    } catch (error) {
      setEventError(getApiErrorMessage(error, "Event konnte nicht angelegt werden."));
    } finally {
      setCreatingInitialEvent(false);
    }
  };

  const saveEntryConfirmationDefaults = async () => {
    setEntryConfirmationDefaultsError("");

    if (findInvalidScheduleItem(entryConfirmationDefaults)) {
      setEntryConfirmationDefaultsError(
        "Bitte prüfe die Standardtermine. Jede Terminzeile braucht mindestens eine Bezeichnung, und Ende darf nicht vor Beginn liegen."
      );
      return;
    }

    setSavingEntryConfirmationDefaults(true);

    try {
      const updated = await adminSettingsService.updateEntryConfirmationDefaults(entryConfirmationDefaults);
      setEntryConfirmationDefaults(entryConfirmationConfigToForm(updated));
      showToast("Standarddaten der Nennbestätigung gespeichert.");
    } catch (error) {
      setEntryConfirmationDefaultsError(
        getApiErrorMessage(error, "Standarddaten der Nennbestätigung konnten nicht gespeichert werden.")
      );
    } finally {
      setSavingEntryConfirmationDefaults(false);
    }
  };

  const saveEventConfiguration = async () => {
    if (!eventState) {
      return;
    }

    setEventError("");
    setPricingError("");

    if (!eventForm.name.trim()) {
      setEventError("Event-Name ist erforderlich.");
      return;
    }

    if (!eventForm.startsAt || !eventForm.endsAt) {
      setEventError("Event-Beginn und Event-Ende sind erforderlich.");
      return;
    }

    if (eventForm.startsAt > eventForm.endsAt) {
      setEventError("Event-Beginn darf nicht nach Event-Ende liegen.");
      return;
    }

    const registrationOpen = parseDateTime(eventForm.registrationOpenAt);
    const registrationClose = parseDateTime(eventForm.registrationCloseAt);

    if (!registrationOpen || !registrationClose) {
      setEventError("Anmeldung öffnet/schließt muss vollständig gesetzt werden.");
      return;
    }

    if (registrationOpen >= registrationClose) {
      setEventError("Anmeldung öffnen muss vor Anmeldung schließen liegen.");
      return;
    }

    if (!pricingForm.earlyDeadline) {
      setPricingError("Ende des 1. Anmeldefensters ist erforderlich.");
      return;
    }

    const earlyDeadline = parseDateTime(pricingForm.earlyDeadline);

    if (!earlyDeadline) {
      setPricingError("Zeitfenster sind ungültig formatiert.");
      return;
    }

    if (earlyDeadline <= registrationOpen) {
      setPricingError("Ende 1. Fenster muss nach Anmeldestart liegen.");
      return;
    }

    if (earlyDeadline >= registrationClose) {
      setPricingError("Ende 1. Fenster muss vor Anmeldeschluss liegen.");
      return;
    }

    if (!isNonNegativeInteger(pricingForm.lateFeeCents)) {
      setPricingError("Late Fee muss eine nicht-negative Ganzzahl sein.");
      return;
    }

    if (!isNonNegativeInteger(pricingForm.secondVehicleDiscountCents)) {
      setPricingError("Second Vehicle Discount muss eine nicht-negative Ganzzahl sein.");
      return;
    }

    const invalidClassRule = pricingForm.classRules.find((rule) => !isNonNegativeInteger(rule.baseFeeCents));
    if (invalidClassRule) {
      setPricingError(`Basispreis für ${invalidClassRule.className} ist ungültig.`);
      return;
    }

    if (findInvalidScheduleItem(eventForm.entryConfirmationConfig)) {
      setEventError(
        "Bitte prüfe die Event-Overrides der Nennbestätigung. Jede Terminzeile braucht mindestens eine Bezeichnung, und Ende darf nicht vor Beginn liegen."
      );
      return;
    }

    setSavingEvent(true);

    try {
      const updated = await adminSettingsService.updateEvent(eventState.id, {
        ...eventForm,
        entryConfirmationConfig: buildEventOverrideConfig(eventForm.entryConfirmationConfig, entryConfirmationDefaults)
      });
      await adminSettingsService.savePricingRules(eventState.id, pricingForm);
      const recalculateResult = await adminSettingsService.recalculateInvoices(eventState.id);
      const nextEventForm = eventToForm(updated);
      setEventState(updated);
      setEventForm(nextEventForm);
      setEventOverridesExpanded(hasEntryConfirmationOverrides(nextEventForm.entryConfirmationConfig));
      showToast(`Event-Konfiguration gespeichert (${recalculateResult.recalculated} Nennungen neu berechnet).`);
    } catch (error) {
      setEventError(getApiErrorMessage(error, "Event-Konfiguration konnte nicht gespeichert werden."));
    } finally {
      setSavingEvent(false);
    }
  };

  const createClass = async () => {
    if (!eventState) {
      return;
    }

    if (!newClassDraft.name.trim()) {
      setClassError("Klassenname ist erforderlich.");
      return;
    }

    setCreatingClass(true);
    setClassError("");

    try {
      const created = await adminSettingsService.createClass(eventState.id, {
        name: newClassDraft.name.trim(),
        vehicleType: newClassDraft.vehicleType
      });

      const nextClasses = [...classes, created];
      setClasses(nextClasses);
      setClassDrafts((prev) => ({
        ...prev,
        [created.id]: {
          name: created.name,
          vehicleType: created.vehicleType
        }
      }));
      setPricingForm((prev) => mergePricingWithClasses(prev, nextClasses));
      setNewClassDraft({ name: "", vehicleType: "auto" });
      showToast("Klasse angelegt.");
    } catch (error) {
      setClassError(getApiErrorMessage(error, "Klasse konnte nicht angelegt werden."));
    } finally {
      setCreatingClass(false);
    }
  };

  const saveClass = async (classId: string) => {
    const draft = classDrafts[classId];
    if (!draft) {
      return;
    }

    if (!draft.name.trim()) {
      setClassError("Klassenname ist erforderlich.");
      return;
    }

    setSavingClassId(classId);
    setClassError("");

    try {
      const updated = await adminSettingsService.updateClass(classId, {
        name: draft.name.trim(),
        vehicleType: draft.vehicleType
      });

      const nextClasses = classes.map((item) => (item.id === classId ? { ...item, ...updated } : item));
      setClasses(nextClasses);
      setPricingForm((prev) => mergePricingWithClasses(prev, nextClasses));
      showToast("Klasse gespeichert.");
    } catch (error) {
      setClassError(getApiErrorMessage(error, "Klasse konnte nicht gespeichert werden."));
    } finally {
      setSavingClassId(null);
    }
  };

  const removeClass = async (classId: string) => {
    if (!window.confirm("Klasse wirklich löschen?")) {
      return;
    }

    setSavingClassId(classId);
    setClassError("");

    try {
      await adminSettingsService.deleteClass(classId);
      const nextClasses = classes.filter((item) => item.id !== classId);
      setClasses(nextClasses);
      setClassDrafts((prev) => {
        const next = { ...prev };
        delete next[classId];
        return next;
      });
      setPricingForm((prev) => mergePricingWithClasses(prev, nextClasses));
      showToast("Klasse gelöscht.");
    } catch (error) {
      setClassError(getApiErrorMessage(error, "Klasse konnte nicht gelöscht werden."));
    } finally {
      setSavingClassId(null);
    }
  };

  const runOperation = async (operation: "close" | "archive" | "activate") => {
    if (!eventState) {
      return;
    }

    const restoreArchivedEvent = operation === "activate" && eventState.status === "archived";
    const confirmText: Record<typeof operation, string> = {
      close: "Event wirklich schließen?",
      archive: "Event wirklich archivieren?",
      activate: restoreArchivedEvent ? "Archiviertes Event wirklich als geschlossen wiederherstellen?" : "Geschlossenes Event wirklich wieder öffnen?"
    };

    if (!window.confirm(confirmText[operation])) {
      return;
    }

    setOperationBusy(operation);
    setOperationsError("");

    try {
      if (operation === "close") {
        const updated = await adminSettingsService.closeEvent(eventState.id);
        persistSelectedEventId(updated.id);
        setEventState(updated);
        showToast("Event wurde geschlossen.");
      } else if (operation === "activate") {
        const updated = await adminSettingsService.activateEvent(eventState.id);
        persistSelectedEventId(updated.id);
        setEventState(updated);
        showToast(restoreArchivedEvent ? "Event wurde als geschlossen wiederhergestellt." : "Event wurde wieder geöffnet.");
      } else {
        const updated = await adminSettingsService.archiveEvent(eventState.id);
        persistSelectedEventId(updated.id);
        setEventState(updated);
        showToast("Event wurde archiviert.");
      }
    } catch (error) {
      setOperationsError(getApiErrorMessage(error, "Operation konnte nicht ausgeführt werden."));
    } finally {
      setOperationBusy(null);
    }
  };

  const toggleRoleInList = (rolesList: IamRole[], role: IamRole) => {
    if (rolesList.includes(role)) {
      const next = rolesList.filter((item) => item !== role);
      return next.length > 0 ? next : rolesList;
    }
    return asRoleList([...rolesList, role]);
  };

  const createIamUser = async () => {
    if (!canManageIam) {
      return;
    }

    const email = iamCreateForm.email.trim();
    if (!email) {
      setIamError("E-Mail ist erforderlich.");
      return;
    }

    if (iamCreateForm.roles.length === 0) {
      setIamError("Mindestens eine Rolle muss gewählt werden.");
      return;
    }

    setIamCreatingUser(true);
    setIamError("");

    try {
      const created = await adminIamService.createUser({
        email,
        roles: iamCreateForm.roles,
        temporaryPassword: iamCreateForm.temporaryPassword.trim() || undefined,
        sendInvitation: iamCreateForm.sendInvitation
      });

      patchIamAccount(created);
      setIamCreateForm({
        email: "",
        roles: ["viewer"],
        temporaryPassword: "",
        sendInvitation: true
      });
      showToast("IAM-Account angelegt.");
    } catch (error) {
      setIamError(getIamCreateUserErrorMessage(error));
    } finally {
      setIamCreatingUser(false);
    }
  };

  const saveIamRoles = async (userId: string) => {
    if (!canManageIam || !iamOverview) {
      return;
    }

    const draftRoles = asRoleList(iamRoleDrafts[userId] ?? []);
    if (draftRoles.length === 0) {
      setIamError("Mindestens eine Rolle muss gewählt werden.");
      return;
    }

    const existing = iamOverview.accounts.find((account) => account.id === userId);
    if (!existing || rolesEqual(existing.roles, draftRoles)) {
      return;
    }

    setIamBusyUserId(userId);
    setIamError("");

    try {
      const updated = await adminIamService.updateUserRoles(userId, draftRoles);
      patchIamAccount(updated);
      showToast("Rollen aktualisiert.");
    } catch (error) {
      setIamError(getApiErrorMessage(error, "Rollen konnten nicht aktualisiert werden."));
    } finally {
      setIamBusyUserId(null);
    }
  };

  const toggleIamStatus = async (userId: string, enabled: boolean) => {
    if (!canManageIam) {
      return;
    }

    setIamBusyUserId(userId);
    setIamError("");

    try {
      const updated = await adminIamService.updateUserStatus(userId, enabled);
      patchIamAccount(updated);
      showToast(enabled ? "Account aktiviert." : "Account deaktiviert.");
    } catch (error) {
      setIamError(getApiErrorMessage(error, "Account-Status konnte nicht aktualisiert werden."));
    } finally {
      setIamBusyUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Einstellungen</h1>
        {eventStatusBadge}
      </div>

      {!canManage && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Du bist ohne Admin-Rolle angemeldet. Einstellungen sind schreibgeschützt.
        </div>
      )}

      {loading && <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Lade Einstellungen…</div>}

      {!loading && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-2">
              {([
                ["event", "Event"],
                ["confirmation", "Nennbestätigung"],
                ["classes", "Klassen"],
                ["iam", "IAM"]
              ] as Array<[SettingsTab, string]>).map(([tabId, label]) => (
                <Button
                  key={tabId}
                  type="button"
                  variant={activeTab === tabId ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab(tabId)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {activeTab === "confirmation" && (
            <Card>
              <CardHeader>
                <CardTitle>Standarddaten für Nennbestätigung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-sm text-slate-600">
                  Diese Standarddaten gelten für alle Veranstaltungen. Im Event können bei Bedarf nur einzelne Abweichungen
                  als Override gepflegt werden.
                </div>

                <EntryConfirmationConfigEditor
                  mode="defaults"
                  config={entryConfirmationDefaults}
                  disabled={!canManage}
                  onFieldChange={updateDefaultEntryConfirmationField}
                  onImportantNoteChange={updateDefaultImportantNote}
                  onAddImportantNote={addDefaultImportantNote}
                  onRemoveImportantNote={removeDefaultImportantNote}
                  onScheduleItemChange={updateDefaultScheduleItem}
                  onAddScheduleItem={addDefaultScheduleItem}
                  onRemoveScheduleItem={removeDefaultScheduleItem}
                />

                {entryConfirmationDefaultsError && (
                  <div className="text-sm text-destructive">{entryConfirmationDefaultsError}</div>
                )}

                <Button
                  type="button"
                  disabled={!canManage || savingEntryConfirmationDefaults}
                  onClick={() => void saveEntryConfirmationDefaults()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingEntryConfirmationDefaults ? "Speichert…" : "Standarddaten speichern"}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === "event" && (
            <>
              {noCurrentEvent ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Neues Event anlegen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-slate-600">
                      Es gibt aktuell kein Event. Lege hier zuerst ein Event an, danach kannst du Klassen, Preise und weitere Einstellungen pflegen.
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Event-Name</Label>
                        <Input
                          value={eventForm.name}
                          disabled={!canManage}
                          onChange={(event) => setEventForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Event beginnt</Label>
                        <Input
                          type="date"
                          value={eventForm.startsAt}
                          disabled={!canManage}
                          onChange={(event) => setEventForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Event endet</Label>
                        <Input
                          type="date"
                          value={eventForm.endsAt}
                          disabled={!canManage}
                          onChange={(event) => setEventForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Anmeldung öffnet (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={eventForm.registrationOpenAt}
                          disabled={!canManage}
                          onChange={(event) => setEventForm((prev) => ({ ...prev, registrationOpenAt: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Anmeldung schließt (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={eventForm.registrationCloseAt}
                          disabled={!canManage}
                          onChange={(event) => setEventForm((prev) => ({ ...prev, registrationCloseAt: event.target.value }))}
                        />
                      </div>
                    </div>

                    {eventError && <div className="text-sm text-destructive">{eventError}</div>}

                    <Button type="button" disabled={!canManage || creatingInitialEvent} onClick={() => void createInitialEvent()}>
                      <Plus className="mr-2 h-4 w-4" />
                      {creatingInitialEvent ? "Legt an…" : "Event anlegen"}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
            <CardHeader>
              <CardTitle>Event-Konfiguration</CardTitle>
            </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Event-Name</Label>
                      <Input
                        value={eventForm.name}
                        disabled={!canManage || !eventState}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Event beginnt</Label>
                      <Input
                        type="date"
                        value={eventForm.startsAt}
                        disabled={!canManage || !eventState}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Event endet</Label>
                      <Input
                        type="date"
                        value={eventForm.endsAt}
                        disabled={!canManage || !eventState}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Anmeldung öffnet</Label>
                      <Input
                        type="datetime-local"
                        value={eventForm.registrationOpenAt}
                        disabled={!canManage || !eventState}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, registrationOpenAt: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Anmeldung schließt (final)</Label>
                      <Input
                        type="datetime-local"
                        value={eventForm.registrationCloseAt}
                        disabled={!canManage || !eventState}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, registrationCloseAt: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <div className="text-sm font-semibold text-slate-900">Anmeldefenster & Preise</div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Ende 1. Anmeldefenster</Label>
                        <Input
                          type="datetime-local"
                          value={pricingForm.earlyDeadline}
                          disabled={!canManage || !eventState}
                          onChange={(event) => setPricingForm((prev) => ({ ...prev, earlyDeadline: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Aufpreis ab 2. Fenster (Cent)</Label>
                        <Input
                          value={pricingForm.lateFeeCents}
                          disabled={!canManage || !eventState}
                          onChange={(event) =>
                            setPricingForm((prev) => ({ ...prev, lateFeeCents: event.target.value.replace(/\D/g, "") }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>2. Fahrzeug Rabatt (Cent)</Label>
                        <Input
                          value={pricingForm.secondVehicleDiscountCents}
                          disabled={!canManage || !eventState}
                          onChange={(event) =>
                            setPricingForm((prev) => ({
                              ...prev,
                              secondVehicleDiscountCents: event.target.value.replace(/\D/g, "")
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      {pricingForm.classRules.map((rule, index) => (
                        <div key={rule.classId} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_220px]">
                          <div className="text-sm font-medium text-slate-900">{rule.className}</div>
                          <div className="space-y-1">
                            <Label>Basispreis (Cent)</Label>
                            <Input
                              value={rule.baseFeeCents}
                              inputMode="numeric"
                              disabled={!canManage || !eventState}
                              onChange={(event) => {
                                const value = event.target.value.replace(/\D/g, "");
                                setPricingForm((prev) => {
                                  const next = [...prev.classRules];
                                  next[index] = { ...next[index], baseFeeCents: value };
                                  return { ...prev, classRules: next };
                                });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {eventError && <div className="text-sm text-destructive">{eventError}</div>}
                  {pricingError && <div className="text-sm text-destructive">{pricingError}</div>}

                  <Button
                    type="button"
                    disabled={!canManage || savingEvent || !eventState}
                    onClick={() => void saveEventConfiguration()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingEvent ? "Speichert…" : "Event-Konfiguration speichern"}
                  </Button>
                </CardContent>
              </Card>

                  <Card>
            <CardHeader>
              <CardTitle>Event-Status ändern</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(eventState?.status === "archived" || eventState?.status === "closed") && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canManage || !eventState || operationBusy !== null}
                    onClick={() => void runOperation("activate")}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {eventState?.status === "archived" ? "Event als geschlossen wiederherstellen" : "Event wieder öffnen"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManage || !eventState || operationBusy !== null}
                  onClick={() => void runOperation("close")}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Event schließen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canManage || !eventState || operationBusy !== null || eventState?.status === "archived"}
                  onClick={() => void runOperation("archive")}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Event archivieren
                </Button>
              </div>

              {operationsError && <div className="text-sm text-destructive">{operationsError}</div>}
            </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {activeTab === "confirmation" && !noCurrentEvent && (
            <Card>
              <CardHeader>
                <CardTitle>Event-Overrides für Nennbestätigung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Abweichungen für dieses Event</div>
                    <div className="text-sm text-slate-600">
                      Standarddaten gelten automatisch. Öffne diesen Bereich nur, wenn dieses Event an einzelnen Stellen andere Angaben braucht.
                    </div>
                    {hasEntryConfirmationOverrides(eventForm.entryConfirmationConfig) ? (
                      <div className="flex flex-wrap gap-2">
                        {getEntryConfirmationOverrideSections(eventForm.entryConfirmationConfig).map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-emerald-700">Aktuell verwendet dieses Event nur die Standarddaten.</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasEntryConfirmationOverrides(eventForm.entryConfirmationConfig) ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canManage || !eventState}
                        onClick={() => {
                          setEventForm((prev) => ({
                            ...prev,
                            entryConfirmationConfig: createEmptyEntryConfirmationConfig()
                          }));
                          setEventOverridesExpanded(false);
                        }}
                      >
                        Overrides zurücksetzen
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canManage || !eventState}
                      onClick={() => setEventOverridesExpanded((prev) => !prev)}
                    >
                      {eventOverridesExpanded ? "Overrides ausblenden" : "Overrides bearbeiten"}
                    </Button>
                  </div>
                </div>

                {eventOverridesExpanded ? (
                  <EntryConfirmationConfigEditor
                    mode="overrides"
                    config={eventForm.entryConfirmationConfig}
                    defaults={entryConfirmationDefaults}
                    disabled={!canManage || !eventState}
                    onFieldChange={updateEventEntryConfirmationField}
                    onImportantNoteChange={updateEventImportantNote}
                    onAddImportantNote={addEventImportantNote}
                    onRemoveImportantNote={removeEventImportantNote}
                    onScheduleItemChange={updateEventScheduleItem}
                    onAddScheduleItem={addEventScheduleItem}
                    onRemoveScheduleItem={removeEventScheduleItem}
                  />
                ) : null}
              </CardContent>
            </Card>
          )}

          {activeTab === "confirmation" && noCurrentEvent && (
            <Card>
              <CardHeader>
                <CardTitle>Nennbestätigung</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Sobald ein Event angelegt ist, können hier eventbezogene Abweichungen zu den Standarddaten gepflegt werden.
              </CardContent>
            </Card>
          )}

          {activeTab === "classes" && (
            <Card>
              <CardHeader>
                <CardTitle>Klassen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {noCurrentEvent ? (
                  <div className="text-sm text-slate-600">Lege zuerst ein Event an, bevor Klassen gepflegt werden.</div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
                      <div className="space-y-1">
                        <Label>Neue Klasse</Label>
                        <Input
                          value={newClassDraft.name}
                          disabled={!canManage || !eventState}
                          onChange={(event) => setNewClassDraft((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Fahrzeugtyp</Label>
                        <Select
                          value={newClassDraft.vehicleType}
                          disabled={!canManage || !eventState}
                          onValueChange={(next) =>
                            setNewClassDraft((prev) => ({
                              ...prev,
                              vehicleType: next as VehicleType
                            }))
                          }
                        >
                          <SelectTrigger className="text-base md:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">auto</SelectItem>
                            <SelectItem value="moto">moto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" disabled={!canManage || creatingClass || !eventState} onClick={() => void createClass()}>
                          <Plus className="mr-2 h-4 w-4" />
                          Anlegen
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {classes.map((item) => {
                        const draft = classDrafts[item.id] ?? { name: item.name, vehicleType: item.vehicleType };
                        const rowBusy = savingClassId === item.id;

                        return (
                          <div key={item.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_160px_auto_auto]">
                            <Input
                              value={draft.name}
                              disabled={!canManage || rowBusy}
                              onChange={(event) =>
                                setClassDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    name: event.target.value
                                  }
                                }))
                              }
                            />
                            <Select
                              value={draft.vehicleType}
                              disabled={!canManage || rowBusy}
                              onValueChange={(next) =>
                                setClassDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...draft,
                                    vehicleType: next as VehicleType
                                  }
                                }))
                              }
                            >
                              <SelectTrigger className="text-base md:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">auto</SelectItem>
                                <SelectItem value="moto">moto</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button type="button" variant="outline" disabled={!canManage || rowBusy} onClick={() => void saveClass(item.id)}>
                              <Save className="mr-2 h-4 w-4" />
                              Speichern
                            </Button>
                            <Button type="button" variant="destructive" disabled={!canManage || rowBusy} onClick={() => void removeClass(item.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Löschen
                            </Button>
                          </div>
                        );
                      })}
                      {classes.length === 0 && <div className="text-sm text-slate-500">Keine Klassen vorhanden.</div>}
                    </div>
                  </>
                )}

                {classError && <div className="text-sm text-destructive">{classError}</div>}
              </CardContent>
            </Card>
          )}

          {activeTab === "iam" && (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                IAM: Accounts & Rollen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManageIam && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Du hast keine Berechtigung für IAM-Änderungen.
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Rollen</h3>
                <div className="space-y-2">
                  {(iamOverview?.roles ?? []).map((role) => (
                    <div key={role.role} className="rounded-md border p-3">
                      <div className="font-medium text-slate-900">{role.role}</div>
                      <div className="text-sm text-slate-600">{role.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Account anlegen</h3>
                <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>E-Mail</Label>
                    <Input
                      value={iamCreateForm.email}
                      disabled={!canManageIam || iamCreatingUser}
                      onChange={(event) =>
                        setIamCreateForm((prev) => ({
                          ...prev,
                          email: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Temporäres Passwort (optional)</Label>
                    <Input
                      value={iamCreateForm.temporaryPassword}
                      disabled={!canManageIam || iamCreatingUser}
                      onChange={(event) =>
                        setIamCreateForm((prev) => ({
                          ...prev,
                          temporaryPassword: event.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Rollen</Label>
                    <div className="flex flex-wrap gap-3 pt-1">
                      {(["admin", "editor", "viewer"] as IamRole[]).map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={iamCreateForm.roles.includes(role)}
                            disabled={!canManageIam || iamCreatingUser}
                            onChange={() =>
                              setIamCreateForm((prev) => ({
                                ...prev,
                                roles: toggleRoleInList(prev.roles, role)
                              }))
                            }
                          />
                          {role}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={iamCreateForm.sendInvitation}
                        disabled={!canManageIam || iamCreatingUser}
                        onChange={(event) =>
                          setIamCreateForm((prev) => ({
                            ...prev,
                            sendInvitation: event.target.checked
                          }))
                        }
                      />
                      Einladung per Cognito senden
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" disabled={!canManageIam || iamCreatingUser} onClick={() => void createIamUser()}>
                      <Users className="mr-2 h-4 w-4" />
                      {iamCreatingUser ? "Legt an…" : "Account anlegen"}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Permission Matrix</h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Bereich</th>
                        <th className="px-3 py-2">admin</th>
                        <th className="px-3 py-2">editor</th>
                        <th className="px-3 py-2">viewer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(iamOverview?.matrix ?? []).map((row) => (
                        <tr key={row.area} className="border-t">
                          <td className="px-3 py-2">{row.area}</td>
                          <td className="px-3 py-2">{row.admin}</td>
                          <td className="px-3 py-2">{row.editor}</td>
                          <td className="px-3 py-2">{row.viewer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Accounts</h3>
                {(iamOverview?.accounts ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-slate-500">
                    Keine Accounts aus API verfügbar.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Username</th>
                          <th className="px-3 py-2">E-Mail</th>
                          <th className="px-3 py-2">Rollen</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(iamOverview?.accounts ?? []).map((account) => {
                          const rowBusy = iamBusyUserId === account.id;
                          const draftRoles = asRoleList(iamRoleDrafts[account.id] ?? account.roles);
                          const rolesChanged = !rolesEqual(draftRoles, asRoleList(account.roles));

                          return (
                            <tr key={account.id} className="border-t align-top">
                              <td className="px-3 py-2">{account.username}</td>
                              <td className="px-3 py-2">{account.email || "-"}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-3">
                                  {(["admin", "editor", "viewer"] as IamRole[]).map((role) => (
                                    <label key={role} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={draftRoles.includes(role)}
                                        disabled={!canManageIam || rowBusy}
                                        onChange={() =>
                                          setIamRoleDrafts((prev) => ({
                                            ...prev,
                                            [account.id]: toggleRoleInList(draftRoles, role)
                                          }))
                                        }
                                      />
                                      {role}
                                    </label>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div>{account.enabled ? "active" : "disabled"}</div>
                                <div className="text-xs text-slate-500">{account.status}</div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!canManageIam || rowBusy || !rolesChanged}
                                    onClick={() => void saveIamRoles(account.id)}
                                  >
                                    Rollen speichern
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!canManageIam || rowBusy}
                                    onClick={() => void toggleIamStatus(account.id, !account.enabled)}
                                  >
                                    {account.enabled ? "Deaktivieren" : "Aktivieren"}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {iamError && <div className="text-sm text-destructive">{iamError}</div>}
            </CardContent>
            </Card>
          )}
        </>
      )}

      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
