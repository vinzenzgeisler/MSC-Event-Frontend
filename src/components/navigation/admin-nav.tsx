import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/admin/entries", label: "Nennungen" },
  { to: "/admin/mail", label: "Kommunikation" },
  { to: "/admin/exports", label: "Exporte" }
];

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            cn(
              "rounded-md border px-3 py-2 text-sm",
              isActive ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
