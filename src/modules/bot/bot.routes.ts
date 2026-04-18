import type { ErrorRequestHandler } from "express";
import { Router } from "express";

import { botTextService } from "./bot-text.service";
import { botController } from "./bot.controller";

const router = Router();

router.get("/ping", (_req, res) => {
  res.status(200).json({
    reply: "pong",
    buttons: [],
    action: "PING",
  });
});

router.post("/start", botController.start);
router.post("/message", botController.message);
router.post("/register-phone", botController.registerPhone);
router.post("/enroll", botController.enroll);

router.use(async (_req, res) => {
  res.status(200).json({
    reply: await botTextService.get("GENERIC_ERROR"),
    buttons: [["🏠 Menu"]],
    action: "ERROR",
  });
});

const botErrorMiddleware: ErrorRequestHandler = async (
  err,
  _req,
  res,
  _next,
) => {
  console.error("[ERROR SOURCE]: bot.routes");
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  return res.status(200).json({
    reply: await botTextService.get("GENERIC_ERROR"),
    buttons: [["🏠 Menu"]],
    action: "ERROR",
  });
};

router.use(botErrorMiddleware);

export const botRoutes = router;
