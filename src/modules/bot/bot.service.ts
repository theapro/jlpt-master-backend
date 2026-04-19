import { UserExperience, UserLearningFormat } from "@prisma/client";

import {
  AppError,
  isNonEmptyString,
  normalizeString,
} from "../../shared/utils";
import { telegramSender } from "../../telegram/telegram.sender";
import { courseService } from "../course/course.service";
import { enrollmentService } from "../enrollment/enrollment.service";
import { goalService } from "../goal/goal.service";
import { messageService } from "../message/message.service";
import { userRepository } from "../user/user.repository";
import { userService } from "../user/user.service";
import { BOT_BUTTON_ACTION, botButtonService } from "./bot-button.service";
import { botTextService } from "./bot-text.service";
import type { BotResponse } from "./bot.types";
import { supportRepository } from "./support.repository";

export enum BotState {
  SELECT_EXPERIENCE = "SELECT_EXPERIENCE",
  ASK_GOAL = "ASK_GOAL",
  SHOW_INTRO = "SHOW_INTRO",
  SELECT_COURSE = "SELECT_COURSE",
  ASK_FORMAT = "ASK_FORMAT",
  REGISTER = "REGISTER",
  COURSE_CTA = "COURSE_CTA",
  ASK_NAME = "ASK_NAME",
  ASK_PHONE = "ASK_PHONE",
  ENROLL = "ENROLL",
  DONE = "DONE",
  SUPPORT = "SUPPORT",
}

export const botKeyboardPreview = async (
  state: BotState,
): Promise<string[][]> => {
  try {
    switch (state) {
      case BotState.SELECT_EXPERIENCE:
        return await experienceKeyboard();

      case BotState.ASK_GOAL: {
        const step = await buildGoalStep(BUTTONS.GOAL_PREFIX);
        return step.buttons;
      }

      case BotState.SELECT_COURSE: {
        const step = await buildCourseStep();
        return step.buttons;
      }

      case BotState.ASK_FORMAT:
        return await formatKeyboard();

      case BotState.REGISTER:
        return await registerKeyboard();

      case BotState.COURSE_CTA:
        return courseCtaKeyboard();

      case BotState.ASK_PHONE:
        return await askPhoneKeyboard();

      case BotState.SUPPORT:
        return supportKeyboard();

      case BotState.ENROLL:
      case BotState.DONE:
        return enrollKeyboard();

      // No reply keyboard in these steps.
      case BotState.SHOW_INTRO:
      case BotState.ASK_NAME:
      default:
        return [];
    }
  } catch {
    return [];
  }
};

type BotUser = NonNullable<
  Awaited<ReturnType<typeof userRepository.findByTelegramId>>
>;

const BUTTONS = {
  EXP_BEGINNER: "🟢 0 dan boshlayman",
  EXP_INTERMEDIATE: "🔵 Tushuncham bor",

  FORMAT_ONLINE: "💻 Online",
  FORMAT_OFFLINE: "🏫 Offline",

  GOAL_PREFIX: " ",
  GOAL_PREFIX_BEGINNER: " ",
  COURSE_PREFIX: "📘 ",

  VIEW_COURSES: "📚 Kurslarni ko‘rish",

  BACK: "⬅️ Orqaga",
  ENROLL: "📥 Ro‘yxatdan o‘tish",
  CONTACT: "📱 Raqamni yuborish",
  SUPPORT: "🎧 Operator",
  MENU: "🏠 Menu",
} as const;

const isMenuLike = (incoming: string) => {
  const text = incoming
    .replace(/^🏠\s*/u, "")
    .trim()
    .toLowerCase();
  return text === "menu" || text === "menyu" || text === "bosh menyu";
};

const BACK_MAP: Partial<Record<BotState, BotState>> = {
  [BotState.ASK_GOAL]: BotState.SELECT_EXPERIENCE,
  [BotState.SELECT_COURSE]: BotState.ASK_GOAL,
  [BotState.ASK_FORMAT]: BotState.SELECT_COURSE,
  [BotState.REGISTER]: BotState.ASK_FORMAT,
  [BotState.COURSE_CTA]: BotState.ASK_FORMAT,
  [BotState.ASK_PHONE]: BotState.ASK_NAME,
  [BotState.SUPPORT]: BotState.SELECT_EXPERIENCE,
};

const INVALID_CHOICE_REPLY = "Iltimos tugmalardan birini tanlang";
const GENERIC_ERROR_REPLY = "Xatolik yuz berdi, qaytadan urinib ko‘ring";

const ASK_FORMAT_REPLY = "Sizga qaysi formatdagi kurs qulay?";
const ASK_GOAL_REPLY = "Siz yapon tilini nima maqsadda o‘rganmoqchisiz?";
const REGISTER_CTA_REPLY =
  "Batafsil ma’lumot va ro‘yxatdan o‘tish uchun quyidagi tugmani bosing";
const ASK_NAME_REPLY = "Ismingizni kiriting 👇";
const ASK_PHONE_REPLY =
  "Telefon raqamingizni kiriting 📱\n" + "yoki pastdagi tugma orqali yuboring";
const SUCCESS_REPLY =
  "✅ Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz!\n\n" +
  "Adminlarimiz tez orada siz bilan bog‘lanadi.";

const BUTTON_TEXT_MAX = 28;
const MAX_LIST_ITEMS = 20;

function toGrid(items: string[], size = 2): string[][] {
  const res: string[][] = [];
  for (let i = 0; i < items.length; i += size) {
    res.push(items.slice(i, i + size));
  }
  return res;
}

const logError = (err: unknown, source: string, context?: unknown) => {
  console.error("[ERROR SOURCE]:", source);
  if (context !== undefined) console.error("[ERROR CONTEXT]:", context);
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
};

const adminChatId = (() => {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!raw || raw.trim().length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
})();

const notifyAdmin = async (text: string) => {
  if (!adminChatId) return;
  try {
    await telegramSender.sendMessage(adminChatId, text);
  } catch (err) {
    logError(err, "bot.service.notifyAdmin");
  }
};

const genericErrorResponse = async (): Promise<BotResponse> => ({
  reply: GENERIC_ERROR_REPLY,
  buttons: [[BUTTONS.MENU]],
});

const invalidChoiceResponse = async (
  buttons: string[][],
): Promise<BotResponse> => ({
  reply: INVALID_CHOICE_REPLY,
  buttons,
});

const clampButtonText = (text: string, max = BUTTON_TEXT_MAX) => {
  const t = typeof text === "string" ? text.trim() : "";
  return t.length > max ? t.slice(0, Math.max(0, max - 1)) + "…" : t;
};

const clampWithSuffix = (
  base: string,
  suffix: string,
  max = BUTTON_TEXT_MAX,
) => {
  const full = base + suffix;
  if (full.length <= max) return full;
  const room = Math.max(0, max - suffix.length - 1);
  return base.slice(0, room) + "…" + suffix;
};

const buildUniqueLabel = (args: {
  base: string;
  id: number;
  used: Set<string>;
  max?: number;
}) => {
  const max = typeof args.max === "number" ? args.max : BUTTON_TEXT_MAX;

  let label = clampButtonText(args.base, max);
  if (!args.used.has(label)) return label;

  label = clampWithSuffix(args.base, ` (#${args.id})`, max);
  if (!args.used.has(label)) return label;

  let n = 2;
  while (args.used.has(label)) {
    label = clampWithSuffix(args.base, ` (#${args.id}-${n})`, max);
    n++;
  }
  return label;
};

const parseTelegramId = (value: unknown) => {
  const raw = typeof value === "number" ? String(value) : value;
  if (!isNonEmptyString(raw))
    throw new AppError(400, "telegramId talab qilinadi");

  const telegramId = normalizeString(raw);
  if (!/^\d+$/.test(telegramId))
    throw new AppError(400, "telegramId noto‘g‘ri");

  return telegramId;
};

const parseTelegramMessageId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
};

const parseName = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "Ism talab qilinadi");
  const name = normalizeString(value);
  if (name.length > 100) throw new AppError(400, "Ism juda uzun");
  return name;
};

const parseTelegramNickname = (value: unknown) => {
  if (!isNonEmptyString(value)) throw new AppError(400, "Ism talab qilinadi");
  const name = normalizeString(value);
  if (name.length > 191) throw new AppError(400, "Ism juda uzun");
  return name;
};

const parseTelegramUsername = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const username = normalizeString(String(value));
  if (username.length > 64)
    throw new AppError(400, "telegramUsername juda uzun");
  return username;
};

const parsePhone = (value: unknown) => {
  if (!isNonEmptyString(value))
    throw new AppError(400, "Telefon raqami talab qilinadi");
  const phone = normalizeString(String(value));
  if (phone.length > 32) throw new AppError(400, "Telefon raqami juda uzun");
  if (!/^[0-9+()\-\s]+$/.test(phone))
    throw new AppError(400, "Telefon raqamida noto‘g‘ri belgilar bor");
  return phone.replace(/\s+/g, " ");
};

const sanitizeMessage = (value: unknown) => {
  if (!isNonEmptyString(value)) return "";

  const normalized = normalizeString(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 1000 ? normalized.slice(0, 1000) : normalized;
};

const isBotState = (value: unknown): value is BotState => {
  return (
    typeof value === "string" &&
    (Object.values(BotState) as string[]).includes(value)
  );
};

const resolveState = (value: unknown): BotState | null => {
  if (isBotState(value)) return value;

  if (typeof value === "string") {
    const legacyMap: Record<string, BotState> = {
      START: BotState.SELECT_EXPERIENCE,
      MAIN_MENU: BotState.SELECT_EXPERIENCE,

      ASK_GOAL: BotState.ASK_GOAL,
      SHOW_INTRO: BotState.SHOW_INTRO,
      SELECT_LEVEL: BotState.SELECT_COURSE,
      COURSE_LIST: BotState.SELECT_COURSE,
      ASK_REGION: BotState.ASK_FORMAT,
      ASK_FORMAT: BotState.ASK_FORMAT,
      COURSE_DETAIL: BotState.COURSE_CTA,
      SHOW_COURSE: BotState.COURSE_CTA,

      REGISTER: BotState.REGISTER,
      DONE: BotState.DONE,

      SUPPORT: BotState.SUPPORT,

      // legacy registration steps
      ASK_NAME: BotState.ASK_NAME,
      ASK_PHONE: BotState.ASK_PHONE,
    };

    return legacyMap[value] ?? null;
  }

  return null;
};

const CONTACT_REQUEST_SENTINEL = "\u2063";

const experienceKeyboard = async (): Promise<string[][]> => {
  return await botButtonService.getButtonsByState(BotState.SELECT_EXPERIENCE);
};

const normalizeStateForUser = (user: BotUser, state: BotState): BotState => {
  const isBeginner = user.experience === UserExperience.beginner;
  if (!isBeginner) return state;

  // 🟢 BEGINNER FLOW ONLY
  // Beginner onboarding must NOT go through course selection / course CTA.
  if (state === BotState.SHOW_INTRO) return BotState.ASK_FORMAT;
  if (state === BotState.SELECT_COURSE) return BotState.ASK_FORMAT;
  if (state === BotState.COURSE_CTA) return BotState.REGISTER;
  if (state === BotState.ENROLL) return BotState.DONE;

  return state;
};

const startReply = async (name: string): Promise<BotResponse> => {
  const start = await botTextService.get("START_MESSAGE", {
    username: name,
  });
  const askExperience = await botTextService.get("ASK_EXPERIENCE");

  return {
    reply: `${start}\n\n${askExperience}`,
    buttons: await experienceKeyboard(),
  };
};

const formatKeyboard = async (): Promise<string[][]> => {
  return await botButtonService.getButtonsByState(BotState.ASK_FORMAT);
};

const formatReply = async (): Promise<BotResponse> => ({
  reply: ASK_FORMAT_REPLY,
  buttons: await formatKeyboard(),
});

const courseCtaReply = async (): Promise<BotResponse> => ({
  reply: await botTextService.get("CTA_REGISTER"),
  buttons: courseCtaKeyboard(),
});

const askNameReply = async (): Promise<BotResponse> => ({
  reply: ASK_NAME_REPLY,
  buttons: await botButtonService.getButtonsByState(BotState.ASK_NAME),
});

const askPhoneReply = async (): Promise<BotResponse> => ({
  reply: ASK_PHONE_REPLY,
  buttons: await askPhoneKeyboard(),
});

const registerKeyboard = async (): Promise<string[][]> => {
  return await botButtonService.getButtonsByState(BotState.REGISTER);
};

const registerReply = async (): Promise<BotResponse> => ({
  reply: REGISTER_CTA_REPLY,
  buttons: await registerKeyboard(),
});

const sendIntroMessage = async (user: BotUser) => {
  const chatId = Number(user.telegramId);
  if (!Number.isFinite(chatId)) return;

  const intro = await botTextService.get("SHOW_INTRO");
  try {
    await telegramSender.sendMessage(chatId, intro, {
      reply_markup: { remove_keyboard: true },
    });
  } catch (err) {
    logError(err, "bot.service.sendIntroMessage", {
      telegramId: user.telegramId,
    });
  }
};

const courseCtaKeyboard = (): string[][] => [
  [BUTTONS.ENROLL],
  [BUTTONS.BACK, BUTTONS.MENU],
];

const askPhoneKeyboard = async (): Promise<string[][]> => {
  const buttons = await botButtonService.getActiveForState(BotState.ASK_PHONE);

  const grid: string[][] = [];
  for (const btn of buttons) {
    if (!grid[btn.row]) grid[btn.row] = [];
    const isContact = btn.action === BOT_BUTTON_ACTION.CONTACT;
    const label = isContact
      ? `${btn.label}${CONTACT_REQUEST_SENTINEL}`
      : btn.label;
    grid[btn.row]![btn.col] = label;
  }

  return grid.map((row) => row.filter(Boolean));
};

const enrollKeyboard = (): string[][] => [[BUTTONS.MENU]];

const supportKeyboard = (): string[][] => [[BUTTONS.BACK, BUTTONS.MENU]];

const formatLearningFormatLabel = (format: UserLearningFormat | null) => {
  if (format === UserLearningFormat.online) return "Online";
  if (format === UserLearningFormat.offline) return "Offline";
  return "-";
};

const formatCourseDescriptionForBot = (description: string) => {
  const lines = description
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const limited = lines.slice(0, 6).join("\n");
  if (limited.length === 0) return "";
  return limited.length > 900 ? limited.slice(0, 899) + "…" : limited;
};

const resolvePendingCourseId = (user: BotUser): number | null => {
  const raw = user.pendingCourseId;
  return typeof raw === "number" && Number.isInteger(raw) && raw > 0
    ? raw
    : null;
};

const flatten = (grid: string[][]) => grid.flat();

const resolveGoalPrefixForUser = (_user: BotUser) => BUTTONS.GOAL_PREFIX;

const buildGoalStep = async (
  goalPrefix: string,
): Promise<{
  reply: string;
  buttons: string[][];
  labelToGoalTitle: Map<string, string>;
}> => {
  const goals = await goalService.getActiveForBot();

  if (!Array.isArray(goals) || goals.length === 0) {
    return {
      reply: await botTextService.get("NO_GOALS"),
      buttons: [[BUTTONS.BACK]],
      labelToGoalTitle: new Map(),
    };
  }

  const used = new Set<string>();
  const labelToGoalTitle = new Map<string, string>();
  const labels: string[] = [];

  const goalIds = goals
    .map((goal) =>
      typeof (goal as any)?.id === "number" && (goal as any).id > 0
        ? ((goal as any).id as number)
        : null,
    )
    .filter((id): id is number => typeof id === "number");

  const orderedGoalIds = await botButtonService.getOrderedGoalIds(goalIds);
  const goalById = new Map(
    goals
      .map((goal) => {
        const id =
          typeof (goal as any)?.id === "number" && (goal as any).id > 0
            ? ((goal as any).id as number)
            : null;
        return id ? ([id, goal] as const) : null;
      })
      .filter((entry): entry is readonly [number, (typeof goals)[number]] =>
        Array.isArray(entry),
      ),
  );

  const orderedGoals = orderedGoalIds
    .map((id) => goalById.get(id) ?? null)
    .filter((goal): goal is (typeof goals)[number] => goal !== null)
    .slice(0, MAX_LIST_ITEMS);

  for (const g of orderedGoals) {
    const id = typeof (g as any)?.id === "number" ? (g as any).id : 0;
    const title = typeof g.title === "string" ? g.title.trim() : "";
    const base = `${goalPrefix}${title}`;

    const label = buildUniqueLabel({ base, id, used });
    used.add(label);
    labels.push(label);
    labelToGoalTitle.set(label, g.title);
  }

  const grid = toGrid(labels);
  grid.push([BUTTONS.BACK]);

  return {
    reply: ASK_GOAL_REPLY,
    buttons: grid,
    labelToGoalTitle,
  };
};

const buildGoalStepForUser = async (user: BotUser) => {
  return await buildGoalStep(resolveGoalPrefixForUser(user));
};

const resolveBeginnerCourseId = async (
  user: BotUser,
): Promise<number | null> => {
  const existing = resolvePendingCourseId(user);
  if (existing) return existing;

  let courses: any[] = [];
  try {
    const list = await courseService.getActiveForBot();
    courses = Array.isArray(list) ? list : [];
  } catch {
    courses = [];
  }

  const pick =
    courses.find((c) => /\bN5\b/i.test(String((c as any)?.title ?? ""))) ??
    courses[0] ??
    null;

  const id = typeof (pick as any)?.id === "number" ? (pick as any).id : null;
  return id && Number.isInteger(id) && id > 0 ? id : null;
};

const buildCourseStep = async (): Promise<{
  reply: string;
  buttons: string[][];
  labelToCourse: Map<string, { courseId: number }>;
}> => {
  const courses = await courseService.getActiveForBot();

  if (!Array.isArray(courses) || courses.length === 0) {
    return {
      reply: await botTextService.get("NO_COURSES"),
      buttons: [[BUTTONS.BACK]],
      labelToCourse: new Map(),
    };
  }

  const used = new Set<string>();
  const labelToCourse = new Map<string, { courseId: number }>();
  const labels: string[] = [];

  const courseIds = courses
    .map((course) =>
      typeof (course as any)?.id === "number" && (course as any).id > 0
        ? ((course as any).id as number)
        : null,
    )
    .filter((id): id is number => typeof id === "number");

  const orderedCourseIds =
    await botButtonService.getOrderedCourseIds(courseIds);
  const courseById = new Map(
    courses
      .map((course) => {
        const id =
          typeof (course as any)?.id === "number" && (course as any).id > 0
            ? ((course as any).id as number)
            : null;
        return id ? ([id, course] as const) : null;
      })
      .filter((entry): entry is readonly [number, (typeof courses)[number]] =>
        Array.isArray(entry),
      ),
  );

  const sorted = orderedCourseIds
    .map((id) => courseById.get(id) ?? null)
    .filter((course): course is (typeof courses)[number] => course !== null)
    .slice(0, MAX_LIST_ITEMS);

  for (const c of sorted) {
    const id = typeof (c as any)?.id === "number" ? (c as any).id : 0;
    const title =
      typeof (c as any)?.title === "string" ? (c as any).title.trim() : "";

    const baseTitle = title.length > 0 ? title : id ? `Kurs #${id}` : "Kurs";
    const base = `${BUTTONS.COURSE_PREFIX}${baseTitle}`;

    const label = buildUniqueLabel({ base, id, used });
    used.add(label);
    labels.push(label);
    labelToCourse.set(label, {
      courseId: (c as any).id,
    });
  }

  const grid = toGrid(labels);
  grid.push([BUTTONS.BACK]);

  return {
    reply: await botTextService.get("SELECT_COURSE"),
    buttons: grid,
    labelToCourse,
  };
};

const buildCourseInfoAndFormatReply = async (
  courseId: number,
): Promise<BotResponse> => {
  const course = await courseService.getById(courseId);

  const durationText =
    typeof (course as any).duration === "number" && (course as any).duration > 0
      ? `${(course as any).duration} oy`
      : "-";

  const description = formatCourseDescriptionForBot(course.description);

  const askFormat = await botTextService.get("ASK_FORMAT");
  const courseDescriptionBlock =
    description.length > 0 ? `${description}\n\n` : "";

  return {
    reply: await botTextService.get("COURSE_INFO", {
      courseTitle: course.title,
      courseDescriptionBlock,
      duration: durationText,
      askFormat,
    }),
    buttons: await formatKeyboard(),
  };
};

const resetFlow = async (user: BotUser): Promise<BotResponse> => {
  await userRepository.updateByTelegramId(user.telegramId, {
    currentStep: BotState.SELECT_EXPERIENCE,
    experience: null,
    goal: null,
    learningFormat: null,
    pendingCourseId: null,

    isInSupport: false,
    supportStatus: "none",
    supportAdminId: null,
  });

  try {
    await supportRepository.closeAllOpenByTelegramId(user.telegramId);
  } catch {
    // ignore
  }

  return startReply(user.name);
};

const goBack = async (
  user: BotUser,
  fromState: BotState,
): Promise<BotResponse> => {
  const isBeginner = user.experience === UserExperience.beginner;
  const prev =
    fromState === BotState.ASK_FORMAT && isBeginner
      ? BotState.ASK_GOAL
      : (BACK_MAP[fromState] ?? null);
  if (!prev) return resetFlow(user);

  await userRepository.updateByTelegramId(user.telegramId, {
    currentStep: prev,
  });

  if (prev === BotState.SELECT_EXPERIENCE) return startReply(user.name);
  if (prev === BotState.ASK_GOAL) {
    const step = await buildGoalStepForUser(user);
    return { reply: step.reply, buttons: step.buttons };
  }
  if (prev === BotState.SELECT_COURSE) {
    const step = await buildCourseStep();
    return { reply: step.reply, buttons: step.buttons };
  }
  if (prev === BotState.ASK_FORMAT) {
    if (isBeginner) return formatReply();

    const pendingCourseId = resolvePendingCourseId(user);
    if (!pendingCourseId) {
      await userRepository.updateByTelegramId(user.telegramId, {
        currentStep: BotState.SELECT_COURSE,
      });
      const step = await buildCourseStep();
      return { reply: step.reply, buttons: step.buttons };
    }

    return await buildCourseInfoAndFormatReply(pendingCourseId);
  }
  if (prev === BotState.REGISTER) return registerReply();
  if (prev === BotState.COURSE_CTA) return courseCtaReply();
  if (prev === BotState.ASK_NAME) return askNameReply();

  return resetFlow(user);
};

const enterSupport = async (
  user: BotUser,
  telegramMessageId?: number | null,
): Promise<BotResponse> => {
  const telegramId = user.telegramId;

  const existing =
    await supportRepository.findLatestOpenByTelegramId(telegramId);
  const request =
    existing ?? (await supportRepository.createRequest(telegramId));

  await userRepository.updateByTelegramId(telegramId, {
    currentStep: BotState.SUPPORT,
    isInSupport: true,
    supportStatus: "pending",
  });

  try {
    await messageService.createUserMessage({
      telegramId,
      telegramMessageId,
      text: BUTTONS.SUPPORT,
    });
  } catch (err) {
    logError(err, "bot.service.support.createUserMessage", { telegramId });
  }

  const phoneLine = user.phone ? `\n📞 Phone: ${user.phone}` : "";
  const requestLine = request ? `\n🧾 Request: ${request.id}` : "";

  void notifyAdmin(
    `🎧 Operator so‘rovi:\n\n` +
      `👤 Ism: ${user.name}\n` +
      `🆔 ID: ${user.telegramId}` +
      phoneLine +
      requestLine +
      `\n\nAdmin panel orqali javob bering.`,
  );

  return {
    reply: await botTextService.get("SUPPORT_MESSAGE"),
    buttons: supportKeyboard(),
  };
};

const handleExperience = async (
  user: BotUser,
  text: string,
  telegramMessageId?: number | null,
): Promise<BotResponse> => {
  const buttons = await experienceKeyboard();
  const validOptions = flatten(buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(buttons);

  const action = await botButtonService.getActionByLabel(
    BotState.SELECT_EXPERIENCE,
    text,
  );

  if (action === BOT_BUTTON_ACTION.SUPPORT || text === BUTTONS.SUPPORT)
    return enterSupport(user, telegramMessageId);

  const experience =
    action === BOT_BUTTON_ACTION.EXP_BEGINNER || text === BUTTONS.EXP_BEGINNER
      ? UserExperience.beginner
      : action === BOT_BUTTON_ACTION.EXP_INTERMEDIATE ||
          text === BUTTONS.EXP_INTERMEDIATE
        ? UserExperience.intermediate
        : null;

  if (!experience) return invalidChoiceResponse(buttons);

  await userRepository.updateByTelegramId(user.telegramId, {
    experience,
    goal: null,
    learningFormat: null,
    pendingCourseId: null,
    currentStep: BotState.ASK_GOAL,
  });

  const step = await buildGoalStep(BUTTONS.GOAL_PREFIX);
  return { reply: step.reply, buttons: step.buttons };
};

const handleGoal = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const step = await buildGoalStepForUser(user);
  const validOptions = flatten(step.buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(step.buttons);

  if (text === BUTTONS.BACK) return goBack(user, BotState.ASK_GOAL);

  const goalTitle = step.labelToGoalTitle.get(text) ?? null;
  if (!goalTitle) return invalidChoiceResponse(step.buttons);

  const isBeginner = user.experience === UserExperience.beginner;
  const isIntermediate = user.experience === UserExperience.intermediate;
  if (!isBeginner && !isIntermediate) return resetFlow(user);

  await userRepository.updateByTelegramId(user.telegramId, {
    goal: goalTitle,
    pendingCourseId: null,
    learningFormat: null,
    currentStep: isBeginner ? BotState.ASK_FORMAT : BotState.SELECT_COURSE,
  });

  if (isBeginner) {
    // ✅ STEP 4 requirement (BEGINNER ONLY):
    // 1) Send intro text (SHOW_INTRO) as a separate message with NO buttons
    // 2) Return format question as the interactive message with buttons
    await sendIntroMessage(user);
    return await formatReply();
  }

  const next = await buildCourseStep();
  return { reply: next.reply, buttons: next.buttons };
};

const handleIntro = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  // Legacy compatibility: SHOW_INTRO used to be an interactive step.
  // New flow sends intro as a separate message and asks format next.
  if (text === BUTTONS.BACK) return goBack(user, BotState.SHOW_INTRO);

  await userRepository.updateByTelegramId(user.telegramId, {
    currentStep: BotState.ASK_FORMAT,
  });

  await sendIntroMessage(user);
  return await formatReply();
};

const handleCourse = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  // 🔵 INTERMEDIATE FLOW ONLY ("🔵 Tushuncham bor")
  // Beginner flow must never show course list.
  const hasGoal = typeof user.goal === "string" && user.goal.trim().length > 0;
  if (!hasGoal) {
    await userRepository.updateByTelegramId(user.telegramId, {
      currentStep: BotState.ASK_GOAL,
    });
    const step = await buildGoalStepForUser(user);
    return { reply: step.reply, buttons: step.buttons };
  }

  const step = await buildCourseStep();
  const validOptions = flatten(step.buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(step.buttons);

  if (text === BUTTONS.BACK) return goBack(user, BotState.SELECT_COURSE);

  const picked = step.labelToCourse.get(text) ?? null;
  if (!picked) return invalidChoiceResponse(step.buttons);

  await userRepository.updateByTelegramId(user.telegramId, {
    pendingCourseId: picked.courseId,
    learningFormat: null,
    currentStep: BotState.ASK_FORMAT,
  });

  return await buildCourseInfoAndFormatReply(picked.courseId);
};

const handleFormat = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const buttons = await formatKeyboard();
  const validOptions = flatten(buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(buttons);

  const action = await botButtonService.getActionByLabel(
    BotState.ASK_FORMAT,
    text,
  );

  if (action === BOT_BUTTON_ACTION.BACK || text === BUTTONS.BACK)
    return goBack(user, BotState.ASK_FORMAT);

  const format =
    action === BOT_BUTTON_ACTION.FORMAT_ONLINE || text === BUTTONS.FORMAT_ONLINE
      ? UserLearningFormat.online
      : action === BOT_BUTTON_ACTION.FORMAT_OFFLINE ||
          text === BUTTONS.FORMAT_OFFLINE
        ? UserLearningFormat.offline
        : null;

  if (!format) return invalidChoiceResponse(buttons);

  const isBeginner = user.experience === UserExperience.beginner;
  if (isBeginner) {
    // ✅ STEP 6 requirement (BEGINNER): after format, show REGISTER CTA.
    const courseId = await resolveBeginnerCourseId(user);
    if (!courseId) return genericErrorResponse();

    await userRepository.updateByTelegramId(user.telegramId, {
      pendingCourseId: courseId,
      learningFormat: format,
      currentStep: BotState.REGISTER,
    });

    return registerReply();
  }

  // 🔵 INTERMEDIATE FLOW: must select course first.
  const pendingCourseId = resolvePendingCourseId(user);
  if (!pendingCourseId) {
    await userRepository.updateByTelegramId(user.telegramId, {
      currentStep: BotState.SELECT_COURSE,
    });
    const step = await buildCourseStep();
    return { reply: step.reply, buttons: step.buttons };
  }

  await userRepository.updateByTelegramId(user.telegramId, {
    learningFormat: format,
    currentStep: BotState.COURSE_CTA,
  });

  return courseCtaReply();
};

const handleRegister = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const buttons = await registerKeyboard();
  const validOptions = flatten(buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(buttons);

  const action = await botButtonService.getActionByLabel(
    BotState.REGISTER,
    text,
  );

  if (action === BOT_BUTTON_ACTION.BACK || text === BUTTONS.BACK)
    return goBack(user, BotState.REGISTER);
  if (action !== BOT_BUTTON_ACTION.ENROLL && text !== BUTTONS.ENROLL)
    return invalidChoiceResponse(buttons);

  await userRepository.updateByTelegramId(user.telegramId, {
    currentStep: BotState.ASK_NAME,
  });

  return askNameReply();
};

const handleCourseCta = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const buttons = courseCtaKeyboard();
  const validOptions = flatten(buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(buttons);

  if (text === BUTTONS.MENU) return resetFlow(user);
  if (text === BUTTONS.BACK) return goBack(user, BotState.COURSE_CTA);

  if (text !== BUTTONS.ENROLL) return invalidChoiceResponse(buttons);

  const pendingCourseId = resolvePendingCourseId(user);
  if (!pendingCourseId || !user.learningFormat) {
    await userRepository.updateByTelegramId(user.telegramId, {
      currentStep: BotState.SELECT_COURSE,
    });
    const step = await buildCourseStep();
    return { reply: step.reply, buttons: step.buttons };
  }

  await userRepository.updateByTelegramId(user.telegramId, {
    currentStep: BotState.ASK_NAME,
  });

  return askNameReply();
};

const handleAskName = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const action = await botButtonService.getActionByLabel(
    BotState.ASK_NAME,
    text,
  );

  if (action === BOT_BUTTON_ACTION.MENU || text === BUTTONS.MENU) {
    return resetFlow(user);
  }

  if (action === BOT_BUTTON_ACTION.BACK || text === BUTTONS.BACK) {
    return askNameReply();
  }

  let name: string;
  try {
    name = parseName(text);
  } catch {
    return askNameReply();
  }

  await userRepository.updateByTelegramId(user.telegramId, {
    name,
    currentStep: BotState.ASK_PHONE,
  });

  return askPhoneReply();
};

const handleAskPhone = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const action = await botButtonService.getActionByLabel(
    BotState.ASK_PHONE,
    text,
  );

  if (action === BOT_BUTTON_ACTION.MENU || text === BUTTONS.MENU) {
    return resetFlow(user);
  }

  if (action === BOT_BUTTON_ACTION.BACK || text === BUTTONS.BACK) {
    await userRepository.updateByTelegramId(user.telegramId, {
      currentStep: BotState.ASK_NAME,
    });
    return askNameReply();
  }

  let phone: string;
  try {
    phone = parsePhone(text);
  } catch {
    return askPhoneReply();
  }

  const isBeginner = user.experience === UserExperience.beginner;
  const pendingCourseId = isBeginner
    ? (resolvePendingCourseId(user) ?? (await resolveBeginnerCourseId(user)))
    : resolvePendingCourseId(user);

  if (!pendingCourseId) {
    if (isBeginner) return genericErrorResponse();

    await userRepository.updateByTelegramId(user.telegramId, {
      currentStep: BotState.SELECT_COURSE,
    });
    const step = await buildCourseStep();
    return { reply: step.reply, buttons: step.buttons };
  }

  if (!user.learningFormat) {
    await userRepository.updateByTelegramId(user.telegramId, {
      currentStep: BotState.ASK_FORMAT,
    });

    return isBeginner
      ? formatReply()
      : await buildCourseInfoAndFormatReply(pendingCourseId);
  }

  try {
    await enrollmentService.registerForBot({
      userId: user.id,
      courseId: pendingCourseId,
      name: user.name,
      phone,
      format: user.learningFormat,
    });
  } catch (err) {
    logError(err, "bot.service.enrollment.register", {
      telegramId: user.telegramId,
      pendingCourseId,
    });
  }

  let courseTitle = String(pendingCourseId);
  try {
    const list = await courseService.getActiveForBot();
    const found = Array.isArray(list)
      ? list.find((c: any) => (c as any)?.id === pendingCourseId)
      : null;
    if (found && typeof (found as any).title === "string") {
      const t = String((found as any).title).trim();
      if (t.length > 0) courseTitle = t;
    }
  } catch {
    // ignore
  }

  void notifyAdmin(
    "🆕 Yangi ro‘yxatdan o‘tish\n\n" +
      `👤 Ism: ${user.name}\n` +
      `📱 Tel: ${phone}\n` +
      `📘 Kurs: ${courseTitle}\n` +
      `📍 Format: ${formatLearningFormatLabel(user.learningFormat)}`,
  );

  await userRepository.updateByTelegramId(user.telegramId, {
    phone,
    currentStep: isBeginner ? BotState.DONE : BotState.ENROLL,
  });

  return {
    reply: SUCCESS_REPLY,
    buttons: enrollKeyboard(),
  };
};

const handleEnroll = async (
  user: BotUser,
  text: string,
): Promise<BotResponse> => {
  const buttons = enrollKeyboard();
  const validOptions = flatten(buttons);

  if (!validOptions.includes(text)) return invalidChoiceResponse(buttons);
  if (text === BUTTONS.MENU) return resetFlow(user);
  return invalidChoiceResponse(buttons);
};

const handleSupport = async (
  user: BotUser,
  text: string,
  telegramMessageId?: number | null,
): Promise<BotResponse> => {
  if (text === BUTTONS.MENU) return resetFlow(user);

  if (text === BUTTONS.BACK) {
    try {
      await userRepository.updateSupportStatusByTelegramId(
        user.telegramId,
        "closed",
      );
    } catch {
      // ignore
    }

    try {
      await supportRepository.closeAllOpenByTelegramId(user.telegramId);
    } catch {
      // ignore
    }

    return goBack(user, BotState.SUPPORT);
  }

  const telegramId = user.telegramId;

  try {
    await messageService.createUserMessage({
      telegramId,
      telegramMessageId,
      text,
    });
  } catch (err) {
    logError(err, "bot.service.support.createUserMessage", { telegramId });
  }

  let request = await supportRepository.findLatestOpenByTelegramId(telegramId);

  if (!request) {
    try {
      request = await supportRepository.createRequest(telegramId, "active");
    } catch {
      request = null;
    }
  } else if (request.status === "pending") {
    try {
      request = await supportRepository.setStatusById(request.id, "active");
    } catch {
      // ignore
    }
  }

  const phoneLine = user.phone ? `\n📞 Phone: ${user.phone}` : "";
  const requestLine = request ? `\n🧾 Request: ${request.id}` : "";

  void notifyAdmin(
    `💬 Operatorga yangi xabar:\n\n` +
      `👤 Ism: ${user.name}\n` +
      `🆔 ID: ${user.telegramId}` +
      phoneLine +
      requestLine +
      `\n\n${text}`,
  );

  void userRepository
    .updateSupportStatusByTelegramId(telegramId, "active")
    .catch(() => {});

  return {
    reply: await botTextService.get("SUPPORT_SENT"),
    buttons: supportKeyboard(),
  };
};

export const botService = {
  start: async (
    telegramIdRaw: unknown,
    telegramNicknameRaw: unknown,
    telegramUsernameRaw: unknown,
  ): Promise<BotResponse> => {
    try {
      const telegramId = parseTelegramId(telegramIdRaw);
      const telegramNickname = parseTelegramNickname(telegramNicknameRaw);
      const telegramUsername = parseTelegramUsername(telegramUsernameRaw);

      const user = await userService.getOrCreateUser(
        telegramId,
        telegramNickname,
        telegramUsername,
      );

      await userRepository.updateByTelegramId(telegramId, {
        currentStep: BotState.SELECT_EXPERIENCE,
        experience: null,
        goal: null,
        learningFormat: null,
        pendingCourseId: null,

        isInSupport: false,
        supportStatus: "none",
        supportAdminId: null,
      });

      try {
        await supportRepository.closeAllOpenByTelegramId(telegramId);
      } catch {
        // ignore
      }

      return startReply(user.name);
    } catch (err) {
      logError(err, "bot.service.start");
      return genericErrorResponse();
    }
  },

  handleMessage: async (
    user: BotUser,
    text: string,
    telegramMessageId?: number | null,
  ): Promise<BotResponse> => {
    if (isMenuLike(text)) return resetFlow(user);

    const mapped = resolveState(user.currentStep);
    if (!mapped) return resetFlow(user);

    const state = normalizeStateForUser(user, mapped);

    if (mapped && mapped !== user.currentStep) {
      try {
        await userRepository.updateByTelegramId(user.telegramId, {
          currentStep: mapped,
        });
      } catch (err) {
        logError(err, "bot.service.state.migrate", {
          telegramId: user.telegramId,
          from: user.currentStep,
          to: mapped,
        });
      }
    }

    switch (state) {
      case BotState.SELECT_EXPERIENCE:
        return handleExperience(user, text, telegramMessageId);
      case BotState.ASK_GOAL:
        return handleGoal(user, text);
      case BotState.SHOW_INTRO:
        return handleIntro(user, text);
      case BotState.SELECT_COURSE:
        return handleCourse(user, text);
      case BotState.ASK_FORMAT:
        return handleFormat(user, text);
      case BotState.REGISTER:
        return handleRegister(user, text);
      case BotState.COURSE_CTA:
        return handleCourseCta(user, text);
      case BotState.ASK_NAME:
        return handleAskName(user, text);
      case BotState.ASK_PHONE:
        return handleAskPhone(user, text);
      case BotState.ENROLL:
        return handleEnroll(user, text);
      case BotState.DONE:
        return handleEnroll(user, text);
      case BotState.SUPPORT:
        return handleSupport(user, text, telegramMessageId);
      default:
        return resetFlow(user);
    }
  },

  message: async (
    telegramIdRaw: unknown,
    messageRaw: unknown,
    telegramMessageIdRaw?: unknown,
  ): Promise<BotResponse> => {
    let telegramId: string | null = null;
    let incoming = "";
    let telegramMessageId: number | null = null;

    try {
      telegramId = parseTelegramId(telegramIdRaw);
      incoming = sanitizeMessage(messageRaw);
      telegramMessageId = parseTelegramMessageId(telegramMessageIdRaw);

      const user = await userRepository.findByTelegramId(telegramId);
      if (!user) {
        return {
          reply: await botTextService.get("START_REQUIRED"),
          buttons: [],
        };
      }

      if (incoming.length === 0) {
        const mapped = resolveState(user.currentStep);
        if (!mapped) return resetFlow(user);

        const state = normalizeStateForUser(user, mapped);
        if (state !== mapped) {
          try {
            await userRepository.updateByTelegramId(user.telegramId, {
              currentStep: state,
            });
          } catch {
            // ignore
          }
        }

        if (state === BotState.SELECT_EXPERIENCE)
          return invalidChoiceResponse(await experienceKeyboard());
        if (state === BotState.ASK_GOAL) {
          const step = await buildGoalStepForUser(user);
          return invalidChoiceResponse(step.buttons);
        }
        if (state === BotState.SHOW_INTRO)
          return invalidChoiceResponse(await formatKeyboard());
        if (state === BotState.SELECT_COURSE) {
          const step = await buildCourseStep();
          return invalidChoiceResponse(step.buttons);
        }
        if (state === BotState.ASK_FORMAT)
          return invalidChoiceResponse(await formatKeyboard());
        if (state === BotState.REGISTER)
          return invalidChoiceResponse(await registerKeyboard());
        if (state === BotState.COURSE_CTA)
          return invalidChoiceResponse(courseCtaKeyboard());
        if (state === BotState.ASK_NAME) return askNameReply();
        if (state === BotState.ASK_PHONE) return askPhoneReply();
        if (state === BotState.ENROLL)
          return invalidChoiceResponse(enrollKeyboard());
        if (state === BotState.DONE)
          return invalidChoiceResponse(enrollKeyboard());
        if (state === BotState.SUPPORT)
          return invalidChoiceResponse(supportKeyboard());

        return resetFlow(user);
      }

      return await botService.handleMessage(user, incoming, telegramMessageId);
    } catch (err) {
      logError(err, "bot.service.message", { telegramId, incoming });
      return genericErrorResponse();
    }
  },

  registerPhone: async (
    telegramIdRaw: unknown,
    phoneRaw: unknown,
  ): Promise<BotResponse> => {
    try {
      const telegramId = parseTelegramId(telegramIdRaw);
      const phone = parsePhone(phoneRaw);

      const user = await userRepository.findByTelegramId(telegramId);
      if (!user)
        return {
          reply: await botTextService.get("START_REQUIRED_SHORT"),
          buttons: [],
        };

      const mapped = resolveState(user.currentStep);
      if (mapped === BotState.ASK_PHONE) {
        return await botService.handleMessage(user, phone, null);
      }

      await userRepository.updateByTelegramId(telegramId, { phone });
      return {
        reply: await botTextService.get("PHONE_SAVED"),
        buttons: [[BUTTONS.MENU]],
      };
    } catch (err) {
      logError(err, "bot.service.registerPhone");
      return genericErrorResponse();
    }
  },

  enroll: async (
    _telegramIdRaw: unknown,
    _courseIdRaw: unknown,
  ): Promise<BotResponse> => {
    return {
      reply: await botTextService.get("ENROLL_CONTINUE"),
      buttons: [[BUTTONS.MENU]],
    };
  },
};
