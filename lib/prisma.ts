import { performance } from "node:perf_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { recordActiveDatabaseQuery } from "@/lib/performance-timing";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  }).$extends(
    Prisma.defineExtension({
      name: "ecl-performance-timing",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const startedAt = performance.now();
            try {
              return await query(args);
            } finally {
              recordActiveDatabaseQuery(model, operation, performance.now() - startedAt);
            }
          },
        },
      },
    }),
  ) as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
