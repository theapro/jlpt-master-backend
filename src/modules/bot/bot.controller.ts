import type { RequestHandler } from "express";

import { botTextService } from "./bot-text.service";
import { botService } from "./bot.service";

const logError = (err: unknown, source: string) => {
  console.error("[ERROR SOURCE]:", source);
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
};

const toErrorResponse = async (_err: unknown, _source: string) => {
  return {
    reply: await botTextService.get("GENERIC_ERROR"),
    buttons: [["🏠 Menu"]],
    action: "ERROR",
  };
};

const wrap = (fn: (req: any) => Promise<any>): RequestHandler => {
  return async (req, res) => {
    console.log("[BOT REQUEST]:", {
      method: req.method,
      path: req.originalUrl ?? req.url,
      body: req.body,
    });

    try {
      const result = await fn(req);
      console.log("[BOT RESPONSE]:", result);
      res.status(200).json(result);
    } catch (err) {
      logError(err, "bot.controller");
      res.status(200).json(await toErrorResponse(err, "bot.controller"));
    }
  };
};

export const botController = {
  start: wrap((req) =>
    botService.start(
      req.body?.telegramId,
      req.body?.name,
      req.body?.telegramUsername,
    ),
  ),

  message: wrap((req) =>
    botService.message(
      req.body?.telegramId,
      req.body?.message,
      req.body?.telegramMessageId,
    ),
  ),

  registerPhone: wrap((req) =>
    botService.registerPhone(req.body?.telegramId, req.body?.phone),
  ),

  enroll: wrap((req) =>
    botService.enroll(req.body?.telegramId, req.body?.courseId),
  ),
};
