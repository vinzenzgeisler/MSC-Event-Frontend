import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiNoticeTone } from "@/types/ai-communication";

const toneConfig: Record<
  AiNoticeTone,
  { icon: typeof Info; className: string }
> = {
  info: {
    icon: Info,
    className: "border-sky-200 bg-sky-50 text-sky-900"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-900"
  },
  critical: {
    icon: AlertCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive"
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900"
  }
};

export function AiNotice(props: { tone?: AiNoticeTone; title: string; children: React.ReactNode; className?: string }) {
  const tone = props.tone ?? "info";
  const Icon = toneConfig[tone].icon;

  return (
    <div className={cn("rounded-lg border p-4", toneConfig[tone].className, props.className)}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <div className="text-sm font-semibold">{props.title}</div>
          <div className="text-sm leading-6">{props.children}</div>
        </div>
      </div>
    </div>
  );
}
