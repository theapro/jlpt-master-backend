import { Markup } from "telegraf";

export const replyKeyboard = (buttons?: readonly string[][]) => {
  if (!buttons) return Markup.keyboard([["🏠 Menu"]]).resize();
  if (buttons.length === 0) return Markup.removeKeyboard();

  const CONTACT_LABEL = "📱 Raqamni yuborish";
  const CONTACT_SENTINEL = "\u2063";

  const rows = buttons
    .filter((r) => Array.isArray(r) && r.length > 0)
    .map((r) =>
      r.map((label) =>
        label === CONTACT_LABEL
          ? Markup.button.contactRequest(CONTACT_LABEL)
          : typeof label === "string" && label.endsWith(CONTACT_SENTINEL)
            ? Markup.button.contactRequest(
                label.slice(
                  0,
                  Math.max(0, label.length - CONTACT_SENTINEL.length),
                ),
              )
            : label,
      ),
    );

  if (rows.length === 0) return Markup.removeKeyboard();

  return Markup.keyboard(rows).resize();
};

export const mainMenuKeyboard = () => replyKeyboard([["🏠 Menu"]]);
