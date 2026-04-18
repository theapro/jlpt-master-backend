import type { RequestHandler } from "express";
import type { AdminRole } from "@prisma/client";

import { AppError } from "../shared/utils";

export const requireRole = (...roles: AdminRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.admin) return next(new AppError(401, "Unauthorized"));
    if (!roles.includes(req.admin.role))
      return next(new AppError(403, "Forbidden"));
    return next();
  };
};
