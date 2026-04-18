import {
  AppError,
  isNonEmptyString,
  normalizeString,
} from "../../shared/utils";
import { goalRepository } from "./goal.repository";

const CACHE_TTL_MS = 5 * 60 * 1000;
let activeGoalsCache:
  | Awaited<ReturnType<typeof goalRepository.findActive>>
  | null = null;
let activeGoalsCacheLoadedAt = 0;
let activeGoalsRefreshPromise: Promise<
  Awaited<ReturnType<typeof goalRepository.findActive>>
> | null = null;

const invalidateActiveGoalsCache = () => {
  activeGoalsCache = null;
  activeGoalsCacheLoadedAt = 0;
  activeGoalsRefreshPromise = null;
};

const getActiveGoalsCached = async () => {
  const now = Date.now();
  if (
    activeGoalsCache &&
    activeGoalsCacheLoadedAt > 0 &&
    now - activeGoalsCacheLoadedAt < CACHE_TTL_MS
  ) {
    return activeGoalsCache;
  }

  if (!activeGoalsRefreshPromise) {
    activeGoalsRefreshPromise = goalRepository
      .findActive()
      .then((rows) => {
        activeGoalsCache = rows;
        activeGoalsCacheLoadedAt = Date.now();
        return rows;
      })
      .finally(() => {
        activeGoalsRefreshPromise = null;
      });
  }

  return activeGoalsRefreshPromise;
};

const parseTitle = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "title is required");
  const title = normalizeString(value);
  if (title.length > 191) throw new AppError(400, "title is too long");
  return title;
};

const parseSortOrder = (value: unknown) => {
  if (value === undefined || value === null || value === "") return 0;

  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isInteger(n))
    throw new AppError(400, "sortOrder must be an integer");

  if (n < -10_000 || n > 10_000)
    throw new AppError(400, "sortOrder is out of range");

  return n;
};

const parseIsActive = (value: unknown) => {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new AppError(400, "isActive must be a boolean");
};

export const goalService = {
  create: async (body: any) => {
    const title = parseTitle(body?.title);
    const sortOrder = parseSortOrder(body?.sortOrder);
    const isActive = parseIsActive(body?.isActive);

    const created = await goalRepository.create({ title, sortOrder, isActive });
    invalidateActiveGoalsCache();
    return created;
  },

  update: async (id: number, body: any) => {
    const patch: { title?: string; sortOrder?: number; isActive?: boolean } =
      {};

    if (body?.title !== undefined) patch.title = parseTitle(body.title);
    if (body?.sortOrder !== undefined)
      patch.sortOrder = parseSortOrder(body.sortOrder);
    if (body?.isActive !== undefined)
      patch.isActive = parseIsActive(body.isActive);

    if (Object.keys(patch).length === 0)
      throw new AppError(400, "No fields to update");

    const existing = await goalRepository.findById(id);
    if (!existing) throw new AppError(404, "Goal not found");

    const updated = await goalRepository.updateById(id, patch);
    invalidateActiveGoalsCache();
    return updated;
  },

  getAll: async () => goalRepository.findAll(),

  getActiveForBot: async () => getActiveGoalsCached(),

  getById: async (id: number) => {
    const goal = await goalRepository.findById(id);
    if (!goal) throw new AppError(404, "Goal not found");
    return goal;
  },

  softDelete: async (id: number) => {
    const existing = await goalRepository.findById(id);
    if (!existing) throw new AppError(404, "Goal not found");
    const updated = await goalRepository.updateById(id, { isActive: false });
    invalidateActiveGoalsCache();
    return updated;
  },
};
