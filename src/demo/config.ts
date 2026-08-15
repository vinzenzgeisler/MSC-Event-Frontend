export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export const demoIdentity = {
  token: "local-demo-token",
  displayName: "Demo Administration",
  email: "admin@demo.invalid",
  roles: ["admin", "editor", "viewer", "technical_inspector", "marshal_manager"]
} as const;
