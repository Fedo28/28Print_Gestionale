CREATE TYPE "BillboardAssetKind" AS ENUM ('CARTELLONE', 'MONITOR', 'VELA_ITINERANTE');

CREATE TABLE "BillboardAsset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BillboardAssetKind" NOT NULL DEFAULT 'CARTELLONE',
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillboardAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillboardBooking" (
    "id" TEXT NOT NULL,
    "billboardAssetId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "pdfFileName" TEXT,
    "pdfFilePath" TEXT,
    "pdfMimeType" TEXT,
    "pdfSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillboardBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillboardAsset_code_key" ON "BillboardAsset"("code");
CREATE INDEX "BillboardAsset_kind_active_idx" ON "BillboardAsset"("kind", "active");
CREATE INDEX "BillboardAsset_sortOrder_idx" ON "BillboardAsset"("sortOrder");
CREATE INDEX "BillboardBooking_billboardAssetId_startsAt_endsAt_idx" ON "BillboardBooking"("billboardAssetId", "startsAt", "endsAt");
CREATE INDEX "BillboardBooking_customerId_startsAt_idx" ON "BillboardBooking"("customerId", "startsAt");
CREATE INDEX "BillboardBooking_startsAt_idx" ON "BillboardBooking"("startsAt");
CREATE INDEX "BillboardBooking_endsAt_idx" ON "BillboardBooking"("endsAt");

ALTER TABLE "BillboardBooking"
ADD CONSTRAINT "BillboardBooking_billboardAssetId_fkey"
FOREIGN KEY ("billboardAssetId") REFERENCES "BillboardAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillboardBooking"
ADD CONSTRAINT "BillboardBooking_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
