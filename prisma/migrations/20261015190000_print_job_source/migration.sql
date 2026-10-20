-- Preserve existing print jobs and their request keys while allowing future
-- WhatsApp and Shop documents to share the same approved dispatch queue.
CREATE TYPE "PrintSourceType" AS ENUM ('ORDER_ATTACHMENT', 'SHOP_FILE', 'WHATSAPP_MEDIA', 'INTERNAL_DOCUMENT');
ALTER TABLE "PrintJob" ADD COLUMN "sourceType" "PrintSourceType" NOT NULL DEFAULT 'ORDER_ATTACHMENT';
ALTER TABLE "PrintJob" ADD COLUMN "sourceId" TEXT;
UPDATE "PrintJob" SET "sourceId" = "attachmentId" WHERE "sourceId" IS NULL;
ALTER TABLE "PrintJob" ALTER COLUMN "sourceId" SET NOT NULL;
ALTER TABLE "PrintJob" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "PrintJob" ALTER COLUMN "attachmentId" DROP NOT NULL;
CREATE INDEX "PrintJob_sourceType_sourceId_approvedAt_idx" ON "PrintJob"("sourceType", "sourceId", "approvedAt");
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_order_source_check"
  CHECK ("sourceType" <> 'ORDER_ATTACHMENT' OR ("orderId" IS NOT NULL AND "attachmentId" IS NOT NULL AND "sourceId" = "attachmentId"));
