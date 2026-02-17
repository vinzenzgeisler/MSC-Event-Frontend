import type { AcceptanceStatus, ExportJobStatus, OutboxStatus, PaymentStatus } from "@/types/common";

export function acceptanceStatusLabel(status: AcceptanceStatus): string {
  return {
    pending: "Offen",
    shortlist: "Vorauswahl",
    accepted: "Zugelassen",
    rejected: "Abgelehnt"
  }[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return {
    due: "Offen",
    paid: "Bezahlt"
  }[status];
}

export function outboxStatusLabel(status: OutboxStatus): string {
  return {
    queued: "In Warteschlange",
    sending: "Wird versendet",
    sent: "Versendet",
    failed: "Fehlgeschlagen"
  }[status];
}

export function exportStatusLabel(status: ExportJobStatus): string {
  return {
    queued: "In Warteschlange",
    processing: "In Bearbeitung",
    succeeded: "Erfolgreich",
    failed: "Fehlgeschlagen"
  }[status];
}

export function checkinLabel(isVerified: boolean): string {
  return isVerified ? "Bestätigt" : "Ausstehend";
}

export function acceptanceStatusClasses(status: AcceptanceStatus): string {
  return {
    pending: "border-amber-300 bg-amber-50 text-amber-900",
    shortlist: "border-primary/35 bg-primary/10 text-primary",
    accepted: "border-primary/35 bg-primary/10 text-primary",
    rejected: "border-rose-300 bg-rose-50 text-rose-900"
  }[status];
}

export function acceptanceStatusRowAccentClasses(status: AcceptanceStatus): string {
  return {
    pending: "border-l-4 border-l-amber-400 bg-amber-50/25",
    shortlist: "border-l-4 border-l-primary/70 bg-primary/5",
    accepted: "border-l-4 border-l-primary/70 bg-primary/5",
    rejected: "border-l-4 border-l-rose-400 bg-rose-50/25"
  }[status];
}

export function paymentStatusClasses(status: PaymentStatus): string {
  return {
    due: "border-amber-300 bg-amber-50 text-amber-900",
    paid: "border-primary/35 bg-primary/10 text-primary"
  }[status];
}

export function checkinClasses(isVerified: boolean): string {
  return isVerified ? "border-primary/35 bg-primary/10 text-primary" : "border-slate-300 bg-slate-100 text-slate-800";
}

export function outboxStatusClasses(status: OutboxStatus): string {
  return {
    queued: "border-primary/35 bg-primary/10 text-primary",
    sending: "border-indigo-300 bg-indigo-50 text-indigo-900",
    sent: "border-primary/35 bg-primary/10 text-primary",
    failed: "border-rose-300 bg-rose-50 text-rose-900"
  }[status];
}

export function exportStatusClasses(status: ExportJobStatus): string {
  return {
    queued: "border-primary/35 bg-primary/10 text-primary",
    processing: "border-indigo-300 bg-indigo-50 text-indigo-900",
    succeeded: "border-primary/35 bg-primary/10 text-primary",
    failed: "border-rose-300 bg-rose-50 text-rose-900"
  }[status];
}
