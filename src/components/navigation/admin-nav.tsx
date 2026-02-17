import { NavLink } from "react-router-dom";
import { LayoutGrid, ListChecks, Mail, FileDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/admin/entries", label: "Nennungen", icon: ListChecks },
  { to: "/admin/communication", label: "Kommunikation", icon: Mail },
  { to: "/admin/exports", label: "Exporte", icon: FileDown },
  { to: "/admin/settings", label: "Einstellungen", icon: Settings }
];

export function AdminNav() {
  return (
    <nav className="grid gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                isActive ? "bg-primary text-primary-foreground" : "text-slate-700 hover:bg-slate-100"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
