import { createQuoteAction } from "@/app/actions";
import { OrderDraftHeaderAction } from "@/components/order-draft-header-action";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getCustomers, getServices } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams
}: {
  searchParams?: { customerId?: string; continuation?: string };
}) {
  await requireAuth();
  const [customers, services] = await Promise.all([getCustomers(), getServices()]);
  const initialCustomerId = searchParams?.customerId?.trim() || undefined;
  const continuation = searchParams?.continuation === "created" || searchParams?.continuation === "updated"
    ? searchParams.continuation
    : null;
  const continuationTitle = continuation === "updated" ? "Modifiche salvate" : continuation === "created" ? "Preventivo salvato" : null;

  return (
    <div className="stack order-entry-page-shell quote-create-page-shell">
      <PageHeader action={<OrderDraftHeaderAction kind="quote" />} title="Nuovo preventivo" />
      {continuationTitle ? (
        <section className="order-draft-banner order-entry-followup-banner">
          <div className="stack">
            <strong>{continuationTitle}</strong>
          </div>
        </section>
      ) : null}
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
