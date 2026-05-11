-- AlterTable
ALTER TABLE "OrderHistory"
ADD COLUMN "snapshotBefore" JSONB,
ADD COLUMN "snapshotAfter" JSONB;
