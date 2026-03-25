import {
  DiscountMode,
  HistoryType,
  InvoiceStatus,
  MainPhase,
  OperationalStatus,
  PaymentEntryStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Priority
} from "@prisma/client";
import { APP_TIMEZONE, mainPhaseLabels, operationalStatusLabels, phaseOrder } from "@/lib/constants";
import { formatDateKey } from "@/lib/format";
import { clampDiscountValue, computeDiscountedUnitPrice, normalizeQuantityTiers } from "@/lib/pricing";
import type {
  InvoiceFilter,
  PaymentFilter,
  PhaseFilter,
  PriorityFilter,
  QuoteFilter,
  StatusFilter
} from "@/lib/order-filters";
import { prisma } from "@/lib/prisma";
import { getWhatsappTemplate } from "@/lib/settings";

export type OrderItemInput = {
  label: string;
  description?: string;
  quantity: number;
  catalogBasePriceCents?: number;
  discountMode?: DiscountMode;
  discountValue?: number;
  unitPriceCents: number;
  format?: string;
  material?: string;
  finishing?: string;
  notes?: string;
  serviceCatalogId?: string;
};

export type CreateOrderInput = {
  customerId?: string;
  customer: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    taxCode?: string;
    vatNumber?: string;
    notes?: string;
  };
  title: string;
  deliveryAt: Date;
  appointmentAt?: Date | null;
  appointmentNote?: string;
  priority: Priority;
  notes?: string;
  invoiceStatus: InvoiceStatus;
  isQuote?: boolean;
  items: OrderItemInput[];
  initialDepositCents?: number;
};

export type UpdateOrderInput = {
  id: string;
  title: string;
  deliveryAt: Date;
  appointmentAt?: Date | null;
  appointmentNote?: string;
  priority: Priority;
  notes?: string;
  invoiceStatus: InvoiceStatus;
  isQuote?: boolean;
};

export type UpdateCustomerInput = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  taxCode?: string;
  vatNumber?: string;
  notes?: string;
};

export type PaymentSnapshot = {
  id: string;
  amountCents: number;
  status: PaymentEntryStatus;
  createdAt: Date | string;
};

type OrderIdentity = {
  id: string;
};

type ProductionQueueSnapshot = {
  id: string;
  isQuote: boolean;
  mainPhase: MainPhase;
  operationalStatus: OperationalStatus;
};

export type ProductionQueues<T> = {
  planning: T[];
  scheduled: T[];
  working: T[];
  blocked: T[];
  ready: T[];
};

type MonthlyAgendaSnapshot = {
  id: string;
  isQuote: boolean;
  mainPhase: MainPhase;
  appointmentAt: Date | string | null;
};

type SalesStatsLineSnapshot = {
  label: string;
  quantity: number;
  lineTotalCents: number;
  serviceCatalogId?: string | null;
  serviceCatalog?: {
    code: string | null;
    name: string;
  } | null;
};

type SalesStatsOrderSnapshot = {
  id: string;
  isQuote: boolean;
  createdAt: Date | string;
  totalCents: number;
  items: SalesStatsLineSnapshot[];
};

export type SalesStatsTrend = "up" | "down" | "flat" | "new";

export type SalesStatsTopItem = {
  key: string;
  label: string;
  catalogCode?: string;
  quantity: number;
  revenueCents: number;
  orderCount: number;
};

export type SalesStatsMonth = {
  monthKey: string;
  label: string;
  revenueCents: number;
  ordersCount: number;
  quantity: number;
  deltaRevenueCents: number;
  deltaRevenuePct: number | null;
  trend: SalesStatsTrend;
};

export type SalesStatsReport = {
  summaryCurrentMonth: SalesStatsMonth;
  monthlyTrend: SalesStatsMonth[];
  topByRevenue: SalesStatsTopItem[];
  topByQuantity: SalesStatsTopItem[];
};

type ServiceCatalogImportRow = {
  code: string;
  name: string;
  description?: string;
  basePriceCents: number;
  quantityTiers?: string;
  active: boolean;
};

function operationalOrderWhere() {
  return {
    isQuote: false
  } satisfies Prisma.OrderWhereInput;
}

export function isOperationalOrder(order: { isQuote: boolean }) {
  return !order.isQuote;
}

export function countUniqueOrders(...lists: OrderIdentity[][]) {
  return new Set(lists.flat().map((order) => order.id)).size;
}

export function classifyProductionQueues<T extends ProductionQueueSnapshot>(orders: T[]): ProductionQueues<T> {
  const queues: ProductionQueues<T> = {
    planning: [],
    scheduled: [],
    working: [],
    blocked: [],
    ready: []
  };

  for (const order of orders) {
    if (!isOperationalOrder(order) || order.mainPhase === "CONSEGNATO") {
      continue;
    }

    if (order.operationalStatus !== "ATTIVO") {
      queues.blocked.push(order);
      continue;
    }

    if (order.mainPhase === "SVILUPPO_COMPLETATO") {
      queues.ready.push(order);
      continue;
    }

    if (order.mainPhase === "IN_LAVORAZIONE") {
      queues.working.push(order);
      continue;
    }

    if (order.mainPhase === "CALENDARIZZATO") {
      queues.scheduled.push(order);
      continue;
    }

    queues.planning.push(order);
  }

  return queues;
}

export function getMonthlyAgendaOrders<T extends MonthlyAgendaSnapshot>(orders: T[]) {
  return orders.filter((order) => !order.isQuote && order.mainPhase !== "CONSEGNATO" && Boolean(order.appointmentAt));
}

function getYearMonthInTimezone(date: Date | string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: APP_TIMEZONE
  });
  const parts = formatter.formatToParts(typeof date === "string" ? new Date(date) : date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Impossibile determinare il mese statistico.");
  }

  return { year: Number(year), month: Number(month) };
}

function buildMonthKey(date: Date | string) {
  const { year, month } = getYearMonthInTimezone(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));

  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE
  }).format(value);
}

function buildRollingMonthKeys(referenceDate: Date, months: number) {
  const { year, month } = getYearMonthInTimezone(referenceDate);
  const currentIndex = year * 12 + (month - 1);

  return Array.from({ length: months }, (_, offset) => {
    const absoluteIndex = currentIndex - (months - 1 - offset);
    const bucketYear = Math.floor(absoluteIndex / 12);
    const bucketMonth = (absoluteIndex % 12) + 1;
    const monthKey = `${bucketYear}-${String(bucketMonth).padStart(2, "0")}`;

    return {
      monthKey,
      label: formatMonthLabel(monthKey)
    };
  });
}

function computeRevenueTrend(currentRevenueCents: number, previousRevenueCents: number) {
  const deltaRevenueCents = currentRevenueCents - previousRevenueCents;

  if (previousRevenueCents === 0 && currentRevenueCents > 0) {
    return {
      deltaRevenueCents,
      deltaRevenuePct: null,
      trend: "new" as const
    };
  }

  if (previousRevenueCents === 0 && currentRevenueCents === 0) {
    return {
      deltaRevenueCents: 0,
      deltaRevenuePct: null,
      trend: "flat" as const
    };
  }

  if (deltaRevenueCents === 0) {
    return {
      deltaRevenueCents: 0,
      deltaRevenuePct: 0,
      trend: "flat" as const
    };
  }

  return {
    deltaRevenueCents,
    deltaRevenuePct: Math.round((deltaRevenueCents / previousRevenueCents) * 1000) / 10,
    trend: deltaRevenueCents > 0 ? ("up" as const) : ("down" as const)
  };
}

function getSalesAggregationKey(item: SalesStatsLineSnapshot) {
  if (item.serviceCatalogId && item.serviceCatalog?.name) {
    return {
      key: `catalog:${item.serviceCatalog.code || item.serviceCatalogId}`,
      label: item.serviceCatalog.name,
      catalogCode: item.serviceCatalog.code || undefined
    };
  }

  const normalizedLabel = normalizeOrderTitle(item.label || "Lavorazione libera") || "Lavorazione libera";
  return {
    key: `free:${normalizeForUniqueness(normalizedLabel)}`,
    label: normalizedLabel
  };
}

export function buildSalesStatsReport<T extends SalesStatsOrderSnapshot>(
  orders: T[],
  options?: { months?: number; referenceDate?: Date }
): SalesStatsReport {
  const months = Math.max(1, options?.months || 12);
  const referenceDate = options?.referenceDate || new Date();
  const monthSequence = buildRollingMonthKeys(referenceDate, months);
  const monthKeySet = new Set(monthSequence.map((entry) => entry.monthKey));

  const monthlyBuckets = new Map(
    monthSequence.map((entry) => [
      entry.monthKey,
      {
        monthKey: entry.monthKey,
        label: entry.label,
        revenueCents: 0,
        ordersCount: 0,
        quantity: 0
      }
    ])
  );

  const topMap = new Map<
    string,
    SalesStatsTopItem & {
      orderIds: Set<string>;
    }
  >();

  for (const order of orders) {
    if (order.isQuote) {
      continue;
    }

    const monthKey = buildMonthKey(order.createdAt);
    if (!monthKeySet.has(monthKey)) {
      continue;
    }

    const bucket = monthlyBuckets.get(monthKey);
    if (!bucket) {
      continue;
    }

    bucket.revenueCents += Math.max(0, order.totalCents);
    bucket.ordersCount += 1;
    bucket.quantity += order.items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0);

    for (const item of order.items) {
      const { key, label, catalogCode } = getSalesAggregationKey(item);
      const current = topMap.get(key) || {
        key,
        label,
        catalogCode,
        quantity: 0,
        revenueCents: 0,
        orderCount: 0,
        orderIds: new Set<string>()
      };

      current.quantity += Math.max(0, item.quantity || 0);
      current.revenueCents += Math.max(0, item.lineTotalCents || 0);
      current.orderIds.add(order.id);
      topMap.set(key, current);
    }
  }

  const monthlyTrend = monthSequence.map((entry, index) => {
    const current = monthlyBuckets.get(entry.monthKey) || {
      monthKey: entry.monthKey,
      label: entry.label,
      revenueCents: 0,
      ordersCount: 0,
      quantity: 0
    };
    const previous = index > 0 ? monthlyBuckets.get(monthSequence[index - 1].monthKey) : undefined;
    const trend = computeRevenueTrend(current.revenueCents, previous?.revenueCents || 0);

    return {
      ...current,
      ...trend
    };
  });

  const topItems = [...topMap.values()].map(({ orderIds, ...entry }) => ({
    ...entry,
    orderCount: orderIds.size
  }));

  const topByRevenue = [...topItems].sort((left, right) => {
    if (right.revenueCents !== left.revenueCents) {
      return right.revenueCents - left.revenueCents;
    }

    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.label.localeCompare(right.label, "it-IT");
  });

  const topByQuantity = [...topItems].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    if (right.revenueCents !== left.revenueCents) {
      return right.revenueCents - left.revenueCents;
    }

    return left.label.localeCompare(right.label, "it-IT");
  });

  return {
    summaryCurrentMonth: monthlyTrend[monthlyTrend.length - 1],
    monthlyTrend,
    topByRevenue,
    topByQuantity
  };
}

export function normalizeOrderTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

export function normalizeForUniqueness(title: string) {
  return normalizeOrderTitle(title).toLocaleLowerCase("it-IT");
}

export function buildOrderCode(createdAt: Date, title: string) {
  return `${formatDateKey(createdAt)}_${normalizeOrderTitle(title)}`;
}

export function computePaymentStatus(totalCents: number, paidCents: number, paymentCount = 0): PaymentStatus {
  if (paidCents <= 0) {
    return "NON_PAGATO";
  }

  if (paidCents >= totalCents) {
    return "PAGATO";
  }

  return paymentCount <= 1 ? "ACCONTO" : "PARZIALE";
}

export function computeBalanceDue(totalCents: number, paidCents: number) {
  return Math.max(totalCents - paidCents, 0);
}

export function computeEffectivePayments(payments: PaymentSnapshot[]) {
  return [...payments]
    .filter((payment) => payment.status === "ATTIVO")
    .sort((left, right) => {
      const byCreatedAt = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }

      return left.id.localeCompare(right.id);
    });
}

export function computePaymentSummary(totalCents: number, payments: PaymentSnapshot[]) {
  const effectivePayments = computeEffectivePayments(payments);
  const paidCents = effectivePayments.reduce((sum, payment) => sum + payment.amountCents, 0);

  return {
    paidCents,
    balanceDueCents: computeBalanceDue(totalCents, paidCents),
    paymentStatus: computePaymentStatus(totalCents, paidCents, effectivePayments.length),
    depositCents: effectivePayments[0] ? Math.min(effectivePayments[0].amountCents, totalCents) : 0
  };
}

export function computeOrderTotals(items: OrderItemInput[]) {
  const normalizedItems = items
    .filter((item) => normalizeOrderTitle(item.label).length > 0)
    .map((item) => {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.round(item.quantity) : 1;
      const catalogBasePriceCents =
        Number.isFinite(item.catalogBasePriceCents) && Number(item.catalogBasePriceCents) > 0
          ? Math.round(Number(item.catalogBasePriceCents))
          : Math.max(Number.isFinite(item.unitPriceCents) ? Math.round(item.unitPriceCents) : 0, 0);
      const discountMode = (item.discountMode || "NONE") as DiscountMode;
      const discountValue = clampDiscountValue(discountMode, Number(item.discountValue ?? 0));
      const unitPriceCents = computeDiscountedUnitPrice(catalogBasePriceCents, discountMode, discountValue);

      return {
        ...item,
        label: normalizeOrderTitle(item.label),
        quantity,
        catalogBasePriceCents,
        discountMode,
        discountValue,
        unitPriceCents,
        lineTotalCents: quantity * unitPriceCents
      };
    });

  const totalCents = normalizedItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
  return { items: normalizedItems, totalCents };
}

export function assertPhaseTransition(
  currentPhase: MainPhase,
  nextPhase: MainPhase,
  balanceDueCents: number,
  overrideWithNote?: string
) {
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const nextIndex = phaseOrder.indexOf(nextPhase);

  if (currentIndex === -1 || nextIndex === -1) {
    throw new Error("Fase ordine non valida.");
  }

  const delta = nextIndex - currentIndex;
  if (delta === 0) {
    return;
  }

  if (Math.abs(delta) > 1) {
    throw new Error("Puoi spostare l'ordine solo di una fase alla volta.");
  }

  if (nextPhase === "CONSEGNATO" && balanceDueCents > 0 && !overrideWithNote?.trim()) {
    throw new Error("Per consegnare un ordine con saldo aperto serve una nota di override.");
  }
}

function getHistoryDescription(type: HistoryType, value: string) {
  switch (type) {
    case "CREATED":
      return "Ordine creato";
    case "UPDATED":
      return value || "Ordine aggiornato";
    case "PHASE_CHANGED":
      return value;
    case "STATUS_CHANGED":
      return value;
    case "PAYMENT_RECORDED":
      return value;
    case "ATTACHMENT_UPLOADED":
      return value;
    case "NOTE":
      return value;
    default:
      return value;
  }
}

async function ensureCustomer(tx: Prisma.TransactionClient, input: CreateOrderInput) {
  if (input.customerId) {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new Error("Cliente selezionato non trovato.");
    }
    return customer;
  }

  const name = input.customer.name?.trim();
  const phone = input.customer.phone?.trim();

  if (!name || !phone) {
    throw new Error("Per creare un nuovo cliente servono nome e telefono.");
  }

  return tx.customer.create({
    data: {
      name,
      phone,
      whatsapp: input.customer.whatsapp?.trim() || undefined,
      email: input.customer.email?.trim() || undefined,
      taxCode: input.customer.taxCode?.trim() || undefined,
      vatNumber: input.customer.vatNumber?.trim() || undefined,
      notes: input.customer.notes?.trim() || undefined
    }
  });
}

export async function createOrder(input: CreateOrderInput) {
  const title = normalizeOrderTitle(input.title);
  if (!title) {
    throw new Error("Il titolo ordine e obbligatorio.");
  }

  const { items, totalCents } = computeOrderTotals(input.items);
  if (!items.length) {
    throw new Error("Inserisci almeno una riga ordine valida.");
  }

  const createdAt = new Date();
  const createdOn = formatDateKey(createdAt);
  const titleNormalized = normalizeForUniqueness(title);
  const orderCode = buildOrderCode(createdAt, title);
  const initialDepositCents = Math.max(0, input.initialDepositCents ?? 0);

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.order.findUnique({
      where: {
        createdOn_titleNormalized: {
          createdOn,
          titleNormalized
        }
      }
    });

    if (duplicate) {
      throw new Error("Esiste gia un ordine con questo titolo nella data odierna.");
    }

    const customer = await ensureCustomer(tx, input);
    const paidCents = Math.min(initialDepositCents, totalCents);
    const balanceDueCents = computeBalanceDue(totalCents, paidCents);
    const paymentStatus = computePaymentStatus(totalCents, paidCents, paidCents > 0 ? 1 : 0);
    const appointmentAt = input.appointmentAt ?? undefined;
    const appointmentNote = appointmentAt ? input.appointmentNote?.trim() || undefined : undefined;

    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        orderCode,
        title,
        titleNormalized,
        createdOn,
        deliveryAt: input.deliveryAt,
        appointmentAt,
        appointmentNote,
        priority: input.priority,
        isQuote: Boolean(input.isQuote),
        notes: input.notes?.trim() || undefined,
        invoiceStatus: input.invoiceStatus,
        totalCents,
        depositCents: paidCents,
        paidCents,
        balanceDueCents,
        paymentStatus,
        items: {
          create: items.map((item) => ({
            label: item.label,
            description: item.description?.trim() || undefined,
            quantity: item.quantity,
            catalogBasePriceCents: item.catalogBasePriceCents,
            discountMode: item.discountMode,
            discountValue: item.discountValue,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
            format: item.format?.trim() || undefined,
            material: item.material?.trim() || undefined,
            finishing: item.finishing?.trim() || undefined,
            notes: item.notes?.trim() || undefined,
            serviceCatalogId: item.serviceCatalogId || undefined
          }))
        },
        history: {
          create: {
            type: "CREATED",
            description: getHistoryDescription("CREATED", ""),
            details: input.isQuote ? "Creato come preventivo" : undefined
          }
        }
      },
      include: {
        customer: true
      }
    });

    if (paidCents > 0) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          amountCents: paidCents,
          method: "CONTANTI",
          note: "Acconto iniziale"
        }
      });

      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          type: "PAYMENT_RECORDED",
          description: `Acconto registrato in creazione: ${paidCents / 100} EUR`
        }
      });
    }

    return order;
  });
}

export async function updateOrder(input: UpdateOrderInput) {
  const title = normalizeOrderTitle(input.title);
  if (!title) {
    throw new Error("Il titolo ordine e obbligatorio.");
  }

  const order = await prisma.order.findUnique({ where: { id: input.id } });
  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  const titleNormalized = normalizeForUniqueness(title);

  return prisma.$transaction(async (tx) => {
    if (titleNormalized !== order.titleNormalized) {
      const duplicate = await tx.order.findFirst({
        where: {
          createdOn: order.createdOn,
          titleNormalized,
          id: { not: order.id }
        }
      });

      if (duplicate) {
        throw new Error("Titolo non disponibile per la stessa data di creazione.");
      }
    }

    const nextIsQuote = Boolean(input.isQuote);
    const appointmentAt = input.appointmentAt ?? null;
    const appointmentNote = appointmentAt ? input.appointmentNote?.trim() || null : null;
    const updated = await tx.order.update({
      where: { id: input.id },
      data: {
        title,
        titleNormalized,
        deliveryAt: input.deliveryAt,
        appointmentAt,
        appointmentNote,
        priority: input.priority,
        notes: input.notes?.trim() || undefined,
        invoiceStatus: input.invoiceStatus,
        isQuote: nextIsQuote
      }
    });

    await tx.orderHistory.create({
      data: {
        orderId: input.id,
        type: "UPDATED",
        description: "Dettagli ordine aggiornati",
        details:
          order.isQuote !== nextIsQuote ? `Preventivo ${nextIsQuote ? "attivato" : "confermato"}` : undefined
      }
    });

    return updated;
  });
}

export async function updateCustomer(input: UpdateCustomerInput) {
  const name = input.name.trim();
  const phone = input.phone.trim();

  if (!name || !phone) {
    throw new Error("Nome e telefono sono obbligatori.");
  }

  return prisma.customer.update({
    where: { id: input.id },
    data: {
      name,
      phone,
      whatsapp: input.whatsapp?.trim() || undefined,
      email: input.email?.trim() || undefined,
      taxCode: input.taxCode?.trim() || undefined,
      vatNumber: input.vatNumber?.trim() || undefined,
      notes: input.notes?.trim() || undefined
    }
  });
}

export async function deleteCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orders: true
        }
      }
    }
  });

  if (!customer) {
    throw new Error("Cliente non trovato.");
  }

  if (customer._count.orders > 0) {
    throw new Error("Non puoi eliminare un cliente con ordini collegati.");
  }

  await prisma.customer.delete({
    where: { id }
  });
}

export async function updateOperationalStatus(orderId: string, status: OperationalStatus, note?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  const cleanNote = note?.trim() || undefined;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        operationalStatus: status,
        operationalNote: status === "ATTIVO" ? undefined : cleanNote
      }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "STATUS_CHANGED",
        description: `Stato operativo impostato su ${operationalStatusLabels[status]}`,
        details: cleanNote
      }
    });

    return updated;
  });
}

export async function transitionOrderPhase(orderId: string, nextPhase: MainPhase, overrideNote?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  assertPhaseTransition(order.mainPhase, nextPhase, order.balanceDueCents, overrideNote);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { mainPhase: nextPhase }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "PHASE_CHANGED",
        description: `Fase ordine aggiornata a ${mainPhaseLabels[nextPhase]}`,
        details: overrideNote?.trim() || undefined
      }
    });

    return updated;
  });
}

export async function recordPayment(orderId: string, amountCents: number, method: PaymentMethod, note?: string) {
  if (amountCents <= 0) {
    throw new Error("L'importo pagamento deve essere maggiore di zero.");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  return prisma.$transaction(async (tx) => {
    const existingPayments = await tx.payment.findMany({
      where: { orderId }
    });

    const payment = await tx.payment.create({
      data: {
        orderId,
        amountCents,
        method,
        note: note?.trim() || undefined
      }
    });

    const summary = computePaymentSummary(order.totalCents, [...existingPayments, payment]);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paidCents: summary.paidCents,
        balanceDueCents: summary.balanceDueCents,
        paymentStatus: summary.paymentStatus,
        depositCents: summary.depositCents
      }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "PAYMENT_RECORDED",
        description: `Pagamento registrato: ${(amountCents / 100).toFixed(2)} EUR`,
        details: note?.trim() || undefined
      }
    });

    return updated;
  });
}

export async function correctPayment(
  orderId: string,
  paymentId: string,
  amountCents: number,
  method: PaymentMethod,
  note?: string
) {
  if (amountCents <= 0) {
    throw new Error("L'importo pagamento deve essere maggiore di zero.");
  }

  return prisma.$transaction(async (tx) => {
    const [order, originalPayment, existingPayments] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId } }),
      tx.payment.findUnique({ where: { id: paymentId } }),
      tx.payment.findMany({ where: { orderId } })
    ]);

    if (!order) {
      throw new Error("Ordine non trovato.");
    }

    if (!originalPayment || originalPayment.orderId !== orderId) {
      throw new Error("Pagamento non trovato.");
    }

    if (originalPayment.status !== "ATTIVO") {
      throw new Error("Puoi correggere solo un pagamento attivo.");
    }

    if (existingPayments.some((payment) => payment.correctedPaymentId === paymentId)) {
      throw new Error("Questo pagamento e gia stato corretto.");
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SOSTITUITO" }
    });

    const correction = await tx.payment.create({
      data: {
        orderId,
        amountCents,
        method,
        note: note?.trim() || `Correzione pagamento ${paymentId}`,
        correctedPaymentId: paymentId
      }
    });

    const summary = computePaymentSummary(order.totalCents, [
      ...existingPayments.map((payment) =>
        payment.id === paymentId ? { ...payment, status: "SOSTITUITO" as PaymentEntryStatus } : payment
      ),
      correction
    ]);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paidCents: summary.paidCents,
        balanceDueCents: summary.balanceDueCents,
        paymentStatus: summary.paymentStatus,
        depositCents: summary.depositCents
      }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "PAYMENT_RECORDED",
        description: `Pagamento corretto: ${(amountCents / 100).toFixed(2)} EUR`,
        details: `Rettifica del pagamento ${paymentId}${note?.trim() ? ` - ${note.trim()}` : ""}`
      }
    });

    return updated;
  });
}

export async function updateOrderQuoteFlag(orderId: string, isQuote: boolean) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { isQuote }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "UPDATED",
        description: isQuote ? "Ordine segnato come preventivo" : "Preventivo confermato",
        details: isQuote
          ? "Escluso dal flusso operativo fino a conferma"
          : "Ordine rientrato nel flusso operativo"
      }
    });

    return updated;
  });
}

export async function registerAttachment(orderId: string, fileName: string, filePath: string, mimeType: string, sizeBytes: number) {
  return prisma.$transaction(async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        orderId,
        fileName,
        filePath,
        mimeType,
        sizeBytes
      }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "ATTACHMENT_UPLOADED",
        description: `Allegato caricato: ${fileName}`
      }
    });

    return attachment;
  });
}

export async function deleteOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      attachments: true
    }
  });

  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  await prisma.order.delete({
    where: { id }
  });

  return order;
}

export async function getWhatsappLink(orderId: string, options?: { requireReady?: boolean }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true
    }
  });

  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  if (options?.requireReady && order.mainPhase !== "SVILUPPO_COMPLETATO") {
    throw new Error("Il messaggio WhatsApp e disponibile solo per ordini pronti.");
  }

  const phone = (order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, "");
  if (!phone) {
    throw new Error("Il cliente non ha un numero WhatsApp valido.");
  }

  const template = await getWhatsappTemplate();
  const text = template
    .replaceAll("{nome_cliente}", order.customer.name)
    .replaceAll("{order_code}", order.orderCode)
    .replaceAll("{titolo_ordine}", order.title);

  return `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

export async function markOrderReady(orderId: string) {
  await transitionOrderPhase(orderId, "SVILUPPO_COMPLETATO");
}

export function normalizeServiceCode(code: string) {
  const normalized = code
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    throw new Error("Il codice servizio e obbligatorio.");
  }

  return normalized;
}

function buildUniqueServiceCode(base: string, usedCodes: Set<string>) {
  let candidate = base || "SERVIZIO";
  let index = 2;

  while (usedCodes.has(candidate)) {
    candidate = `${base || "SERVIZIO"}_${index}`;
    index += 1;
  }

  usedCodes.add(candidate);
  return candidate;
}

async function ensureServiceCodes() {
  const services = await prisma.serviceCatalog.findMany({
    select: {
      id: true,
      code: true,
      name: true
    },
    orderBy: { createdAt: "asc" }
  });

  const missing = services.filter((service) => !service.code?.trim());
  if (!missing.length) {
    return;
  }

  const usedCodes = new Set(
    services
      .map((service) => service.code?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toUpperCase())
  );

  for (const service of missing) {
    const generated = buildUniqueServiceCode(
      normalizeServiceCode(service.name || "SERVIZIO"),
      usedCodes
    );

    await prisma.serviceCatalog.update({
      where: { id: service.id },
      data: { code: generated }
    });
  }
}

export async function createService(
  code: string,
  name: string,
  description: string | undefined,
  basePriceCents: number,
  quantityTiers?: string
) {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error("Il nome servizio e obbligatorio.");
  }

  const normalizedCode = normalizeServiceCode(code);
  const existing = await prisma.serviceCatalog.findUnique({
    where: { code: normalizedCode }
  });

  if (existing) {
    throw new Error("Esiste gia un servizio con questo codice.");
  }

  return prisma.serviceCatalog.create({
    data: {
      code: normalizedCode,
      name: cleanName,
      description: description?.trim() || undefined,
      basePriceCents: Math.max(0, basePriceCents),
      quantityTiers: normalizeQuantityTiers(quantityTiers)
    }
  });
}

export async function updateServiceCatalogEntry(input: {
  id: string;
  code: string;
  name: string;
  description?: string;
  basePriceCents: number;
  quantityTiers?: string;
  active: boolean;
}) {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error("Il nome servizio e obbligatorio.");
  }

  const normalizedCode = normalizeServiceCode(input.code);
  const existing = await prisma.serviceCatalog.findFirst({
    where: {
      code: normalizedCode,
      id: { not: input.id }
    }
  });

  if (existing) {
    throw new Error("Esiste gia un servizio con questo codice.");
  }

  return prisma.serviceCatalog.update({
    where: { id: input.id },
    data: {
      code: normalizedCode,
      name: cleanName,
      description: input.description?.trim() || undefined,
      basePriceCents: Math.max(0, input.basePriceCents),
      quantityTiers: normalizeQuantityTiers(input.quantityTiers),
      active: input.active
    }
  });
}

export async function syncServiceCatalogEntries(rows: ServiceCatalogImportRow[]) {
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.serviceCatalog.findUnique({
        where: { code: row.code }
      });

      if (existing) {
        await tx.serviceCatalog.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            description: row.description,
            basePriceCents: row.basePriceCents,
            quantityTiers: normalizeQuantityTiers(row.quantityTiers),
            active: row.active
          }
        });
        updated += 1;
        continue;
      }

      await tx.serviceCatalog.create({
        data: {
          code: row.code,
          name: row.name,
          description: row.description,
          basePriceCents: row.basePriceCents,
          quantityTiers: normalizeQuantityTiers(row.quantityTiers),
          active: row.active
        }
      });
      created += 1;
    }
  });

  return { created, updated };
}

export async function getDashboardData() {
  const now = new Date();
  const [todayOrders, overdueOrders, blockedOrders, readyOrders, balanceOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...operationalOrderWhere(),
        mainPhase: { not: "CONSEGNATO" },
        deliveryAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        }
      },
      include: { customer: true },
      orderBy: [{ priority: "desc" }, { deliveryAt: "asc" }]
    }),
    prisma.order.findMany({
      where: {
        ...operationalOrderWhere(),
        deliveryAt: { lt: now },
        mainPhase: { not: "CONSEGNATO" }
      },
      include: { customer: true },
      orderBy: { deliveryAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
        ...operationalOrderWhere(),
        operationalStatus: { not: "ATTIVO" },
        mainPhase: { not: "CONSEGNATO" }
      },
      include: { customer: true },
      orderBy: { deliveryAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
        ...operationalOrderWhere(),
        mainPhase: "SVILUPPO_COMPLETATO"
      },
      include: { customer: true },
      orderBy: { deliveryAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
        ...operationalOrderWhere(),
        balanceDueCents: { gt: 0 },
        mainPhase: { not: "CONSEGNATO" }
      },
      include: { customer: true },
      orderBy: [{ balanceDueCents: "desc" }, { deliveryAt: "asc" }]
    })
  ]);

  return {
    todayOrders,
    overdueOrders,
    blockedOrders,
    readyOrders,
    balanceOrders
  };
}

export async function getSalesStats(options?: { months?: number; referenceDate?: Date }) {
  const orders = await prisma.order.findMany({
    where: operationalOrderWhere(),
    select: {
      id: true,
      isQuote: true,
      createdAt: true,
      totalCents: true,
      items: {
        select: {
          label: true,
          quantity: true,
          lineTotalCents: true,
          serviceCatalogId: true,
          serviceCatalog: {
            select: {
              code: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return buildSalesStatsReport(orders, options);
}

export async function getOrdersList(filters: {
  query?: string;
  phase?: PhaseFilter;
  status?: StatusFilter;
  payment?: PaymentFilter;
  invoice?: InvoiceFilter;
  priority?: PriorityFilter;
  quote?: QuoteFilter;
}) {
  const query = filters.query?.trim();

  return prisma.order.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { orderCode: { contains: query } },
              { title: { contains: query } },
              { customer: { name: { contains: query } } },
              { customer: { phone: { contains: query } } }
            ]
          }
        : {}),
      ...(filters.phase && filters.phase !== "ALL" ? { mainPhase: filters.phase } : {}),
      ...(filters.status && filters.status !== "ALL" ? { operationalStatus: filters.status } : {}),
      ...(filters.payment && filters.payment !== "ALL" ? { paymentStatus: filters.payment } : {}),
      ...(filters.invoice && filters.invoice !== "ALL" ? { invoiceStatus: filters.invoice } : {}),
      ...(filters.priority && filters.priority !== "ALL" ? { priority: filters.priority } : {}),
      ...(filters.quote === "QUOTE" ? { isQuote: true } : {}),
      ...(filters.quote === "ORDER" ? { isQuote: false } : {})
    },
    include: {
      customer: true
    },
    orderBy: [{ deliveryAt: "asc" }, { priority: "desc" }]
  });
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          serviceCatalog: true
        }
      },
      attachments: {
        orderBy: { createdAt: "desc" }
      },
      payments: {
        include: {
          correctedPayment: true,
          correction: true
        },
        orderBy: { createdAt: "asc" }
      },
      history: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function getCalendarOrders() {
  return prisma.order.findMany({
    where: operationalOrderWhere(),
    include: { customer: true },
    orderBy: [{ deliveryAt: "asc" }, { priority: "desc" }]
  });
}

export async function getProductionQueues() {
  const orders = await prisma.order.findMany({
    where: {
      ...operationalOrderWhere(),
      mainPhase: { not: "CONSEGNATO" }
    },
    include: { customer: true },
    orderBy: [{ priority: "desc" }, { deliveryAt: "asc" }]
  });

  return classifyProductionQueues(orders);
}

export async function getServices() {
  await ensureServiceCodes();
  return prisma.serviceCatalog.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
  });
}

export async function getServiceCatalogAdmin() {
  await ensureServiceCodes();
  return prisma.serviceCatalog.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
}

export async function getCustomers() {
  return prisma.customer.findMany({
    include: {
      orders: {
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { name: "asc" }
  });
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: [{ createdAt: "desc" }]
      }
    }
  });
}
