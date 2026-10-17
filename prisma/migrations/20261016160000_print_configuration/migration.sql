-- Additive: keep legacy destination identity and profileKey, never change jobs or their request keys.
CREATE TABLE "PrintPrinter" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "preferredFor" TEXT NOT NULL DEFAULT 'NONE',
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintPrinter_preference_check" CHECK ("preferredFor" IN ('NONE', 'BW', 'COLOR'))
);
CREATE TABLE "PrintProfile" (
  "id" TEXT PRIMARY KEY, "key" TEXT NOT NULL, "name" TEXT NOT NULL,
  "paperSize" TEXT NOT NULL, "colorMode" TEXT NOT NULL, "sides" TEXT NOT NULL,
  "copies" INTEGER NOT NULL DEFAULT 1, "paperStock" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintProfile_properties_check" CHECK ("paperSize" IN ('A4', 'A3') AND "colorMode" IN ('BW', 'COLOR') AND "sides" IN ('SIMPLEX', 'DUPLEX_LONG', 'DUPLEX_SHORT') AND "copies" BETWEEN 1 AND 999)
);
CREATE UNIQUE INDEX "PrintProfile_key_key" ON "PrintProfile"("key");
ALTER TABLE "PrintDestination" ADD COLUMN "printerId" TEXT, ADD COLUMN "profileId" TEXT;
ALTER TABLE "PrintDestination" ADD CONSTRAINT "PrintDestination_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "PrintPrinter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintDestination" ADD CONSTRAINT "PrintDestination_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PrintProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "PrintProfile" ("id", "key", "name", "paperSize", "colorMode", "sides")
VALUES ('bridge-profile-legacy-a4', 'A4_BW_SIMPLEX_1_HOLD_V1', 'A4 B/N · solo fronte · 1 copia · attesa', 'A4', 'BW', 'SIMPLEX');
INSERT INTO "PrintPrinter" ("id", "name")
SELECT DISTINCT 'printer-' || md5("printerName"), "printerName" FROM "PrintDestination";
UPDATE "PrintDestination" SET "printerId" = 'printer-' || md5("printerName"),
  "profileId" = CASE WHEN "profileKey" = 'A4_BW_SIMPLEX_1_HOLD_V1' THEN 'bridge-profile-legacy-a4' ELSE NULL END;
-- Unknown historical profiles stay unlinked and cannot be approved/claimed by the new server.
