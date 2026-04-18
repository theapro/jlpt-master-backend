import { Router } from "express";

import { getTelegramBot, TELEGRAM_WEBHOOK_PATH } from "./bot";
import { perfMetrics } from "../shared/perf-metrics";

const router = Router();

let cachedWebhookCallback: ReturnType<
  ReturnType<typeof getTelegramBot>["webhookCallback"]
> | null = null;

const getWebhookCallback = () => {
  if (!cachedWebhookCallback) {
    const bot = getTelegramBot();
    cachedWebhookCallback = bot.webhookCallback(TELEGRAM_WEBHOOK_PATH);
  }
  return cachedWebhookCallback;
};

router.post(TELEGRAM_WEBHOOK_PATH, (req, res, next) => {
  const end = perfMetrics.span("telegram.webhook.total");
  res.once("finish", end);
  res.once("close", end);

  try {
    return getWebhookCallback()(req, res, next);
  } catch (err) {
    console.error("[ERROR SOURCE]: telegram.webhook");
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    return res.sendStatus(500);
  }
});

export const telegramWebhookRoutes = router;
