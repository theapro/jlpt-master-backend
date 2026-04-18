import {
  AppError,
  isNonEmptyString,
  normalizeString,
  parsePositiveInt,
} from "../../shared/utils";
import { supportRepository } from "../bot/support.repository";

type SupportRequestStatus = "pending" | "active" | "closed";

const parseSupportRequestStatus = (value: unknown): SupportRequestStatus => {
  if (!isNonEmptyString(value)) throw new AppError(400, "status is required");
  const v = normalizeString(value).toLowerCase();

  if (v === "open") return "pending";
  if (v === "in_progress" || v === "in-progress") return "active";

  if (v === "pending" || v === "active" || v === "closed") return v;

  throw new AppError(400, "Invalid status");
};

export const supportService = {
  setStatusByIdForAdmin: async (idRaw: unknown, body: any) => {
    const id = parsePositiveInt(idRaw);
    if (!id) throw new AppError(400, "Invalid support request id");

    const status = parseSupportRequestStatus(body?.status);

    try {
      const supportRequest = await supportRepository.setStatusById(id, status);
      return { supportRequest };
    } catch {
      throw new AppError(404, "Support request not found");
    }
  },
};
