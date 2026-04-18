import type { Context } from "telegraf";

import { botApiService } from "../bot.api.service";
import { replyKeyboard } from "../keyboards/main.keyboard";

const getTelegramId = (ctx: Context) => {
  const id = ctx.from?.id;
  return typeof id === "number" ? String(id) : null;
};

const getDisplayName = (ctx: Context) => {
  const first = ctx.from?.first_name ?? "";
  const last = ctx.from?.last_name ?? "";
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : (ctx.from?.username ?? "Telegram User");
};

export const startHandler = async (ctx: Context) => {
  const telegramId = getTelegramId(ctx);
  if (!telegramId) return;

  try {
    console.log("[INCOMING]:", { type: "start", telegramId });
    const result = await botApiService.start({
      telegramId,
      name: getDisplayName(ctx),
      telegramUsername: ctx.from?.username ?? null,
    });

    console.log("[BACKEND RESPONSE]:", result);
    await ctx.reply(result.reply, replyKeyboard(result.buttons));
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.start.handler");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);

    await ctx.reply(
      "Xatolik yuz berdi, qaytadan urinib ko‘ring",
      replyKeyboard([["🏠 Menu"]]),
    );
  }
};
