import type { RequestHandler } from "express";

const isDebug = process.env.NODE_ENV !== "production";

const truncate = (value: string, max: number) =>
  value.length > max ? value.slice(0, Math.max(0, max - 1)) + "…" : value;

const safeBodyForLog = (body: unknown) => {
  if (body === undefined) return undefined;

  try {
    const json = JSON.stringify(body);
    return truncate(json, 4000);
  } catch {
    return "[unserializable body]";
  }
};

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  const url = req.originalUrl ?? req.url;

  console.log(`[REQUEST] ${req.method} ${url}`);

  const shouldLogBody = isDebug || url.startsWith("/api/bot");
  if (shouldLogBody) {
    console.log("Body:", safeBodyForLog(req.body));
  }

  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`[RESPONSE] ${res.statusCode} ${req.method} ${url} (${ms}ms)`);
  });

  next();
};
