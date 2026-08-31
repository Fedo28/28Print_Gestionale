import {
  DEFAULT_SHOP_PUBLIC_BASE_URL,
  salesOrderOrigins,
  salesOrderStatuses
} from "@/lib/domain/commerce/shop-foundation";

export const shopFoundationProgressCards = [
  {
    title: "Subdomain target",
    value: DEFAULT_SHOP_PUBLIC_BASE_URL,
    detail: "Confermato come destinazione pubblica finale dello shop."
  },
  {
    title: "Approccio",
    value: "Foundation additiva",
    detail: "Nessun refactoring distruttivo del gestionale nella prima fase."
  },
  {
    title: "Ordine shop",
    value: "SalesOrder separato",
    detail: "Distinto dall'attuale Order operativo del gestionale."
  },
  {
    title: "File di stampa",
    value: "Privati + tracciati",
    detail: "Base pronta per FileAsset, retention e collegamento a righe ordine."
  }
] as const;

export const shopFoundationModuleCards = [
  {
    title: "Catalog",
    path: "lib/domain/catalog/service-catalog.ts",
    detail: "Risoluzione dei codici servizio e della modalita prezzo condivisa."
  },
  {
    title: "Pricing",
    path: "lib/domain/pricing/service-pricing.ts",
    detail: "Quote riusabili lato server con snapshot pronti per ordini e checkout."
  },
  {
    title: "Files",
    path: "lib/domain/files/shop-file-assets.ts",
    detail: "Policy iniziale PDF/JPG, retention e storage key del dominio shop."
  },
  {
    title: "Commerce",
    path: "lib/domain/commerce/shop-foundation.ts",
    detail: "Stati ordine shop, base URL e regole di creazione commessa."
  }
] as const;

export const shopFoundationDatabaseBlocks = [
  {
    title: "Identity",
    items: ["CustomerAccount", "CustomerAddress", "CustomerBillingProfile"]
  },
  {
    title: "Commerce core",
    items: ["SalesOrder", "SalesOrderItem", "SalesOrderBillingSnapshot"]
  },
  {
    title: "Files & payments",
    items: ["FileAsset", "SalesOrderItemFile", "PaymentRecord", "PaymentWebhookEvent"]
  },
  {
    title: "Operations",
    items: ["SalesOrderJobLink", "DomainEvent"]
  }
] as const;

export const shopFoundationPlannedRoutes = [
  "shop.28print.it/",
  "shop.28print.it/stampa-documenti",
  "shop.28print.it/account/login",
  "shop.28print.it/cart",
  "shop.28print.it/checkout",
  "shop.28print.it/orders/:id"
] as const;

export const shopFoundationNextSteps = [
  "Generare Prisma Client dopo l'applicazione della migrazione.",
  "Introdurre CustomerAccount e il primo flow di registrazione/login cliente.",
  "Creare SalesOrder e SalesOrderItem con stato PENDING_PAYMENT.",
  "Aprire il primo skeleton pubblico del configuratore stampa documenti.",
  "Integrare l'upload privato e il collegamento file -> riga ordine.",
  "Preparare il webhook Stripe idempotente."
] as const;

export const shopFoundationStatusSummary = {
  salesOrderStatuses,
  salesOrderOrigins
} as const;
