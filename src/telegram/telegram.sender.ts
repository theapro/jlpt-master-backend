import { Telegraf } from "telegraf";

let bot: Telegraf | null = null;

const getToken = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.trim().length === 0) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }
  return token.trim();
};

const getBot = () => {
  if (!bot) bot = new Telegraf(getToken());
  return bot;
};

type SendMessageExtra = Parameters<
  ReturnType<typeof getBot>["telegram"]["sendMessage"]
>[2];

export const telegramSender = {
  sendMessage: async (
    chatId: number | string,
    text: string,
    extra?: SendMessageExtra,
  ) => {
    return getBot().telegram.sendMessage(chatId, text, extra);
  },

  getChatByUsername: async (username: string) => {
    const value = username.trim().replace(/^@+/, "");
    return getBot().telegram.getChat(`@${value}`);
  },

  editMessageText: async (chatId: number, messageId: number, text: string) => {
    return getBot().telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      text,
    );
  },

  deleteMessage: async (chatId: number, messageId: number) => {
    return getBot().telegram.deleteMessage(chatId, messageId);
  },
};
