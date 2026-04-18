import type { Context } from "telegraf";

import type { BotResponse } from "../../modules/bot/bot.types";

const resolveAdminChatId = () => {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!raw || raw.trim().length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getChatId = (ctx: Context): number | null => {
  const direct = ctx.chat?.id;
  if (typeof direct === "number") return direct;

  const cb = (ctx as any).callbackQuery;
  const cbChatId = cb?.message?.chat?.id;
  if (typeof cbChatId === "number") return cbChatId;

  return null;
};

type SupportTarget = { telegramId: string; createdAt: number };
const targetByAdminMessageId = new Map<number, SupportTarget>();

const rememberTarget = (adminMessageId: number, userTelegramId: string) => {
  targetByAdminMessageId.set(adminMessageId, {
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

const resolveTargetFromReplyMessage = (reply: any): string | null => {
  const replyMessageId = reply?.message_id;
  if (typeof replyMessageId === "number") {
    const remembered = targetByAdminMessageId.get(replyMessageId);
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
  isAdminChat: (ctx: Context) => {
    const adminChatId = resolveAdminChatId();
    if (!adminChatId) return false;
    return getChatId(ctx) === adminChatId;
  },

  notifyAdminIfNeeded: async (ctx: Context, res: BotResponse) => {
    const notification = res.adminNotification;
    if (!notification) return;

    const adminChatId = resolveAdminChatId();
    if (!adminChatId) return;

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

      const sent = await ctx.telegram.sendMessage(adminChatId, text);
      if (typeof (sent as any)?.message_id === "number") {
        rememberTarget((sent as any).message_id, user.telegramId);
      }
      return;
    }

    const text =
      `💬 Yangi xabar:\n\n` +
      `👤 Ism: ${user.name}\n` +
      `🆔 ID: ${user.telegramId}` +
      requestLine +
      `\n\nAdmin javob berish uchun shu xabarga Reply qiling.`;

    const header = await ctx.telegram.sendMessage(adminChatId, text);
    if (typeof (header as any)?.message_id === "number") {
      rememberTarget((header as any).message_id, user.telegramId);
    }

    try {
      const fromChatId = getChatId(ctx);
      const fromMessageId = (ctx.message as any)?.message_id;
      if (typeof fromChatId === "number" && typeof fromMessageId === "number") {
        const fwd = await ctx.telegram.forwardMessage(
          adminChatId,
          fromChatId,
          fromMessageId,
        );
        if (typeof (fwd as any)?.message_id === "number") {
          rememberTarget((fwd as any).message_id, user.telegramId);
        }
      } else {
        const fallback = sanitizeText(notification.message);
        if (fallback.length > 0) {
          const copy = await ctx.telegram.sendMessage(adminChatId, fallback);
          if (typeof (copy as any)?.message_id === "number") {
            rememberTarget((copy as any).message_id, user.telegramId);
          }
        }
      }
    } catch (err) {
      console.error("[ERROR SOURCE]: telegram.support.forwardMessage");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    }
  },

  onAdminReplyText: async (ctx: Context): Promise<boolean> => {
    if (!supportHandler.isAdminChat(ctx)) return false;

    const messageText = sanitizeText((ctx.message as any)?.text);
    if (messageText.length === 0) return false;

    const reply = (ctx.message as any)?.reply_to_message;
    if (!reply) return false;

    const userTelegramId = resolveTargetFromReplyMessage(reply);
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
