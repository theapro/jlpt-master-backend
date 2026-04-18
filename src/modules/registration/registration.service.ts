import { Prisma } from "@prisma/client";

import {
  AppError,
  isNonEmptyString,
  normalizeString,
  parsePositiveInt,
} from "../../shared/utils";
import { registrationRepository } from "./registration.repository";

const parseName = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "Ism talab qilinadi");
  const name = normalizeString(value);
  if (name.length > 100) throw new AppError(400, "Ism juda uzun");
  return name;
};

const parsePhone = (value: unknown) => {
  if (!isNonEmptyString(value))
    throw new AppError(400, "Telefon raqami talab qilinadi");

  const phone = normalizeString(String(value));
  if (phone.length > 32) throw new AppError(400, "Telefon raqami juda uzun");
  if (!/^[0-9+()\-\s]+$/.test(phone))
    throw new AppError(400, "Telefon raqamida noto‘g‘ri belgilar bor");

  return phone.replace(/\s+/g, " ");
};

export const registrationService = {
  createForBot: async (params: {
    telegramId: string;
    name: unknown;
    phone: unknown;
    courseId: unknown;
  }) => {
    const courseId = parsePositiveInt(params.courseId);
    if (!courseId)
      throw new AppError(400, "courseId musbat butun son bo‘lishi kerak");

    const name = parseName(params.name);
    const phone = parsePhone(params.phone);

    try {
      const created = await registrationRepository.create({
        telegramId: params.telegramId,
        name,
        phone,
        courseId,
      });

      return {
        created: true as const,
        duplicate: false as const,
        registration: created,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return { created: false as const, duplicate: true as const };
      }

      throw err;
    }
  },

  listForAdmin: async () => {
    return registrationRepository.findAll();
  },
};
