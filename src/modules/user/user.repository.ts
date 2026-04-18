import type {
  Prisma,
  UserExperience,
  UserLearningFormat,
} from "@prisma/client";

import { prisma } from "../../shared/prisma";

const botUserSelect = {
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

  isInSupport: true,
  supportStatus: true,
  createdAt: true,
} as const;

type BotUser = Prisma.UserGetPayload<{ select: typeof botUserSelect }>;

const adminUserSelect = {
  ...botUserSelect,
  supportAdmin: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_CACHE_MAX = 10_000;

const userCache = new Map<
  string,
  { loadedAt: number; value: BotUser | null }
>();
const userPromiseCache = new Map<string, Promise<BotUser | null>>();

const pruneUserCacheIfNeeded = () => {
  if (userCache.size <= USER_CACHE_MAX) return;
  const overflow = userCache.size - USER_CACHE_MAX;
  for (let i = 0; i < overflow; i++) {
    const oldestKey = userCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    userCache.delete(oldestKey);
  }
};

const getCachedUser = (telegramId: string) => {
  const entry = userCache.get(telegramId);
  if (!entry) return undefined;

  const now = Date.now();
  if (now - entry.loadedAt > USER_CACHE_TTL_MS) {
    userCache.delete(telegramId);
    return undefined;
  }

  return entry.value;
};

const setCachedUser = (telegramId: string, value: BotUser | null) => {
  if (userCache.has(telegramId)) {
    userCache.delete(telegramId);
  }
  userCache.set(telegramId, { loadedAt: Date.now(), value });
  pruneUserCacheIfNeeded();
};

export const userRepository = {
  findByTelegramId: async (telegramId: string) => {
    const cached = getCachedUser(telegramId);
    if (cached !== undefined) return cached;

    const inFlight = userPromiseCache.get(telegramId);
    if (inFlight) return inFlight;

    const promise = prisma.user
      .findUnique({ where: { telegramId }, select: botUserSelect })
      .then((user) => {
        setCachedUser(telegramId, user);
        return user;
      })
      .finally(() => {
        userPromiseCache.delete(telegramId);
      });

    userPromiseCache.set(telegramId, promise);
    return promise;
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
    const updated = await prisma.user.update({
      where: { telegramId },
      data,
      select: {
        ...botUserSelect,
      },
    });

    setCachedUser(telegramId, updated);
    return updated;
  },

  upsertByTelegramId: async (data: {
    telegramId: string;
    telegramNickname: string;
    telegramUsername: string | null;
  }) => {
    const user = await prisma.user.upsert({
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
        ...botUserSelect,
      },
    });

    setCachedUser(user.telegramId, user);
    return user;
  },

  updatePhoneByTelegramId: async (telegramId: string, phone: string | null) => {
    const updated = await prisma.user.update({
      where: { telegramId },
      data: { phone },
      select: {
        ...botUserSelect,
      },
    });

    setCachedUser(telegramId, updated);
    return updated;
  },

  updateSupportStatusByTelegramId: async (
    telegramId: string,
    status: "none" | "pending" | "active" | "closed",
  ) => {
    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        isInSupport: status === "pending" || status === "active",
        supportStatus: status,
        ...(status === "none" ? { supportAdminId: null } : {}),
      },
      select: {
        ...botUserSelect,
      },
    });

    setCachedUser(telegramId, updated);
    return updated;
  },

  updateSupportStatusByIdForAdmin: async (
    id: number,
    status: "none" | "pending" | "active" | "closed",
    supportAdminId?: number | null,
  ) => {
    const updated = await prisma.user.update({
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

    setCachedUser(updated.telegramId, updated);
    return updated;
  },

  create: async (data: {
    telegramId: string;
    name: string;
    phone?: string | null;
  }) => {
    const created = await prisma.user.create({
      data,
      select: {
        ...adminUserSelect,
      },
    });

    setCachedUser(created.telegramId, created);
    return created;
  },
};
