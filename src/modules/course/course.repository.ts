import { prisma } from "../../shared/prisma";

const courseSelect = {
  id: true,
  title: true,
  description: true,
  duration: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const courseSelectForBotActiveList = {
  id: true,
  title: true,
} as const;

export const courseRepository = {
  create: async (data: {
    title: string;
    description: string;
    duration?: number | null;
    isActive?: boolean;
  }) => {
    return prisma.course.create({
      data,
      select: {
        ...courseSelect,
      },
    });
  },

  updateById: async (
    id: number,
    data: {
      title?: string;
      description?: string;
      duration?: number | null;
      isActive?: boolean;
    },
  ) => {
    return prisma.course.update({
      where: { id },
      data,
      select: {
        ...courseSelect,
      },
    });
  },

  findAll: async () => {
    return prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        ...courseSelect,
      },
    });
  },

  findActive: async () => {
    return prisma.course.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        ...courseSelectForBotActiveList,
      },
    });
  },

  findById: async (id: number) => {
    return prisma.course.findUnique({
      where: { id },
      select: {
        ...courseSelect,
      },
    });
  },

  deleteById: async (id: number) => {
    return prisma.course.delete({
      where: { id },
      select: {
        ...courseSelect,
      },
    });
  },
};
