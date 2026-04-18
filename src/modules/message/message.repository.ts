import { MessageSender, Prisma } from "@prisma/client";

import { prisma } from "../../shared/prisma";

const messageSelect = {
  id: true,
  telegramId: true,
  telegramMessageId: true,
  sender: true,
  text: true,
  isRead: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
} as const;

export const messageRepository = {
  findById: async (id: number) => {
    return prisma.message.findUnique({
      where: { id },
      select: messageSelect,
    });
  },

  create: async (data: {
    telegramId: string;
    telegramMessageId?: number | null;
    sender: MessageSender;
    text: string;
    isRead: boolean;
  }) => {
    return prisma.message.create({
      data,
      select: messageSelect,
    });
  },

  editTextById: async (id: number, text: string) => {
    return prisma.message.update({
      where: { id },
      data: {
        text,
        editedAt: new Date(),
      },
      select: messageSelect,
    });
  },

  softDeleteById: async (id: number) => {
    return prisma.message.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
      select: messageSelect,
    });
  },

  hideForAdmin: async (adminId: number, messageId: number) => {
    return prisma.messageHidden.upsert({
      where: {
        messageId_adminId: {
          messageId,
          adminId,
        },
      },
      update: {},
      create: {
        adminId,
        messageId,
      },
      select: { id: true, messageId: true, adminId: true, hiddenAt: true },
    });
  },

  listHiddenMessageIdsForAdmin: async (
    adminId: number,
    messageIds: number[],
  ) => {
    if (messageIds.length === 0) return [];
    const rows = await prisma.messageHidden.findMany({
      where: {
        adminId,
        messageId: { in: messageIds },
      },
      select: { messageId: true },
    });
    return rows.map((r) => r.messageId);
  },

  listChatLatestMessageIds: async (limit = 200) => {
    const rows = await prisma.message.groupBy({
      by: ["telegramId"],
      where: { deletedAt: null },
      _max: { id: true },
      orderBy: { _max: { id: "desc" } },
      take: limit,
    });

    return rows
      .map((r) => ({
        telegramId: r.telegramId,
        lastMessageId: r._max.id,
      }))
      .filter(
        (r): r is { telegramId: string; lastMessageId: number } =>
          typeof r.lastMessageId === "number",
      );
  },

  listChatLatestMessageIdsPage: async (params: {
    take: number;
    skip: number;
    order: "asc" | "desc";
    where?: Prisma.MessageWhereInput;
  }) => {
    const rows = await prisma.message.groupBy({
      by: ["telegramId"],
      where: {
        AND: [params.where ?? {}, { deletedAt: null }],
      },
      _max: { id: true },
      orderBy: { _max: { id: params.order } },
      take: params.take,
      skip: params.skip,
    });

    return rows
      .map((r) => ({
        telegramId: r.telegramId,
        lastMessageId: r._max.id,
      }))
      .filter(
        (r): r is { telegramId: string; lastMessageId: number } =>
          typeof r.lastMessageId === "number",
      );
  },

  listChatLatestMessageIdsByTelegramIds: async (telegramIds: string[]) => {
    if (telegramIds.length === 0) return [];

    const rows = await prisma.message.groupBy({
      by: ["telegramId"],
      where: { telegramId: { in: telegramIds }, deletedAt: null },
      _max: { id: true },
    });

    return rows
      .map((r) => ({
        telegramId: r.telegramId,
        lastMessageId: r._max.id,
      }))
      .filter(
        (r): r is { telegramId: string; lastMessageId: number } =>
          typeof r.lastMessageId === "number",
      );
  },

  listByIds: async (ids: number[]) => {
    if (ids.length === 0) return [];
    return prisma.message.findMany({
      where: { id: { in: ids } },
      select: messageSelect,
    });
  },

  countUnreadUserMessagesByTelegramIds: async (telegramIds: string[]) => {
    if (telegramIds.length === 0) return [];

    const rows = await prisma.message.groupBy({
      by: ["telegramId"],
      where: {
        telegramId: { in: telegramIds },
        sender: MessageSender.user,
        isRead: false,
        deletedAt: null,
      },
      _count: { _all: true },
    });

    return rows.map((r) => ({
      telegramId: r.telegramId,
      unreadCount: r._count._all,
    }));
  },

  listLatestByTelegramId: async (telegramId: string, limit = 200) => {
    return prisma.message.findMany({
      where: { telegramId, deletedAt: null },
      orderBy: { id: "desc" },
      take: limit,
      select: messageSelect,
    });
  },

  listBeforeIdByTelegramId: async (
    telegramId: string,
    beforeId: number,
    limit = 200,
  ) => {
    return prisma.message.findMany({
      where: {
        telegramId,
        id: { lt: beforeId },
        deletedAt: null,
      },
      orderBy: { id: "desc" },
      take: limit,
      select: messageSelect,
    });
  },

  listUnreadChatStatsPage: async (params: {
    take: number;
    skip: number;
    where?: Prisma.MessageWhereInput;
    order?: "asc" | "desc";
  }) => {
    const order = params.order ?? "desc";

    const rows = await prisma.message.groupBy({
      by: ["telegramId"],
      where: {
        AND: [
          params.where ?? {},
          {
            sender: MessageSender.user,
            isRead: false,
            deletedAt: null,
          },
        ],
      },
      _max: { id: true },
      _count: { id: true },
      orderBy: [{ _count: { id: "desc" } }, { _max: { id: order } }],
      take: params.take,
      skip: params.skip,
    });

    return rows.map((r) => ({
      telegramId: r.telegramId,
      lastUnreadMessageId: typeof r._max?.id === "number" ? r._max.id : null,
      unreadCount: typeof r._count?.id === "number" ? r._count.id : 0,
    }));
  },

  markUserMessagesRead: async (telegramId: string) => {
    return prisma.message.updateMany({
      where: {
        telegramId,
        sender: MessageSender.user,
        isRead: false,
        deletedAt: null,
      },
      data: { isRead: true },
    });
  },
};
