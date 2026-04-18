import type { BotButton } from "@prisma/client";

import { prisma } from "../../shared/prisma";
import {
  AppError,
  isNonEmptyString,
  normalizeString,
} from "../../shared/utils";

export const BOT_BUTTON_ADMIN_STATES = [
  "SELECT_EXPERIENCE",
  "ASK_FORMAT",
  "REGISTER",
  "ASK_PHONE",
] as const;

export type BotButtonAdminState = (typeof BOT_BUTTON_ADMIN_STATES)[number];

export const isBotButtonAdminState = (
  value: unknown,
): value is BotButtonAdminState => {
  return (
    typeof value === "string" &&
    (BOT_BUTTON_ADMIN_STATES as readonly string[]).includes(value)
  );
};

export const BOT_BUTTON_ACTION = {
  EXP_BEGINNER: "EXP_BEGINNER",
  EXP_INTERMEDIATE: "EXP_INTERMEDIATE",
  SUPPORT: "SUPPORT",

  FORMAT_ONLINE: "FORMAT_ONLINE",
  FORMAT_OFFLINE: "FORMAT_OFFLINE",

  BACK: "BACK",
  ENROLL: "ENROLL",
  MENU: "MENU",
  CONTACT: "CONTACT",
} as const;

export type BotButtonAction =
  (typeof BOT_BUTTON_ACTION)[keyof typeof BOT_BUTTON_ACTION];

type ButtonLike = {
  label: string;
  row: number;
  col: number;
};

type DefaultButtonDef = ButtonLike & {
  action: BotButtonAction | null;
};

const DEFAULT_BUTTON_DEFS: Record<string, DefaultButtonDef[]> = {
  SELECT_EXPERIENCE: [
    {
      row: 0,
      col: 0,
      label: "🟢 0 dan boshlayman",
      action: BOT_BUTTON_ACTION.EXP_BEGINNER,
    },
    {
      row: 0,
      col: 1,
      label: "🔵 Tushuncham bor",
      action: BOT_BUTTON_ACTION.EXP_INTERMEDIATE,
    },
    {
      row: 1,
      col: 0,
      label: "🎧 Operator",
      action: BOT_BUTTON_ACTION.SUPPORT,
    },
  ],

  ASK_FORMAT: [
    {
      row: 0,
      col: 0,
      label: "💻 Online",
      action: BOT_BUTTON_ACTION.FORMAT_ONLINE,
    },
    {
      row: 0,
      col: 1,
      label: "🏫 Offline",
      action: BOT_BUTTON_ACTION.FORMAT_OFFLINE,
    },
    {
      row: 1,
      col: 0,
      label: "⬅️ Orqaga",
      action: BOT_BUTTON_ACTION.BACK,
    },
  ],

  REGISTER: [
    {
      row: 0,
      col: 0,
      label: "📥 Ro‘yxatdan o‘tish",
      action: BOT_BUTTON_ACTION.ENROLL,
    },
    {
      row: 1,
      col: 0,
      label: "⬅️ Orqaga",
      action: BOT_BUTTON_ACTION.BACK,
    },
  ],

  ASK_PHONE: [
    {
      row: 0,
      col: 0,
      label: "📱 Raqamni yuborish",
      action: BOT_BUTTON_ACTION.CONTACT,
    },
  ],

  // Dynamic states (goals / intro / free-text) default to empty config.
  ASK_GOAL: [
    { row: 0, col: 0, label: "⬅️ Orqaga", action: BOT_BUTTON_ACTION.BACK },
  ],
  SHOW_INTRO: [],
  ASK_NAME: [],
};

const toGrid = (buttons: ButtonLike[]) => {
  const grid: string[][] = [];
  buttons.forEach((btn) => {
    if (!grid[btn.row]) grid[btn.row] = [];
    grid[btn.row]![btn.col] = btn.label;
  });
  return grid.map((row) => row.filter(Boolean));
};

const DEFAULT_BUTTONS: Record<string, string[][]> = Object.fromEntries(
  Object.entries(DEFAULT_BUTTON_DEFS).map(([state, defs]) => [
    state,
    toGrid(defs),
  ]),
) as Record<string, string[][]>;

const CACHE_TTL_MS = 5 * 60 * 1000;
const activeButtonsCache = new Map<
  string,
  { loadedAt: number; value: BotButton[] }
>();
const activeButtonsPromise = new Map<string, Promise<BotButton[]>>();

const invalidateActiveButtonsCache = () => {
  activeButtonsCache.clear();
  activeButtonsPromise.clear();
};

const fetchActiveButtonsByState = async (state: string) => {
  return prisma.botButton.findMany({
    where: { state, isActive: true },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });
};

const getActiveButtonsByStateCached = async (state: string) => {
  const now = Date.now();
  const cached = activeButtonsCache.get(state) ?? null;
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.value;

  const existingPromise = activeButtonsPromise.get(state) ?? null;
  if (existingPromise) return existingPromise;

  const promise = fetchActiveButtonsByState(state)
    .then((rows) => {
      activeButtonsCache.set(state, { loadedAt: Date.now(), value: rows });
      return rows;
    })
    .finally(() => {
      activeButtonsPromise.delete(state);
    });

  activeButtonsPromise.set(state, promise);
  return promise;
};

const parseState = (raw: unknown) => {
  const state = typeof raw === "string" ? raw.trim() : "";
  if (!isNonEmptyString(state)) throw new AppError(400, "State is required");
  if (!isBotButtonAdminState(state)) throw new AppError(400, "Invalid state");
  return state;
};

const parseLabel = (raw: unknown) => {
  const label = typeof raw === "string" ? raw.trim() : "";
  if (!isNonEmptyString(label)) throw new AppError(400, "Label is required");
  if (label.length > 191) throw new AppError(400, "Label is too long");
  return label;
};

const parseRow = (raw: unknown) => {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0) throw new AppError(400, "Invalid row");
  return n;
};

const parseCol = (raw: unknown) => {
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0) throw new AppError(400, "Invalid col");
  if (n > 1)
    throw new AppError(400, "Max 2 buttons per row (col must be 0 or 1)");
  return n;
};

const parseIsActive = (raw: unknown) => {
  if (raw === undefined) return true;
  if (typeof raw === "boolean") return raw;
  if (raw === 1 || raw === "1" || raw === "true") return true;
  if (raw === 0 || raw === "0" || raw === "false") return false;
  throw new AppError(400, "Invalid isActive value");
};

const inferAction = (args: {
  state: string;
  label: string;
  row: number;
  col: number;
}): BotButtonAction | null => {
  const label = normalizeString(args.label);

  const byKnownLabel: Partial<Record<string, BotButtonAction>> = {
    "🟢 0 dan boshlayman": BOT_BUTTON_ACTION.EXP_BEGINNER,
    "🔵 Tushuncham bor": BOT_BUTTON_ACTION.EXP_INTERMEDIATE,
    "🎧 Operator": BOT_BUTTON_ACTION.SUPPORT,
    "💻 Online": BOT_BUTTON_ACTION.FORMAT_ONLINE,
    "🏫 Offline": BOT_BUTTON_ACTION.FORMAT_OFFLINE,
    "⬅️ Orqaga": BOT_BUTTON_ACTION.BACK,
    "📥 Ro‘yxatdan o‘tish": BOT_BUTTON_ACTION.ENROLL,
    "🏠 Menu": BOT_BUTTON_ACTION.MENU,
    "📱 Raqamni yuborish": BOT_BUTTON_ACTION.CONTACT,
  };

  if (byKnownLabel[label]) return byKnownLabel[label] ?? null;

  const byLabel = DEFAULT_BUTTON_DEFS[args.state]?.find(
    (d) => d.label === label,
  )?.action;
  if (byLabel) return byLabel;

  const key = `${args.row}:${args.col}`;
  const byPosition: Partial<Record<string, BotButtonAction>> =
    args.state === "SELECT_EXPERIENCE"
      ? {
          "0:0": BOT_BUTTON_ACTION.EXP_BEGINNER,
          "0:1": BOT_BUTTON_ACTION.EXP_INTERMEDIATE,
          "1:0": BOT_BUTTON_ACTION.SUPPORT,
        }
      : args.state === "ASK_FORMAT"
        ? {
            "0:0": BOT_BUTTON_ACTION.FORMAT_ONLINE,
            "0:1": BOT_BUTTON_ACTION.FORMAT_OFFLINE,
            "1:0": BOT_BUTTON_ACTION.BACK,
          }
        : args.state === "REGISTER"
          ? { "0:0": BOT_BUTTON_ACTION.ENROLL, "1:0": BOT_BUTTON_ACTION.BACK }
          : args.state === "ASK_PHONE"
            ? { "0:0": BOT_BUTTON_ACTION.CONTACT }
            : args.state === "ASK_GOAL"
              ? { "0:0": BOT_BUTTON_ACTION.BACK }
              : {};

  return byPosition[key] ?? null;
};

const resolveDefaultButtons = (state: string): string[][] =>
  DEFAULT_BUTTONS[state] ?? [];

const resolveDefaultActionByLabel = (state: string, label: string) => {
  return (
    DEFAULT_BUTTON_DEFS[state]?.find((d) => d.label === label)?.action ?? null
  );
};

export const botButtonService = {
  getButtonsByState: async (state: string): Promise<string[][]> => {
    try {
      const buttons = await getActiveButtonsByStateCached(state);

      if (!buttons.length) {
        return resolveDefaultButtons(state);
      }

      return toGrid(buttons);
    } catch {
      return resolveDefaultButtons(state);
    }
  },

  getActiveForState: async (state: string): Promise<BotButton[]> => {
    try {
      const buttons = await getActiveButtonsByStateCached(state);

      if (buttons.length > 0) return buttons;

      // Convert defaults to BotButton-like objects (admin fields not needed here)
      const defs = DEFAULT_BUTTON_DEFS[state] ?? [];
      return defs.map(
        (d) =>
          ({
            id: "default",
            state,
            label: d.label,
            action: d.action,
            row: d.row,
            col: d.col,
            isActive: true,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }) as BotButton,
      );
    } catch {
      const defs = DEFAULT_BUTTON_DEFS[state] ?? [];
      return defs.map(
        (d) =>
          ({
            id: "default",
            state,
            label: d.label,
            action: d.action,
            row: d.row,
            col: d.col,
            isActive: true,
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }) as BotButton,
      );
    }
  },

  getActionByLabel: async (
    state: string,
    label: string,
  ): Promise<string | null> => {
    try {
      const buttons = await getActiveButtonsByStateCached(state);

      if (!buttons.length) return resolveDefaultActionByLabel(state, label);

      const found = buttons.find((b) => b.label === label) ?? null;
      if (!found) return null;

      if (typeof found.action === "string" && found.action.trim().length > 0) {
        return normalizeString(found.action);
      }

      // Fallback: if action is missing, infer from default label within that state.
      return resolveDefaultActionByLabel(state, label);
    } catch {
      return resolveDefaultActionByLabel(state, label);
    }
  },

  listForAdmin: async (stateRaw: unknown | null): Promise<BotButton[]> => {
    const state = stateRaw === null ? null : parseState(stateRaw);

    if (!state) {
      return prisma.botButton.findMany({
        orderBy: [{ state: "asc" }, { row: "asc" }, { col: "asc" }],
      });
    }

    const existing = await prisma.botButton.findMany({
      where: { state },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });

    if (existing.length > 0) return existing;

    const defaults = DEFAULT_BUTTON_DEFS[state] ?? [];
    if (defaults.length === 0) return [];

    await prisma.$transaction(async (tx) => {
      const count = await tx.botButton.count({ where: { state } });
      if (count > 0) return;

      for (const d of defaults) {
        await tx.botButton.create({
          data: {
            state,
            label: d.label,
            action: d.action,
            row: d.row,
            col: d.col,
            isActive: true,
          },
        });
      }
    });

    invalidateActiveButtonsCache();

    return prisma.botButton.findMany({
      where: { state },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });
  },

  createForAdmin: async (body: unknown) => {
    const b = (body ?? {}) as any;

    const state = parseState(b.state);
    const label = parseLabel(b.label);
    const row = parseRow(b.row);
    const col = parseCol(b.col);
    const isActive = parseIsActive(b.isActive);

    const existingInCell = await prisma.botButton.findFirst({
      where: { state, row, col },
      select: { id: true },
    });
    if (existingInCell)
      throw new AppError(400, "Duplicate row+col for this state");

    const rowCount = await prisma.botButton.count({ where: { state, row } });
    if (rowCount >= 2) throw new AppError(400, "Max 2 buttons per row");

    const action = inferAction({ state, label, row, col });

    const created = await prisma.botButton.create({
      data: {
        state,
        label,
        action,
        row,
        col,
        isActive,
      },
    });

    invalidateActiveButtonsCache();
    return created;
  },

  updateForAdmin: async (idRaw: unknown, body: unknown) => {
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (!isNonEmptyString(id)) throw new AppError(400, "Invalid id");

    const existing = await prisma.botButton.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Button not found");

    const b = (body ?? {}) as any;

    const label = b.label !== undefined ? parseLabel(b.label) : existing.label;
    const row = b.row !== undefined ? parseRow(b.row) : existing.row;
    const col = b.col !== undefined ? parseCol(b.col) : existing.col;
    const isActive =
      b.isActive !== undefined ? parseIsActive(b.isActive) : existing.isActive;

    const cellConflict = await prisma.botButton.findFirst({
      where: {
        state: existing.state,
        row,
        col,
        NOT: { id },
      },
      select: { id: true },
    });
    if (cellConflict)
      throw new AppError(400, "Duplicate row+col for this state");

    const rowCount = await prisma.botButton.count({
      where: { state: existing.state, row, NOT: { id } },
    });
    if (rowCount >= 2) throw new AppError(400, "Max 2 buttons per row");

    const nextAction =
      existing.action && existing.action.trim().length > 0
        ? existing.action
        : inferAction({ state: existing.state, label, row, col });

    const updated = await prisma.botButton.update({
      where: { id },
      data: {
        label,
        row,
        col,
        isActive,
        action: nextAction,
      },
    });

    invalidateActiveButtonsCache();
    return updated;
  },

  deleteForAdmin: async (idRaw: unknown) => {
    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    if (!isNonEmptyString(id)) throw new AppError(400, "Invalid id");

    try {
      await prisma.botButton.delete({ where: { id } });
    } catch {
      // ignore if missing
    }

    invalidateActiveButtonsCache();
  },
};
