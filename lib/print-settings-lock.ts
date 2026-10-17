import type { Prisma } from "@prisma/client";
export async function lockPrintSettings(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(280650)`;
}
