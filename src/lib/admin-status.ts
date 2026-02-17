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
  return isVerified ? "Eingecheckt" : "Nicht eingecheckt";
}

export function acceptanceStatusClasses(status: AcceptanceStatus): string {
  return {
    pending: "border-amber-300 bg-amber-50 text-amber-900",
    shortlist: "border-orange-300 bg-orange-50 text-orange-900",
    accepted: "border-emerald-300 bg-emerald-50 text-emerald-900",
    rejected: "border-rose-300 bg-rose-50 text-rose-900"
  }[status];
}

export function acceptanceStatusRowAccentClasses(status: AcceptanceStatus): string {
  return {
    pending: "border-l-4 border-l-amber-400",
    shortlist: "border-l-4 border-l-orange-400",
    accepted: "border-l-4 border-l-emerald-400",
    rejected: "border-l-4 border-l-rose-400"
  }[status];
}

export function paymentStatusClasses(status: PaymentStatus): string {
  return {
    due: "border-amber-300 bg-amber-50 text-amber-900",
    paid: "border-emerald-300 bg-emerald-50 text-emerald-900"
  }[status];
}

export function checkinClasses(isVerified: boolean): string {
  return isVerified ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-100 text-slate-800";
}

export function outboxStatusClasses(status: OutboxStatus): string {
  return {
    queued: "border-blue-300 bg-blue-50 text-blue-900",
    sending: "border-indigo-300 bg-indigo-50 text-indigo-900",
    sent: "border-emerald-300 bg-emerald-50 text-emerald-900",
    failed: "border-rose-300 bg-rose-50 text-rose-900"
  }[status];
}

export function exportStatusClasses(status: ExportJobStatus): string {
  return {
    queued: "border-blue-300 bg-blue-50 text-blue-900",
    processing: "border-indigo-300 bg-indigo-50 text-indigo-900",
    succeeded: "border-emerald-300 bg-emerald-50 text-emerald-900",
    failed: "border-rose-300 bg-rose-50 text-rose-900"
  }[status];
}
