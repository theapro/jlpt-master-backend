import { AdminRole } from "@prisma/client";

import {
  AppError,
  isNonEmptyString,
  normalizeString,
  parsePositiveInt,
} from "../../shared/utils";
import { courseRepository } from "./course.repository";

const CACHE_TTL_MS = 5 * 60 * 1000;
let activeCoursesCache: Awaited<
  ReturnType<typeof courseRepository.findActive>
> | null = null;
let activeCoursesCacheLoadedAt = 0;
let activeCoursesRefreshPromise: Promise<
  Awaited<ReturnType<typeof courseRepository.findActive>>
> | null = null;

let courseByIdCache: Map<
  number,
  {
    loadedAt: number;
    value: Awaited<ReturnType<typeof courseRepository.findById>>;
  }
> | null = null;

let courseByIdPromiseCache: Map<
  number,
  Promise<Awaited<ReturnType<typeof courseRepository.findById>>>
> | null = null;

const invalidateActiveCoursesCache = () => {
  activeCoursesCache = null;
  activeCoursesCacheLoadedAt = 0;
  activeCoursesRefreshPromise = null;
  courseByIdCache = null;
  courseByIdPromiseCache = null;
};

const getActiveCoursesCached = async () => {
  const now = Date.now();
  if (
    activeCoursesCache &&
    activeCoursesCacheLoadedAt > 0 &&
    now - activeCoursesCacheLoadedAt < CACHE_TTL_MS
  ) {
    return activeCoursesCache;
  }

  if (!activeCoursesRefreshPromise) {
    activeCoursesRefreshPromise = courseRepository
      .findActive()
      .then((rows) => {
        activeCoursesCache = rows;
        activeCoursesCacheLoadedAt = Date.now();
        return rows;
      })
      .finally(() => {
        activeCoursesRefreshPromise = null;
      });
  }

  return activeCoursesRefreshPromise;
};

const getCourseByIdCached = async (id: number) => {
  if (!courseByIdCache) courseByIdCache = new Map();
  if (!courseByIdPromiseCache) courseByIdPromiseCache = new Map();

  const now = Date.now();
  const cached = courseByIdCache.get(id) ?? null;
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.value;

  const inFlight = courseByIdPromiseCache.get(id) ?? null;
  if (inFlight) return inFlight;

  const promise = courseRepository
    .findById(id)
    .then((course) => {
      courseByIdCache!.set(id, { loadedAt: Date.now(), value: course });
      return course;
    })
    .finally(() => {
      courseByIdPromiseCache!.delete(id);
    });

  courseByIdPromiseCache.set(id, promise);
  return promise;
};

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

    const created = await courseRepository.create({
      title,
      description,
      duration,
      isActive,
    });

    invalidateActiveCoursesCache();
    return created;
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

    const updated = await courseRepository.updateById(id, patch);
    invalidateActiveCoursesCache();
    return updated;
  },

  getAll: async () => courseRepository.findAll(),

  getActiveForBot: async () => getActiveCoursesCached(),

  getById: async (id: number) => {
    const course = await getCourseByIdCached(id);
    if (!course) throw new AppError(404, "Course not found");
    return course;
  },

  softDelete: async (admin: { id: number; role: AdminRole }, id: number) => {
    const existing = await courseRepository.findById(id);
    if (!existing) throw new AppError(404, "Course not found");

    const updated = await courseRepository.updateById(id, { isActive: false });
    invalidateActiveCoursesCache();
    return updated;
  },

  getFormattedListForBot: async () => {
    const courses = await getActiveCoursesCached();
    if (courses.length === 0) return "No courses are available yet.";

    return courses
      .slice(0, 20)
      .map((c) => `${c.id}. ${c.title}`)
      .join("\n");
  },
};
