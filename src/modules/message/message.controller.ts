import type { RequestHandler } from "express";

import { asyncHandler, AppError } from "../../shared/utils";
import { adminService } from "../admin/admin.service";
import { messageService } from "./message.service";

export const messageController = {
  listUsers: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await messageService.listUsersForAdmin(
      req.admin.id,
      req.query as any,
    );
    res.status(200).json(result);
  }) as RequestHandler,

  listChats: asyncHandler(async (_req, res) => {
    const result = await messageService.listChatsForAdmin();
    res.status(200).json(result);
  }) as RequestHandler,

  getByTelegramId: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await messageService.getChatHistoryForAdmin(
      req.admin.id,
      req.params.telegramId,
      req.query as any,
    );
    res.status(200).json(result);
  }) as RequestHandler,

  hideById: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await messageService.hideMessageForAdmin(
      req.admin.id,
      req.params.id,
    );
    res.status(200).json(result);
  }) as RequestHandler,

  deleteById: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await messageService.deleteMessageForEveryone(
      req.admin.id,
      req.params.id,
    );
    res.status(200).json(result);
  }) as RequestHandler,

  editById: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await messageService.editMessageForAdmin(
      req.admin.id,
      req.params.id,
      req.body,
    );
    res.status(200).json(result);
  }) as RequestHandler,

  send: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await adminService.replyToUser(req.admin.id, req.body);
    res.status(200).json(result);
  }) as RequestHandler,
};
