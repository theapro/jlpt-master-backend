import type { EnrollmentStatus, UserLearningFormat } from "@prisma/client";

import { prisma } from "../../shared/prisma";

const enrollmentSelect = {
  id: true,
  status: true,
  name: true,
  phone: true,
  format: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, telegramId: true, name: true, phone: true } },
  course: { select: { id: true, title: true, isActive: true } },
} as const;

export const enrollmentRepository = {
  create: async (data: {
    userId: number;
    courseId: number;
    status: EnrollmentStatus;
    name?: string | null;
    phone?: string | null;
    format?: UserLearningFormat | null;
  }) => {
    return prisma.enrollment.create({
      data,
      select: {
        ...enrollmentSelect,
      },
    });
  },

  upsertByUserAndCourse: async (data: {
    userId: number;
    courseId: number;
    status: EnrollmentStatus;
    name?: string | null;
    phone?: string | null;
    format?: UserLearningFormat | null;
  }) => {
    return prisma.enrollment.upsert({
      where: {
        userId_courseId: { userId: data.userId, courseId: data.courseId },
      },
      create: {
        userId: data.userId,
        courseId: data.courseId,
        status: data.status,
        name: data.name ?? null,
        phone: data.phone ?? null,
        format: data.format ?? null,
      },
      update: {
        status: data.status,
        name: data.name ?? undefined,
        phone: data.phone ?? undefined,
        format: data.format ?? undefined,
      },
      select: {
        ...enrollmentSelect,
      },
    });
  },
};
