CREATE TYPE "CustomerAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "CustomerAddressType" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');
CREATE TYPE "BillingProfileKind" AS ENUM ('PRIVATE', 'BUSINESS', 'PROFESSIONAL');
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED', 'FULFILLED');
CREATE TYPE "SalesOrderOrigin" AS ENUM ('SHOP_ONLINE');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');
CREATE TYPE "PaymentRecordStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "FileAssetVisibility" AS ENUM ('PRIVATE', 'STAFF_ONLY');
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
CREATE TYPE "SalesOrderJobLinkReason" AS ENUM ('AUTO_PRODUCT_POLICY', 'INVOICE_REQUESTED', 'AUTO_PRODUCT_POLICY_AND_INVOICE_REQUESTED', 'MANUAL');

ALTER TABLE "ServiceCatalog"
ADD COLUMN "onlineActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onlineSlug" TEXT,
ADD COLUMN "createJobAutomatically" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shopSortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shopConfigurationSchema" JSONB,
ADD COLUMN "shopPricingSchema" JSONB,
ADD COLUMN "shopFilePolicy" JSONB,
ADD COLUMN "shopProductionPolicy" JSONB;

CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "CustomerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerAddressType" NOT NULL DEFAULT 'BOTH',
    "label" TEXT,
    "fullName" TEXT,
    "companyName" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "postalCode" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerBillingProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "BillingProfileKind" NOT NULL DEFAULT 'PRIVATE',
    "label" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "companyName" TEXT,
    "taxCode" TEXT,
    "vatNumber" TEXT,
    "sdiCode" TEXT,
    "pec" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerBillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "orderCode" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" "SalesOrderOrigin" NOT NULL DEFAULT 'SHOP_ONLINE',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "invoiceRequested" BOOLEAN NOT NULL DEFAULT false,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "extraCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "placedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "serviceCatalogId" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "configuration" JSONB,
    "pricingSnapshot" JSONB,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,
    "createJobAutomaticallyResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderBillingSnapshot" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "kind" "BillingProfileKind" NOT NULL DEFAULT 'PRIVATE',
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "companyName" TEXT,
    "taxCode" TEXT,
    "vatNumber" TEXT,
    "sdiCode" TEXT,
    "pec" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IT',
    "phone" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOrderBillingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "ownerCustomerId" TEXT NOT NULL,
    "uploadedByCustomerAccountId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storagePath" TEXT,
    "visibility" "FileAssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderItemFile" (
    "id" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderItemFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "providerCheckoutSessionId" TEXT,
    "providerPaymentIntentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentRecordStatus" NOT NULL DEFAULT 'CREATED',
    "paidAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "rawProviderSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "objectId" TEXT,
    "payloadJson" JSONB,
    "processingStatus" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderJobLink" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT,
    "orderId" TEXT NOT NULL,
    "reason" "SalesOrderJobLinkReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderJobLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payloadJson" JSONB,
    "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCatalog_onlineSlug_key" ON "ServiceCatalog"("onlineSlug");
CREATE UNIQUE INDEX "CustomerAccount_emailNormalized_key" ON "CustomerAccount"("emailNormalized");
CREATE UNIQUE INDEX "CustomerAccount_customerId_emailNormalized_key" ON "CustomerAccount"("customerId", "emailNormalized");
CREATE UNIQUE INDEX "SalesOrder_orderCode_key" ON "SalesOrder"("orderCode");
CREATE UNIQUE INDEX "SalesOrderBillingSnapshot_salesOrderId_key" ON "SalesOrderBillingSnapshot"("salesOrderId");
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE UNIQUE INDEX "SalesOrderItemFile_salesOrderItemId_fileAssetId_key" ON "SalesOrderItemFile"("salesOrderItemId", "fileAssetId");
CREATE UNIQUE INDEX "PaymentRecord_providerCheckoutSessionId_key" ON "PaymentRecord"("providerCheckoutSessionId");
CREATE UNIQUE INDEX "PaymentRecord_providerPaymentIntentId_key" ON "PaymentRecord"("providerPaymentIntentId");
CREATE UNIQUE INDEX "PaymentWebhookEvent_providerEventId_key" ON "PaymentWebhookEvent"("providerEventId");
CREATE UNIQUE INDEX "SalesOrderJobLink_salesOrderId_orderId_key" ON "SalesOrderJobLink"("salesOrderId", "orderId");
CREATE UNIQUE INDEX "DomainEvent_dedupeKey_key" ON "DomainEvent"("dedupeKey");

CREATE INDEX "CustomerAccount_customerId_status_idx" ON "CustomerAccount"("customerId", "status");
CREATE INDEX "CustomerAddress_customerId_type_isDefault_idx" ON "CustomerAddress"("customerId", "type", "isDefault");
CREATE INDEX "CustomerBillingProfile_customerId_kind_isDefault_idx" ON "CustomerBillingProfile"("customerId", "kind", "isDefault");
CREATE INDEX "SalesOrder_customerId_createdAt_idx" ON "SalesOrder"("customerId", "createdAt");
CREATE INDEX "SalesOrder_customerAccountId_createdAt_idx" ON "SalesOrder"("customerAccountId", "createdAt");
CREATE INDEX "SalesOrder_status_createdAt_idx" ON "SalesOrder"("status", "createdAt");
CREATE INDEX "SalesOrder_origin_createdAt_idx" ON "SalesOrder"("origin", "createdAt");
CREATE INDEX "SalesOrderItem_salesOrderId_createdAt_idx" ON "SalesOrderItem"("salesOrderId", "createdAt");
CREATE INDEX "SalesOrderItem_serviceCatalogId_idx" ON "SalesOrderItem"("serviceCatalogId");
CREATE INDEX "FileAsset_ownerCustomerId_createdAt_idx" ON "FileAsset"("ownerCustomerId", "createdAt");
CREATE INDEX "FileAsset_uploadedByCustomerAccountId_createdAt_idx" ON "FileAsset"("uploadedByCustomerAccountId", "createdAt");
CREATE INDEX "FileAsset_expiresAt_idx" ON "FileAsset"("expiresAt");
CREATE INDEX "SalesOrderItemFile_fileAssetId_idx" ON "SalesOrderItemFile"("fileAssetId");
CREATE INDEX "PaymentRecord_salesOrderId_status_createdAt_idx" ON "PaymentRecord"("salesOrderId", "status", "createdAt");
CREATE INDEX "PaymentWebhookEvent_provider_eventType_createdAt_idx" ON "PaymentWebhookEvent"("provider", "eventType", "createdAt");
CREATE INDEX "PaymentWebhookEvent_processingStatus_createdAt_idx" ON "PaymentWebhookEvent"("processingStatus", "createdAt");
CREATE INDEX "SalesOrderJobLink_salesOrderItemId_idx" ON "SalesOrderJobLink"("salesOrderItemId");
CREATE INDEX "SalesOrderJobLink_orderId_idx" ON "SalesOrderJobLink"("orderId");
CREATE INDEX "DomainEvent_topic_createdAt_idx" ON "DomainEvent"("topic", "createdAt");
CREATE INDEX "DomainEvent_status_createdAt_idx" ON "DomainEvent"("status", "createdAt");
CREATE INDEX "DomainEvent_entityType_entityId_createdAt_idx" ON "DomainEvent"("entityType", "entityId", "createdAt");

ALTER TABLE "CustomerAccount"
ADD CONSTRAINT "CustomerAccount_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerAddress"
ADD CONSTRAINT "CustomerAddress_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerBillingProfile"
ADD CONSTRAINT "CustomerBillingProfile_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrder"
ADD CONSTRAINT "SalesOrder_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesOrder"
ADD CONSTRAINT "SalesOrder_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrderItem"
ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderItem"
ADD CONSTRAINT "SalesOrderItem_serviceCatalogId_fkey"
FOREIGN KEY ("serviceCatalogId") REFERENCES "ServiceCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrderBillingSnapshot"
ADD CONSTRAINT "SalesOrderBillingSnapshot_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FileAsset"
ADD CONSTRAINT "FileAsset_ownerCustomerId_fkey"
FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FileAsset"
ADD CONSTRAINT "FileAsset_uploadedByCustomerAccountId_fkey"
FOREIGN KEY ("uploadedByCustomerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrderItemFile"
ADD CONSTRAINT "SalesOrderItemFile_salesOrderItemId_fkey"
FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderItemFile"
ADD CONSTRAINT "SalesOrderItemFile_fileAssetId_fkey"
FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord"
ADD CONSTRAINT "PaymentRecord_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderJobLink"
ADD CONSTRAINT "SalesOrderJobLink_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesOrderJobLink"
ADD CONSTRAINT "SalesOrderJobLink_salesOrderItemId_fkey"
FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesOrderJobLink"
ADD CONSTRAINT "SalesOrderJobLink_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
