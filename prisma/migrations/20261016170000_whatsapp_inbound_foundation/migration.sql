CREATE TABLE "WhatsAppInboundMessage" (
  "id" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "mediaId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppInboundMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppInboundMessage_kind_check" CHECK ("kind" IN ('text', 'document', 'image'))
);
CREATE UNIQUE INDEX "WhatsAppInboundMessage_phoneNumberId_providerMessageId_key" ON "WhatsAppInboundMessage"("phoneNumberId", "providerMessageId");
CREATE INDEX "WhatsAppInboundMessage_sender_sentAt_idx" ON "WhatsAppInboundMessage"("sender", "sentAt");
CREATE INDEX "WhatsAppInboundMessage_receivedAt_idx" ON "WhatsAppInboundMessage"("receivedAt");
