import { PrismaClient } from "@prisma/client";

/**
 * Reuse a single PrismaClient instance across hot-reloads in development to
 * avoid exhausting the database connection pool. In production a fresh client
 * is created per server instance.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
