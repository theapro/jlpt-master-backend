import type { Context } from "telegraf";

import { botService } from "../../modules/bot/bot.service";
import { replyKeyboard } from "../keyboards/main.keyboard";
import { supportHandler } from "./support.handler";

const isPrivateChat = (ctx: Context) => ctx.chat?.type === "private";

const getTelegramId = (ctx: Context) => {
  const id = ctx.from?.id;
  return typeof id === "number" ? String(id) : null;
};

const sanitizeText = (value: unknown) => {
  if (typeof value !== "string") return "";

  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 1000 ? normalized.slice(0, 1000) : normalized;
};

export const messageHandler = async (ctx: Context) => {
  if (!isPrivateChat(ctx)) return;

  const telegramId = getTelegramId(ctx);
  if (!telegramId) return;

  const rawTelegramMessageId = (ctx.message as any)?.message_id;
  const telegramMessageId =
    typeof rawTelegramMessageId === "number" ? rawTelegramMessageId : undefined;

  const contactPhone = (ctx.message as any)?.contact?.phone_number;
  if (typeof contactPhone === "string" && contactPhone.trim().length > 0) {
    const phone = sanitizeText(contactPhone);

    try {
      const result = await botService.registerPhone(telegramId, phone);

      if (typeof result.reply === "string" && result.reply.trim().length > 0) {
        await ctx.reply(result.reply, replyKeyboard(result.buttons));
      }

      void supportHandler.notifyAdminIfNeeded(ctx, result).catch((err) => {
        console.error("[ERROR SOURCE]: telegram.support.notifyAdmin");
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      });
    } catch (err) {
      console.error("[ERROR SOURCE]: telegram.message.handler.contact");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);

      await ctx.reply(
        "Xatolik yuz berdi, qaytadan urinib ko‘ring",
        replyKeyboard([["🏠 Menu"]]),
      );
    }

    return;
  }

  const rawText = (ctx.message as any)?.text;
  const text = sanitizeText(rawText);
  if (text.length === 0) return;

  try {
    const result = await botService.message(telegramId, text, telegramMessageId);

    if (typeof result.reply === "string" && result.reply.trim().length > 0) {
      await ctx.reply(result.reply, replyKeyboard(result.buttons));
    }

    void supportHandler.notifyAdminIfNeeded(ctx, result).catch((err) => {
      console.error("[ERROR SOURCE]: telegram.support.notifyAdmin");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    });
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.message.handler");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);

    await ctx.reply(
      "Xatolik yuz berdi, qaytadan urinib ko‘ring",
      replyKeyboard([["🏠 Menu"]]),
    );
  }
};
