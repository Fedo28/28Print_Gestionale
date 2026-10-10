-- CreateEnum
CREATE TYPE "SiteServiceKind" AS ENUM ('HOSTING', 'DOMAIN');

-- CreateEnum
CREATE TYPE "SiteDomainRenewalMode" AS ENUM ('UNKNOWN', 'TOGETHER', 'SEPARATE');

-- CreateTable
CREATE TABLE "ManagedSite" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "customerId" TEXT,
    "domainRenewalMode" "SiteDomainRenewalMode" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteService" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "SiteServiceKind" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "renewalDay" INTEGER,
    "renewalMonth" INTEGER,
    "renewalYear" INTEGER,
    "costCents" INTEGER,
    "autoRenew" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteRenewal" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "previousDueLabel" TEXT NOT NULL,
    "includesDomain" BOOLEAN NOT NULL DEFAULT false,
    "nextDueDate" TEXT NOT NULL,
    "renewedOn" TEXT NOT NULL,
    "costCents" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSite_hostname_key" ON "ManagedSite"("hostname");

-- CreateIndex
CREATE INDEX "ManagedSite_customerId_archivedAt_idx" ON "ManagedSite"("customerId", "archivedAt");

-- CreateIndex
CREATE INDEX "SiteService_renewalYear_renewalMonth_renewalDay_idx" ON "SiteService"("renewalYear", "renewalMonth", "renewalDay");

-- CreateIndex
CREATE UNIQUE INDEX "SiteService_siteId_kind_key" ON "SiteService"("siteId", "kind");

-- CreateIndex
CREATE INDEX "SiteRenewal_serviceId_createdAt_idx" ON "SiteRenewal"("serviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "ManagedSite" ADD CONSTRAINT "ManagedSite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteService" ADD CONSTRAINT "SiteService_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ManagedSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteRenewal" ADD CONSTRAINT "SiteRenewal_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "SiteService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteRenewal" ADD CONSTRAINT "SiteRenewal_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Initial hosting renewal dates supplied by the owner. No year or customer was supplied.
INSERT INTO "ManagedSite" ("id", "hostname", "updatedAt") VALUES
('initial-site-01', 'atlascentrospecialistico.it', CURRENT_TIMESTAMP),
('initial-site-02', 'gmcomposite.it', CURRENT_TIMESTAMP),
('initial-site-03', 'condosoluzioni.it', CURRENT_TIMESTAMP),
('initial-site-04', 'caffegaribaldi.it', CURRENT_TIMESTAMP),
('initial-site-05', 'ncclg.com', CURRENT_TIMESTAMP),
('initial-site-06', 'ediliziapiu.com', CURRENT_TIMESTAMP),
('initial-site-07', 'labottegadigiorgio.it', CURRENT_TIMESTAMP),
('initial-site-08', '28web.it', CURRENT_TIMESTAMP),
('initial-site-09', 'comegainfissi.it', CURRENT_TIMESTAMP),
('initial-site-10', 'autocarrozzeriapanetti.it', CURRENT_TIMESTAMP),
('initial-site-11', 'drsocialbroker.it', CURRENT_TIMESTAMP),
('initial-site-12', 'specialcatering.it', CURRENT_TIMESTAMP),
('initial-site-13', 'duectech.it', CURRENT_TIMESTAMP),
('initial-site-14', 'drsb.it', CURRENT_TIMESTAMP),
('initial-site-15', '28print.it', CURRENT_TIMESTAMP),
('initial-site-16', 'avvocatodisilvestro.it', CURRENT_TIMESTAMP),
('initial-site-17', 'lalternativaweb.it', CURRENT_TIMESTAMP),
('initial-site-18', 'trastoproject.com', CURRENT_TIMESTAMP);
INSERT INTO "SiteService" ("id", "siteId", "kind", "renewalDay", "renewalMonth", "renewalYear", "updatedAt") VALUES
('initial-hosting-01', 'initial-site-01', 'HOSTING', 7, 8, NULL, CURRENT_TIMESTAMP),
('initial-hosting-02', 'initial-site-02', 'HOSTING', 24, 2, NULL, CURRENT_TIMESTAMP),
('initial-hosting-03', 'initial-site-03', 'HOSTING', 5, 2, NULL, CURRENT_TIMESTAMP),
('initial-hosting-04', 'initial-site-04', 'HOSTING', 10, 2, NULL, CURRENT_TIMESTAMP),
('initial-hosting-05', 'initial-site-05', 'HOSTING', 30, 10, NULL, CURRENT_TIMESTAMP),
('initial-hosting-06', 'initial-site-06', 'HOSTING', 28, 5, NULL, CURRENT_TIMESTAMP),
('initial-hosting-07', 'initial-site-07', 'HOSTING', 23, 11, NULL, CURRENT_TIMESTAMP),
('initial-hosting-08', 'initial-site-08', 'HOSTING', 15, 11, NULL, CURRENT_TIMESTAMP),
('initial-hosting-09', 'initial-site-09', 'HOSTING', 23, 9, NULL, CURRENT_TIMESTAMP),
('initial-hosting-10', 'initial-site-10', 'HOSTING', 20, 10, NULL, CURRENT_TIMESTAMP),
('initial-hosting-11', 'initial-site-11', 'HOSTING', 3, 3, NULL, CURRENT_TIMESTAMP),
('initial-hosting-12', 'initial-site-12', 'HOSTING', 26, 5, NULL, CURRENT_TIMESTAMP),
('initial-hosting-13', 'initial-site-13', 'HOSTING', 5, 3, NULL, CURRENT_TIMESTAMP),
('initial-hosting-14', 'initial-site-14', 'HOSTING', 25, 3, NULL, CURRENT_TIMESTAMP),
('initial-hosting-15', 'initial-site-15', 'HOSTING', 11, 7, NULL, CURRENT_TIMESTAMP),
('initial-hosting-16', 'initial-site-16', 'HOSTING', 8, 11, NULL, CURRENT_TIMESTAMP),
('initial-hosting-17', 'initial-site-17', 'HOSTING', 7, 3, NULL, CURRENT_TIMESTAMP),
('initial-hosting-18', 'initial-site-18', 'HOSTING', 26, 3, NULL, CURRENT_TIMESTAMP);

ALTER TABLE "SiteService" ADD CONSTRAINT "SiteService_date_parts_check" CHECK (
  ("renewalDay" IS NULL AND "renewalMonth" IS NULL AND "renewalYear" IS NULL)
  OR ("renewalDay" IS NOT NULL AND "renewalMonth" IS NOT NULL AND "renewalDay" BETWEEN 1 AND 31 AND "renewalMonth" BETWEEN 1 AND 12 AND ("renewalYear" IS NULL OR "renewalYear" BETWEEN 1900 AND 2200))
);
ALTER TABLE "SiteService" ADD CONSTRAINT "SiteService_cost_check" CHECK ("costCents" IS NULL OR "costCents" >= 0);
