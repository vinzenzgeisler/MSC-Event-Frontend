import { Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/ai-communication", label: "Dashboard", end: true },
  { href: "/admin/ai-communication/mail-assistant", label: "Mail-Assistent" },
  { href: "/admin/ai-communication/report-generator", label: "Berichte" },
  { href: "/admin/ai-communication/speaker-assistant", label: "Sprecherassistenz" }
];

export const textareaClassName =
  "min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AiCommunicationShell(props: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                  KI-Kommunikation
                </Badge>
                <div className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <Sparkles className="h-4 w-4" />
                  KI unterstützt Formulierungen, Entscheidungen bleiben beim Team.
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-200">{props.description}</p>
              </div>
            </div>
            {props.actions ? <div className="flex shrink-0 flex-wrap gap-2">{props.actions}</div> : null}
          </div>
        </div>
        <div className="border-t bg-slate-50/80 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                end={item.end}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </section>

      {props.children}
    </div>
  );
}
