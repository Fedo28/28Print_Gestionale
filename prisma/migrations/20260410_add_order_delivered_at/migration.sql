ALTER TABLE "Order"
ADD COLUMN "deliveredAt" TIMESTAMP(3);

UPDATE "Order" AS o
SET "deliveredAt" = COALESCE(
  (
    SELECT MAX(h."createdAt")
    FROM "OrderHistory" AS h
    WHERE h."orderId" = o."id"
      AND h."type" = 'PHASE_CHANGED'
      AND h."description" = 'Fase ordine aggiornata a Consegnato'
  ),
  o."updatedAt"
)
WHERE o."mainPhase" = 'CONSEGNATO'
  AND o."deliveredAt" IS NULL;

CREATE INDEX "Order_deliveredAt_idx" ON "Order"("deliveredAt");
