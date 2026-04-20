import { prisma } from "../../shared/prisma";

const adminSelect = {
  id: true,
  name: true,
  email: true,
  tgUsername: true,
  tgChatId: true,
  role: true,
  createdAt: true,
} as const;

export const adminRepository = {
  findForLoginByEmail: async (email: string) => {
    return prisma.admin.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, password: true },
    });
  },

  findByEmail: async (email: string) => {
    return prisma.admin.findUnique({ where: { email }, select: adminSelect });
  },

  findByTelegramUsername: async (tgUsername: string) => {
    return prisma.admin.findFirst({
      where: { tgUsername },
      select: adminSelect,
    });
  },

  findByTelegramChatId: async (tgChatId: string) => {
    return prisma.admin.findFirst({
      where: { tgChatId },
      select: adminSelect,
    });
  },

  findNotificationTargets: async () => {
    return prisma.admin.findMany({
      where: {
        tgChatId: { not: null },
      },
      select: {
        id: true,
        tgUsername: true,
        tgChatId: true,
      },
    });
  },

  findAll: async (params?: {
    where?: Record<string, unknown>;
    skip?: number;
    take?: number;
  }) => {
    return prisma.admin.findMany({
      where: params?.where,
      skip: params?.skip,
      take: params?.take,
      orderBy: { createdAt: "desc" },
      select: adminSelect,
    });
  },

  countAll: async (where?: Record<string, unknown>) => {
    return prisma.admin.count({ where });
  },

  findById: async (id: number) => {
    return prisma.admin.findUnique({ where: { id }, select: adminSelect });
  },

  create: async (data: {
    name: string;
    email: string;
    tgUsername: string;
    tgChatId: string | null;
    password: string;
    role: "admin" | "super_admin";
  }) => {
    return prisma.admin.create({
      data,
      select: adminSelect,
    });
  },

  updateById: async (
    id: number,
    data: {
      name?: string;
      email?: string;
      tgUsername?: string;
      tgChatId?: string | null;
      role?: "admin" | "super_admin";
      password?: string;
    },
  ) => {
    return prisma.admin.update({ where: { id }, data, select: adminSelect });
  },

  updateTelegramBindingById: async (
    id: number,
    data: {
      tgUsername?: string;
      tgChatId?: string | null;
    },
  ) => {
    return prisma.admin.update({
      where: { id },
      data,
      select: adminSelect,
    });
  },

  countByRole: async (role: "admin" | "super_admin") => {
    return prisma.admin.count({ where: { role } });
  },

  deleteById: async (id: number) => {
    return prisma.admin.delete({ where: { id }, select: adminSelect });
  },
};
