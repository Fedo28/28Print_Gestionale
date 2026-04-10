ALTER TABLE "Customer"
ADD COLUMN "pec" TEXT,
ADD COLUMN "uniqueCode" TEXT;

CREATE INDEX "Customer_pec_idx" ON "Customer"("pec");
CREATE INDEX "Customer_uniqueCode_idx" ON "Customer"("uniqueCode");
