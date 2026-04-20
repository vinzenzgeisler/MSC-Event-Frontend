export type AppRole = "admin" | "editor" | "viewer";

export type AppPermission =
  | "dashboard.read"
  | "entries.read"
  | "entries.status.write"
  | "entries.checkin.write"
  | "entries.payment.write"
  | "entries.notes.write"
  | "entries.delete"
  | "communication.read"
  | "communication.write"
  | "exports.read"
  | "exports.write"
  | "settings.read"
  | "settings.write"
  | "iam.read"
  | "iam.write";

const KNOWN_ROLES: AppRole[] = ["admin", "editor", "viewer"];

const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  admin: [
    "dashboard.read",
    "entries.read",
    "entries.status.write",
    "entries.checkin.write",
    "entries.payment.write",
    "entries.notes.write",
    "entries.delete",
    "communication.read",
    "communication.write",
    "exports.read",
    "exports.write",
    "settings.read",
    "settings.write",
    "iam.read",
    "iam.write"
  ],
  editor: [
    "dashboard.read",
    "entries.read",
    "entries.status.write",
    "entries.checkin.write",
    "entries.payment.write",
    "entries.notes.write",
    "exports.read"
  ],
  viewer: ["dashboard.read", "entries.read", "exports.read"]
};

function normalizeRole(role: string): AppRole | null {
  const normalized = role.trim().toLowerCase();
  if (normalized === "checkin") {
    return "editor";
  }
  if (KNOWN_ROLES.includes(normalized as AppRole)) {
    return normalized as AppRole;
  }
  return null;
}

export function getEffectiveRoles(rawRoles: string[]): AppRole[] {
  const unique = new Set<AppRole>();
  rawRoles.forEach((role) => {
    const normalized = normalizeRole(role);
    if (normalized) {
      unique.add(normalized);
    }
  });
  return Array.from(unique.values());
}

export function hasPermission(rawRoles: string[], permission: AppPermission): boolean {
  const roles = getEffectiveRoles(rawRoles);
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function canAccessAny(rawRoles: string[], permissions: AppPermission[]): boolean {
  return permissions.some((permission) => hasPermission(rawRoles, permission));
}

export function toRoleMatrix() {
  return [
    {
      area: "Dashboard",
      admin: "read",
      editor: "read",
      viewer: "read"
    },
    {
      area: "Nennungen",
      admin: "write",
      editor: "write",
      viewer: "read"
    },
    {
      area: "Check-in",
      admin: "write",
      editor: "write",
      viewer: "none"
    },
    {
      area: "Kommunikation",
      admin: "write",
      editor: "none",
      viewer: "none"
    },
    {
      area: "Exporte",
      admin: "write",
      editor: "read",
      viewer: "read"
    },
    {
      area: "Einstellungen",
      admin: "write",
      editor: "none",
      viewer: "none"
    },
    {
      area: "IAM",
      admin: "write",
      editor: "none",
      viewer: "none"
    }
  ] as const;
}
