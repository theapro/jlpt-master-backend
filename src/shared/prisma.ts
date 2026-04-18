import { PrismaClient } from "@prisma/client";

import { perfMetrics } from "./perf-metrics";

const basePrisma = new PrismaClient();

const prismaWithMetrics = basePrisma.$extends({
  query: {
    $allModels: {
      $allOperations: async ({ model, operation, args, query }) => {
        const modelSafe = typeof model === "string" ? model : "raw";
        const operationSafe =
          typeof operation === "string" ? operation : "query";

        const end = perfMetrics.span(`prisma.${modelSafe}.${operationSafe}`);
        try {
          return await query(args);
        } finally {
          end();
        }
      },
    },
  },
});

const prisma: PrismaClient = perfMetrics.enabled()
  ? (prismaWithMetrics as unknown as PrismaClient)
  : basePrisma;

export { prisma };
