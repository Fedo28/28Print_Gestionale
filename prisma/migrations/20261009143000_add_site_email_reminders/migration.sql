-- CreateEnum
CREATE TYPE "SiteEmailReminderStatus" AS ENUM ('SENDING', 'SENT', 'FAILED', 'UNKNOWN', 'CANCELLED');

-- AlterTable
ALTER TABLE "ManagedSite" ADD COLUMN     "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "renewalEmail" TEXT;

-- CreateTable
CREATE TABLE "SiteEmailReminder" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "status" "SiteEmailReminderStatus" NOT NULL DEFAULT 'SENDING',
    "recipient" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteEmailReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteEmailReminder_status_createdAt_idx" ON "SiteEmailReminder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteEmailReminder_serviceId_dueDate_key" ON "SiteEmailReminder"("serviceId", "dueDate");

-- AddForeignKey
ALTER TABLE "SiteEmailReminder" ADD CONSTRAINT "SiteEmailReminder_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SiteService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

