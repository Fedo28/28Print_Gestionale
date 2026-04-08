CREATE TYPE "BillboardBookingStatus" AS ENUM ('OPZIONATO', 'CONFERMATO', 'SCADUTO');

ALTER TABLE "BillboardBooking"
ADD COLUMN "status" "BillboardBookingStatus" NOT NULL DEFAULT 'CONFERMATO',
ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paidCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "balanceDueCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "BillboardBooking"
SET "balanceDueCents" = GREATEST("priceCents" - "paidCents", 0);

CREATE INDEX "BillboardBooking_status_startsAt_idx" ON "BillboardBooking"("status", "startsAt");
