import type { RequestHandler } from "express";

import { asyncHandler, AppError, parsePositiveInt } from "../../shared/utils";
import { goalService } from "./goal.service";

export const goalController = {
  create: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const goal = await goalService.create(req.body);
    res.status(201).json({ goal });
  }) as RequestHandler,

  update: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid goal id");
    const goal = await goalService.update(id, req.body);
    res.status(200).json({ goal });
  }) as RequestHandler,

  getAll: asyncHandler(async (_req, res) => {
    const goals = await goalService.getAll();
    res.status(200).json({ goals });
  }) as RequestHandler,

  getById: asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid goal id");
    const goal = await goalService.getById(id);
    res.status(200).json({ goal });
  }) as RequestHandler,

  remove: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid goal id");
    const goal = await goalService.softDelete(id);
    res.status(200).json({ goal });
  }) as RequestHandler,
};
