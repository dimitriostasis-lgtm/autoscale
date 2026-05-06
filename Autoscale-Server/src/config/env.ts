import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

const cwd = process.cwd();

export const env = {
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "change-this-secret",
  storageRoot: path.resolve(cwd, process.env.STORAGE_ROOT || "./storage"),
  dataStorePath: path.resolve(cwd, process.env.DATA_STORE_PATH || "./data/store.json"),
  workerUrl: process.env.HIGGSFIELD_WORKER_URL || "http://127.0.0.1:8190",
  workerApiKey: process.env.HIGGSFIELD_WORKER_API_KEY || "local-dev",
  requireRowReferenceImages: (process.env.HIGGSFIELD_REQUIRE_REFERENCE_IMAGES || "false").toLowerCase() === "true",
  nodeEnv: process.env.NODE_ENV || "development",
};
