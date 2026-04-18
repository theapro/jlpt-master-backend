import { Markup } from "telegraf";

export const adminReplyInlineKeyboard = (userTelegramId: string) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "Foydalanuvchiga javob berish",
        `admin_reply_${userTelegramId}`,
      ),
    ],
  ]);
};
