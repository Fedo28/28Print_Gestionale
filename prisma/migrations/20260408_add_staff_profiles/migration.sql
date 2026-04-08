ALTER TABLE "User"
ADD COLUMN "nickname" TEXT,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "invitePreparedAt" TIMESTAMP(3),
ADD COLUMN "inviteSentAt" TIMESTAMP(3);

UPDATE "User"
SET "nickname" = LOWER(SPLIT_PART("email", '@', 1))
WHERE "nickname" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "nickname" SET NOT NULL;

CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");
