import type { Request, Response } from "express";

import type { AuthUser } from "./domain.js";

export interface GraphQLContext {
  req?: Request;
  res?: Response;
  currentUser: AuthUser | null;
}