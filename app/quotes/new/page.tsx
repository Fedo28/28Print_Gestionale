import { createQuoteAction } from "@/app/actions";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getCustomers, getServices } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  await requireAuth();
  const [customers, services] = await Promise.all([getCustomers(), getServices()]);

  return (
    <div className="stack">
      <PageHeader
        title="Nuovo preventivo"
        description="Crea un preventivo dedicato senza sporcare il flusso ordini operativo."
      />
      <OrderForm action={createQuoteAction} customers={customers} kind="quote" services={services} />
    </div>
  );
}
