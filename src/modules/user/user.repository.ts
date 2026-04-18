import type { UserExperience, UserLearningFormat } from "@prisma/client";

import { prisma } from "../../shared/prisma";

const adminUserSelect = {
  id: true,
  telegramId: true,
  name: true,
  phone: true,
  telegramUsername: true,
  telegramNickname: true,

  pendingCourseId: true,

  currentStep: true,
  goal: true,
  experience: true,
  learningFormat: true,

  supportAdminId: true,
  supportAdmin: {
    select: {
      id: true,
      name: true,
    },
  },

  isInSupport: true,
  supportStatus: true,
  createdAt: true,
} as const;

export const userRepository = {
  findByTelegramId: async (telegramId: string) => {
    return prisma.user.findUnique({ where: { telegramId } });
  },

  findManyByTelegramIds: async (telegramIds: string[]) => {
    if (telegramIds.length === 0) return [];
    return prisma.user.findMany({
      where: { telegramId: { in: telegramIds } },
      select: {
        id: true,
        telegramId: true,
        name: true,
        phone: true,
        telegramUsername: true,
        telegramNickname: true,
        pendingCourseId: true,
        isInSupport: true,
        supportStatus: true,
        createdAt: true,
      },
    });
  },

  findAllForAdmin: async () => {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        ...adminUserSelect,
      },
    });
  },

  findByIdForAdmin: async (id: number) => {
    return prisma.user.findUnique({
      where: { id },
      select: {
        ...adminUserSelect,
      },
    });
  },

  updateByTelegramId: async (
    telegramId: string,
    data: {
      name?: string;
      phone?: string | null;
      telegramUsername?: string | null;
      telegramNickname?: string | null;
      supportAdminId?: number | null;

      pendingCourseId?: number | null;

      currentStep?: string;
      goal?: string | null;
      experience?: UserExperience | null;
      learningFormat?: UserLearningFormat | null;
    },
  ) => {
    return prisma.user.update({
      where: { telegramId },
      data,
      select: {
        ...adminUserSelect,
      },
    });
  },

  upsertByTelegramId: async (data: {
    telegramId: string;
    telegramNickname: string;
    telegramUsername: string | null;
  }) => {
    return prisma.user.upsert({
      where: { telegramId: data.telegramId },
      update: {
        telegramNickname: data.telegramNickname,
        telegramUsername: data.telegramUsername,
      },
      create: {
        telegramId: data.telegramId,
        name: data.telegramNickname,
        telegramNickname: data.telegramNickname,
        telegramUsername: data.telegramUsername,
      },
      select: {
        ...adminUserSelect,
      },
    });
  },

  updatePhoneByTelegramId: async (telegramId: string, phone: string | null) => {
    return prisma.user.update({
      where: { telegramId },
      data: { phone },
      select: {
        ...adminUserSelect,
      },
    });
  },

  updateSupportStatusByTelegramId: async (
    telegramId: string,
    status: "none" | "pending" | "active" | "closed",
  ) => {
    return prisma.user.update({
      where: { telegramId },
      data: {
        isInSupport: status === "pending" || status === "active",
        supportStatus: status,
        ...(status === "none" ? { supportAdminId: null } : {}),
      },
      select: {
        ...adminUserSelect,
      },
    });
  },

  updateSupportStatusByIdForAdmin: async (
    id: number,
    status: "none" | "pending" | "active" | "closed",
    supportAdminId?: number | null,
  ) => {
    return prisma.user.update({
      where: { id },
      data: {
        isInSupport: status === "pending" || status === "active",
        supportStatus: status,
        ...(status === "none" ? { supportAdminId: null } : {}),
        ...(supportAdminId !== undefined ? { supportAdminId } : {}),
      },
      select: {
        ...adminUserSelect,
      },
    });
  },

  create: async (data: {
    telegramId: string;
    name: string;
    phone?: string | null;
  }) => {
    return prisma.user.create({
      data,
      select: {
        ...adminUserSelect,
      },
    });
  },
};
