import type { Prisma, PurchaseNoteUrgency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizePurchaseNoteContent,
  normalizePurchaseNoteCustomerName,
  sortCompletedPurchaseNotes,
  sortPendingPurchaseNotes
} from "@/lib/purchase-note-utils";

type PurchaseNoteDbClient = Prisma.TransactionClient | typeof prisma;

const purchaseNoteSelect = {
  id: true,
  customerId: true,
  customerName: true,
  order: {
    select: {
      id: true,
      orderCode: true,
      title: true,
      operationalStatus: true
    }
  },
  content: true,
  urgency: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true
} satisfies Prisma.PurchaseNoteSelect;

export type PurchaseNoteInput = {
  customerId?: string;
  orderId?: string;
  customerName: string;
  content: string;
  urgency: PurchaseNoteUrgency;
};

export type UpdatePurchaseNoteInput = PurchaseNoteInput & {
  id: string;
};

export async function getPurchaseNotes() {
  const notes = await prisma.purchaseNote.findMany({
    select: purchaseNoteSelect,
    orderBy: [{ createdAt: "desc" }]
  });

  return {
    pending: sortPendingPurchaseNotes(notes.filter((note) => !note.completedAt)),
    completed: sortCompletedPurchaseNotes(notes.filter((note) => Boolean(note.completedAt)))
  };
}

async function resolveLinkedOrder(db: PurchaseNoteDbClient, rawOrderId: string | undefined) {
  const orderId = rawOrderId?.trim() || "";
  if (!orderId) {
    return null;
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customer: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Ordine collegato non trovato.");
  }

  return order;
}

async function resolvePurchaseNoteCustomer(db: PurchaseNoteDbClient, input: PurchaseNoteInput) {
  const linkedOrder = await resolveLinkedOrder(db, input.orderId);
  if (linkedOrder) {
    return {
      orderId: linkedOrder.id,
      customerId: linkedOrder.customer.id,
      customerName: linkedOrder.customer.name
    };
  }

  if (!input.customerId) {
    return {
      orderId: null,
      customerId: null,
      customerName: normalizePurchaseNoteCustomerName(input.customerName)
    };
  }

  const customer = await db.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, name: true }
  });

  if (!customer) {
    throw new Error("Cliente non trovato.");
  }

  return {
    orderId: null,
    customerId: customer.id,
    customerName: customer.name
  };
}

export async function createPurchaseNote(input: PurchaseNoteInput, db: PurchaseNoteDbClient = prisma) {
  const content = normalizePurchaseNoteContent(input.content);
  if (!content) {
    throw new Error("Inserisci cosa ordinare.");
  }

  const customer = await resolvePurchaseNoteCustomer(db, input);
  if (!customer.customerName) {
    throw new Error("Il cliente e obbligatorio.");
  }

  return db.purchaseNote.create({
    data: {
      orderId: customer.orderId,
      customerId: customer.customerId,
      customerName: customer.customerName,
      content,
      urgency: input.urgency
    },
    select: purchaseNoteSelect
  });
}

export async function updatePurchaseNote(input: UpdatePurchaseNoteInput, db: PurchaseNoteDbClient = prisma) {
  const id = input.id.trim();
  if (!id) {
    throw new Error("Nota non valida.");
  }

  const content = normalizePurchaseNoteContent(input.content);
  if (!content) {
    throw new Error("Inserisci cosa ordinare.");
  }

  const customer = await resolvePurchaseNoteCustomer(db, input);
  if (!customer.customerName) {
    throw new Error("Il cliente e obbligatorio.");
  }

  return db.purchaseNote.update({
    where: { id },
    data: {
      orderId: customer.orderId,
      customerId: customer.customerId,
      customerName: customer.customerName,
      content,
      urgency: input.urgency
    },
    select: purchaseNoteSelect
  });
}

export async function completePurchaseNote(noteId: string, db: PurchaseNoteDbClient = prisma) {
  const id = noteId.trim();
  if (!id) {
    throw new Error("Nota non valida.");
  }

  return db.purchaseNote.update({
    where: { id },
    data: {
      completedAt: new Date()
    },
    select: purchaseNoteSelect
  });
}

export async function reopenPurchaseNote(noteId: string, db: PurchaseNoteDbClient = prisma) {
  const id = noteId.trim();
  if (!id) {
    throw new Error("Nota non valida.");
  }

  return db.purchaseNote.update({
    where: { id },
    data: {
      completedAt: null
    },
    select: purchaseNoteSelect
  });
}

export async function deletePurchaseNote(noteId: string) {
  const id = noteId.trim();
  if (!id) {
    throw new Error("Nota non valida.");
  }

  return prisma.purchaseNote.delete({
    where: { id },
    select: {
      id: true,
      orderId: true
    }
  });
}

export async function upsertOrderMaterialPurchaseNote(
  input: {
    orderId: string;
    content: string;
    urgency: PurchaseNoteUrgency;
  },
  db: PurchaseNoteDbClient = prisma
) {
  const content = normalizePurchaseNoteContent(input.content);
  if (!content) {
    throw new Error("Inserisci il materiale da ordinare.");
  }

  const order = await resolveLinkedOrder(db, input.orderId);
  if (!order) {
    throw new Error("Ordine collegato non trovato.");
  }

  const existing = await db.purchaseNote.findFirst({
    where: {
      orderId: order.id,
      completedAt: null
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true }
  });

  const data = {
    orderId: order.id,
    customerId: order.customer.id,
    customerName: order.customer.name,
    content,
    urgency: input.urgency
  };

  if (existing) {
    return db.purchaseNote.update({
      where: { id: existing.id },
      data,
      select: purchaseNoteSelect
    });
  }

  return db.purchaseNote.create({
    data,
    select: purchaseNoteSelect
  });
}
