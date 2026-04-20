import { Prisma, PrismaClient } from "@prisma/client";

import { perfMetrics } from "./perf-metrics";

const TARGET_DATABASE_NAME =
  process.env.PRISMA_DB_NAME?.trim() || "jlpt_master";

const resolvePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const buildDatabaseUrl = () => {
  const raw = process.env.DATABASE_URL;
  if (!raw || raw.trim().length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  if (parsed.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql:// protocol");
  }

  const dbName = parsed.pathname.replace(/^\/+/, "").trim();
  if (dbName.length === 0) {
    throw new Error("DATABASE_URL must include a database name");
  }

  if (dbName !== TARGET_DATABASE_NAME) {
    throw new Error(
      `DATABASE_URL must target '${TARGET_DATABASE_NAME}', got '${dbName}'`,
    );
  }

  const defaults = {
    connection_limit: resolvePositiveInt(process.env.PRISMA_POOL_MAX, 15),
    pool_timeout: resolvePositiveInt(process.env.PRISMA_POOL_TIMEOUT_SEC, 20),
    connect_timeout: resolvePositiveInt(
      process.env.PRISMA_CONNECT_TIMEOUT_SEC,
      10,
    ),
    socket_timeout: resolvePositiveInt(
      process.env.PRISMA_SOCKET_TIMEOUT_SEC,
      30,
    ),
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!parsed.searchParams.has(key)) {
      parsed.searchParams.set(key, String(value));
    }
  }

  const finalized = parsed.toString();
  process.env.DATABASE_URL = finalized;
  return finalized;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1017", "P2024"]);

const isRetryablePrismaError = (err: unknown) => {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(err.code);
  }

  const message =
    err instanceof Error ? `${err.name} ${err.message}`.toLowerCase() : "";

  return (
    message.includes("server has gone away") ||
    message.includes("lost connection") ||
    message.includes("connection")
  );
};

const withResilientReconnect = (client: PrismaClient) => {
  let reconnectPromise: Promise<void> | null = null;

  const reconnect = async () => {
    if (!reconnectPromise) {
      reconnectPromise = (async () => {
        try {
          await client.$disconnect();
        } catch {
          // ignore stale disconnection errors
        }

        await client.$connect();
      })().finally(() => {
        reconnectPromise = null;
      });
    }

    await reconnectPromise;
  };

  return async <T>(query: () => Promise<T>): Promise<T> => {
    const maxAttempts = resolvePositiveInt(process.env.PRISMA_QUERY_RETRIES, 2);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await query();
      } catch (err) {
        lastErr = err;

        if (!isRetryablePrismaError(err) || attempt >= maxAttempts) {
          throw err;
        }

        const delayMs = Math.min(750, 150 * attempt);
        await sleep(delayMs);
        await reconnect();
      }
    }

    throw lastErr;
  };
};

const createClient = (databaseUrl: string) => {
  const baseClient = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  const runWithRetry = withResilientReconnect(baseClient);

  const prismaWithMetrics = baseClient.$extends({
    query: {
      $allModels: {
        $allOperations: async ({ model, operation, args, query }) => {
          const modelSafe = typeof model === "string" ? model : "raw";
          const operationSafe =
            typeof operation === "string" ? operation : "query";

          const end = perfMetrics.span(`prisma.${modelSafe}.${operationSafe}`);
          try {
            return await runWithRetry(() => query(args));
          } finally {
            end();
          }
        },
      },
    },
  });

  if (perfMetrics.enabled()) {
    return prismaWithMetrics as unknown as PrismaClient;
  }

  return baseClient;
};

type PrismaGlobal = typeof globalThis & {
  __prismaClient?: PrismaClient;
  __prismaDatabaseUrl?: string;
};

const globalForPrisma = globalThis as PrismaGlobal;

const getPrismaClient = () => {
  const dbUrl = buildDatabaseUrl();

  const existing = globalForPrisma.__prismaClient;
  const existingUrl = globalForPrisma.__prismaDatabaseUrl;

  if (existing && existingUrl === dbUrl) {
    return existing;
  }

  if (existing && existingUrl !== dbUrl) {
    void existing.$disconnect().catch(() => {
      // ignore disconnect errors when rotating env URL during dev
    });
  }

  const client = createClient(dbUrl);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prismaClient = client;
    globalForPrisma.__prismaDatabaseUrl = dbUrl;
  }

  return client;
};

const prisma = getPrismaClient();

export { prisma };
