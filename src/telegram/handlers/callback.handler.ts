import type { Context } from "telegraf";

import { botService } from "../../modules/bot/bot.service";
import { perfMetrics } from "../../shared/perf-metrics";
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

  const endUpdate = perfMetrics.span("telegram.update.total");
  const endTotal = perfMetrics.span("telegram.callback.total");

  try {
    if (data.startsWith("admin_reply_")) {
      const endAnswer = perfMetrics.span("telegram.callback.answerCbQuery");
      try {
        await safeAnswerCb(ctx, "Reply orqali javob bering");
      } finally {
        endAnswer();
      }

      const endReply = perfMetrics.span("telegram.callback.reply");
      try {
        await ctx.reply(
          "Admin javobi endi foydalanuvchi xabariga Reply qilib yuboriladi.",
        );
      } finally {
        endReply();
      }
      return;
    }

    const telegramId = getTelegramId(ctx);
    if (!telegramId) return;

    try {
      const endAnswer = perfMetrics.span("telegram.callback.answerCbQuery");
      try {
        await safeAnswerCb(ctx);
      } finally {
        endAnswer();
      }

      const result = await (async () => {
        const end = perfMetrics.span("telegram.callback.botService.message");
        try {
          return await botService.message(telegramId, data);
        } finally {
          end();
        }
      })();

      if (typeof result.reply === "string" && result.reply.trim().length > 0) {
        const endReply = perfMetrics.span("telegram.callback.reply");
        try {
          await ctx.reply(result.reply, replyKeyboard(result.buttons));
        } finally {
          endReply();
        }
      }

      void supportHandler.notifyAdminIfNeeded(ctx, result).catch((err) => {
        console.error("[ERROR SOURCE]: telegram.support.notifyAdmin");
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      });
    } catch (err) {
      console.error("[ERROR SOURCE]: telegram.callback.handler");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);

      const endAnswer = perfMetrics.span("telegram.callback.answerCbQuery");
      try {
        await safeAnswerCb(ctx, "Xatolik");
      } finally {
        endAnswer();
      }

      const endReply = perfMetrics.span("telegram.callback.reply");
      try {
        await ctx.reply(
          "Xatolik yuz berdi, qaytadan urinib ko‘ring",
          replyKeyboard([["🏠 Menu"]]),
        );
      } finally {
        endReply();
      }
    }
  } finally {
    endTotal();
    endUpdate();
  }
};
