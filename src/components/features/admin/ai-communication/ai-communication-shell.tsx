import { Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
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
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[linear-gradient(90deg,_#f8fafc,_#eef2f7_48%,_#f8fafc)] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{props.title}</h1>
                </div>
                {props.description ? <p className="max-w-2xl text-sm leading-6 text-slate-600">{props.description}</p> : null}
              </div>
            </div>
            {props.actions ? <div className="flex shrink-0 flex-wrap gap-2">{props.actions}</div> : null}
          </div>
        </div>
        <div className="bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                end={item.end}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
