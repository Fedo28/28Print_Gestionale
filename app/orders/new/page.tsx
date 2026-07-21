import { createOrderAction } from "@/app/actions";
import { OrderDraftHeaderAction } from "@/components/order-draft-header-action";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getCustomers, getServices } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
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
  const continuationCustomer = initialCustomerId ? customers.find((customer) => customer.id === initialCustomerId) || null : null;
  const continuationTitle = continuation === "updated" ? "Modifiche salvate" : continuation === "created" ? "Ordine salvato" : null;
  const continuationMessage = continuation
    ? continuationCustomer
      ? `Stai gia inserendo il prossimo ordine per ${continuationCustomer.name}.`
      : "Puoi compilare subito il prossimo ordine."
    : null;

  return (
    <div className="stack order-entry-page-shell order-create-page-shell">
      <PageHeader action={<OrderDraftHeaderAction kind="order" />} title="Nuovo ordine" />
      {continuationTitle && continuationMessage ? (
        <section className="order-draft-banner order-entry-followup-banner">
          <div className="stack">
            <strong>{continuationTitle}</strong>
            <span className="subtle">{continuationMessage}</span>
          </div>
        </section>
      ) : null}
      <OrderForm
        action={createOrderAction}
        customers={customers}
        initialCustomerId={initialCustomerId}
        kind="order"
        services={services}
      />
    </div>
  );
}
