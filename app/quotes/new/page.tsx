import { createQuoteAction } from "@/app/actions";
import { OrderDraftHeaderAction } from "@/components/order-draft-header-action";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getCustomers, getServices } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams?: { customerId?: string } }) {
  await requireAuth();
  const [customers, services] = await Promise.all([getCustomers(), getServices()]);
  const initialCustomerId = searchParams?.customerId?.trim() || undefined;

  return (
    <div className="stack order-entry-page-shell quote-create-page-shell">
      <PageHeader action={<OrderDraftHeaderAction kind="quote" />} title="Nuovo preventivo" />
      <OrderForm
        action={createQuoteAction}
        customers={customers}
        initialCustomerId={initialCustomerId}
        kind="quote"
        services={services}
      />
    </div>
  );
}
