import { PageHeader } from "@/components/page-header";
import { ProductionBoard } from "@/components/production-board";
import { WorkspaceLiveRefresh } from "@/components/workspace-live-refresh";
import { requireAuth } from "@/lib/auth";
import { getProductionQueues } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const session = await requireAuth();
  const queues = await getProductionQueues();

  return (
    <div className="stack production-page-shell">
      <WorkspaceLiveRefresh />
      <PageHeader title="Produzione" />
      <ProductionBoard queues={queues} currentUserId={session.userId} />
    </div>
  );
}
