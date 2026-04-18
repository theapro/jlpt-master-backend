import type { RequestHandler } from "express";

import { asyncHandler, AppError } from "../../shared/utils";
import { supportService } from "./support.service";

export const supportController = {
  updateStatus: asyncHandler(async (req, res) => {
    if (!req.admin) throw new AppError(401, "Unauthorized");
    const result = await supportService.setStatusByIdForAdmin(
      req.params.id,
      req.body,
    );
    res.status(200).json(result);
  }) as RequestHandler,
};
