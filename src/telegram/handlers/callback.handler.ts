import type { Context } from "telegraf";

import { botApiService } from "../bot.api.service";
import { replyKeyboard } from "../keyboards/main.keyboard";
import { supportHandler } from "./support.handler";

const getTelegramId = (ctx: Context) => {
  const id = ctx.from?.id;
  return typeof id === "number" ? String(id) : null;
};

const safeAnswerCb = async (ctx: Context, text?: string) => {
  try {
    await ctx.answerCbQuery(text);
  } catch {
    // ignore
  }
};

export const callbackHandler = async (ctx: Context) => {
  const data = (ctx.callbackQuery as any)?.data;
  if (typeof data !== "string" || data.length === 0) return;

  console.log("[INCOMING]:", {
    type: "callback_query",
    data,
    from: ctx.from?.id,
  });

  if (data.startsWith("admin_reply_")) {
    await safeAnswerCb(ctx, "Reply orqali javob bering");
    await ctx.reply(
      "Admin javobi endi foydalanuvchi xabariga Reply qilib yuboriladi.",
    );
    return;
  }

  const telegramId = getTelegramId(ctx);
  if (!telegramId) return;

  try {
    await safeAnswerCb(ctx);

    const result = await botApiService.message({ telegramId, message: data });
    console.log("[BACKEND RESPONSE]:", result);

    if (typeof result.reply === "string" && result.reply.trim().length > 0) {
      await ctx.reply(result.reply, replyKeyboard(result.buttons));
    }

    await supportHandler.notifyAdminIfNeeded(ctx, result);
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.callback.handler");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);

    await safeAnswerCb(ctx, "Xatolik");
    await ctx.reply(
      "Xatolik yuz berdi, qaytadan urinib ko‘ring",
      replyKeyboard([["🏠 Menu"]]),
    );
  }
};
