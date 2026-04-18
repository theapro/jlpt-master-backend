import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";

import { AppError } from "../shared/utils";

const isDev = process.env.NODE_ENV !== "production";

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  // Always log full stack for easier debugging
  // eslint-disable-next-line no-console
  console.error(
    "[ERROR]:",
    err instanceof Error ? (err.stack ?? err.message) : err,
  );

  const req = _req as any;
  const url = typeof req?.originalUrl === "string" ? req.originalUrl : "";
  const isBotRoute = url.startsWith("/api/bot");

  if (isBotRoute) {
    return res.status(200).json({
      reply: "Xatolik yuz berdi, qaytadan urinib ko‘ring",
      buttons: [["🏠 Menu"]],
      action: "ERROR",
    });
  }

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ message: err.message, details: isDev ? err.details : undefined });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Duplicate record" });
    }

    if (err.code === "P2003") {
      return res.status(400).json({ message: "Invalid relation reference" });
    }

    return res.status(400).json({ message: "Database error" });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ message: "Invalid request" });
  }

  return res.status(500).json({ message: "Internal Server Error" });
};
