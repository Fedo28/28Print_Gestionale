ALTER TYPE "OperationalStatus" ADD VALUE IF NOT EXISTS 'IN_ATTESA_MATERIALE';

ALTER TABLE "PurchaseNote"
ADD COLUMN "orderId" TEXT;

ALTER TABLE "PurchaseNote"
ADD CONSTRAINT "PurchaseNote_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "PurchaseNote_orderId_idx" ON "PurchaseNote"("orderId");
