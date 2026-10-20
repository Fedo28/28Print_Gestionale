-- Additive only. Apply exclusively to the isolated test database in Phase 2.
CREATE TYPE "PrintJobStatus" AS ENUM ('APPROVED', 'PREPARING', 'SENDING', 'DELIVERED', 'ERROR', 'NEEDS_REVIEW', 'PRINTED', 'CANCELLED');
CREATE TABLE "PrintBridge" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintBridge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintBridge_tokenHash_key" ON "PrintBridge"("tokenHash");
CREATE TABLE "PrintDestination" (
  "id" TEXT NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "printerName" TEXT NOT NULL,
  "profileKey" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "bridgeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintDestination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrintDestination_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "PrintBridge"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrintDestination_key_key" ON "PrintDestination"("key");
CREATE TABLE "PrintJob" (
  "id" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "orderId" TEXT NOT NULL, "attachmentId" TEXT NOT NULL,
  "orderCode" TEXT NOT NULL, "fileName" TEXT NOT NULL, "sourcePath" TEXT NOT NULL, "fileSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL, "pageCount" INTEGER NOT NULL, "profileKey" TEXT NOT NULL, "destinationId" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL, "approvedByName" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reprintOfId" TEXT, "reason" TEXT NOT NULL DEFAULT '',
  "status" "PrintJobStatus" NOT NULL DEFAULT 'APPROVED', "claimToken" TEXT, "claimedById" TEXT,
  "leaseExpiresAt" TIMESTAMP(3), "dispatchId" TEXT, "sendingAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3),
  "printedAt" TIMESTAMP(3), "printedById" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT NOT NULL DEFAULT '', "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrintJob_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "PrintDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrintJob_requestKey_key" ON "PrintJob"("requestKey");
CREATE INDEX "PrintJob_status_approvedAt_idx" ON "PrintJob"("status", "approvedAt");
CREATE INDEX "PrintJob_orderId_approvedAt_idx" ON "PrintJob"("orderId", "approvedAt");
CREATE INDEX "PrintJob_claimedById_status_idx" ON "PrintJob"("claimedById", "status");
CREATE TABLE "PrintJobEvent" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "key" TEXT NOT NULL, "type" TEXT NOT NULL,
  "detail" TEXT NOT NULL, "actorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintJobEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrintJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PrintJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrintJobEvent_key_key" ON "PrintJobEvent"("key");
CREATE INDEX "PrintJobEvent_jobId_createdAt_idx" ON "PrintJobEvent"("jobId", "createdAt");
