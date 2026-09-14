import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { hashPassword } from "../lib/auth-core";
import { formatDateKey } from "../lib/format";
import { normalizeForUniqueness } from "../lib/orders";
import { prisma } from "../lib/prisma";
import { buildCatalogServicePricingSnapshot, quoteCatalogService } from "../lib/domain/pricing/service-pricing";
import {
  SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS,
  SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS,
  buildShopDocumentBundleDetailedSummary,
  buildShopDocumentBundleOverview,
  normalizeShopDocumentBundle,
  type ShopDocumentConfigurationInput
} from "../lib/shop-print-config";

const demoAccountEmail = "demo.shop@28print.it";
const demoPassword = "DemoShop2026!";
const demoCustomerName = "Cliente Demo Shop";
const projectRoot = process.cwd();
const privateShopRoot = path.join(projectRoot, ".shop-private");
const remoteDemoConfirmation = "local-demo";

type DemoOrder = {
  code: string;
  title: string;
  note?: string;
  invoiceRequested?: boolean;
  billingDetails?: {
    fullName?: string;
    companyName?: string;
    taxCode?: string;
    vatNumber?: string;
    sdiCode?: string;
    pec?: string;
    addressLine1: string;
    postalCode: string;
    city: string;
    province: string;
    phone?: string;
  };
  documents: ShopDocumentConfigurationInput[];
};

const demoOrders: DemoOrder[] = [
  {
    code: "SHOP-DEMO-01",
    title: "Dispense corso B/N",
    note: "Ritiro in negozio appena pronto.",
    documents: [
      {
        id: "dispense-corso",
        name: "dispense-corso-storia.pdf",
        copies: 1,
        pages: 24,
        format: "A4",
        colorMode: "BLACK_WHITE",
        sidesMode: "FRONT_ONLY",
        paperType: "USOMANO",
        paperStock: "USOMANO_80",
        binding: "NONE"
      }
    ]
  },
  {
    code: "SHOP-DEMO-02",
    title: "Materiale tesi e slide",
    note: "La tesi va rilegata, le slide restano sciolte.",
    documents: [
      {
        id: "tesi",
        name: "tesi-finale.pdf",
        copies: 2,
        pages: 86,
        format: "A4",
        colorMode: "BLACK_WHITE",
        sidesMode: "DOUBLE_SIDED",
        paperType: "USOMANO",
        paperStock: "USOMANO_100",
        binding: "SPIRAL"
      },
      {
        id: "slide",
        name: "slide-presentazione.pdf",
        copies: 1,
        pages: 12,
        format: "A3",
        colorMode: "COLOR",
        sidesMode: "FRONT_ONLY",
        paperType: "PATINATA_LUCIDA",
        paperStock: "PATINATA_LUCIDA_170",
        binding: "NONE"
      }
    ]
  },
  {
    code: "SHOP-DEMO-03",
    title: "Pratica aziendale con fattura",
    invoiceRequested: true,
    note: "Serve fattura intestata all'azienda.",
    billingDetails: {
      companyName: "Demo Studio SRL",
      fullName: "Demo Studio SRL",
      taxCode: "12345678901",
      vatNumber: "12345678901",
      sdiCode: "M5UXCR1",
      pec: "demo.studio@pec.it",
      addressLine1: "Via Roma 28",
      postalCode: "00100",
      city: "Roma",
      province: "RM",
      phone: "+39 06 1234567"
    },
    documents: [
      {
        id: "pratica",
        name: "pratica-azienda.pdf",
        copies: 1,
        pages: 7,
        format: "A4",
        colorMode: "COLOR",
        sidesMode: "DOUBLE_SIDED",
        paperType: "USOMANO",
        paperStock: "USOMANO_80",
        binding: "STAPLED"
      }
    ]
  }
];

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildDemoFileBuffer(fileName: string, pages: number) {
  return Buffer.from(`28Print demo file\n${fileName}\nPagine dichiarate: ${pages}\n`, "utf8");
}

function assertDemoSeedCanWrite() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const isRemoteDatabase =
    /neon\.tech|supabase\.co|amazonaws\.com|render\.com|railway\.app|vercel-storage\.com/i.test(databaseUrl) ||
    (!/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(databaseUrl) && /^postgres/i.test(databaseUrl));

  if (isRemoteDatabase && process.env.SHOP_DEMO_SEED_CONFIRM !== remoteDemoConfirmation) {
    throw new Error(
      `Seed demo bloccato: il database non sembra locale. Per forzare consapevolmente imposta SHOP_DEMO_SEED_CONFIRM="${remoteDemoConfirmation}".`
    );
  }
}

async function writeDemoPrivateFile(storageKey: string, fileName: string, pages: number) {
  const absolutePath = path.join(privateShopRoot, storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = buildDemoFileBuffer(fileName, pages);
  await writeFile(absolutePath, buffer);

  return {
    buffer,
    storagePath: path.relative(projectRoot, absolutePath).split(path.sep).join("/")
  };
}

async function removeExistingDemoData() {
  const salesOrderCodes = demoOrders.map((order) => order.code);
  const internalOrderCodes = demoOrders.map((order) => `${order.code}-GEST`);
  const existingFileAssets = await prisma.fileAsset.findMany({
    where: {
      storageKey: {
        startsWith: "shop-demo/"
      }
    },
    select: {
      id: true
    }
  });

  await prisma.salesOrder.deleteMany({
    where: {
      orderCode: {
        in: salesOrderCodes
      }
    }
  });
  await prisma.order.deleteMany({
    where: {
      orderCode: {
        in: internalOrderCodes
      }
    }
  });

  if (existingFileAssets.length > 0) {
    await prisma.fileAsset.deleteMany({
      where: {
        id: {
          in: existingFileAssets.map((file) => file.id)
        }
      }
    });
  }
}

async function ensureDemoService() {
  return prisma.serviceCatalog.upsert({
    where: {
      code: "SHOP_STAMPA_DOCUMENTI_DEMO"
    },
    update: {
      name: "Stampa documenti",
      description: "Servizio demo per ordini shop",
      basePriceCents: SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS,
      quantityTiers: SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS,
      active: true,
      onlineActive: true,
      shopSortOrder: -10
    },
    create: {
      code: "SHOP_STAMPA_DOCUMENTI_DEMO",
      name: "Stampa documenti",
      description: "Servizio demo per ordini shop",
      basePriceCents: SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS,
      quantityTiers: SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS,
      active: true,
      onlineActive: true,
      shopSortOrder: -10
    }
  });
}

async function ensureDemoAccount() {
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      email: demoAccountEmail
    },
    orderBy: {
      createdAt: "asc"
    }
  });
  const customer = existingCustomer
    ? await prisma.customer.update({
        where: {
          id: existingCustomer.id
        },
        data: {
          name: demoCustomerName,
          type: "PUBBLICO",
          phone: "+39 333 280 2800",
          whatsapp: "+39 333 280 2800"
        }
      })
    : await prisma.customer.create({
        data: {
          name: demoCustomerName,
          type: "PUBBLICO",
          phone: "+39 333 280 2800",
          whatsapp: "+39 333 280 2800",
          email: demoAccountEmail
        }
      });

  const account = await prisma.customerAccount.upsert({
    where: {
      emailNormalized: demoAccountEmail
    },
    update: {
      customerId: customer.id,
      email: demoAccountEmail,
      passwordHash: hashPassword(demoPassword),
      status: "ACTIVE"
    },
    create: {
      customerId: customer.id,
      email: demoAccountEmail,
      emailNormalized: demoAccountEmail,
      passwordHash: hashPassword(demoPassword),
      status: "ACTIVE"
    }
  });

  return { account, customer };
}

async function createDemoOrder(input: {
  accountId: string;
  customerId: string;
  demoOrder: DemoOrder;
  index: number;
  service: Awaited<ReturnType<typeof ensureDemoService>>;
}) {
  const documentBundle = normalizeShopDocumentBundle({ documents: input.demoOrder.documents });
  const quantity = documentBundle.totalPrintUnits;
  const quote = quoteCatalogService({ service: input.service, quantity });
  const pricingSnapshot = buildCatalogServicePricingSnapshot({ service: input.service, quantity });
  const documentBundleOverview = buildShopDocumentBundleOverview(documentBundle);
  const documentBundleSummary = buildShopDocumentBundleDetailedSummary(documentBundle);
  const createdAt = new Date(Date.now() - (demoOrders.length - input.index) * 60 * 60 * 1000);
  const deliveryAt = new Date(Date.now() + (input.index + 1) * 24 * 60 * 60 * 1000);

  const salesOrder = await prisma.salesOrder.create({
    data: {
      customerId: input.customerId,
      customerAccountId: input.accountId,
      orderCode: input.demoOrder.code,
      status: "PENDING_PAYMENT",
      origin: "SHOP_ONLINE",
      currency: "EUR",
      invoiceRequested: Boolean(input.demoOrder.invoiceRequested),
      subtotalCents: quote.lineTotalCents,
      totalCents: quote.lineTotalCents,
      notes: input.demoOrder.note,
      placedAt: createdAt,
      createdAt,
      items: {
        create: {
          serviceCatalogId: input.service.id,
          label: "Stampa documenti",
          description: documentBundleOverview,
          quantity: quote.quantity,
          configuration: toJson({
            source: "shop_demo",
            sourcePath: "/shop/stampa-documenti",
            serviceSlug: "stampa-documenti",
            printConfiguration: documentBundle.documents[0],
            documentBundle,
            documentBundleOverview,
            documentBundleSummary,
            printConfigurationSummary: documentBundleSummary
          }),
          pricingSnapshot: toJson(pricingSnapshot),
          unitPriceCents: quote.unitPriceCents,
          lineTotalCents: quote.lineTotalCents,
          createJobAutomaticallyResolved: true
        }
      },
      billingSnapshot: input.demoOrder.invoiceRequested
        ? {
            create: {
              kind: "BUSINESS",
              fullName: input.demoOrder.billingDetails?.fullName,
              companyName: input.demoOrder.billingDetails?.companyName,
              taxCode: input.demoOrder.billingDetails?.taxCode,
              vatNumber: input.demoOrder.billingDetails?.vatNumber,
              sdiCode: input.demoOrder.billingDetails?.sdiCode,
              pec: input.demoOrder.billingDetails?.pec,
              addressLine1: input.demoOrder.billingDetails?.addressLine1,
              postalCode: input.demoOrder.billingDetails?.postalCode,
              city: input.demoOrder.billingDetails?.city,
              province: input.demoOrder.billingDetails?.province,
              country: "Italia",
              phone: input.demoOrder.billingDetails?.phone,
              rawJson: toJson({ demo: true })
            }
          }
        : undefined,
      payments: {
        create: {
          amountCents: quote.lineTotalCents,
          currency: "EUR",
          status: "CREATED"
        }
      }
    },
    include: {
      items: true
    }
  });

  const salesOrderItem = salesOrder.items[0];
  if (!salesOrderItem) {
    throw new Error("Riga demo shop non creata.");
  }

  for (const document of documentBundle.documents) {
    const storageKey = `shop-demo/${salesOrder.orderCode}/${document.name}`;
    const stored = await writeDemoPrivateFile(storageKey, document.name, document.pages);
    const fileAsset = await prisma.fileAsset.create({
      data: {
        ownerCustomerId: input.customerId,
        uploadedByCustomerAccountId: input.accountId,
        originalName: document.name,
        mimeType: document.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg",
        fileSize: stored.buffer.byteLength,
        storageProvider: "local-private",
        storageKey,
        storagePath: stored.storagePath,
        visibility: "PRIVATE",
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      }
    });

    await prisma.salesOrderItemFile.create({
      data: {
        salesOrderItemId: salesOrderItem.id,
        fileAssetId: fileAsset.id
      }
    });
  }

  const internalTitle = `Shop online - ${input.demoOrder.title}`;
  const internalOrder = await prisma.order.create({
    data: {
      customerId: input.customerId,
      orderCode: `${input.demoOrder.code}-GEST`,
      title: internalTitle,
      titleNormalized: normalizeForUniqueness(internalTitle),
      createdOn: formatDateKey(createdAt),
      createdAt,
      deliveryAt,
      priority: input.index === 2 ? "ALTA" : "MEDIA",
      mainPhase: "ACCETTATO",
      operationalStatus: "ATTIVO",
      paymentStatus: "NON_PAGATO",
      invoiceStatus: input.demoOrder.invoiceRequested ? "DA_FATTURARE" : "NON_RICHIESTO",
      totalCents: quote.lineTotalCents,
      balanceDueCents: quote.lineTotalCents,
      notes: input.demoOrder.note ? `Nota cliente shop:\n${input.demoOrder.note}` : undefined,
      items: {
        create: {
          serviceCatalogId: input.service.id,
          label: "Stampa documenti shop",
          description: documentBundleOverview,
          quantity: quote.quantity,
          catalogBasePriceCents: quote.catalogBasePriceCents,
          unitPriceCents: quote.unitPriceCents,
          lineTotalCents: quote.lineTotalCents,
          format: "Documenti",
          material: "Da file cliente",
          finishing: documentBundleSummary
        }
      },
      history: {
        create: {
          type: "CREATED",
          description: "Ordine demo shop creato"
        }
      }
    }
  });

  await prisma.salesOrderJobLink.create({
    data: {
      salesOrderId: salesOrder.id,
      salesOrderItemId: salesOrderItem.id,
      orderId: internalOrder.id,
      reason: "MANUAL"
    }
  });

  return {
    internalOrderId: internalOrder.id,
    salesOrderId: salesOrder.id
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Lo seed demo shop non puo essere eseguito in produzione.");
  }

  if (process.argv.includes("--dry-run")) {
    console.log("Seed demo shop pronto.");
    console.log(`Account: ${demoAccountEmail}`);
    console.log(`Password: ${demoPassword}`);
    console.log(`Ordini demo: ${demoOrders.map((order) => order.code).join(", ")}`);
    return;
  }

  assertDemoSeedCanWrite();
  await removeExistingDemoData();
  const service = await ensureDemoService();
  const { account, customer } = await ensureDemoAccount();
  const created = [];

  for (const [index, demoOrder] of demoOrders.entries()) {
    created.push(
      await createDemoOrder({
        accountId: account.id,
        customerId: customer.id,
        demoOrder,
        index,
        service
      })
    );
  }

  console.log("Seed demo shop completato.");
  console.log(`Account cliente: ${demoAccountEmail}`);
  console.log(`Password: ${demoPassword}`);
  console.log(`Ordini shop creati: ${created.map((entry) => entry.salesOrderId).join(", ")}`);
  console.log(`Ordini gestionali collegati: ${created.map((entry) => entry.internalOrderId).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
