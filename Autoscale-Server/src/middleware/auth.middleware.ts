import type { IncomingHttpHeaders } from "node:http";

import type { Request } from "express";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "../lib/auth.js";
import { readStore } from "../lib/store.js";
import type { AuthUser } from "../types/domain.js";
import { toAuthUser } from "../lib/auth.js";

function parseCookieHeader(rawCookieHeader: string | undefined): Record<string, string> {
  if (!rawCookieHeader) {
    return {};
  }

  return rawCookieHeader.split(";").reduce<Record<string, string>>((accumulator, item) => {
    const [key, ...value] = item.trim().split("=");
    if (key) {
      accumulator[key] = decodeURIComponent(value.join("="));
    }
    return accumulator;
  }, {});
}

export async function getCurrentUserFromRequest(req?: Request | null): Promise<AuthUser | null> {
  const token = req?.cookies?.[AUTH_COOKIE_NAME];
  if (!token || typeof token !== "string") {
    return null;
  }
  return hydrateCurrentUser(await verifyAuthToken(token));
}

export async function getCurrentUserFromHeaders(headers: IncomingHttpHeaders): Promise<AuthUser | null> {
  const cookies = parseCookieHeader(typeof headers.cookie === "string" ? headers.cookie : undefined);
  const token = cookies[AUTH_COOKIE_NAME];
  if (!token) {
    return null;
  }
  return hydrateCurrentUser(await verifyAuthToken(token));
}

async function hydrateCurrentUser(currentUser: AuthUser | null): Promise<AuthUser | null> {
  if (!currentUser) {
    return null;
  }

  const store = await readStore();
  const storedUser = store.users.find((entry) => entry.id === currentUser.id);
  return storedUser ? toAuthUser(storedUser) : currentUser;
}