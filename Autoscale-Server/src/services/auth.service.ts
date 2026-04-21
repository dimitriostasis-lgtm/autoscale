import { randomUUID } from "node:crypto";

import type { Response } from "express";

import { env } from "../config/env.js";
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME, signAuthToken, toAuthUser, verifyPassword } from "../lib/auth.js";
import { readStore } from "../lib/store.js";
import type { AuthUser } from "../types/domain.js";

import { presentUser } from "./presenters.js";

function setAuthCookies(res: Response, token: string, csrfToken: string): void {
  const secure = env.nodeEnv === "production";
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
  });
}

export async function loginUser(email: string, password: string, res?: Response | null) {
  if (!res) {
    throw new Error("HTTP response is required for login");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const store = await readStore();
  const user = store.users.find((entry) => entry.email.toLowerCase() === normalizedEmail);

  if (!user || !user.isActive) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  const authUser = toAuthUser(user);
  const token = await signAuthToken(authUser);
  const csrfToken = randomUUID();
  setAuthCookies(res, token, csrfToken);

  return {
    user: presentUser(user, store),
    csrfToken,
  };
}

export function logoutUser(res?: Response | null): boolean {
  if (!res) {
    throw new Error("HTTP response is required for logout");
  }

  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, sameSite: "lax" });
  res.clearCookie(CSRF_COOKIE_NAME, { httpOnly: false, sameSite: "lax" });
  return true;
}

export async function getCurrentProfile(currentUser: AuthUser | null) {
  if (!currentUser) {
    return null;
  }

  const store = await readStore();
  const storedUser = store.users.find((entry) => entry.id === currentUser.id);
  return storedUser ? presentUser(storedUser, store) : null;
}