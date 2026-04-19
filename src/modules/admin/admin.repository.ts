import { prisma } from "../../shared/prisma";

const adminSelect = {
  id: true,
  name: true,
  email: true,
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

  findAll: async () => {
    return prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
      select: adminSelect,
    });
  },

  findById: async (id: number) => {
    return prisma.admin.findUnique({ where: { id }, select: adminSelect });
  },

  create: async (data: {
    name: string;
    email: string;
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
      role?: "admin" | "super_admin";
      password?: string;
    },
  ) => {
    return prisma.admin.update({ where: { id }, data, select: adminSelect });
  },

  countByRole: async (role: "admin" | "super_admin") => {
    return prisma.admin.count({ where: { role } });
  },

  deleteById: async (id: number) => {
    return prisma.admin.delete({ where: { id }, select: adminSelect });
  },
};
