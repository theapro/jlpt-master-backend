import { Markup } from "telegraf";

import type { BotCourseSummary } from "../../modules/bot/bot.types";

const clamp = (text: string, max: number) =>
  text.length > max ? text.slice(0, Math.max(0, max - 1)) + "…" : text;

export const courseListInlineKeyboard = (courses: BotCourseSummary[]) => {
  const buttons = courses.slice(0, 20).map((c) => {
    const label = clamp(`${c.title}`, 40);
    return Markup.button.callback(label, `course_${c.id}`);
  });

  const rows: any[] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  rows.push([Markup.button.callback("🔙 Menuga qaytish", "back_menu")]);

  return Markup.inlineKeyboard(rows);
};

export const courseDetailsInlineKeyboard = (courseId: number) => {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📥 Ro‘yxatdan o‘tish", `enroll_${courseId}`)],
    [
      Markup.button.callback("📚 Kurslarga qaytish", "back_courses"),
      Markup.button.callback("🎧 Operator", "support_request"),
    ],
    [Markup.button.callback("🔙 Menuga qaytish", "back_menu")],
  ]);
};
