import { prisma } from "../../shared/prisma";

export const supportRepository = {
  createRequest: async (
    telegramId: string,
    status: "pending" | "active" = "pending",
  ) => {
    return prisma.supportRequest.create({
      data: { telegramId, status },
      select: {
        id: true,
        telegramId: true,
        status: true,
        createdAt: true,
      },
    });
  },

  findLatestOpenByTelegramId: async (telegramId: string) => {
    return prisma.supportRequest.findFirst({
      where: { telegramId, status: { in: ["pending", "active"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        telegramId: true,
        status: true,
        createdAt: true,
      },
    });
  },

  closeAllOpenByTelegramId: async (telegramId: string) => {
    return prisma.supportRequest.updateMany({
      where: {
        telegramId,
        status: { in: ["pending", "active"] },
      },
      data: { status: "closed" },
    });
  },

  setStatusById: async (
    id: number,
    status: "pending" | "active" | "closed",
  ) => {
    return prisma.supportRequest.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        telegramId: true,
        status: true,
        createdAt: true,
      },
    });
  },
};
