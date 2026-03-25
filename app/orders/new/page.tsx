import { createOrderAction } from "@/app/actions";
import { OrderForm } from "@/components/order-form";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getCustomers, getServices } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireAuth();
  const [customers, services] = await Promise.all([getCustomers(), getServices()]);

  return (
    <div className="stack">
      <PageHeader
        title="Nuovo ordine"
        description="Crea un ordine completo con cliente, righe catalogo o personalizzate, consegna, appuntamento e acconto."
      />
      <OrderForm customers={customers} services={services} action={createOrderAction} />
    </div>
  );
}
