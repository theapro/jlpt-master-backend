import "dotenv/config";

import http from "http";

import app from "./app";
import { realtimeWs } from "./realtime/ws";
import { prisma } from "./shared/prisma";
import { startTelegramBot, stopTelegramBot } from "./telegram/bot";

const HOST = "0.0.0.0";

const PORT = (() => {
  const raw = process.env.PORT;
  if (!raw) return 3000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3000;
  return parsed;
})();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let processErrorHandlersRegistered = false;

const registerProcessErrorHandlers = () => {
  if (processErrorHandlersRegistered) return;
  processErrorHandlersRegistered = true;

  process.on("unhandledRejection", (reason) => {
    console.error("[ERROR SOURCE]: process.unhandledRejection");
    console.error(
      reason instanceof Error ? (reason.stack ?? reason.message) : reason,
    );

    void prisma
      .$disconnect()
      .catch(() => {})
      .then(() => prisma.$connect())
      .catch((err) => {
        console.error(
          "[ERROR SOURCE]: process.unhandledRejection.prismaReconnect",
        );
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      });
  });

  process.on("uncaughtException", (err) => {
    console.error("[ERROR SOURCE]: process.uncaughtException");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  });
};

const connectDatabaseWithRetry = async () => {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      console.error("[ERROR SOURCE]: backend.boot.database");
      console.error(
        { attempt, maxAttempts },
        err instanceof Error ? (err.stack ?? err.message) : err,
      );

      if (attempt >= maxAttempts) throw err;

      const delayMs = Math.min(2000, 250 * attempt);
      await sleep(delayMs);
    }
  }
};

const boot = async () => {
  console.log("[BOOT]: backend starting...");
  console.log("[BOOT]: NODE_ENV:", process.env.NODE_ENV ?? "(not set)");
  console.log("[BOOT]: PORT:", PORT);

  registerProcessErrorHandlers();

  await connectDatabaseWithRetry();
  console.log("[BOOT]: database OK");

  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  server.on("clientError", (err) => {
    console.error("[ERROR SOURCE]: http.clientError");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  });

  server.on("error", (err) => {
    console.error("[ERROR SOURCE]: http.server");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  });

  realtimeWs.init(server);

  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[BOOT]: received ${signal}, shutting down...`);

    try {
      stopTelegramBot(signal);
    } catch {
      // ignore
    }

    try {
      await realtimeWs.close();
    } catch {
      // ignore
    }

    try {
      (server as any).closeIdleConnections?.();
    } catch {
      // ignore
    }

    try {
      (server as any).closeAllConnections?.();
    } catch {
      // ignore
    }

    await new Promise<void>((resolve) => {
      try {
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });

    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  };

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  server.listen(PORT, HOST, () => {
    console.log("✅ Backend running on port:", PORT);
    console.log("✅ WebSocket listening on: /ws");
    if (process.env.NODE_ENV !== "production") {
      console.log("🔎 Debug mode: ON (NODE_ENV != production)");
    }

    if (process.env.NODE_ENV === "production") {
      startTelegramBot().catch((err) => {
        console.error("[ERROR SOURCE]: telegram.bot.autostart");
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      });
    }
  });
};

boot().catch((err) => {
  console.error("[ERROR SOURCE]: backend.boot");
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exitCode = 1;
});
