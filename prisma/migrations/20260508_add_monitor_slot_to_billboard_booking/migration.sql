ALTER TABLE "BillboardBooking"
ADD COLUMN "monitorSlot" INTEGER;

CREATE INDEX "BillboardBooking_billboardAssetId_monitorSlot_startsAt_endsAt_idx"
ON "BillboardBooking"("billboardAssetId", "monitorSlot", "startsAt", "endsAt");
