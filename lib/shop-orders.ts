import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import {
  resolveSalesOrderItemJobCreationReason,
  shouldCreateSalesOrderItemJob,
  type SalesOrderBillingPartyKind
} from "@/lib/domain/commerce/shop-foundation";
import { buildCatalogServicePricingSnapshot, quoteCatalogService } from "@/lib/domain/pricing/service-pricing";
import { formatDateKey } from "@/lib/format";
import { buildOrderCode, normalizeForUniqueness } from "@/lib/orders";
import { computeAutomaticPriority } from "@/lib/priorities";
import { normalizeQuantityValue } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { sendShopOnlineOrderPushNotification } from "@/lib/push-notifications";
import { getShopServiceByIdForOrderCreation } from "@/lib/shop-catalog";
import { customerShopSalesOrderItemFileSelect } from "@/lib/shop-order-files";
import {
  buildShopDocumentBundleDetailedSummary,
  buildShopDocumentBundleOverview,
  buildShopPrintConfigurationSummary,
  normalizeShopDocumentBundle,
  normalizeShopPrintConfiguration,
  resolveShopDocumentPreviewPricing,
  type ShopDocumentBundleInput,
  type ShopPrintConfiguration
} from "@/lib/shop-print-config";

const customerShopOrderListSelect = {
  id: true,
  orderCode: true,
  status: true,
  currency: true,
  invoiceRequested: true,
  totalCents: true,
  placedAt: true,
  createdAt: true,
  items: {
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      quantity: true,
      lineTotalCents: true
    }
  },
  payments: {
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      createdAt: true
    }
  }
} satisfies Prisma.SalesOrderSelect;

const customerShopOrderDetailSelect = {
  id: true,
  orderCode: true,
  status: true,
  origin: true,
  currency: true,
  invoiceRequested: true,
  subtotalCents: true,
  discountCents: true,
  extraCents: true,
  totalCents: true,
  notes: true,
  placedAt: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true
    }
  },
  billingSnapshot: {
    select: {
      kind: true,
      firstName: true,
      lastName: true,
      fullName: true,
      companyName: true,
      taxCode: true,
      vatNumber: true,
      sdiCode: true,
      pec: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      province: true,
      country: true,
      phone: true,
      rawJson: true
    }
  },
  items: {
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      description: true,
      quantity: true,
      configuration: true,
      pricingSnapshot: true,
      unitPriceCents: true,
      lineTotalCents: true,
      createJobAutomaticallyResolved: true,
      serviceCatalog: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true
        }
      },
      files: {
        orderBy: [{ createdAt: "asc" }],
        select: customerShopSalesOrderItemFileSelect
      }
    }
  },
  payments: {
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      provider: true,
      providerCheckoutSessionId: true,
      providerPaymentIntentId: true,
      amountCents: true,
      currency: true,
      status: true,
      paidAt: true,
      failureCode: true,
      failureMessage: true,
      createdAt: true,
      updatedAt: true
    }
  },
  jobLinks: {
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      orderId: true,
      reason: true,
      order: {
        select: {
          id: true,
          orderCode: true,
          title: true
        }
      }
    }
  }
} satisfies Prisma.SalesOrderSelect;

export type CustomerShopOrderListEntry = Prisma.SalesOrderGetPayload<{
  select: typeof customerShopOrderListSelect;
}>;

export type CustomerShopOrderDetail = Prisma.SalesOrderGetPayload<{
  select: typeof customerShopOrderDetailSelect;
}>;

type ShopSalesOrderForOperationalOrder = Prisma.SalesOrderGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        whatsapp: true;
      };
    };
    items: {
      orderBy: [{ createdAt: "asc" }];
      include: {
        serviceCatalog: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    jobLinks: {
      orderBy: [{ createdAt: "asc" }];
      include: {
        order: {
          select: {
            id: true;
            orderCode: true;
            title: true;
          };
        };
      };
    };
    payments: {
      orderBy: [{ createdAt: "desc" }];
      select: {
        id: true;
        providerCheckoutSessionId: true;
        providerPaymentIntentId: true;
        status: true;
      };
    };
  };
}>;

export type CreateShopSalesOrderInput = {
  customerAccountId: string;
  serviceId: string;
  serviceLabel?: string | null;
  quantity: number;
  documentBundle?: ShopDocumentBundleInput | null;
  configuration?: Partial<ShopPrintConfiguration> | null;
  configurationSummary?: string | null;
  invoiceRequested?: boolean;
  billingDetails?: CreateShopSalesOrderBillingInput | null;
  customerNote?: string | null;
  sourcePath?: string | null;
  allowPreviewFallback?: boolean;
};

export type CreateShopSalesOrderBillingInput = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  companyName?: string | null;
  country?: string | null;
  firstName?: string | null;
  fullName?: string | null;
  kind?: SalesOrderBillingPartyKind | null;
  lastName?: string | null;
  pec?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  province?: string | null;
  sdiCode?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
};

export function buildShopSalesOrderCode(now = new Date(), suffix = randomBytes(3).toString("hex").toUpperCase()) {
  return `SHOP-${formatDateKey(now).replaceAll("-", "")}-${suffix}`;
}

export function describeShopSalesOrderFailure(error: unknown) {
  if (
    error instanceof Error &&
    [
      "Sessione cliente non valida.",
      "Quantita non valida.",
      "Account cliente non disponibile.",
      "Servizio shop non disponibile.",
      "Impossibile generare un codice ordine shop univoco.",
      "Checkout demo non disponibile in produzione.",
      "Ordine shop non disponibile.",
      "Ordine shop senza righe.",
      "Pagamento non disponibile.",
      "Importo ordine non valido per il pagamento online.",
      "Importo pagamento non valido."
    ].includes(error.message)
  ) {
    return error.message;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database shop non raggiungibile. Controlla l'ambiente di sviluppo.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
    return "Schema shop non ancora applicato. Esegui prima le migrazioni Prisma.";
  }

  return error instanceof Error ? error.message : "Non sono riuscito a creare l'ordine shop.";
}

function normalizeShopOrderNote(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeShopBillingText(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function normalizeShopBillingKind(
  value: SalesOrderBillingPartyKind | string | null | undefined
): SalesOrderBillingPartyKind {
  return value === "BUSINESS" || value === "PROFESSIONAL" ? value : "PRIVATE";
}

export function normalizeShopSalesOrderBillingInput(
  input: CreateShopSalesOrderBillingInput | null | undefined
) {
  if (!input) {
    return null;
  }

  const firstName = normalizeShopBillingText(input.firstName);
  const lastName = normalizeShopBillingText(input.lastName);
  const fullName =
    normalizeShopBillingText(input.fullName) ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    undefined;
  const companyName = normalizeShopBillingText(input.companyName);
  const kind = normalizeShopBillingKind(input.kind);

  return {
    kind,
    firstName,
    lastName,
    fullName: kind === "BUSINESS" ? fullName || companyName : fullName,
    companyName: kind === "BUSINESS" ? companyName || fullName : companyName,
    taxCode: normalizeShopBillingText(input.taxCode)?.toUpperCase(),
    vatNumber: normalizeShopBillingText(input.vatNumber)?.toUpperCase(),
    sdiCode: normalizeShopBillingText(input.sdiCode)?.toUpperCase(),
    pec: normalizeShopBillingText(input.pec)?.toLowerCase(),
    addressLine1: normalizeShopBillingText(input.addressLine1),
    addressLine2: normalizeShopBillingText(input.addressLine2),
    postalCode: normalizeShopBillingText(input.postalCode)?.toUpperCase(),
    city: normalizeShopBillingText(input.city),
    province: normalizeShopBillingText(input.province)?.toUpperCase(),
    country: normalizeShopBillingText(input.country) || "Italia",
    phone: normalizeShopBillingText(input.phone)
  };
}

export function validateShopSalesOrderBillingInput(
  input: CreateShopSalesOrderBillingInput | null | undefined
) {
  const billingDetails = normalizeShopSalesOrderBillingInput(input);

  if (!billingDetails) {
    return "Compila i dati di fatturazione prima di continuare.";
  }

  const missingFields: string[] = [];

  if (billingDetails.kind === "BUSINESS") {
    if (!billingDetails.companyName && !billingDetails.fullName) {
      missingFields.push("ragione sociale");
    }
    if (!billingDetails.vatNumber) {
      missingFields.push("P. IVA");
    }
  } else {
    if (!billingDetails.fullName) {
      missingFields.push("nome e cognome");
    }
    if (billingDetails.kind === "PRIVATE" && !billingDetails.taxCode) {
      missingFields.push("codice fiscale");
    }
    if (billingDetails.kind === "PROFESSIONAL" && !billingDetails.taxCode && !billingDetails.vatNumber) {
      missingFields.push("codice fiscale o P. IVA");
    }
  }

  if (!billingDetails.addressLine1) {
    missingFields.push("indirizzo");
  }
  if (!billingDetails.postalCode) {
    missingFields.push("CAP");
  }
  if (!billingDetails.city) {
    missingFields.push("citta");
  }
  if (!billingDetails.province) {
    missingFields.push("provincia");
  }

  return missingFields.length
    ? `Per richiedere la fattura completa: ${missingFields.join(", ")}.`
    : null;
}

function buildShopOrderNotes(input: {
  customerNote?: string | null;
}) {
  const chunks: string[] = [];
  const customerNote = normalizeShopOrderNote(input.customerNote);

  if (customerNote) {
    chunks.push(customerNote);
  }

  return chunks.filter(Boolean).join("\n");
}

export function buildShopOperationalOrderTitle(input: {
  orderCode: string;
  primaryLabel?: string | null;
}) {
  const label = String(input.primaryLabel || "Stampa documenti").trim() || "Stampa documenti";
  return `Shop online - ${label} - ${input.orderCode}`;
}

function readShopConfigurationString(configuration: unknown, key: string) {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return "";
  }

  const value = (configuration as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function resolveShopOperationalOrderLinkReason(salesOrder: ShopSalesOrderForOperationalOrder) {
  const firstItem = salesOrder.items[0];
  const configuredReason = readShopConfigurationString(firstItem?.configuration, "jobCreationReason");
  if (
    configuredReason === "AUTO_PRODUCT_POLICY" ||
    configuredReason === "INVOICE_REQUESTED" ||
    configuredReason === "AUTO_PRODUCT_POLICY_AND_INVOICE_REQUESTED"
  ) {
    return configuredReason;
  }

  if (salesOrder.invoiceRequested) {
    return "INVOICE_REQUESTED";
  }

  return firstItem?.createJobAutomaticallyResolved ? "AUTO_PRODUCT_POLICY" : "MANUAL";
}

function buildShopOperationalOrderNotes(salesOrder: ShopSalesOrderForOperationalOrder) {
  return [
    `Ordine generato dallo shop online: ${salesOrder.orderCode}`,
    salesOrder.notes ? `Nota cliente:\n${salesOrder.notes}` : "",
    salesOrder.invoiceRequested ? "Fattura richiesta dal cliente." : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildShopOperationalOrderItemNotes(item: ShopSalesOrderForOperationalOrder["items"][number]) {
  return (
    readShopConfigurationString(item.configuration, "documentBundleSummary") ||
    readShopConfigurationString(item.configuration, "printConfigurationSummary") ||
    undefined
  );
}

async function ensureShopOperationalOrderForSalesOrder(
  tx: Prisma.TransactionClient,
  salesOrder: ShopSalesOrderForOperationalOrder,
  referenceDate = new Date()
) {
  const existingLink = salesOrder.jobLinks[0];
  if (existingLink) {
    return {
      created: false,
      order: existingLink.order
    };
  }

  const primaryItem = salesOrder.items[0];
  const title = buildShopOperationalOrderTitle({
    orderCode: salesOrder.orderCode,
    primaryLabel: primaryItem?.label
  });
  const createdOn = formatDateKey(referenceDate);
  const titleNormalized = normalizeForUniqueness(title);
  const existingOrder = await tx.order.findUnique({
    where: {
      createdOn_titleNormalized: {
        createdOn,
        titleNormalized
      }
    },
    select: {
      id: true,
      orderCode: true,
      title: true
    }
  });
  const order =
    existingOrder ||
    (await tx.order.create({
      data: {
        customerId: salesOrder.customerId,
        orderCode: buildOrderCode(referenceDate, title),
        title,
        titleNormalized,
        createdOn,
        deliveryAt: new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000),
        priority: computeAutomaticPriority(new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000), referenceDate),
        invoiceStatus: salesOrder.invoiceRequested ? "DA_FATTURARE" : "NON_RICHIESTO",
        totalCents: salesOrder.totalCents,
        depositCents: salesOrder.totalCents,
        paidCents: salesOrder.totalCents,
        balanceDueCents: 0,
        paymentStatus: salesOrder.totalCents > 0 ? "PAGATO" : "NON_PAGATO",
        notes: buildShopOperationalOrderNotes(salesOrder),
        items: {
          create: salesOrder.items.map((item) => ({
            serviceCatalogId: item.serviceCatalogId || undefined,
            label: item.label,
            description: item.description || undefined,
            quantity: Number(item.quantity) || 1,
            catalogBasePriceCents: item.unitPriceCents,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
            material: "Shop online",
            notes: buildShopOperationalOrderItemNotes(item)
          }))
        },
        payments:
          salesOrder.totalCents > 0
            ? {
                create: {
                  amountCents: salesOrder.totalCents,
                  method: "CARTA",
                  note: "Pagamento shop online"
                }
              }
            : undefined,
        history: {
          create: [
            {
              type: "CREATED",
              description: "Ordine creato da shop online",
              details: salesOrder.orderCode
            },
            ...(salesOrder.totalCents > 0
              ? [
                  {
                    type: "PAYMENT_RECORDED",
                    description: `Pagamento shop registrato: ${salesOrder.totalCents / 100} EUR`,
                    details: "Checkout shop online"
                  } as const
                ]
              : [])
          ]
        }
      },
      select: {
        id: true,
        orderCode: true,
        title: true
      }
    }));

  await tx.salesOrderJobLink.create({
    data: {
      salesOrderId: salesOrder.id,
      salesOrderItemId: primaryItem?.id || undefined,
      orderId: order.id,
      reason: resolveShopOperationalOrderLinkReason(salesOrder)
    }
  });

  return {
    created: !existingOrder,
    order
  };
}

export async function createShopSalesOrder(input: CreateShopSalesOrderInput) {
  const customerAccountId = String(input.customerAccountId || "").trim();
  if (!customerAccountId) {
    throw new Error("Sessione cliente non valida.");
  }

  const allowPreviewFallback = Boolean(input.allowPreviewFallback);
  const invoiceRequested = Boolean(input.invoiceRequested);
  const serviceLabel = String(input.serviceLabel || "").trim();
  const documentBundle = input.documentBundle ? normalizeShopDocumentBundle(input.documentBundle) : null;
  const configuration = documentBundle?.documents[0] || normalizeShopPrintConfiguration(input.configuration);
  const quantity = normalizeQuantityValue(documentBundle?.totalPrintUnits ?? Number(input.quantity ?? 1), 1);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantita non valida.");
  }
  const configurationOverview = documentBundle
    ? buildShopDocumentBundleOverview(documentBundle)
    : buildShopPrintConfigurationSummary(configuration);
  const configurationSummary =
    normalizeShopOrderNote(input.configurationSummary) ||
    (documentBundle ? buildShopDocumentBundleDetailedSummary(documentBundle) : buildShopPrintConfigurationSummary(configuration));
  const billingDetails = normalizeShopSalesOrderBillingInput(input.billingDetails);
  const billingValidationError = invoiceRequested
    ? validateShopSalesOrderBillingInput(billingDetails)
    : null;

  if (billingValidationError) {
    throw new Error(billingValidationError);
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.customerAccount.findUnique({
      where: { id: customerAccountId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!account || account.status !== "ACTIVE") {
      throw new Error("Account cliente non disponibile.");
    }

    const service = await getShopServiceByIdForOrderCreation(input.serviceId, {
      allowPreviewFallback,
      client: tx
    });
    if (!service) {
      throw new Error("Servizio shop non disponibile.");
    }

    const pricedService = resolveShopDocumentPreviewPricing(service, input.sourcePath);
    const quote = quoteCatalogService({
      service: pricedService,
      quantity
    });
    const pricingSnapshot = buildCatalogServicePricingSnapshot({
      service: pricedService,
      quantity
    });
    const createJobAutomaticallyResolved = shouldCreateSalesOrderItemJob({
      createJobAutomatically: service.createJobAutomatically,
      invoiceRequested
    });
    const createdAt = new Date();
    const notes = buildShopOrderNotes({
      customerNote: input.customerNote
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderCode = buildShopSalesOrderCode(createdAt);

      try {
        const order = await tx.salesOrder.create({
          data: {
            customerId: account.customerId,
            customerAccountId: account.id,
            orderCode,
            status: "PENDING_PAYMENT",
            origin: "SHOP_ONLINE",
            currency: "EUR",
            invoiceRequested,
            subtotalCents: quote.lineTotalCents,
            discountCents: 0,
            extraCents: 0,
            totalCents: quote.lineTotalCents,
            notes: notes || undefined,
            placedAt: createdAt,
            items: {
              create: [
                {
                  serviceCatalogId: service.id,
                  label: serviceLabel || service.name,
                  description: configurationOverview || service.description || undefined,
                  quantity: quote.quantity,
                  configuration: {
                    source: "shop_preview",
                    sourcePath: input.sourcePath?.trim() || null,
                    serviceSlug: service.onlineSlug || null,
                    serviceOnlineActive: service.onlineActive,
                    printConfiguration: configuration,
                    documentBundle,
                    documentBundleOverview: configurationOverview,
                    documentBundleSummary: configurationSummary,
                    printConfigurationSummary: configurationSummary,
                    jobCreationReason: resolveSalesOrderItemJobCreationReason({
                      createJobAutomatically: service.createJobAutomatically,
                      invoiceRequested
                    })
                  },
                  pricingSnapshot,
                  unitPriceCents: quote.unitPriceCents,
                  lineTotalCents: quote.lineTotalCents,
                  createJobAutomaticallyResolved
                }
              ]
            },
            billingSnapshot: invoiceRequested
              ? {
                  create: {
                    kind: billingDetails?.kind || "PRIVATE",
                    firstName: billingDetails?.firstName,
                    lastName: billingDetails?.lastName,
                    fullName:
                      billingDetails?.fullName ||
                      billingDetails?.companyName ||
                      account.customer.name,
                    companyName: billingDetails?.companyName,
                    taxCode: billingDetails?.taxCode,
                    vatNumber: billingDetails?.vatNumber,
                    sdiCode: billingDetails?.sdiCode,
                    pec: billingDetails?.pec,
                    addressLine1: billingDetails?.addressLine1,
                    addressLine2: billingDetails?.addressLine2,
                    postalCode: billingDetails?.postalCode,
                    city: billingDetails?.city,
                    province: billingDetails?.province,
                    country: billingDetails?.country || "Italia",
                    phone: billingDetails?.phone || account.customer.phone || undefined,
                    rawJson: {
                      accountEmail: account.email,
                      customerEmail: account.customer.email || null
                    }
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
          select: customerShopOrderDetailSelect
        });

        await tx.domainEvent.create({
          data: {
            topic: "shop.sales_order.created",
            entityType: "SalesOrder",
            entityId: order.id,
            dedupeKey: `shop.sales_order.created:${order.id}`,
            payloadJson: {
              salesOrderId: order.id,
              orderCode: order.orderCode,
              customerId: order.customer.id,
              customerAccountId: account.id,
              totalCents: order.totalCents,
              invoiceRequested,
              previewFallbackUsed: !service.onlineActive
            }
          }
        });

        return order;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (Array.isArray(error.meta?.target)
            ? error.meta.target.includes("orderCode")
            : String(error.meta?.target || "").includes("orderCode"))
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Impossibile generare un codice ordine shop univoco.");
  });
}

type PaidShopCheckoutResult = {
  customerName: string;
  internalOrderCode: string;
  internalOrderCreated: boolean;
  internalOrderHref: string;
  internalOrderId: string;
  internalOrderLabel: string;
  salesOrderCode: string;
  salesOrderId: string;
  shouldNotifyStaff: boolean;
  status: "PAID";
  totalCents: number;
};

async function recordShopStaffPushNotification(checkoutResult: PaidShopCheckoutResult) {
  if (!checkoutResult.shouldNotifyStaff) {
    return;
  }

  try {
    const pushResult = await sendShopOnlineOrderPushNotification({
      customerName: checkoutResult.customerName,
      internalOrderCode: checkoutResult.internalOrderCode,
      internalOrderId: checkoutResult.internalOrderId,
      salesOrderCode: checkoutResult.salesOrderCode,
      totalCents: checkoutResult.totalCents
    });

    await prisma.domainEvent.upsert({
      where: {
        dedupeKey: `shop.sales_order.staff_push:${checkoutResult.salesOrderId}`
      },
      update: {
        payloadJson: {
          ...pushResult,
          internalOrderId: checkoutResult.internalOrderId,
          salesOrderId: checkoutResult.salesOrderId
        },
        status: pushResult.sent > 0 ? "PROCESSED" : "FAILED",
        processedAt: new Date()
      },
      create: {
        topic: "shop.sales_order.staff_push",
        entityType: "SalesOrder",
        entityId: checkoutResult.salesOrderId,
        dedupeKey: `shop.sales_order.staff_push:${checkoutResult.salesOrderId}`,
        payloadJson: {
          ...pushResult,
          internalOrderId: checkoutResult.internalOrderId,
          salesOrderId: checkoutResult.salesOrderId
        },
        status: pushResult.sent > 0 ? "PROCESSED" : "FAILED",
        processedAt: new Date()
      }
    });
  } catch (error) {
    await prisma.domainEvent.upsert({
      where: {
        dedupeKey: `shop.sales_order.staff_push:${checkoutResult.salesOrderId}`
      },
      update: {
        payloadJson: {
          error: error instanceof Error ? error.message : "Invio push non riuscito.",
          internalOrderId: checkoutResult.internalOrderId,
          salesOrderId: checkoutResult.salesOrderId
        },
        status: "FAILED",
        processedAt: new Date()
      },
      create: {
        topic: "shop.sales_order.staff_push",
        entityType: "SalesOrder",
        entityId: checkoutResult.salesOrderId,
        dedupeKey: `shop.sales_order.staff_push:${checkoutResult.salesOrderId}`,
        payloadJson: {
          error: error instanceof Error ? error.message : "Invio push non riuscito.",
          internalOrderId: checkoutResult.internalOrderId,
          salesOrderId: checkoutResult.salesOrderId
        },
        status: "FAILED",
        processedAt: new Date()
      }
    });
  }
}

export async function completeShopDemoCheckout(input: {
  customerAccountId: string;
  salesOrderId: string;
}) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Checkout demo non disponibile in produzione.");
  }

  const customerAccountId = String(input.customerAccountId || "").trim();
  const salesOrderId = String(input.salesOrderId || "").trim();
  if (!customerAccountId || !salesOrderId) {
    throw new Error("Ordine shop non disponibile.");
  }

  const checkoutResult = await prisma.$transaction(async (tx) => {
    const salesOrder = await tx.salesOrder.findFirst({
      where: {
        id: salesOrderId,
        customerAccountId
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsapp: true
          }
        },
        items: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            serviceCatalog: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        jobLinks: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            order: {
              select: {
                id: true,
                orderCode: true,
                title: true
              }
            }
          }
        },
        payments: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            providerCheckoutSessionId: true,
            providerPaymentIntentId: true,
            status: true
          }
        }
      }
    });

    if (!salesOrder || salesOrder.origin !== "SHOP_ONLINE") {
      throw new Error("Ordine shop non disponibile.");
    }

    if (!salesOrder.items.length) {
      throw new Error("Ordine shop senza righe.");
    }

    const wasAlreadyCompleted = salesOrder.status === "PAID" || salesOrder.status === "FULFILLED";
    const paidAt = new Date();
    const linkedOrder = await ensureShopOperationalOrderForSalesOrder(tx, salesOrder, paidAt);
    const paymentStatus = "PAID" as const;

    await tx.salesOrder.update({
      where: { id: salesOrder.id },
      data: {
        status: paymentStatus,
        paidAt
      }
    });

    const existingPayment = salesOrder.payments[0];
    if (existingPayment) {
      await tx.paymentRecord.update({
        where: { id: existingPayment.id },
        data: {
          status: "SUCCEEDED",
          paidAt,
          rawProviderSnapshot: {
            demoCheckout: true,
            paidAt: paidAt.toISOString()
          }
        }
      });
    } else {
      await tx.paymentRecord.create({
        data: {
          salesOrderId: salesOrder.id,
          amountCents: salesOrder.totalCents,
          currency: salesOrder.currency,
          status: "SUCCEEDED",
          paidAt,
          rawProviderSnapshot: {
            demoCheckout: true,
            paidAt: paidAt.toISOString()
          }
        }
      });
    }

    await tx.domainEvent.upsert({
      where: {
        dedupeKey: `shop.sales_order.demo_checkout_completed:${salesOrder.id}`
      },
      update: {
        payloadJson: {
          salesOrderId: salesOrder.id,
          orderCode: salesOrder.orderCode,
          internalOrderId: linkedOrder.order.id,
          internalOrderCreated: linkedOrder.created
        },
        status: "PROCESSED",
        processedAt: paidAt
      },
      create: {
        topic: "shop.sales_order.demo_checkout_completed",
        entityType: "SalesOrder",
        entityId: salesOrder.id,
        dedupeKey: `shop.sales_order.demo_checkout_completed:${salesOrder.id}`,
        payloadJson: {
          salesOrderId: salesOrder.id,
          orderCode: salesOrder.orderCode,
          internalOrderId: linkedOrder.order.id,
          internalOrderCreated: linkedOrder.created
        },
        status: "PROCESSED",
        processedAt: paidAt
      }
    });

    return {
      customerName: salesOrder.customer.name,
      internalOrderCreated: linkedOrder.created,
      internalOrderCode: linkedOrder.order.orderCode,
      internalOrderHref: `/orders/${linkedOrder.order.id}`,
      internalOrderId: linkedOrder.order.id,
      internalOrderLabel: linkedOrder.order.orderCode,
      shouldNotifyStaff: !wasAlreadyCompleted,
      salesOrderCode: salesOrder.orderCode,
      salesOrderId: salesOrder.id,
      status: paymentStatus,
      totalCents: salesOrder.totalCents
    };
  });

  await recordShopStaffPushNotification(checkoutResult);

  return {
    internalOrderCreated: checkoutResult.internalOrderCreated,
    internalOrderHref: checkoutResult.internalOrderHref,
    internalOrderId: checkoutResult.internalOrderId,
    internalOrderLabel: checkoutResult.internalOrderLabel,
    salesOrderId: checkoutResult.salesOrderId,
    staffPushNotificationAttempted: checkoutResult.shouldNotifyStaff,
    status: checkoutResult.status
  };
}

export async function completeShopStripeCheckoutPayment(input: {
  amountTotalCents?: number | null;
  checkoutSessionId: string;
  currency?: string | null;
  eventType?: string | null;
  paymentIntentId?: string | null;
  rawProviderSnapshot?: Prisma.InputJsonValue | null;
  salesOrderId?: string | null;
}) {
  const checkoutSessionId = String(input.checkoutSessionId || "").trim();
  const paymentIntentId = String(input.paymentIntentId || "").trim();
  const salesOrderId = String(input.salesOrderId || "").trim();

  if (!checkoutSessionId && !salesOrderId) {
    throw new Error("Ordine shop non disponibile.");
  }

  const checkoutResult = await prisma.$transaction(async (tx) => {
    const salesOrder = await tx.salesOrder.findFirst({
      where: salesOrderId
        ? {
            id: salesOrderId
          }
        : {
            payments: {
              some: {
                providerCheckoutSessionId: checkoutSessionId
              }
            }
          },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsapp: true
          }
        },
        items: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            serviceCatalog: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        jobLinks: {
          orderBy: [{ createdAt: "asc" }],
          include: {
            order: {
              select: {
                id: true,
                orderCode: true,
                title: true
              }
            }
          }
        },
        payments: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            providerCheckoutSessionId: true,
            providerPaymentIntentId: true,
            status: true
          }
        }
      }
    });

    if (!salesOrder || salesOrder.origin !== "SHOP_ONLINE") {
      throw new Error("Ordine shop non disponibile.");
    }

    if (!salesOrder.items.length) {
      throw new Error("Ordine shop senza righe.");
    }

    if (
      typeof input.amountTotalCents === "number" &&
      Number.isFinite(input.amountTotalCents) &&
      Math.round(input.amountTotalCents) !== salesOrder.totalCents
    ) {
      throw new Error("Importo pagamento non valido.");
    }

    const wasAlreadyCompleted = salesOrder.status === "PAID" || salesOrder.status === "FULFILLED";
    const paidAt = salesOrder.paidAt || new Date();
    const linkedOrder = await ensureShopOperationalOrderForSalesOrder(tx, salesOrder, paidAt);
    const paymentStatus = "PAID" as const;

    await tx.salesOrder.update({
      where: { id: salesOrder.id },
      data: {
        status: paymentStatus,
        paidAt
      }
    });

    const existingPayment =
      salesOrder.payments.find((payment) => payment.providerCheckoutSessionId === checkoutSessionId) ||
      salesOrder.payments.find((payment) => payment.providerPaymentIntentId === paymentIntentId) ||
      salesOrder.payments[0];
    const rawProviderSnapshot =
      input.rawProviderSnapshot ||
      ({
        checkoutSessionId,
        currency: input.currency || salesOrder.currency,
        eventType: input.eventType || "checkout.session.completed",
        paidAt: paidAt.toISOString(),
        paymentIntentId: paymentIntentId || null
      } satisfies Prisma.InputJsonObject);

    if (existingPayment) {
      await tx.paymentRecord.update({
        where: { id: existingPayment.id },
        data: {
          amountCents: salesOrder.totalCents,
          currency: input.currency?.toUpperCase() || salesOrder.currency,
          failureCode: null,
          failureMessage: null,
          paidAt,
          providerCheckoutSessionId: checkoutSessionId || existingPayment.providerCheckoutSessionId,
          providerPaymentIntentId: paymentIntentId || existingPayment.providerPaymentIntentId,
          rawProviderSnapshot,
          status: "SUCCEEDED"
        }
      });
    } else {
      await tx.paymentRecord.create({
        data: {
          salesOrderId: salesOrder.id,
          amountCents: salesOrder.totalCents,
          currency: input.currency?.toUpperCase() || salesOrder.currency,
          paidAt,
          providerCheckoutSessionId: checkoutSessionId || undefined,
          providerPaymentIntentId: paymentIntentId || undefined,
          rawProviderSnapshot,
          status: "SUCCEEDED"
        }
      });
    }

    await tx.domainEvent.upsert({
      where: {
        dedupeKey: `shop.sales_order.stripe_checkout_completed:${checkoutSessionId || salesOrder.id}`
      },
      update: {
        payloadJson: {
          checkoutSessionId,
          internalOrderCreated: linkedOrder.created,
          internalOrderId: linkedOrder.order.id,
          orderCode: salesOrder.orderCode,
          paymentIntentId: paymentIntentId || null,
          salesOrderId: salesOrder.id
        },
        status: "PROCESSED",
        processedAt: paidAt
      },
      create: {
        topic: "shop.sales_order.stripe_checkout_completed",
        entityType: "SalesOrder",
        entityId: salesOrder.id,
        dedupeKey: `shop.sales_order.stripe_checkout_completed:${checkoutSessionId || salesOrder.id}`,
        payloadJson: {
          checkoutSessionId,
          internalOrderCreated: linkedOrder.created,
          internalOrderId: linkedOrder.order.id,
          orderCode: salesOrder.orderCode,
          paymentIntentId: paymentIntentId || null,
          salesOrderId: salesOrder.id
        },
        status: "PROCESSED",
        processedAt: paidAt
      }
    });

    return {
      customerName: salesOrder.customer.name,
      internalOrderCreated: linkedOrder.created,
      internalOrderCode: linkedOrder.order.orderCode,
      internalOrderHref: `/orders/${linkedOrder.order.id}`,
      internalOrderId: linkedOrder.order.id,
      internalOrderLabel: linkedOrder.order.orderCode,
      salesOrderCode: salesOrder.orderCode,
      salesOrderId: salesOrder.id,
      shouldNotifyStaff: !wasAlreadyCompleted,
      status: paymentStatus,
      totalCents: salesOrder.totalCents
    } satisfies PaidShopCheckoutResult;
  });

  await recordShopStaffPushNotification(checkoutResult);

  return {
    internalOrderCreated: checkoutResult.internalOrderCreated,
    internalOrderHref: checkoutResult.internalOrderHref,
    internalOrderId: checkoutResult.internalOrderId,
    internalOrderLabel: checkoutResult.internalOrderLabel,
    salesOrderId: checkoutResult.salesOrderId,
    staffPushNotificationAttempted: checkoutResult.shouldNotifyStaff,
    status: checkoutResult.status
  };
}

export async function markShopStripeCheckoutPaymentFailed(input: {
  amountTotalCents?: number | null;
  checkoutSessionId?: string | null;
  currency?: string | null;
  eventType?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  paymentIntentId?: string | null;
  rawProviderSnapshot?: Prisma.InputJsonValue | null;
  salesOrderId?: string | null;
}) {
  const checkoutSessionId = String(input.checkoutSessionId || "").trim();
  const paymentIntentId = String(input.paymentIntentId || "").trim();
  const salesOrderId = String(input.salesOrderId || "").trim();

  if (!checkoutSessionId && !paymentIntentId && !salesOrderId) {
    return null;
  }

  const paymentRecord = await prisma.paymentRecord.findFirst({
    where: {
      OR: [
        checkoutSessionId ? { providerCheckoutSessionId: checkoutSessionId } : undefined,
        paymentIntentId ? { providerPaymentIntentId: paymentIntentId } : undefined,
        salesOrderId ? { salesOrderId } : undefined
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause))
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      salesOrderId: true
    }
  });
  const resolvedSalesOrderId = salesOrderId || paymentRecord?.salesOrderId || "";

  if (!resolvedSalesOrderId) {
    return null;
  }

  const failedAt = new Date();
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: resolvedSalesOrderId },
    select: {
      currency: true,
      id: true,
      origin: true,
      orderCode: true,
      status: true,
      totalCents: true
    }
  });

  if (!salesOrder || salesOrder.origin !== "SHOP_ONLINE") {
    return null;
  }

  if (salesOrder.status !== "PAID" && salesOrder.status !== "FULFILLED") {
    await prisma.salesOrder.update({
      where: { id: salesOrder.id },
      data: {
        status: "PAYMENT_FAILED"
      }
    });
  }

  const rawProviderSnapshot =
    input.rawProviderSnapshot ||
    ({
      checkoutSessionId: checkoutSessionId || null,
      eventType: input.eventType || "checkout.session.async_payment_failed",
      failedAt: failedAt.toISOString(),
      paymentIntentId: paymentIntentId || null
    } satisfies Prisma.InputJsonObject);
  const paymentData = {
    amountCents: Math.round(input.amountTotalCents || salesOrder.totalCents),
    currency: input.currency?.toUpperCase() || salesOrder.currency,
    failureCode: input.failureCode || null,
    failureMessage: input.failureMessage || "Pagamento non riuscito.",
    providerCheckoutSessionId: checkoutSessionId || undefined,
    providerPaymentIntentId: paymentIntentId || undefined,
    rawProviderSnapshot,
    status: "FAILED" as const
  };

  if (paymentRecord) {
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: paymentData
    });
  } else {
    await prisma.paymentRecord.create({
      data: {
        ...paymentData,
        salesOrderId: salesOrder.id
      }
    });
  }

  await prisma.domainEvent.upsert({
    where: {
      dedupeKey: `shop.sales_order.stripe_checkout_failed:${checkoutSessionId || paymentIntentId || salesOrder.id}`
    },
    update: {
      payloadJson: {
        checkoutSessionId: checkoutSessionId || null,
        failureCode: input.failureCode || null,
        failureMessage: input.failureMessage || null,
        orderCode: salesOrder.orderCode,
        paymentIntentId: paymentIntentId || null,
        salesOrderId: salesOrder.id
      },
      status: "PROCESSED",
      processedAt: failedAt
    },
    create: {
      topic: "shop.sales_order.stripe_checkout_failed",
      entityType: "SalesOrder",
      entityId: salesOrder.id,
      dedupeKey: `shop.sales_order.stripe_checkout_failed:${checkoutSessionId || paymentIntentId || salesOrder.id}`,
      payloadJson: {
        checkoutSessionId: checkoutSessionId || null,
        failureCode: input.failureCode || null,
        failureMessage: input.failureMessage || null,
        orderCode: salesOrder.orderCode,
        paymentIntentId: paymentIntentId || null,
        salesOrderId: salesOrder.id
      },
      status: "PROCESSED",
      processedAt: failedAt
    }
  });

  return {
    salesOrderId: salesOrder.id,
    status: "PAYMENT_FAILED" as const
  };
}

export async function listCustomerAccountShopOrders(customerAccountId: string, limit = 8) {
  return prisma.salesOrder.findMany({
    where: {
      customerAccountId
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: customerShopOrderListSelect
  });
}

export async function getCustomerAccountShopOrderDetail(orderId: string, customerAccountId: string) {
  return prisma.salesOrder.findFirst({
    where: {
      id: orderId,
      customerAccountId
    },
    select: customerShopOrderDetailSelect
  });
}
