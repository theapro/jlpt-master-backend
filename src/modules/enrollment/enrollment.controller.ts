import type { RequestHandler } from "express";

import { asyncHandler } from "../../shared/utils";
import { enrollmentService } from "./enrollment.service";

export const enrollmentController = {
  assign: asyncHandler(async (req, res) => {
    const enrollment = await enrollmentService.assign(req.body);
    res.status(201).json({ enrollment });
  }) as RequestHandler,
};
