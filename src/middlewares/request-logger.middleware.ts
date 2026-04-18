import type { RequestHandler } from "express";

const isDebug = process.env.NODE_ENV !== "production";

const isRequestLoggingEnabled = (() => {
  const raw = String(process.env.LOG_REQUESTS ?? "").toLowerCase().trim();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return isDebug;
})();

const isRequestBodyLoggingEnabled = (() => {
  const raw = String(process.env.LOG_REQUEST_BODIES ?? "")
    .toLowerCase()
    .trim();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return isDebug;
})();

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
  if (!isRequestLoggingEnabled) return next();

  const startedAt = Date.now();
  const url = req.originalUrl ?? req.url;

  console.log(`[REQUEST] ${req.method} ${url}`);

  const shouldLogBody =
    isRequestBodyLoggingEnabled &&
    (isDebug || url.startsWith("/api/bot")) &&
    !url.startsWith("/telegram/webhook");
  if (shouldLogBody) {
    console.log("Body:", safeBodyForLog(req.body));
  }

  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`[RESPONSE] ${res.statusCode} ${req.method} ${url} (${ms}ms)`);
  });

  next();
};
