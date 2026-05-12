CREATE TABLE "PurchaseNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseNote_completedAt_createdAt_idx" ON "PurchaseNote"("completedAt", "createdAt");
CREATE INDEX "PurchaseNote_customerId_idx" ON "PurchaseNote"("customerId");

ALTER TABLE "PurchaseNote"
ADD CONSTRAINT "PurchaseNote_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
