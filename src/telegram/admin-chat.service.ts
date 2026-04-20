import type { Context } from "telegraf";

import { adminRepository } from "../modules/admin/admin.repository";
import { userRepository } from "../modules/user/user.repository";
import { AppError } from "../shared/utils";
import { telegramSender } from "./telegram.sender";

const TELEGRAM_USERNAME_REGEX = /^[a-zA-Z0-9_]{5,32}$/;

const normalizeTelegramUsername = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  if (!TELEGRAM_USERNAME_REGEX.test(normalized)) return null;
  return normalized;
};

const normalizeChatId = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) return trimmed;
  }

  return null;
};

const getContextChatId = (ctx: Context) => {
  const direct = (ctx.chat as any)?.id;
  if (typeof direct === "number") return String(direct);

  const cb = (ctx as any).callbackQuery;
  const cbChatId = cb?.message?.chat?.id;
  if (typeof cbChatId === "number") return String(cbChatId);

  return null;
};

const isBotNotStartedError = (err: unknown) => {
  const e = err as any;
  const code = e?.response?.error_code;
  const description = String(e?.response?.description ?? "").toLowerCase();

  if (code !== 400) return false;

  return (
    description.includes("chat not found") ||
    description.includes("user not found") ||
    description.includes("bot was blocked")
  );
};

export const adminChatService = {
  normalizeTelegramUsername,

  isAdminContext: async (ctx: Context) => {
    const chatId = getContextChatId(ctx);
    if (chatId) {
      const byChat = await adminRepository.findByTelegramChatId(chatId);
      if (byChat) return true;
    }

    const username = normalizeTelegramUsername(ctx.from?.username ?? null);
    if (!username) return false;

    const byUsername = await adminRepository.findByTelegramUsername(username);
    return !!byUsername;
  },

  syncAdminBindingFromContext: async (ctx: Context) => {
    try {
      if (ctx.chat?.type !== "private") return;

      const username = normalizeTelegramUsername(ctx.from?.username ?? null);
      const chatId = getContextChatId(ctx);

      if (!username || !chatId) return;

      const admin = await adminRepository.findByTelegramUsername(username);
      if (!admin) return;

      if (admin.tgChatId === chatId && admin.tgUsername === username) return;

      await adminRepository.updateTelegramBindingById(admin.id, {
        tgUsername: username,
        tgChatId: chatId,
      });
    } catch (err) {
      console.error("[ERROR SOURCE]: telegram.admin.syncBinding");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    }
  },

  resolveChatIdForUsername: async (tgUsername: string) => {
    const username = normalizeTelegramUsername(tgUsername);
    if (!username) {
      throw new AppError(400, "tgUsername is invalid");
    }

    const mapped = await adminRepository.findByTelegramUsername(username);
    if (mapped?.tgChatId) return mapped.tgChatId;

    // If this Telegram account already interacted with the bot as a user,
    // user.telegramId is a valid private chat id for sending messages.
    const knownUser = await userRepository.findByTelegramUsername(username);
    if (knownUser?.telegramId) return knownUser.telegramId;

    try {
      const chat = await telegramSender.getChatByUsername(username);
      const chatId = normalizeChatId((chat as any)?.id);
      if (chatId) return chatId;
    } catch (err) {
      if (isBotNotStartedError(err)) {
        throw new AppError(
          400,
          `Telegram user @${username} has not started the bot yet`,
        );
      }

      console.error("[ERROR SOURCE]: telegram.admin.resolveChatId");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      throw new AppError(502, "Failed to resolve Telegram chat id");
    }

    throw new AppError(
      400,
      `Telegram user @${username} has not started the bot yet`,
    );
  },

  getNotificationTargets: async () => {
    const admins = await adminRepository.findNotificationTargets();

    return admins
      .map((admin) => ({
        adminId: admin.id,
        username: admin.tgUsername,
        chatId: normalizeChatId(admin.tgChatId),
      }))
      .filter((item) => !!item.chatId) as Array<{
      adminId: number;
      username: string | null;
      chatId: string;
    }>;
  },

  notifyAllAdmins: async (text: string) => {
    const targets = await adminChatService.getNotificationTargets();
    if (targets.length === 0) return { delivered: 0, failed: 0 };

    let delivered = 0;
    let failed = 0;

    await Promise.all(
      targets.map(async (target) => {
        try {
          await telegramSender.sendMessage(target.chatId, text);
          delivered += 1;
        } catch (err) {
          failed += 1;
          console.error("[ERROR SOURCE]: telegram.admin.notifyAll");
          console.error(
            {
              adminId: target.adminId,
              username: target.username,
              chatId: target.chatId,
            },
            err instanceof Error ? (err.stack ?? err.message) : err,
          );
        }
      }),
    );

    return { delivered, failed };
  },
};
