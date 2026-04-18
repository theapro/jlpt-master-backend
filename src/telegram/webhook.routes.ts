import { Router } from "express";

import { getTelegramBot, TELEGRAM_WEBHOOK_PATH } from "./bot";

const router = Router();

let cachedWebhookCallback:
  | ReturnType<ReturnType<typeof getTelegramBot>["webhookCallback"]>
  | null = null;

const getWebhookCallback = () => {
  if (!cachedWebhookCallback) {
    const bot = getTelegramBot();
    cachedWebhookCallback = bot.webhookCallback(TELEGRAM_WEBHOOK_PATH);
  }
  return cachedWebhookCallback;
};

router.post(TELEGRAM_WEBHOOK_PATH, (req, res, next) => {
  try {
    return getWebhookCallback()(req, res, next);
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.webhook");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    return res.sendStatus(500);
  }
});

export const telegramWebhookRoutes = router;
