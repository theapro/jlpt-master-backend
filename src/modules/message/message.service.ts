import { MessageSender } from "@prisma/client";

import {
  AppError,
  isNonEmptyString,
  normalizeString,
  parsePositiveInt,
} from "../../shared/utils";
import { realtimeWs } from "../../realtime/ws";
import { telegramSender } from "../../telegram/telegram.sender";
import { userRepository } from "../user/user.repository";
import { messageRepository } from "./message.repository";

const parseTelegramIdFromParam = (value: unknown) => {
  if (!isNonEmptyString(value))
    throw new AppError(400, "telegramId is required");
  const telegramId = normalizeString(String(value));
  if (telegramId.length > 64) throw new AppError(400, "telegramId is too long");
  if (!/^\d+$/.test(telegramId))
    throw new AppError(400, "telegramId must be numeric");
  return telegramId;
};

const parseMessageIdFromParam = (value: unknown) => {
  const id = parsePositiveInt(value);
  if (!id) throw new AppError(400, "messageId is required");
  return id;
};

const getQueryString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : null;
  }
  return null;
};

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type InboxSort = "newest" | "oldest" | "unread";
type InboxFilter =
  | "all"
  | "unread"
  | "read"
  | "in_progress"
  | "open"
  | "pending"
  | "active"
  | "closed"
  | "none"
  | "new";

const parseInboxSort = (value: unknown): InboxSort => {
  const v = getQueryString(value);
  if (!v) return "newest";
  const n = normalizeString(v).toLowerCase();
  if (n === "oldest") return "oldest";
  if (n === "unread") return "unread";
  return "newest";
};

const parseInboxFilter = (value: unknown): InboxFilter => {
  const v = getQueryString(value);
  if (!v) return "all";
  const n = normalizeString(v).toLowerCase();
  if (n === "unread" || n === "read") return n;
  if (n === "in_progress" || n === "in-progress") return "in_progress";
  if (
    n === "open" ||
    n === "pending" ||
    n === "active" ||
    n === "closed" ||
    n === "none" ||
    n === "new"
  )
    return n;
  return "all";
};

const parseOptionalQuery = (value: unknown, maxLen: number) => {
  const v = getQueryString(value);
  if (!v) return null;
  const s = normalizeString(v);
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
};

const parsePage = (value: unknown) => parsePositiveInt(getQueryString(value));

const parseLimit = (value: unknown) => parsePositiveInt(getQueryString(value));

export const messageService = {
  listUsersForAdmin: async (
    adminId: number,
    query: Record<string, unknown> | undefined,
  ) => {
    const qRaw = parseOptionalQuery(query?.q, 100);
    const q = qRaw;
    const qUsername = qRaw ? qRaw.replace(/^@+/, "") : null;
    const sort = parseInboxSort(query?.sort);
    const filterRaw = parseInboxFilter(query?.filter);
    const filter: InboxFilter =
      filterRaw === "in_progress" ? "active" : filterRaw;

    const page = clampInt(parsePage(query?.page) ?? 1, 1, 10_000);
    const limit = clampInt(parseLimit(query?.limit) ?? 25, 1, 50);

    const skip = (page - 1) * limit;
    const take = limit + 1;

    const whereAnd: any[] = [];

    if (q) {
      whereAnd.push({
        OR: [
          { telegramId: { contains: q } },
          { user: { is: { name: { contains: q } } } },
          { user: { is: { phone: { contains: q } } } },
          ...(qUsername
            ? [{ user: { is: { telegramUsername: { contains: qUsername } } } }]
            : []),
          { user: { is: { telegramNickname: { contains: q } } } },
        ],
      });
    }

    if (filter === "unread" || filter === "read") {
      whereAnd.push({
        user: { is: { supportStatus: { notIn: ["active", "closed"] } } },
      });
    }

    if (filter === "open") {
      whereAnd.push({
        user: { is: { supportStatus: { in: ["pending", "active"] } } },
      });
    } else if (
      filter === "pending" ||
      filter === "active" ||
      filter === "closed" ||
      filter === "none"
    ) {
      whereAnd.push({ user: { is: { supportStatus: filter } } });
    } else if (filter === "new") {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      whereAnd.push({ user: { is: { createdAt: { gte: since } } } });
    }

    const assignedTo = getQueryString(query?.assignedTo);
    if (assignedTo && normalizeString(assignedTo).toLowerCase() === "me") {
      whereAnd.push({ user: { is: { supportAdminId: adminId } } });
    }

    const where = whereAnd.length > 0 ? { AND: whereAnd } : undefined;

    if (sort === "unread" || filter === "unread") {
      const unreadStats = await messageRepository.listUnreadChatStatsPage({
        take,
        skip,
        where,
      });

      const pageRows = unreadStats.slice(0, limit);
      const hasMore = unreadStats.length > limit;

      const telegramIds = pageRows.map((r) => r.telegramId);
      if (telegramIds.length === 0)
        return { chats: [], page, limit, hasMore: false };

      const lastMessageIdsRows =
        await messageRepository.listChatLatestMessageIdsByTelegramIds(
          telegramIds,
        );
      const lastMessageIdByTelegramId = new Map(
        lastMessageIdsRows.map((r) => [r.telegramId, r.lastMessageId]),
      );

      const lastMessageIds = telegramIds
        .map((id) => lastMessageIdByTelegramId.get(id) ?? null)
        .filter((id): id is number => typeof id === "number");

      const [users, lastMessages] = await Promise.all([
        userRepository.findManyByTelegramIds(telegramIds),
        messageRepository.listByIds(lastMessageIds),
      ]);

      const userByTelegramId = new Map(users.map((u) => [u.telegramId, u]));
      const lastMessageById = new Map(lastMessages.map((m) => [m.id, m]));
      const unreadByTelegramId = new Map(
        pageRows.map((r) => [r.telegramId, r.unreadCount]),
      );

      const chats = telegramIds
        .map((telegramId) => {
          const lastMessageId = lastMessageIdByTelegramId.get(telegramId);
          const lastMessage =
            typeof lastMessageId === "number"
              ? (lastMessageById.get(lastMessageId) ?? null)
              : null;
          return {
            telegramId,
            user: userByTelegramId.get(telegramId) ?? null,
            lastMessage,
            unreadCount: unreadByTelegramId.get(telegramId) ?? 0,
          };
        })
        .filter((c) => c.lastMessage !== null);

      return { chats, page, limit, hasMore };
    }

    if (filter === "read") {
      const order = sort === "oldest" ? "asc" : "desc";
      const desiredSkipMatches = skip;
      const desiredTakeMatches = take;

      const batchSize = 200;
      const picked: Array<{ telegramId: string; lastMessageId: number }> = [];
      let scannedMatches = 0;
      let scannedRows = 0;

      while (picked.length < desiredTakeMatches) {
        const batch = await messageRepository.listChatLatestMessageIdsPage({
          take: batchSize,
          skip: scannedRows,
          order,
          where,
        });

        if (batch.length === 0) break;

        scannedRows += batch.length;

        const batchTelegramIds = batch.map((r) => r.telegramId);
        const unreadCounts =
          await messageRepository.countUnreadUserMessagesByTelegramIds(
            batchTelegramIds,
          );
        const unreadByTelegramId = new Map(
          unreadCounts.map((r) => [r.telegramId, r.unreadCount]),
        );

        for (const row of batch) {
          const unreadCount = unreadByTelegramId.get(row.telegramId) ?? 0;
          if (unreadCount > 0) continue;

          if (scannedMatches < desiredSkipMatches) {
            scannedMatches += 1;
            continue;
          }

          picked.push(row);
          if (picked.length >= desiredTakeMatches) break;
        }

        if (batch.length < batchSize) break;
      }

      const pageRows = picked.slice(0, limit);
      const hasMore = picked.length > limit;

      const telegramIds = pageRows.map((c) => c.telegramId);
      const lastMessageIds = pageRows.map((c) => c.lastMessageId);

      if (telegramIds.length === 0) return { chats: [], page, limit, hasMore };

      const [users, lastMessages] = await Promise.all([
        userRepository.findManyByTelegramIds(telegramIds),
        messageRepository.listByIds(lastMessageIds),
      ]);

      const userByTelegramId = new Map(users.map((u) => [u.telegramId, u]));
      const lastMessageById = new Map(lastMessages.map((m) => [m.id, m]));

      const chats = pageRows
        .map((c) => {
          const lastMessage = lastMessageById.get(c.lastMessageId) ?? null;
          return {
            telegramId: c.telegramId,
            user: userByTelegramId.get(c.telegramId) ?? null,
            lastMessage,
            unreadCount: 0,
          };
        })
        .filter((c) => c.lastMessage !== null);

      return { chats, page, limit, hasMore };
    }

    const order = sort === "oldest" ? "asc" : "desc";

    const latest = await messageRepository.listChatLatestMessageIdsPage({
      take,
      skip,
      order,
      where,
    });

    const pageRows = latest.slice(0, limit);
    const hasMore = latest.length > limit;

    const telegramIds = pageRows.map((c) => c.telegramId);
    const lastMessageIds = pageRows.map((c) => c.lastMessageId);

    if (telegramIds.length === 0) return { chats: [], page, limit, hasMore };

    const [users, lastMessages, unreadCounts] = await Promise.all([
      userRepository.findManyByTelegramIds(telegramIds),
      messageRepository.listByIds(lastMessageIds),
      messageRepository.countUnreadUserMessagesByTelegramIds(telegramIds),
    ]);

    const userByTelegramId = new Map(users.map((u) => [u.telegramId, u]));
    const lastMessageById = new Map(lastMessages.map((m) => [m.id, m]));
    const unreadByTelegramId = new Map(
      unreadCounts.map((r) => [r.telegramId, r.unreadCount]),
    );

    const chats = pageRows
      .map((c) => {
        const lastMessage = lastMessageById.get(c.lastMessageId) ?? null;
        return {
          telegramId: c.telegramId,
          user: userByTelegramId.get(c.telegramId) ?? null,
          lastMessage,
          unreadCount: unreadByTelegramId.get(c.telegramId) ?? 0,
        };
      })
      .filter((c) => c.lastMessage !== null);

    return { chats, page, limit, hasMore };
  },

  listChatsForAdmin: async () => {
    const latest = await messageRepository.listChatLatestMessageIds(200);
    const telegramIds = latest.map((c) => c.telegramId);
    const lastMessageIds = latest.map((c) => c.lastMessageId);

    if (telegramIds.length === 0) return { chats: [] };

    const [users, lastMessages, unreadCounts] = await Promise.all([
      userRepository.findManyByTelegramIds(telegramIds),
      messageRepository.listByIds(lastMessageIds),
      messageRepository.countUnreadUserMessagesByTelegramIds(telegramIds),
    ]);

    const userByTelegramId = new Map(users.map((u) => [u.telegramId, u]));
    const lastMessageById = new Map(lastMessages.map((m) => [m.id, m]));
    const unreadByTelegramId = new Map(
      unreadCounts.map((r) => [r.telegramId, r.unreadCount]),
    );

    const chats = latest
      .map((c) => {
        const lastMessage = lastMessageById.get(c.lastMessageId) ?? null;
        return {
          telegramId: c.telegramId,
          user: userByTelegramId.get(c.telegramId) ?? null,
          lastMessage,
          unreadCount: unreadByTelegramId.get(c.telegramId) ?? 0,
        };
      })
      .filter((c) => c.lastMessage !== null);

    return { chats };
  },

  getChatHistoryForAdmin: async (
    adminId: number,
    telegramIdParam: unknown,
    query?: Record<string, unknown>,
  ) => {
    const telegramId = parseTelegramIdFromParam(telegramIdParam);

    const user = await userRepository.findByTelegramId(telegramId);
    if (!user) throw new AppError(404, "User not found");

    const limit = clampInt(parseLimit(query?.limit) ?? 200, 1, 200);
    const beforeId = parsePositiveInt(getQueryString(query?.beforeId));

    const markReadRaw = getQueryString(query?.markRead);
    const markRead =
      beforeId === null &&
      (markReadRaw === null ||
        normalizeString(markReadRaw).toLowerCase() === "1" ||
        normalizeString(markReadRaw).toLowerCase() === "true");

    const pageSize = limit + 1;

    if (beforeId) {
      const older = await messageRepository.listBeforeIdByTelegramId(
        telegramId,
        beforeId,
        pageSize,
      );

      const hasMore = older.length > limit;
      const slice = older.slice(0, limit).reverse();
      const nextCursor = slice.length > 0 ? slice[0].id : null;

      const hiddenIds = await messageRepository.listHiddenMessageIdsForAdmin(
        adminId,
        slice.map((m) => m.id),
      );
      const hiddenSet = new Set(hiddenIds);

      return {
        telegramId,
        messages: slice.map((m) => ({
          ...m,
          hiddenForMe: hiddenSet.has(m.id),
        })),
        hasMore,
        nextCursor,
      };
    }

    const latest = await messageRepository.listLatestByTelegramId(
      telegramId,
      pageSize,
    );
    const hasMore = latest.length > limit;
    const slice = latest.slice(0, limit).reverse();
    const nextCursor = slice.length > 0 ? slice[0].id : null;

    const hiddenIds = await messageRepository.listHiddenMessageIdsForAdmin(
      adminId,
      slice.map((m) => m.id),
    );
    const hiddenSet = new Set(hiddenIds);

    if (markRead) {
      await messageRepository.markUserMessagesRead(telegramId);
    }

    return {
      telegramId,
      messages: slice.map((m) => ({
        ...m,
        hiddenForMe: hiddenSet.has(m.id),
      })),
      hasMore,
      nextCursor,
    };
  },

  hideMessageForAdmin: async (adminId: number, messageIdParam: unknown) => {
    const messageId = parseMessageIdFromParam(messageIdParam);

    const existing = await messageRepository.findById(messageId);
    if (!existing) throw new AppError(404, "Message not found");

    await messageRepository.hideForAdmin(adminId, messageId);
    return { ok: true };
  },

  deleteMessageForEveryone: async (
    adminId: number,
    messageIdParam: unknown,
  ) => {
    const messageId = parseMessageIdFromParam(messageIdParam);

    const existing = await messageRepository.findById(messageId);
    if (!existing) throw new AppError(404, "Message not found");
    if (existing.deletedAt) return { message: existing };

    const chatId = Number(existing.telegramId);
    if (!Number.isFinite(chatId) || chatId <= 0)
      throw new AppError(400, "Invalid telegramId");

    const telegramMessageId = existing.telegramMessageId;
    if (!telegramMessageId)
      throw new AppError(
        409,
        "Cannot delete for everyone: Telegram message id not stored for this message",
      );

    try {
      await telegramSender.deleteMessage(chatId, telegramMessageId);
    } catch (err) {
      console.error(
        "[ERROR SOURCE]: message.service.deleteMessageForEveryone.telegram",
      );
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      throw new AppError(502, "Failed to delete message on Telegram");
    }

    const updated = await messageRepository.softDeleteById(messageId);
    return { message: updated };
  },

  editMessageForAdmin: async (
    adminId: number,
    messageIdParam: unknown,
    body: unknown,
  ) => {
    const messageId = parseMessageIdFromParam(messageIdParam);

    const rawText =
      body && typeof body === "object" ? (body as any).text : undefined;
    if (!isNonEmptyString(rawText)) throw new AppError(400, "text is required");
    const text = normalizeString(String(rawText));
    if (text.length === 0) throw new AppError(400, "text is required");
    if (text.length > 4000) throw new AppError(400, "text is too long");

    const existing = await messageRepository.findById(messageId);
    if (!existing) throw new AppError(404, "Message not found");
    if (existing.deletedAt) throw new AppError(409, "Message is deleted");
    if (existing.sender !== MessageSender.admin)
      throw new AppError(403, "Only admin messages can be edited");

    const chatId = Number(existing.telegramId);
    if (!Number.isFinite(chatId) || chatId <= 0)
      throw new AppError(400, "Invalid telegramId");

    const telegramMessageId = existing.telegramMessageId;
    if (!telegramMessageId)
      throw new AppError(
        409,
        "Cannot edit: Telegram message id not stored for this message",
      );

    try {
      await telegramSender.editMessageText(chatId, telegramMessageId, text);
    } catch (err) {
      console.error(
        "[ERROR SOURCE]: message.service.editMessageForAdmin.telegram",
      );
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      throw new AppError(502, "Failed to edit message on Telegram");
    }

    const updated = await messageRepository.editTextById(messageId, text);
    return { message: updated };
  },

  createUserMessage: async (params: {
    telegramId: string;
    text: string;
    telegramMessageId?: number | null;
  }) => {
    const saved = await messageRepository.create({
      telegramId: params.telegramId,
      telegramMessageId: params.telegramMessageId ?? undefined,
      sender: MessageSender.user,
      text: params.text,
      isRead: false,
    });

    realtimeWs.emitMessageCreated(saved);
    return saved;
  },

  createAdminMessage: async (params: {
    telegramId: string;
    text: string;
    telegramMessageId?: number | null;
  }) => {
    const saved = await messageRepository.create({
      telegramId: params.telegramId,
      telegramMessageId: params.telegramMessageId ?? undefined,
      sender: MessageSender.admin,
      text: params.text,
      isRead: true,
    });

    realtimeWs.emitMessageCreated(saved);
    return saved;
  },
};
