import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { env } from "../config/env.js";
import { DEFAULT_MANAGER_PERMISSIONS } from "../types/domain.js";
import type { AuthUser, ManagerPermissions, StoredUser } from "../types/domain.js";

export const AUTH_COOKIE_NAME = "autoscale_access";
export const CSRF_COOKIE_NAME = "autoscale_csrf";

const jwtSecret = new TextEncoder().encode(env.jwtSecret);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function signAuthToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    agencyId: user.agencyId,
    managedAgencyIds: user.managedAgencyIds,
    managerPermissions: user.managerPermissions,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(jwtSecret);
}

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: (payload.role as AuthUser["role"]) || "USER",
      agencyId: typeof payload.agencyId === "string" ? payload.agencyId : null,
      managedAgencyIds: normalizeManagedAgencyIds(payload.managedAgencyIds),
      managerPermissions: normalizeManagerPermissions(payload.managerPermissions),
    };
  } catch {
    return null;
  }
}

function normalizeManagedAgencyIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string")));
}

function normalizeManagerPermissions(value: unknown): ManagerPermissions | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ManagerPermissions>;
  return {
    canSuspendUsers: candidate.canSuspendUsers ?? DEFAULT_MANAGER_PERMISSIONS.canSuspendUsers,
    canDeleteUsers: candidate.canDeleteUsers ?? DEFAULT_MANAGER_PERMISSIONS.canDeleteUsers,
    canResetPasswords: candidate.canResetPasswords ?? DEFAULT_MANAGER_PERMISSIONS.canResetPasswords,
    canManageAssignments: candidate.canManageAssignments ?? DEFAULT_MANAGER_PERMISSIONS.canManageAssignments,
  };
}

export function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    agencyId: user.agencyId,
    managedAgencyIds: user.role === "AGENCY_MANAGER" ? user.managedAgencyIds : [],
    managerPermissions: user.role === "AGENCY_MANAGER" ? user.managerPermissions || DEFAULT_MANAGER_PERMISSIONS : null,
  };
}