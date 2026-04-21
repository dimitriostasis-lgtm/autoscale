import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

import { CSRF_COOKIE_NAME } from "../lib/auth.js";

function isMutationRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }

  const query = "query" in body && typeof body.query === "string" ? body.query : "";
  return query.includes("mutation");
}

function isLoginMutation(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }

  const query = "query" in body && typeof body.query === "string" ? body.query : "";
  return query.includes("login") || query.includes("logout");
}

export const csrfCookieMiddleware: RequestHandler = (req, res, next) => {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!existingToken) {
    res.cookie(CSRF_COOKIE_NAME, randomUUID(), {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
    });
  }

  if (req.method === "POST" && req.path === "/graphql" && isMutationRequest(req.body) && !isLoginMutation(req.body)) {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers["x-csrf-token"];
    if (!cookieToken || cookieToken !== headerToken) {
      res.status(403).json({ error: "CSRF validation failed" });
      return;
    }
  }

  next();
};