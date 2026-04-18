import type { RequestHandler } from "express";

import { asyncHandler, AppError, parsePositiveInt } from "../../shared/utils";
import { userService } from "./user.service";

export const userController = {
  register: asyncHandler(async (req, res) => {
    const user = await userService.register(req.body);
    res.status(201).json({ user });
  }) as RequestHandler,

  listForAdmin: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const users = await userService.listForAdmin();
    res.status(200).json({ users });
  }) as RequestHandler,

  getByIdForAdmin: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid user id");
    const user = await userService.getByIdForAdmin(id);
    res.status(200).json({ user });
  }) as RequestHandler,

  updateSupportStatusForAdmin: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid user id");
    const user = await userService.updateSupportStatusByIdForAdmin(
      req.admin.id,
      id,
      req.body,
    );
    res.status(200).json({ user });
  }) as RequestHandler,
};
