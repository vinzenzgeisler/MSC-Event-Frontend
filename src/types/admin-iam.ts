export type IamRole = "admin" | "editor" | "viewer";

export type IamAccount = {
  id: string;
  username: string;
  email: string | null;
  enabled: boolean;
  status: string;
  emailVerified: boolean;
  roles: IamRole[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type IamCreateUserInput = {
  email: string;
  roles: IamRole[];
  temporaryPassword?: string;
  sendInvitation?: boolean;
};

export type IamRoleDefinition = {
  role: IamRole;
  description: string;
};

export type IamPermissionMatrixRow = {
  area: string;
  admin: "read" | "write";
  editor: "none" | "read" | "write";
  viewer: "none" | "read" | "write";
};

export type IamOverview = {
  accounts: IamAccount[];
  roles: IamRoleDefinition[];
  matrix: IamPermissionMatrixRow[];
  nextCursor: string | null;
};
