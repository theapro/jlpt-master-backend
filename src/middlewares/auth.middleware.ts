import type { RequestHandler } from "express";

import { AppError } from "../shared/utils";
import { verifyAdminToken } from "../modules/auth/auth.service";

export const requireAdminAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing Authorization header"));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAdminToken(token);
    req.admin = { id: payload.adminId, role: payload.role };
    return next();
  } catch {
    return next(new AppError(401, "Invalid or expired token"));
  }
};
