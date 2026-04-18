import "dotenv/config";

import http from "http";

import app from "./app";
import { realtimeWs } from "./realtime/ws";
import { prisma } from "./shared/prisma";
import { startTelegramBot } from "./telegram/bot";

const HOST = "0.0.0.0";

const PORT = (() => {
  const raw = process.env.PORT;
  if (!raw) return 3000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3000;
  return parsed;
})();

const boot = async () => {
  console.log("[BOOT]: backend starting...");
  console.log("[BOOT]: NODE_ENV:", process.env.NODE_ENV ?? "(not set)");
  console.log("[BOOT]: PORT:", PORT);

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("[BOOT]: database OK");
  } catch (err) {
    console.error("[ERROR SOURCE]: backend.boot.database");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }

  const server = http.createServer(app);
  realtimeWs.init(server);

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
