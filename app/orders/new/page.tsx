import { createOrderAction } from "@/app/actions";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getCustomers, getOrderCopyDraftSource, getServices } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function NewOrderPage({
  searchParams
}: {
  searchParams?: { copyFrom?: string; customerId?: string; continuation?: string };
}) {
  await requireAuth();
  const copyFrom = searchParams?.copyFrom?.trim() || "";
  const [customers, services, copyDraft] = await Promise.all([
    getCustomers(),
    getServices(),
    copyFrom ? getOrderCopyDraftSource(copyFrom) : Promise.resolve(null)
  ]);
  const initialCustomerId = searchParams?.customerId?.trim() || undefined;
  const continuation = searchParams?.continuation === "created" || searchParams?.continuation === "updated"
    ? searchParams.continuation
    : null;
  const continuationTitle = continuation === "updated" ? "Modifiche salvate" : continuation === "created" ? "Ordine salvato" : null;

  return (
    <div className="stack order-entry-page-shell order-create-page-shell">
      <PageHeader title="Nuovo ordine" />
      {continuationTitle ? (
        <section className="order-draft-banner order-entry-followup-banner">
          <div className="stack">
            <strong>{continuationTitle}</strong>
          </div>
        </section>
      ) : null}
      {copyDraft ? (
        <section className="order-draft-banner order-copy-source-banner">
          <div className="stack">
            <strong>Righe copiate</strong>
            <span className="subtle">{`${copyDraft.sourceLabel} - ${copyDraft.lineCount} ${copyDraft.lineCount === 1 ? "riga" : "righe"}`}</span>
          </div>
        </section>
      ) : null}
      <OrderForm
        action={createOrderAction}
        customers={customers}
        initialDraft={copyDraft || undefined}
        initialCustomerId={initialCustomerId}
        kind="order"
        services={services}
      />
    </div>
  );
}
