import { EnrollmentStatus, Prisma, UserLearningFormat } from "@prisma/client";

import { AppError, parsePositiveInt } from "../../shared/utils";
import { enrollmentRepository } from "./enrollment.repository";

const isDebug = process.env.NODE_ENV !== "production";

const isBotTrafficLoggingEnabled = (() => {
  const raw = String(process.env.BOT_DEBUG ?? "").toLowerCase().trim();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return isDebug;
})();

const statuses = new Set<string>(Object.values(EnrollmentStatus));

const parseStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "")
    return EnrollmentStatus.pending;
  if (typeof value !== "string")
    throw new AppError(400, "status must be a string");
  if (!statuses.has(value)) throw new AppError(400, "Invalid status");
  return value as EnrollmentStatus;
};

export const enrollmentService = {
  assign: async (body: any) => {
    if (isBotTrafficLoggingEnabled) {
      console.log("[BOT REQUEST]:", {
        layer: "enrollment.service",
        action: "assign",
        userId: body?.userId,
        courseId: body?.courseId,
        status: body?.status,
        ...(isDebug ? { body } : {}),
      });
    }

    const userId = parsePositiveInt(body?.userId);
    const courseId = parsePositiveInt(body?.courseId);

    if (!userId) throw new AppError(400, "userId must be a positive integer");
    if (!courseId)
      throw new AppError(400, "courseId must be a positive integer");

    const status = parseStatus(body?.status);

    try {
      const result = await enrollmentRepository.create({
        userId,
        courseId,
        status,
      });
      if (isBotTrafficLoggingEnabled) {
        console.log("[BOT RESPONSE]:", {
          layer: "enrollment.service",
          action: "assign",
          enrollmentId: result.id,
          status: result.status,
        });
      }
      return result;
    } catch (err) {
      console.error("[BOT ERROR]:", {
        layer: "enrollment.service",
        action: "assign",
        error:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : err,
      });
      throw err;
    }
  },

  enrollForBot: async (params: { userId: number; courseId: number }) => {
    if (isBotTrafficLoggingEnabled) {
      console.log("[BOT REQUEST]:", {
        layer: "enrollment.service",
        action: "enrollForBot",
        ...params,
      });
    }

    try {
      const result = await enrollmentRepository.upsertByUserAndCourse({
        userId: params.userId,
        courseId: params.courseId,
        status: EnrollmentStatus.pending,
      });

      if (isBotTrafficLoggingEnabled) {
        console.log("[BOT RESPONSE]:", {
          layer: "enrollment.service",
          action: "enrollForBot",
          enrollmentId: result.id,
        });
      }

      return { upserted: true as const };
    } catch (err) {
      console.error("[BOT ERROR]:", {
        layer: "enrollment.service",
        action: "enrollForBot",
        error:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : err,
      });
      throw err;
    }
  },

  registerForBot: async (params: {
    userId: number;
    courseId: number;
    name: string;
    phone: string;
    format: UserLearningFormat;
  }) => {
    if (isBotTrafficLoggingEnabled) {
      console.log("[BOT REQUEST]:", {
        layer: "enrollment.service",
        action: "registerForBot",
        userId: params.userId,
        courseId: params.courseId,
        format: params.format,
      });
    }

    try {
      const result = await enrollmentRepository.upsertByUserAndCourse({
        userId: params.userId,
        courseId: params.courseId,
        status: EnrollmentStatus.pending,
        name: params.name,
        phone: params.phone,
        format: params.format,
      });

      if (isBotTrafficLoggingEnabled) {
        console.log("[BOT RESPONSE]:", {
          layer: "enrollment.service",
          action: "registerForBot",
          enrollmentId: result.id,
        });
      }

      return result;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // should not happen with upsert, but keep a friendly log
        if (isBotTrafficLoggingEnabled) {
          console.log("[BOT RESPONSE]:", {
            layer: "enrollment.service",
            action: "registerForBot",
            duplicate: true,
          });
        }
      }

      console.error("[BOT ERROR]:", {
        layer: "enrollment.service",
        action: "registerForBot",
        error:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : err,
      });
      throw err;
    }
  },
};
