import { prisma } from "../../shared/prisma";

export const registrationRepository = {
  create: async (data: {
    telegramId: string;
    name: string;
    phone: string;
    courseId: number;
  }) => {
    return prisma.registration.create({
      data,
      select: {
        id: true,
        telegramId: true,
        name: true,
        phone: true,
        courseId: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  },

  findAll: async () => {
    return prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        telegramId: true,
        name: true,
        phone: true,
        createdAt: true,
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  },
};
