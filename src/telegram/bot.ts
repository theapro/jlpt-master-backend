import "dotenv/config";

import { Telegraf } from "telegraf";

import { botApiService } from "./bot.api.service";
import { startHandler } from "./handlers/start.handler";
import { messageHandler } from "./handlers/message.handler";
import { callbackHandler } from "./handlers/callback.handler";
import { createRateLimitMiddleware } from "./services/rate-limit.service";
import { supportHandler } from "./handlers/support.handler";
import { mainMenuKeyboard } from "./keyboards/main.keyboard";

let isStarted = false;

export async function startTelegramBot() {
  if (isStarted) return;
  isStarted = true;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.trim().length === 0) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const bot = new Telegraf(token.trim());

  bot.use(
    createRateLimitMiddleware({
      windowMs: 3_000,
      max: 8,
      message: "Juda ko‘p amal bajarildi. Iltimos sekinroq harakat qiling.",
    }),
  );

  bot.use(
    createRateLimitMiddleware({
      windowMs: 60_000,
      max: 40,
      message: "Juda ko‘p so‘rov yuborildi. Iltimos biroz kuting.",
    }),
  );

  bot.start(startHandler);

  bot.on("message", async (ctx) => {
    const msg = ctx.message as any;
    const incomingText = msg?.text;
    const hasContact = !!msg?.contact;

    console.log("[INCOMING]:", {
      type: hasContact
        ? "contact"
        : typeof incomingText === "string"
          ? "text"
          : "message",
      from: ctx.from?.id,
      text: incomingText,
    });

    if (supportHandler.isAdminChat(ctx) && typeof incomingText === "string") {
      const handled = await supportHandler.onAdminReplyText(ctx);
      if (handled) return;
    }

    await messageHandler(ctx);
  });

  bot.on("callback_query", callbackHandler);

  bot.catch((err, ctx) => {
    console.error("[ERROR SOURCE]: telegram.bot.catch");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    try {
      void ctx.reply(
        "Xatolik: bot ishlashida muammo (telegram.bot.catch)",
        mainMenuKeyboard(),
      );
    } catch {
      // ignore
    }
  });

  console.log("[BOOT]: telegram bot starting...");
  console.log("[BOOT]: backend baseURL:", botApiService.getBaseUrl());

  const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID;
  console.log(
    "[BOOT]: TELEGRAM_ADMIN_CHAT_ID:",
    adminChatIdRaw ? "set" : "missing",
  );

  try {
    const ping = await botApiService.ping();
    console.log("[BOOT]: backend ping OK:", ping.reply);
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.boot.backendPing");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }

  try {
    const me = await bot.telegram.getMe();
    console.log("[BOOT]: telegram API OK:", {
      id: me.id,
      username: (me as any).username,
      first_name: (me as any).first_name,
    });
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.boot.getMe");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }

  await bot.launch();
  console.log("🤖 Bot is running...");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

if (require.main === module) {
  startTelegramBot().catch((err) => {
    console.error("[ERROR SOURCE]: telegram.boot");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  });
}
