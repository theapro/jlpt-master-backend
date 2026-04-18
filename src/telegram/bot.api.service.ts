import axios, { AxiosError } from "axios";

import type {
  BotEnrollBody,
  BotMessageBody,
  BotRegisterPhoneBody,
  BotResponse,
  BotStartBody,
} from "../modules/bot/bot.types";

const resolveBaseUrl = () => {
  const configured =
    process.env.BOT_BACKEND_URL ??
    process.env.BACKEND_URL ??
    process.env.API_BASE_URL;

  if (configured && configured.trim().length > 0) return configured.trim();

  const rawPort = process.env.PORT;
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : NaN;
  const port =
    Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  return `http://127.0.0.1:${port}`;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const shouldRetry = (err: unknown) => {
  if (!axios.isAxiosError(err)) return false;
  const code = (err as any).code;
  return (
    code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT"
  );
};

const baseURL = resolveBaseUrl();

const http = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

const getErrorMessage = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<any>;
    const reply = e.response?.data?.reply;
    if (typeof reply === "string" && reply.trim().length > 0) return reply;

    const status = e.response?.status;
    const code = (e as any).code;

    if (status) {
      return `Xatolik: backend javobi xato (status=${status}) (bot.api.service)`;
    }

    if (code === "ECONNREFUSED") {
      return "Xatolik: backend ishlamayapti yoki port noto‘g‘ri (bot.api.service)";
    }

    return "Xatolik: backendga ulanishda muammo (bot.api.service)";
  }

  if (err instanceof Error && err.message.trim().length > 0) return err.message;

  return "Xatolik: so‘rov bajarilmadi (bot.api.service)";
};

const post = async <TBody>(path: string, body: TBody): Promise<BotResponse> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await http.post<BotResponse>(path, body);
      return res.data;
    } catch (err) {
      lastError = err;
      console.error("[ERROR SOURCE]: bot.api.service");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);

      if (attempt === 1 && shouldRetry(err)) {
        console.log("[RETRY]:", { path, attempt, baseURL });
        await sleep(300);
        continue;
      }

      break;
    }
  }

  throw new Error(getErrorMessage(lastError));
};

const get = async (path: string): Promise<BotResponse> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const res = await http.get<BotResponse>(path);
      return res.data;
    } catch (err) {
      lastError = err;

      // Avoid noisy stack traces during local startup race (bot starts before server)
      if (shouldRetry(err) && attempt < 10) {
        if (attempt === 1) {
          console.log("[WAIT]: backend not ready, retrying...", {
            path,
            baseURL,
          });
        }
        await sleep(300);
        continue;
      }

      console.error("[ERROR SOURCE]: bot.api.service");
      console.error(err instanceof Error ? (err.stack ?? err.message) : err);
      break;
    }
  }

  throw new Error(getErrorMessage(lastError));
};

export const botApiService = {
  getBaseUrl: () => baseURL,

  ping: async () => get("/api/bot/ping"),

  start: async (body: BotStartBody) =>
    post<BotStartBody>("/api/bot/start", body),

  message: async (body: BotMessageBody) =>
    post<BotMessageBody>("/api/bot/message", body),

  enroll: async (body: BotEnrollBody) =>
    post<BotEnrollBody>("/api/bot/enroll", body),

  registerPhone: async (body: BotRegisterPhoneBody) =>
    post<BotRegisterPhoneBody>("/api/bot/register-phone", body),
};
