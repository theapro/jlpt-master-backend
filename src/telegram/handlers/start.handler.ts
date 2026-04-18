import type { Context } from "telegraf";

import { botService } from "../../modules/bot/bot.service";
import { perfMetrics } from "../../shared/perf-metrics";
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

  const endUpdate = perfMetrics.span("telegram.update.total");
  const endTotal = perfMetrics.span("telegram.start.total");

  try {
    const result = await (async () => {
      const end = perfMetrics.span("telegram.start.botService");
      try {
        return await botService.start(
          telegramId,
          getDisplayName(ctx),
          ctx.from?.username ?? null,
        );
      } finally {
        end();
      }
    })();

    const endReply = perfMetrics.span("telegram.start.reply");
    try {
      await ctx.reply(result.reply, replyKeyboard(result.buttons));
    } finally {
      endReply();
    }
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.start.handler");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);

    const endReply = perfMetrics.span("telegram.start.reply");
    try {
      await ctx.reply(
        "Xatolik yuz berdi, qaytadan urinib ko‘ring",
        replyKeyboard([["🏠 Menu"]]),
      );
    } finally {
      endReply();
    }
  } finally {
    endTotal();
    endUpdate();
  }
};
