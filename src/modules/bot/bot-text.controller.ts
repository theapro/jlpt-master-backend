import type { RequestHandler } from "express";

import { asyncHandler, AppError, isNonEmptyString } from "../../shared/utils";
import { botTextService } from "./bot-text.service";

const parseKey = (raw: unknown) => {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!isNonEmptyString(key)) throw new AppError(400, "Invalid bot text key");
  return key;
};

const parseValue = (raw: unknown) => {
  if (typeof raw !== "string") throw new AppError(400, "Invalid value");
  return raw;
};

export const botTextController = {
  list: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const texts = await botTextService.listAll();
    res.status(200).json({ texts });
  }) as RequestHandler,

  getByKey: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const key = parseKey(req.params.key);
    const text = await botTextService.getForAdmin(key);
    if (!text) throw new AppError(404, "Unknown bot text key");

    res.status(200).json({ text });
  }) as RequestHandler,

  upsert: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const key = parseKey(req.params.key);
    const value = parseValue(req.body?.value);

    const existing = await botTextService.getForAdmin(key);
    if (!existing) throw new AppError(404, "Unknown bot text key");

    await botTextService.upsert(key, value);

    const text = await botTextService.getForAdmin(key);
    res.status(200).json({ text });
  }) as RequestHandler,

  remove: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const key = parseKey(req.params.key);

    const existing = await botTextService.getForAdmin(key);
    if (!existing) throw new AppError(404, "Unknown bot text key");

    await botTextService.remove(key);

    const text = await botTextService.getForAdmin(key);
    res.status(200).json({ text });
  }) as RequestHandler,
};
