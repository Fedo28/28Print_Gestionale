import {
  HistoryType,
  InvoiceStatus,
  MainPhase,
  OperationalStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Priority
} from "@prisma/client";
import { phaseOrder } from "@/lib/constants";
import { formatDateKey } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getWhatsappTemplate } from "@/lib/settings";

export type OrderItemInput = {
  label: string;
  description?: string;
  quantity: number;
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
  priority: Priority;
  notes?: string;
  invoiceStatus: InvoiceStatus;
  items: OrderItemInput[];
  initialDepositCents?: number;
};

export type UpdateOrderInput = {
  id: string;
  title: string;
  deliveryAt: Date;
  priority: Priority;
  notes?: string;
  invoiceStatus: InvoiceStatus;
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

export function computeOrderTotals(items: OrderItemInput[]) {
  const normalizedItems = items
    .filter((item) => normalizeOrderTitle(item.label).length > 0)
    .map((item) => {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.round(item.quantity) : 1;
      const unitPriceCents =
        Number.isFinite(item.unitPriceCents) && item.unitPriceCents > 0 ? Math.round(item.unitPriceCents) : 0;

      return {
        ...item,
        label: normalizeOrderTitle(item.label),
        quantity,
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

    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        orderCode,
        title,
        titleNormalized,
        createdOn,
        deliveryAt: input.deliveryAt,
        priority: input.priority,
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
            description: getHistoryDescription("CREATED", "")
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

    const updated = await tx.order.update({
      where: { id: input.id },
      data: {
        title,
        titleNormalized,
        deliveryAt: input.deliveryAt,
        priority: input.priority,
        notes: input.notes?.trim() || undefined,
        invoiceStatus: input.invoiceStatus
      }
    });

    await tx.orderHistory.create({
      data: {
        orderId: input.id,
        type: "UPDATED",
        description: "Dettagli ordine aggiornati"
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { operationalStatus: status }
    });

    await tx.orderHistory.create({
      data: {
        orderId,
        type: "STATUS_CHANGED",
        description: `Stato operativo impostato su ${status}`,
        details: note?.trim() || undefined
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
        description: `Fase ordine aggiornata a ${nextPhase}`,
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
    const existingPaymentCount = await tx.payment.count({
      where: { orderId }
    });

    await tx.payment.create({
      data: {
        orderId,
        amountCents,
        method,
        note: note?.trim() || undefined
      }
    });

    const paidCents = order.paidCents + amountCents;
    const balanceDueCents = computeBalanceDue(order.totalCents, paidCents);
    const paymentStatus = computePaymentStatus(order.totalCents, paidCents, existingPaymentCount + 1);

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        paidCents,
        balanceDueCents,
        paymentStatus,
        depositCents: order.depositCents === 0 ? Math.min(amountCents, order.totalCents) : order.depositCents
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
    where: { id }
  });

  if (!order) {
    throw new Error("Ordine non trovato.");
  }

  await prisma.order.delete({
    where: { id }
  });

  return order;
}

export async function getWhatsappLink(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true
    }
  });

  if (!order) {
    throw new Error("Ordine non trovato.");
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
  const whatsappUrl = await getWhatsappLink(orderId);

  return { whatsappUrl };
}

export async function createService(name: string, description: string | undefined, basePriceCents: number) {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error("Il nome servizio e obbligatorio.");
  }

  return prisma.serviceCatalog.create({
    data: {
      name: cleanName,
      description: description?.trim() || undefined,
      basePriceCents: Math.max(0, basePriceCents)
    }
  });
}

export async function getDashboardData() {
  const now = new Date();
  const [todayOrders, overdueOrders, blockedOrders, readyOrders, balanceOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
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
        deliveryAt: { lt: now },
        mainPhase: { not: "CONSEGNATO" }
      },
      include: { customer: true },
      orderBy: { deliveryAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
        operationalStatus: { not: "ATTIVO" },
        mainPhase: { not: "CONSEGNATO" }
      },
      include: { customer: true },
      orderBy: { deliveryAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
        mainPhase: "SVILUPPO_COMPLETATO"
      },
      include: { customer: true },
      orderBy: { deliveryAt: "asc" }
    }),
    prisma.order.findMany({
      where: {
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

export async function getOrdersList(filters: {
  query?: string;
  phase?: MainPhase | "ALL";
  status?: OperationalStatus | "ALL";
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
      ...(filters.status && filters.status !== "ALL" ? { operationalStatus: filters.status } : {})
    },
    include: {
      customer: true,
      payments: true
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
        orderBy: { createdAt: "desc" }
      },
      history: {
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function getCalendarOrders() {
  return prisma.order.findMany({
    include: { customer: true },
    orderBy: [{ deliveryAt: "asc" }, { priority: "desc" }]
  });
}

export async function getProductionQueues() {
  const orders = await prisma.order.findMany({
    where: {
      mainPhase: { not: "CONSEGNATO" }
    },
    include: { customer: true },
    orderBy: [{ priority: "desc" }, { deliveryAt: "asc" }]
  });

  return {
    toStart: orders.filter((order) => order.mainPhase === "CALENDARIZZATO"),
    working: orders.filter((order) => order.mainPhase === "IN_LAVORAZIONE"),
    blocked: orders.filter((order) => order.operationalStatus !== "ATTIVO"),
    ready: orders.filter((order) => order.mainPhase === "SVILUPPO_COMPLETATO")
  };
}

export async function getServices() {
  return prisma.serviceCatalog.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
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
