import type { RequestHandler } from "express";

import { asyncHandler, AppError, parsePositiveInt } from "../../shared/utils";
import { courseService } from "./course.service";

export const courseController = {
  create: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const course = await courseService.create(req.body);
    res.status(201).json({ course });
  }) as RequestHandler,

  update: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid course id");
    const course = await courseService.update(req.admin, id, req.body);
    res.status(200).json({ course });
  }) as RequestHandler,

  getAll: asyncHandler(async (_req, res) => {
    const courses = await courseService.getAll();
    res.status(200).json({ courses });
  }) as RequestHandler,

  getById: asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid course id");
    const course = await courseService.getById(id);
    res.status(200).json({ course });
  }) as RequestHandler,

  remove: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const id = parsePositiveInt(req.params.id);
    if (!id) throw new AppError(400, "Invalid course id");
    const course = await courseService.hardDelete(req.admin, id);
    res.status(200).json({ course });
  }) as RequestHandler,
};
