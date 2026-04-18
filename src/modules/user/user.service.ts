import {
  AppError,
  isNonEmptyString,
  normalizeString,
} from "../../shared/utils";
import { supportRepository } from "../bot/support.repository";
import { userRepository } from "./user.repository";

const isDebug = process.env.NODE_ENV !== "production";

const supportStatuses = new Set<string>([
  "none",
  "pending",
  "active",
  "closed",
]);

const parseSupportStatus = (value: unknown) => {
  if (!isNonEmptyString(value))
    throw new AppError(400, "supportStatus must be provided");
  const v = normalizeString(value).toLowerCase();
  if (!supportStatuses.has(v)) throw new AppError(400, "Invalid supportStatus");
  return v as "none" | "pending" | "active" | "closed";
};

export const userService = {
  register: async (body: any) => {
    console.log("[BOT REQUEST]:", {
      layer: "user.service",
      action: "register",
      telegramId: body?.telegramId,
      ...(isDebug ? { body } : {}),
    });

    const telegramIdRaw = body?.telegramId;
    const nameRaw = body?.name;

    if (!isNonEmptyString(telegramIdRaw))
      throw new AppError(400, "telegramId is required");
    if (!isNonEmptyString(nameRaw)) throw new AppError(400, "name is required");

    const telegramId = normalizeString(telegramIdRaw);
    const name = normalizeString(nameRaw);

    const phoneRaw = body?.phone;
    const phone =
      phoneRaw === undefined || phoneRaw === null || phoneRaw === ""
        ? null
        : String(phoneRaw).trim();

    try {
      const existing = await userRepository.findByTelegramId(telegramId);
      if (existing) throw new AppError(409, "User already registered");

      const created = await userRepository.create({
        telegramId,
        name,
        phone,
      });

      console.log("[BOT RESPONSE]:", {
        layer: "user.service",
        action: "register",
        telegramId: created.telegramId,
        id: created.id,
      });

      return created;
    } catch (err) {
      console.error("[BOT ERROR]:", {
        layer: "user.service",
        action: "register",
        error:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : err,
      });
      throw err;
    }
  },

  getOrCreateUser: async (
    telegramIdRaw: unknown,
    telegramNicknameRaw: unknown,
    telegramUsernameRaw: unknown,
  ) => {
    console.log("[BOT REQUEST]:", {
      layer: "user.service",
      action: "getOrCreateUser",
      telegramId: telegramIdRaw,
      ...(isDebug
        ? {
            telegramNickname: telegramNicknameRaw,
            telegramUsername: telegramUsernameRaw,
          }
        : {}),
    });

    if (!isNonEmptyString(telegramIdRaw))
      throw new AppError(400, "telegramId is required");
    if (!isNonEmptyString(telegramNicknameRaw))
      throw new AppError(400, "telegramNickname is required");

    const telegramId = normalizeString(telegramIdRaw);
    const telegramNickname = normalizeString(telegramNicknameRaw);

    const telegramUsername =
      telegramUsernameRaw === undefined ||
      telegramUsernameRaw === null ||
      telegramUsernameRaw === ""
        ? null
        : normalizeString(String(telegramUsernameRaw));

    if (telegramId.length > 64)
      throw new AppError(400, "telegramId is too long");
    if (telegramNickname.length > 191)
      throw new AppError(400, "telegramNickname is too long");
    if (telegramUsername && telegramUsername.length > 64)
      throw new AppError(400, "telegramUsername is too long");

    try {
      const user = await userRepository.upsertByTelegramId({
        telegramId,
        telegramNickname,
        telegramUsername,
      });
      console.log("[BOT RESPONSE]:", {
        layer: "user.service",
        action: "getOrCreateUser",
        id: user.id,
        telegramId: user.telegramId,
      });
      return user;
    } catch (err) {
      console.error("[BOT ERROR]:", {
        layer: "user.service",
        action: "getOrCreateUser",
        error:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : err,
      });
      throw err;
    }
  },

  updatePhone: async (telegramIdRaw: unknown, phoneRaw: unknown) => {
    console.log("[BOT REQUEST]:", {
      layer: "user.service",
      action: "updatePhone",
      telegramId: telegramIdRaw,
    });

    if (!isNonEmptyString(telegramIdRaw))
      throw new AppError(400, "telegramId is required");
    if (!isNonEmptyString(phoneRaw))
      throw new AppError(400, "phone is required");

    const telegramId = normalizeString(telegramIdRaw);
    const phone = normalizeString(String(phoneRaw));

    if (telegramId.length > 64)
      throw new AppError(400, "telegramId is too long");
    if (phone.length > 32) throw new AppError(400, "phone is too long");

    try {
      const existing = await userRepository.findByTelegramId(telegramId);
      if (!existing) throw new AppError(404, "User not found");

      const updated = await userRepository.updatePhoneByTelegramId(
        telegramId,
        phone,
      );

      console.log("[BOT RESPONSE]:", {
        layer: "user.service",
        action: "updatePhone",
        telegramId: updated.telegramId,
      });

      return updated;
    } catch (err) {
      console.error("[BOT ERROR]:", {
        layer: "user.service",
        action: "updatePhone",
        error:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : err,
      });
      throw err;
    }
  },

  listForAdmin: async () => {
    return userRepository.findAllForAdmin();
  },

  getByIdForAdmin: async (id: number) => {
    const user = await userRepository.findByIdForAdmin(id);
    if (!user) throw new AppError(404, "User not found");
    return user;
  },

  updateSupportStatusByIdForAdmin: async (
    adminId: number,
    id: number,
    body: any,
  ) => {
    const status = parseSupportStatus(body?.supportStatus);

    const existing = await userRepository.findByIdForAdmin(id);
    if (!existing) throw new AppError(404, "User not found");

    const supportAdminId =
      status === "none"
        ? null
        : existing.supportAdminId === null
          ? adminId
          : undefined;

    const updated = await userRepository.updateSupportStatusByIdForAdmin(
      id,
      status,
      supportAdminId,
    );

    if (status === "none" || status === "closed") {
      try {
        await supportRepository.closeAllOpenByTelegramId(updated.telegramId);
      } catch {
        // ignore
      }
    }

    return updated;
  },
};
