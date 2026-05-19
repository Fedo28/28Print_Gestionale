-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('ORDER', 'CUSTOMER', 'PURCHASE_NOTE', 'BILLBOARD_BOOKING', 'SERVICE_CATALOG', 'APP_SETTING', 'STAFF_USER');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'COMPLETED', 'REOPENED');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "actionType" "AuditActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "snapshotBefore" JSONB,
    "snapshotAfter" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
