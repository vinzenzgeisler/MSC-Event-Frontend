/**
 * Gemeinsame Status-/Sichtbarkeits-Übersetzungen für die RacePic-Admin-Oberfläche.
 *
 * Vorher standen sechs sich überlappende Vokabulare an sechs verschiedenen Stellen im Code
 * (racepic-page.tsx, racepic-conversions-page.tsx) - Nutzerfeedback 2026-09-29: "verwirrende
 * Begriffe/Status". Dieses Modul bündelt sie an einer Stelle, mit Kommentar, wofür jede Map steht,
 * damit ähnlich klingende, aber unterschiedliche Konzepte nicht wieder verwechselt werden.
 */

/** Verarbeitungsstatus eines Bildes (racepic_image.processing_status) - die KI-Pipeline (Ingest →
 * Analyze → Match) läuft asynchron über SQS, ein frisch hochgeladenes Bild durchläuft diese Stati
 * nacheinander. */
export const PROCESSING_STATUS_ORDER = ["UPLOADED", "VALIDATED", "DERIVED", "ANALYZED", "MATCHED", "FAILED", "DUPLICATE"];
export const PROCESSING_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Hochgeladen",
  VALIDATED: "Geprüft",
  DERIVED: "Varianten werden erzeugt",
  ANALYZED: "KI-Analyse fertig",
  MATCHED: "Zuordnung berechnet",
  FAILED: "Fehlgeschlagen",
  DUPLICATE: "Duplikat",
};
/** Bilder in diesen Stati werden noch von der Pipeline verarbeitet - solange mindestens eins davon
 * existiert, lohnt sich Polling. DUPLICATE/FAILED sind Endzustände, die nie ein Vorschaubild
 * bekommen (siehe HAS_THUMB_STATUSES im Backend, api/src/racepic/uploads.ts). */
export const PROCESSING_NON_TERMINAL_STATUSES = new Set(["UPLOADED", "VALIDATED", "DERIVED", "ANALYZED"]);
export const PROCESSING_STATUS_BADGE_CLASS: Record<string, string> = {
  UPLOADED: "border-slate-300 text-slate-500",
  VALIDATED: "border-slate-300 text-slate-500",
  DERIVED: "border-blue-300 text-blue-600",
  ANALYZED: "border-blue-300 text-blue-600",
  MATCHED: "border-green-300 text-green-700",
  FAILED: "border-red-300 text-red-700",
  DUPLICATE: "border-amber-300 text-amber-700",
};

/** Sichtbarkeit eines Bildes (racepic_image.visibility) - unabhängig vom Verarbeitungsstatus: ein
 * Bild kann fertig verarbeitet und trotzdem noch nicht (DRAFT) oder nicht mehr (HIDDEN/REMOVED)
 * öffentlich sein. */
export const VISIBILITY_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
  HIDDEN: "Verborgen",
  REMOVED: "Entfernt",
};

/** Zuordnungs-Zusammenfassung aus der Perspektive EINES BILDES (RacepicAdminImage.assignmentState) -
 * "hat dieses Bild insgesamt einen bestätigten Fahrer?". Nicht zu verwechseln mit
 * ASSIGNMENT_STATUS_LABELS unten, die den Status EINES EINZELNEN Zuordnungs-Datensatzes beschreiben
 * (ein Bild kann mehrere Zuordnungen haben, z. B. bei mehreren Fahrzeugen im selben Foto). */
export const ASSIGNMENT_STATE_LABEL: Record<string, string> = {
  CONFIRMED: "Bestätigt",
  AUTO_MATCHED: "Automatisch zugeordnet",
  REVIEW_REQUIRED: "Prüfung nötig",
  UNASSIGNED: "Kein Fahrer zugeordnet",
};

/** Status EINES EINZELNEN Zuordnungs-Datensatzes (racepic_assignment.status). */
export const ASSIGNMENT_STATUS_ORDER = ["REVIEW_REQUIRED", "AUTO_MATCHED", "MANUALLY_CONFIRMED", "MANUALLY_CORRECTED", "REJECTED"];
export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  REVIEW_REQUIRED: "Wartet auf Entscheidung",
  AUTO_MATCHED: "Automatisch zugeordnet",
  MANUALLY_CONFIRMED: "Bestätigt",
  MANUALLY_CORRECTED: "Manuell korrigiert",
  REJECTED: "Abgelehnt",
};

/** Fotograf:innen-Status (racepic_photographer.status) - vereinfachte Anzeige: alles außer
 * ACTIVE_FREE/PAYMENT_ENABLED gilt als "nicht aktiv". */
export const PHOTOGRAPHER_STATUS_LABELS: Record<string, string> = {
  INVITED: "Eingeladen",
  PENDING_APPROVAL: "Wartet auf Freigabe",
  ACTIVE_FREE: "Aktiv",
  PAYMENT_ONBOARDING_REQUIRED: "Auszahlung: Einrichtung nötig",
  PAYMENT_ONBOARDING_PENDING: "Auszahlung: Einrichtung läuft",
  PAYMENT_ENABLED: "Aktiv (Auszahlung eingerichtet)",
  PAYMENT_RESTRICTED: "Auszahlung eingeschränkt",
  PAYMENT_DISABLED: "Auszahlung deaktiviert",
  DISABLED: "Deaktiviert",
};

/** FREE→PAID-Preisumstellungsantrag (racepic_offer_conversion.status). */
export const CONVERSION_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Beantragt",
  PREPARING_ASSETS: "Bereitet Dateien vor",
  READY_FOR_REVIEW: "Zur Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  FAILED: "Fehlgeschlagen",
};
