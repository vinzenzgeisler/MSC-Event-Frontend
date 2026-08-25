import type { MarshalCommitmentStatus } from "@/types/admin-marshals";
import { cn } from "@/lib/utils";

export const marshalStatusLabels: Record<MarshalCommitmentStatus, string> = {
  accepted: "Zugesagt", tentative: "Vielleicht", declined: "Abgesagt", pending: "Offen", not_asked: "Nicht angefragt",
};

export function StatusBadge({ status }: { status: MarshalCommitmentStatus }) {
  const classes: Record<MarshalCommitmentStatus, string> = {
    accepted: "border-green-200 bg-green-100 text-green-800",
    tentative: "border-amber-200 bg-amber-100 text-amber-800",
    declined: "border-red-200 bg-red-100 text-red-800",
    pending: "border-blue-200 bg-blue-100 text-blue-800",
    not_asked: "border-slate-200 bg-slate-100 text-slate-500",
  };
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", classes[status])}>{marshalStatusLabels[status]}</span>;
}

export function StatusCell({ status }: { status: MarshalCommitmentStatus }) {
  const classes: Record<MarshalCommitmentStatus, string> = {
    accepted: "border-green-300 bg-green-100 text-green-800", tentative: "border-amber-300 bg-amber-100 text-amber-800",
    declined: "border-red-300 bg-red-100 text-red-800", pending: "border-blue-300 bg-blue-100 text-blue-800",
    not_asked: "border-slate-200 bg-slate-100 text-slate-400",
  };
  const labels: Record<MarshalCommitmentStatus, string> = { accepted: "✓", tentative: "?", declined: "✗", pending: "○", not_asked: "—" };
  return <span className={cn("inline-block h-7 w-7 rounded border text-center text-xs leading-7", classes[status])}>{labels[status]}</span>;
}

export function nextMarshalStatus(current: MarshalCommitmentStatus): MarshalCommitmentStatus {
  const cycle: MarshalCommitmentStatus[] = ["not_asked", "accepted", "tentative", "declined"];
  return cycle[(cycle.indexOf(current) + 1) % cycle.length];
}
