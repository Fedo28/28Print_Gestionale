ALTER TABLE "OrderItem"
ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "OrderItem_orderId_deliveredAt_idx" ON "OrderItem"("orderId", "deliveredAt");
