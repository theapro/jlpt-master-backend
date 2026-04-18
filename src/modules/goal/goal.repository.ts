import { prisma } from "../../shared/prisma";

const goalSelect = {
  id: true,
  title: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const goalRepository = {
  create: async (data: {
    title: string;
    isActive: boolean;
    sortOrder: number;
  }) => {
    return prisma.goal.create({
      data,
      select: goalSelect,
    });
  },

  updateById: async (
    id: number,
    data: { title?: string; isActive?: boolean; sortOrder?: number },
  ) => {
    return prisma.goal.update({
      where: { id },
      data,
      select: goalSelect,
    });
  },

  findAll: async () => {
    return prisma.goal.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: goalSelect,
    });
  },

  findById: async (id: number) => {
    return prisma.goal.findUnique({
      where: { id },
      select: goalSelect,
    });
  },

  findActive: async () => {
    return prisma.goal.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: goalSelect,
    });
  },
};
