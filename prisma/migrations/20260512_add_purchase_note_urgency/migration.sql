CREATE TYPE "PurchaseNoteUrgency" AS ENUM ('NORMALE', 'URGENTE', 'BLOCCANTE');

ALTER TABLE "PurchaseNote"
ADD COLUMN "urgency" "PurchaseNoteUrgency" NOT NULL DEFAULT 'NORMALE';
