-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PUBBLICO', 'AZIENDA');

-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "type" "CustomerType" NOT NULL DEFAULT 'PUBBLICO';

-- Backfill
UPDATE "Customer"
SET "type" = 'AZIENDA'
WHERE COALESCE("vatNumber", '') <> '';

-- CreateIndex
CREATE INDEX "Customer_type_idx" ON "Customer"("type");
