import {
  completePurchaseNoteAction,
  createPurchaseNoteAction,
  deletePurchaseNoteAction,
  reopenPurchaseNoteAction,
  updatePurchaseNoteAction
} from "@/app/actions";
import { PurchaseNotesWorkspace } from "@/components/purchase-notes-workspace";
import { requireAuth } from "@/lib/auth";
import { getCustomers } from "@/lib/orders";
import { getPurchaseNotes } from "@/lib/purchase-notes";
import { serializePurchaseNote } from "@/lib/purchase-note-utils";

export const dynamic = "force-dynamic";

export default async function PurchaseNotesPage() {
  await requireAuth();

  const [customers, purchaseNotes] = await Promise.all([getCustomers(), getPurchaseNotes()]);

  return (
    <PurchaseNotesWorkspace
      completeAction={completePurchaseNoteAction}
      completedNotes={purchaseNotes.completed.map(serializePurchaseNote)}
      createAction={createPurchaseNoteAction}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        whatsapp: customer.whatsapp,
        email: customer.email,
        pec: customer.pec,
        taxCode: customer.taxCode,
        vatNumber: customer.vatNumber,
        uniqueCode: customer.uniqueCode,
        type: customer.type,
        orderCount: customer.orders.length
      }))}
      deleteAction={deletePurchaseNoteAction}
      pendingNotes={purchaseNotes.pending.map(serializePurchaseNote)}
      reopenAction={reopenPurchaseNoteAction}
      updateAction={updatePurchaseNoteAction}
    />
  );
}
