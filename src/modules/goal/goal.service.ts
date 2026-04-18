import {
  AppError,
  isNonEmptyString,
  normalizeString,
} from "../../shared/utils";
import { goalRepository } from "./goal.repository";

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

    return goalRepository.create({ title, sortOrder, isActive });
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

    return goalRepository.updateById(id, patch);
  },

  getAll: async () => goalRepository.findAll(),

  getActiveForBot: async () => goalRepository.findActive(),

  getById: async (id: number) => {
    const goal = await goalRepository.findById(id);
    if (!goal) throw new AppError(404, "Goal not found");
    return goal;
  },

  softDelete: async (id: number) => {
    const existing = await goalRepository.findById(id);
    if (!existing) throw new AppError(404, "Goal not found");
    return goalRepository.updateById(id, { isActive: false });
  },
};
