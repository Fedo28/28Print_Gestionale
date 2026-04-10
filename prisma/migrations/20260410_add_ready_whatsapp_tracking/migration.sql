ALTER TABLE "Order"
ADD COLUMN "readyWhatsappSentAt" TIMESTAMP(3);

CREATE INDEX "Order_readyWhatsappSentAt_idx" ON "Order"("readyWhatsappSentAt");
