import type { Context } from "telegraf";

import type { BotResponse } from "../../modules/bot/bot.types";
import { adminChatService } from "../admin-chat.service";

const getChatId = (ctx: Context): string | null => {
  const direct = ctx.chat?.id;
  if (typeof direct === "number") return String(direct);

  const cb = (ctx as any).callbackQuery;
  const cbChatId = cb?.message?.chat?.id;
  if (typeof cbChatId === "number") return String(cbChatId);

  return null;
};

const getNumericChatId = (ctx: Context): number | null => {
  const direct = ctx.chat?.id;
  if (typeof direct === "number") return direct;

  const cb = (ctx as any).callbackQuery;
  const cbChatId = cb?.message?.chat?.id;
  if (typeof cbChatId === "number") return cbChatId;

  return null;
};

type SupportTarget = { telegramId: string; createdAt: number };
const targetByAdminMessageId = new Map<string, SupportTarget>();

const rememberTarget = (
  adminChatId: string,
  adminMessageId: number,
  userTelegramId: string,
) => {
  const key = `${adminChatId}:${adminMessageId}`;

  targetByAdminMessageId.set(key, {
    telegramId: userTelegramId,
    createdAt: Date.now(),
  });

  if (targetByAdminMessageId.size <= 1000) return;
  const oldest = [...targetByAdminMessageId.entries()].sort(
    (a, b) => a[1].createdAt - b[1].createdAt,
  );
  for (const [key] of oldest.slice(0, 250)) targetByAdminMessageId.delete(key);
};

const sanitizeText = (value: unknown) => {
  if (typeof value !== "string") return "";

  const normalized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 1000 ? normalized.slice(0, 1000) : normalized;
};

const extractTelegramIdFromText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const m = value.match(/\bID\s*:?\s*(\d{5,})\b/i);
  return m ? m[1] : null;
};

const resolveTargetFromReplyMessage = (
  adminChatId: string,
  reply: any,
): string | null => {
  const replyMessageId = reply?.message_id;
  if (typeof replyMessageId === "number") {
    const remembered = targetByAdminMessageId.get(
      `${adminChatId}:${replyMessageId}`,
    );
    if (remembered) return remembered.telegramId;
  }

  const forwardFromId = reply?.forward_from?.id;
  if (typeof forwardFromId === "number") return String(forwardFromId);

  return (
    extractTelegramIdFromText(reply?.text) ??
    extractTelegramIdFromText(reply?.caption)
  );
};

export const supportHandler = {
  isAdminChat: async (ctx: Context) => {
    return adminChatService.isAdminContext(ctx);
  },

  notifyAdminIfNeeded: async (ctx: Context, res: BotResponse) => {
    const notification = res.adminNotification;
    if (!notification) return;

    const targets = await adminChatService.getNotificationTargets();
    if (targets.length === 0) return;

    const user = notification.user;

    const requestLine =
      typeof notification.requestId === "number"
        ? `\n🧾 Request: ${notification.requestId}`
        : "";

    if (notification.type === "support_request") {
      const text =
        `📩 Yangi murojaat:\n\n` +
        `👤 Ism: ${user.name}\n` +
        `🆔 ID: ${user.telegramId}` +
        requestLine +
        `\n\nJavob berish uchun shu xabarga Reply qiling.`;

      for (const target of targets) {
        try {
          const sent = await ctx.telegram.sendMessage(target.chatId, text);
          if (typeof (sent as any)?.message_id === "number") {
            rememberTarget(
              target.chatId,
              (sent as any).message_id,
              user.telegramId,
            );
          }
        } catch (err) {
          console.error(
            "[ERROR SOURCE]: telegram.support.notify.support_request",
          );
          console.error(
            err instanceof Error ? (err.stack ?? err.message) : err,
          );
        }
      }
      return;
    }

    const text =
      `💬 Yangi xabar:\n\n` +
      `👤 Ism: ${user.name}\n` +
      `🆔 ID: ${user.telegramId}` +
      requestLine +
      `\n\nAdmin javob berish uchun shu xabarga Reply qiling.`;

    for (const target of targets) {
      const adminChatId = target.chatId;

      try {
        const header = await ctx.telegram.sendMessage(adminChatId, text);
        if (typeof (header as any)?.message_id === "number") {
          rememberTarget(
            adminChatId,
            (header as any).message_id,
            user.telegramId,
          );
        }
      } catch (err) {
        console.error(
          "[ERROR SOURCE]: telegram.support.notify.support_message",
        );
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
        continue;
      }

      try {
        const fromChatId = getNumericChatId(ctx);
        const fromMessageId = (ctx.message as any)?.message_id;
        if (
          typeof fromChatId === "number" &&
          typeof fromMessageId === "number"
        ) {
          const fwd = await ctx.telegram.forwardMessage(
            adminChatId,
            fromChatId,
            fromMessageId,
          );
          if (typeof (fwd as any)?.message_id === "number") {
            rememberTarget(
              adminChatId,
              (fwd as any).message_id,
              user.telegramId,
            );
          }
        } else {
          const fallback = sanitizeText(notification.message);
          if (fallback.length > 0) {
            const copy = await ctx.telegram.sendMessage(adminChatId, fallback);
            if (typeof (copy as any)?.message_id === "number") {
              rememberTarget(
                adminChatId,
                (copy as any).message_id,
                user.telegramId,
              );
            }
          }
        }
      } catch (err) {
        console.error("[ERROR SOURCE]: telegram.support.forwardMessage");
        console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      }
    }
  },

  onAdminReplyText: async (ctx: Context): Promise<boolean> => {
    if (!(await supportHandler.isAdminChat(ctx))) return false;

    const messageText = sanitizeText((ctx.message as any)?.text);
    if (messageText.length === 0) return false;

    const reply = (ctx.message as any)?.reply_to_message;
    if (!reply) return false;

    const adminChatId = getChatId(ctx);
    if (!adminChatId) return false;

    const userTelegramId = resolveTargetFromReplyMessage(adminChatId, reply);
    if (!userTelegramId) {
      await ctx.reply(
        "Xatolik: foydalanuvchi topilmadi. Iltimos support xabariga Reply qiling.",
      );
      return true;
    }

    const chatId = Number(userTelegramId);
    if (!Number.isFinite(chatId) || chatId <= 0) {
      await ctx.reply("Xatolik: noto‘g‘ri foydalanuvchi ID");
      return true;
    }

    await ctx.telegram.sendMessage(chatId, messageText);
    await ctx.reply(`Foydalanuvchiga yuborildi: ${userTelegramId}.`);
    return true;
  },
};
