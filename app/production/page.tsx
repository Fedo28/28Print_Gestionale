import { PageHeader } from "@/components/page-header";
import { ProductionBoard } from "@/components/production-board";
import { requireAuth } from "@/lib/auth";
import { getProductionQueues } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  await requireAuth();
  const queues = await getProductionQueues();

  return (
    <div className="stack production-page-shell">
      <PageHeader title="Produzione" />
      <ProductionBoard queues={queues} />
    </div>
  );
}
