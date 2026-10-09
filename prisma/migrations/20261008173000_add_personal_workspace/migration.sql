-- CreateEnum
CREATE TYPE "WorkTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "PersonalNoteColor" AS ENUM ('YELLOW', 'BLUE', 'GREEN', 'PINK');

-- CreateTable
CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "claimKey" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'OPEN',
    "scheduledDate" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkTaskCollaborator" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTaskCollaborator_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "PersonalNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "color" "PersonalNoteColor" NOT NULL DEFAULT 'YELLOW',
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkTask_claimKey_key" ON "WorkTask"("claimKey");

-- CreateIndex
CREATE INDEX "WorkTask_ownerId_archivedAt_scheduledDate_idx" ON "WorkTask"("ownerId", "archivedAt", "scheduledDate");

-- CreateIndex
CREATE INDEX "WorkTask_orderId_status_idx" ON "WorkTask"("orderId", "status");

-- CreateIndex
CREATE INDEX "WorkTask_archivedAt_scheduledDate_idx" ON "WorkTask"("archivedAt", "scheduledDate");

-- CreateIndex
CREATE INDEX "WorkTaskCollaborator_userId_idx" ON "WorkTaskCollaborator"("userId");

-- CreateIndex
CREATE INDEX "PersonalNote_userId_archivedAt_position_idx" ON "PersonalNote"("userId", "archivedAt", "position");

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskCollaborator" ADD CONSTRAINT "WorkTaskCollaborator_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTaskCollaborator" ADD CONSTRAINT "WorkTaskCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

