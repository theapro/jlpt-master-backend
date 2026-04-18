import type { MiddlewareFn } from "telegraf";
import type { Context } from "telegraf";

type Bucket = {
  count: number;
  resetAt: number;
};

export const createRateLimitMiddleware = (opts: {
  windowMs: number;
  max: number;
  getKey?: (ctx: Context) => string | null;
  message?: string;
}): MiddlewareFn<Context> => {
  const buckets = new Map<string, Bucket>();

  return async (ctx, next) => {
    const key = opts.getKey
      ? opts.getKey(ctx)
      : ctx.from?.id
        ? String(ctx.from.id)
        : null;

    if (!key) return next();

    const now = Date.now();
    const existing = buckets.get(key);

    const bucket: Bucket =
      existing && now <= existing.resetAt
        ? existing
        : { count: 0, resetAt: now + opts.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > opts.max) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      const msg =
        opts.message ??
        `Juda ko‘p so‘rov yuborildi. Iltimos ${retryAfterSec}s kuting va qaytadan urinib ko‘ring.`;

      try {
        if ("reply" in ctx) await (ctx as any).reply(msg);
      } catch {
        // ignore
      }

      return;
    }

    return next();
  };
};
