import type { RequestHandler } from "express";

import { asyncHandler, AppError } from "../../shared/utils";
import { BotState, botKeyboardPreview } from "./bot.service";
import { botButtonService } from "./bot-button.service";

const ADMIN_KEYBOARD_STATES: BotState[] = [
  BotState.SELECT_EXPERIENCE,
  BotState.ASK_GOAL,
  BotState.SELECT_COURSE,
  BotState.ASK_FORMAT,
  BotState.REGISTER,
  BotState.ASK_PHONE,
];

const EDITABLE_STATES = new Set<BotState>([
  BotState.SELECT_EXPERIENCE,
  BotState.ASK_GOAL,
  BotState.SELECT_COURSE,
  BotState.ASK_FORMAT,
  BotState.REGISTER,
  BotState.ASK_PHONE,
]);

const parseBotStateQuery = (raw: unknown): BotState => {
  const state = typeof raw === "string" ? raw.trim() : "";
  if (!state) throw new AppError(400, "State is required");
  if (!(Object.values(BotState) as string[]).includes(state)) {
    throw new AppError(400, "Invalid state");
  }
  return state as BotState;
};

export const botButtonController = {
  states: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    res.status(200).json({ states: ADMIN_KEYBOARD_STATES });
  }) as RequestHandler,

  preview: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const state = parseBotStateQuery((req.query?.state as unknown) ?? null);
    const grid = await botKeyboardPreview(state);

    const editable = EDITABLE_STATES.has(state);
    const buttons = editable ? await botButtonService.listForAdmin(state) : [];

    res.status(200).json({ state, grid, editable, buttons });
  }) as RequestHandler,

  list: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const state = (req.query?.state as unknown) ?? null;
    const buttons = await botButtonService.listForAdmin(state);
    res.status(200).json({ buttons });
  }) as RequestHandler,

  create: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const button = await botButtonService.createForAdmin(req.body);
    res.status(201).json({ button });
  }) as RequestHandler,

  update: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    const button = await botButtonService.updateForAdmin(
      req.params.id,
      req.body,
    );
    res.status(200).json({ button });
  }) as RequestHandler,

  remove: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");

    await botButtonService.deleteForAdmin(req.params.id);
    res.status(200).json({ ok: true });
  }) as RequestHandler,
};
