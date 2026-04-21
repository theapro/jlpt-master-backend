import { prisma } from "../../shared/prisma";

export const DEFAULT_TEXTS = {
  START_MESSAGE:
    "Assalomu alaykum, {username} 👋\n\nJLPT Master botiga xush kelibsiz 🇯🇵",
  ASK_EXPERIENCE: "Siz yapon tilini qaysi darajada bilasiz?",
  ASK_GOAL: "Siz yapon tilini nima maqsadda o‘rganmoqchisiz?",
  SHOW_INTRO:
    "Yapon tili 5 darajadan iborat:\n\n" +
    "N5 → boshlang‘ich\n" +
    "N4 → elementary\n" +
    "N3 → intermediate\n" +
    "N2 → upper-intermediate\n" +
    "N1 → advanced\n\n" +
    "Kurslar haqida umumiy ma’lumotni o‘qib chiqing va davom eting 👇",
  SELECT_COURSE: "Siz uchun mos kurslardan birini tanlang 👇",
  COURSE_INFO:
    "📘 {courseTitle}\n\n{courseDescriptionBlock}⏳ Davomiyligi: {duration}\n\n{askFormat}",
  ASK_FORMAT: "Sizga qaysi formatdagi kurs qulay?",
  CTA_REGISTER: "Batafsil ma’lumot olish uchun ro‘yxatdan o‘ting",
  ASK_NAME: "Ismingizni kiriting 👇",
  ASK_PHONE:
    "Telefon raqamingizni kiriting 📱\n" +
    "yoki pastdagi tugma orqali yuboring",
  SUCCESS_ENROLL:
    "✅ Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz!\n\nAdminlarimiz tez orada siz bilan bog‘lanadi.",
  SUPPORT_MESSAGE: "📞 Operator bilan bog‘landingiz.\nXabaringizni yozing...",
  SUPPORT_SENT: "✅ Xabaringiz operatorga yuborildi.",
  INVALID_INPUT: "Iltimos tugmalardan birini tanlang",
  GENERIC_ERROR: "Xatolik yuz berdi, qaytadan urinib ko‘ring",
  NO_GOALS: "Hozircha maqsadlar mavjud emas. Iltimos keyinroq urinib ko‘ring.",
  NO_COURSES: "Hozircha kurslar mavjud emas. Iltimos keyinroq urinib ko‘ring.",
  START_REQUIRED: "Botdan foydalanish uchun /start buyrug‘ini bosing.",
  START_REQUIRED_SHORT: "Iltimos, /start buyrug‘ini bosing.",
  PHONE_SAVED: "✅ Telefon raqamingiz saqlandi.",
  ENROLL_CONTINUE:
    "Iltimos, ro‘yxatdan o‘tish uchun botdagi tugmalar orqali davom eting.",
} as const;

export type BotTextKey = keyof typeof DEFAULT_TEXTS;
export type BotTextSource = "db" | "default";
export type BotTextGroup =
  | "onboarding"
  | "course"
  | "support"
  | "errors"
  | "system";

export type BotTextListItem = {
  key: BotTextKey;
  value: string;
  defaultValue: string;
  dbValue: string | null;
  source: BotTextSource;
  group: BotTextGroup;
  updatedAt: string | null;
};

const BOT_TEXT_KEYS = Object.keys(DEFAULT_TEXTS) as BotTextKey[];

const GROUP_BY_KEY: Partial<Record<BotTextKey, BotTextGroup>> = {
  START_MESSAGE: "onboarding",
  ASK_EXPERIENCE: "onboarding",
  ASK_GOAL: "onboarding",
  SHOW_INTRO: "onboarding",
  ASK_NAME: "onboarding",
  ASK_PHONE: "onboarding",
  SUCCESS_ENROLL: "onboarding",

  SELECT_COURSE: "course",
  COURSE_INFO: "course",
  ASK_FORMAT: "course",
  CTA_REGISTER: "course",

  SUPPORT_MESSAGE: "support",
  SUPPORT_SENT: "support",

  INVALID_INPUT: "errors",
  GENERIC_ERROR: "errors",
  NO_GOALS: "errors",
  NO_COURSES: "errors",
  START_REQUIRED: "errors",
  START_REQUIRED_SHORT: "errors",
};

const resolveGroup = (key: BotTextKey): BotTextGroup =>
  GROUP_BY_KEY[key] ?? "system";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cacheLoadedAt = 0;
let cache: Map<string, { value: string; updatedAt: Date }> = new Map();
let refreshPromise: Promise<void> | null = null;

const isBotTextKey = (value: string): value is BotTextKey => {
  return (BOT_TEXT_KEYS as string[]).includes(value);
};

const applyVars = (template: string, vars?: Record<string, unknown> | null) => {
  if (!vars) return template;

  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    const token = `{${k}}`;
    const value = v === null || v === undefined ? "" : String(v);
    if (out.includes(token)) out = out.split(token).join(value);
  }
  return out;
};

const refreshCache = async () => {
  const rows = await prisma.botText.findMany({
    select: { key: true, value: true, updatedAt: true },
  });

  const next = new Map<string, { value: string; updatedAt: Date }>();
  for (const r of rows)
    next.set(r.key, { value: r.value, updatedAt: r.updatedAt });

  cache = next;
  cacheLoadedAt = Date.now();
};

const ensureCache = async () => {
  const now = Date.now();
  if (cacheLoadedAt > 0 && now - cacheLoadedAt < CACHE_TTL_MS) return;

  if (!refreshPromise) {
    refreshPromise = refreshCache().finally(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;
};

export const botTextService = {
  keys: () => BOT_TEXT_KEYS.slice(),

  invalidateCache: () => {
    cacheLoadedAt = 0;
  },

  get: async (key: string, vars?: Record<string, unknown>): Promise<string> => {
    try {
      await ensureCache();
    } catch {
      // ignore cache refresh errors, fall back to defaults
    }

    const cached = cache.get(key);
    if (cached) return applyVars(cached.value, vars);

    if (isBotTextKey(key)) return applyVars(DEFAULT_TEXTS[key], vars);

    return "";
  },

  listAll: async (): Promise<BotTextListItem[]> => {
    try {
      await ensureCache();
    } catch {
      // ignore
    }

    return BOT_TEXT_KEYS.map((key) => {
      const def = DEFAULT_TEXTS[key];
      const row = cache.get(key) ?? null;
      const dbValue = row ? row.value : null;
      const value = row ? row.value : def;

      return {
        key,
        value,
        defaultValue: def,
        dbValue,
        source: row ? "db" : "default",
        group: resolveGroup(key),
        updatedAt: row ? row.updatedAt.toISOString() : null,
      };
    });
  },

  getForAdmin: async (key: string): Promise<BotTextListItem | null> => {
    if (!isBotTextKey(key)) return null;

    try {
      await ensureCache();
    } catch {
      // ignore
    }

    const def = DEFAULT_TEXTS[key];
    const row = cache.get(key) ?? null;

    return {
      key,
      value: row ? row.value : def,
      defaultValue: def,
      dbValue: row ? row.value : null,
      source: row ? "db" : "default",
      group: resolveGroup(key),
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  },

  upsert: async (key: string, value: string) => {
    if (!isBotTextKey(key)) {
      throw new Error("Invalid bot text key");
    }

    const saved = await prisma.botText.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    cache.set(saved.key, { value: saved.value, updatedAt: saved.updatedAt });
    cacheLoadedAt = Date.now();

    return saved;
  },

  remove: async (key: string) => {
    if (!isBotTextKey(key)) {
      throw new Error("Invalid bot text key");
    }

    try {
      await prisma.botText.delete({ where: { key } });
    } catch {
      // ignore if missing
    }

    cache.delete(key);
    cacheLoadedAt = Date.now();
  },
};
