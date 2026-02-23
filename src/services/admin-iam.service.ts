import { toRoleMatrix } from "@/app/auth/iam";
import { requestJson } from "@/services/api/http-client";
import type { IamCreateUserInput, IamOverview, IamRole } from "@/types/admin-iam";

type RoleDto = {
  key: IamRole;
  description: string;
};

type UserDto = {
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

type RolesResponse = {
  ok: boolean;
  roles: RoleDto[];
};

type UsersResponse = {
  ok: boolean;
  users: UserDto[];
  meta: {
    nextCursor: string | null;
    limit: number;
  };
};

type UserMutationResponse = {
  ok: boolean;
  user: UserDto;
};

function normalizeRoles(input: string[]): IamRole[] {
  const unique = new Set<IamRole>();
  input.forEach((role) => {
    if (role === "admin" || role === "editor" || role === "viewer") {
      unique.add(role);
    }
  });
  return Array.from(unique.values());
}

export const adminIamService = {
  async getOverview(): Promise<IamOverview> {
    const [rolesResponse, usersResponse] = await Promise.all([
      requestJson<RolesResponse>("/admin/iam/roles"),
      requestJson<UsersResponse>("/admin/iam/users", {
        query: {
          limit: 60
        }
      })
    ]);

    return {
      accounts: usersResponse.users.map((item) => ({
        id: item.id,
        username: item.username,
        email: item.email,
        enabled: item.enabled,
        status: item.status,
        emailVerified: item.emailVerified,
        roles: normalizeRoles(item.roles),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      roles: rolesResponse.roles.map((role) => ({
        role: role.key,
        description: role.description
      })),
      matrix: toRoleMatrix().map((row) => ({ ...row })),
      nextCursor: usersResponse.meta?.nextCursor ?? null
    };
  },

  async createUser(payload: IamCreateUserInput) {
    const response = await requestJson<UserMutationResponse>("/admin/iam/users", {
      method: "POST",
      body: {
        email: payload.email,
        roles: payload.roles,
        temporaryPassword: payload.temporaryPassword || undefined,
        sendInvitation: payload.sendInvitation ?? true
      }
    });

    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      enabled: response.user.enabled,
      status: response.user.status,
      emailVerified: response.user.emailVerified,
      roles: normalizeRoles(response.user.roles),
      createdAt: response.user.createdAt,
      updatedAt: response.user.updatedAt
    };
  },

  async updateUserRoles(userId: string, roles: IamRole[]) {
    const response = await requestJson<UserMutationResponse>(`/admin/iam/users/${userId}/roles`, {
      method: "PATCH",
      body: {
        roles
      }
    });

    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      enabled: response.user.enabled,
      status: response.user.status,
      emailVerified: response.user.emailVerified,
      roles: normalizeRoles(response.user.roles),
      createdAt: response.user.createdAt,
      updatedAt: response.user.updatedAt
    };
  },

  async updateUserStatus(userId: string, enabled: boolean) {
    const response = await requestJson<UserMutationResponse>(`/admin/iam/users/${userId}/status`, {
      method: "PATCH",
      body: {
        enabled
      }
    });

    return {
      id: response.user.id,
      username: response.user.username,
      email: response.user.email,
      enabled: response.user.enabled,
      status: response.user.status,
      emailVerified: response.user.emailVerified,
      roles: normalizeRoles(response.user.roles),
      createdAt: response.user.createdAt,
      updatedAt: response.user.updatedAt
    };
  }
};
