import "dotenv/config";

import { Telegraf } from "telegraf";

import { botApiService } from "./bot.api.service";
import { startHandler } from "./handlers/start.handler";
import { messageHandler } from "./handlers/message.handler";
import { callbackHandler } from "./handlers/callback.handler";
import { createRateLimitMiddleware } from "./services/rate-limit.service";
import { supportHandler } from "./handlers/support.handler";
import { mainMenuKeyboard } from "./keyboards/main.keyboard";
import { adminChatService } from "./admin-chat.service";

let isStarted = false;
let botSingleton: Telegraf | null = null;
let processErrorHandlersRegistered = false;

export const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";

const registerProcessErrorHandlers = () => {
  if (processErrorHandlersRegistered) return;
  processErrorHandlersRegistered = true;

  process.on("unhandledRejection", (reason) => {
    console.error("[ERROR SOURCE]: telegram.process.unhandledRejection");
    console.error(
      reason instanceof Error ? (reason.stack ?? reason.message) : reason,
    );
  });

  process.on("uncaughtException", (err) => {
    console.error("[ERROR SOURCE]: telegram.process.uncaughtException");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  });
};

const isBotDebugEnabled = () => {
  const raw = String(process.env.BOT_DEBUG ?? "")
    .toLowerCase()
    .trim();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return process.env.NODE_ENV !== "production";
};

const shouldUseWebhook = () => {
  const raw = String(process.env.TELEGRAM_USE_WEBHOOK ?? "")
    .toLowerCase()
    .trim();

  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return process.env.NODE_ENV === "production";
};

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/g, "");
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const isPlausiblePublicWebhookBaseUrl = (baseUrl: string) => {
  if (!baseUrl.startsWith("https://")) return false;

  // Avoid obviously non-public addresses.
  const lowered = baseUrl.toLowerCase();
  if (lowered.includes("localhost")) return false;
  if (lowered.includes("127.0.0.1")) return false;
  if (lowered.includes("0.0.0.0")) return false;

  return true;
};

const resolvePublicBaseUrl = () => {
  const candidates = [
    process.env.BASE_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.BACKEND_PUBLIC_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.BACKEND_URL,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      const normalized = normalizeBaseUrl(c);
      if (normalized && isPlausiblePublicWebhookBaseUrl(normalized)) {
        return normalized;
      }
    }
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (typeof railwayDomain === "string" && railwayDomain.trim().length > 0) {
    const normalized = normalizeBaseUrl(railwayDomain);
    if (normalized && isPlausiblePublicWebhookBaseUrl(normalized)) {
      return normalized;
    }
  }

  return null;
};

export const getTelegramBot = () => {
  if (botSingleton) return botSingleton;

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
    await adminChatService.syncAdminBindingFromContext(ctx);

    const msg = ctx.message as any;
    const incomingText = msg?.text;

    if (isBotDebugEnabled()) {
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
    }

    if (
      (await supportHandler.isAdminChat(ctx)) &&
      typeof incomingText === "string"
    ) {
      const handled = await supportHandler.onAdminReplyText(ctx);
      if (handled) return;
    }

    await messageHandler(ctx);
  });

  bot.on("callback_query", async (ctx) => {
    await adminChatService.syncAdminBindingFromContext(ctx);
    await callbackHandler(ctx);
  });

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

  botSingleton = bot;
  return botSingleton;
};

export const stopTelegramBot = (reason = "shutdown") => {
  if (!botSingleton) return;
  try {
    botSingleton.stop(reason);
  } catch {
    // ignore
  }
};

export async function startTelegramBot() {
  if (isStarted) return;
  isStarted = true;

  registerProcessErrorHandlers();

  const bot = getTelegramBot();

  if (isBotDebugEnabled()) {
    console.log("[BOOT]: telegram bot starting...");
    console.log("[BOOT]: backend baseURL:", botApiService.getBaseUrl());
  }

  try {
    const ping = await botApiService.ping();
    if (isBotDebugEnabled()) {
      console.log("[BOOT]: backend ping OK:", ping.reply);
    }
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.boot.backendPing");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }

  try {
    const me = await bot.telegram.getMe();
    if (isBotDebugEnabled()) {
      console.log("[BOOT]: telegram API OK:", {
        id: me.id,
        username: (me as any).username,
        first_name: (me as any).first_name,
      });
    }
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.boot.getMe");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  }

  if (shouldUseWebhook()) {
    const baseUrl = resolvePublicBaseUrl();
    if (!baseUrl) {
      console.error(
        "[BOOT]: TELEGRAM_USE_WEBHOOK enabled but BASE_URL is missing; falling back to long polling",
      );
    } else {
      const webhookUrl = `${baseUrl}${TELEGRAM_WEBHOOK_PATH}`;
      try {
        await bot.telegram.setWebhook(webhookUrl);
        if (isBotDebugEnabled()) {
          console.log("[BOOT]: telegram webhook set:", webhookUrl);
        }
        return;
      } catch (err) {
        console.error("[ERROR SOURCE]: telegram.boot.setWebhook");
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
        console.error("[BOOT]: Falling back to long polling...");
      }
    }
  }

  try {
    // Polling requires webhook to be disabled.
    await bot.telegram.deleteWebhook();
  } catch {
    // ignore
  }

  await bot.launch();
  if (isBotDebugEnabled()) {
    console.log("[BOOT]: bot is running (long polling)...");
  }
}

if (require.main === module) {
  startTelegramBot().catch((err) => {
    console.error("[ERROR SOURCE]: telegram.boot");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  });
}
