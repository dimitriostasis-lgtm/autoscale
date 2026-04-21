import http from "node:http";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { makeExecutableSchema } from "@graphql-tools/schema";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";

import { env } from "./config/env.js";
import { ensureStorageDirectories, getStorageRoot, saveUploadedFile } from "./lib/storage.js";
import { getCurrentUserFromHeaders, getCurrentUserFromRequest } from "./middleware/auth.middleware.js";
import { csrfCookieMiddleware } from "./middleware/csrf.middleware.js";
import { loadResolvers } from "./resolvers/index.js";
import { loadTypeDefs } from "./schemas/index.js";
import { resetStoreWithSeed } from "./lib/store.js";
import type { GraphQLContext } from "./types/context.js";

async function bootstrap(): Promise<void> {
  await ensureStorageDirectories();

  const typeDefs = await loadTypeDefs();
  const resolvers = await loadResolvers();
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const app = express();
  const httpServer = http.createServer(app);
  const upload = multer();

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/ws",
  });

  useServer(
    {
      schema,
      context: async (ctx): Promise<GraphQLContext> => ({
        currentUser: await getCurrentUserFromHeaders(ctx.extra.request.headers),
      }),
    },
    wsServer,
  );

  const server = new ApolloServer<GraphQLContext>({
    schema,
  });

  await server.start();

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(csrfCookieMiddleware);
  app.use("/files", express.static(getStorageRoot()));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, workerUrl: env.workerUrl, nodeEnv: env.nodeEnv });
  });

  app.post("/api/uploads", upload.single("file"), async (req, res) => {
    const currentUser = await getCurrentUserFromRequest(req);
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Missing file" });
      return;
    }

    const saved = await saveUploadedFile(file.originalname, file.buffer);
    res.json(saved);
  });

  app.post("/api/dev/seed", async (_req, res) => {
    if (env.nodeEnv === "production") {
      res.status(403).json({ error: "Disabled in production" });
      return;
    }

    const data = await resetStoreWithSeed();
    res.json({ ok: true, counts: { users: data.users.length, models: data.influencerModels.length } });
  });

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }): Promise<GraphQLContext> => {
        const currentUser = await getCurrentUserFromRequest(req);
        return { req, res, currentUser };
      },
    }),
  );

  httpServer.listen(env.port, () => {
    console.log(`AutoScale server listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});