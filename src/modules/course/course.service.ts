import { AdminRole } from "@prisma/client";

import {
  AppError,
  isNonEmptyString,
  normalizeString,
  parsePositiveInt,
} from "../../shared/utils";
import { courseRepository } from "./course.repository";

const parseIsActive = (value: unknown) => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new AppError(400, "isActive must be a boolean");
};

const parseIsActiveOptional = (value: unknown) => {
  if (value === undefined) return undefined;
  return parseIsActive(value);
};

const MAX_INT32 = 2_147_483_647;

export const courseService = {
  create: async (body: any) => {
    if (!isNonEmptyString(body?.title))
      throw new AppError(400, "title is required");
    if (!isNonEmptyString(body?.description))
      throw new AppError(400, "description is required");

    const title = normalizeString(body.title);
    const description = normalizeString(body.description);

    const durationRaw = body?.duration;
    const duration =
      durationRaw === undefined || durationRaw === null || durationRaw === ""
        ? null
        : parsePositiveInt(durationRaw);
    if (
      durationRaw !== undefined &&
      durationRaw !== null &&
      durationRaw !== ""
    ) {
      if (!duration)
        throw new AppError(400, "duration must be a positive integer");
      if (duration > MAX_INT32)
        throw new AppError(400, "duration is too large");
    }
    const isActive = parseIsActive(body?.isActive);

    return courseRepository.create({
      title,
      description,
      duration,
      isActive,
    });
  },

  update: async (
    admin: { id: number; role: AdminRole },
    id: number,
    body: any,
  ) => {
    if (!isNonEmptyString(body?.title))
      throw new AppError(400, "title is required");
    if (!isNonEmptyString(body?.description))
      throw new AppError(400, "description is required");

    const existing = await courseRepository.findById(id);
    if (!existing) throw new AppError(404, "Course not found");

    const title = normalizeString(body.title);
    const description = normalizeString(body.description);

    const durationRaw = body?.duration;
    const duration =
      durationRaw === undefined || durationRaw === null || durationRaw === ""
        ? null
        : parsePositiveInt(durationRaw);
    if (
      durationRaw !== undefined &&
      durationRaw !== null &&
      durationRaw !== ""
    ) {
      if (!duration)
        throw new AppError(400, "duration must be a positive integer");
      if (duration > MAX_INT32)
        throw new AppError(400, "duration is too large");
    }

    const patch: {
      title: string;
      description: string;
      duration: number | null;
      isActive?: boolean;
    } = {
      title,
      description,
      duration,
    };

    const isActive = parseIsActiveOptional(body?.isActive);
    if (isActive !== undefined) patch.isActive = isActive;

    return courseRepository.updateById(id, patch);
  },

  getAll: async () => courseRepository.findAll(),

  getActiveForBot: async () => courseRepository.findActive(),

  getById: async (id: number) => {
    const course = await courseRepository.findById(id);
    if (!course) throw new AppError(404, "Course not found");
    return course;
  },

  softDelete: async (admin: { id: number; role: AdminRole }, id: number) => {
    const existing = await courseRepository.findById(id);
    if (!existing) throw new AppError(404, "Course not found");

    return courseRepository.updateById(id, { isActive: false });
  },

  getFormattedListForBot: async () => {
    const courses = await courseRepository.findActive();
    if (courses.length === 0) return "No courses are available yet.";

    return courses
      .slice(0, 20)
      .map((c) => `${c.id}. ${c.title}`)
      .join("\n");
  },
};
