import { HistoryBackButton } from "@/components/history-back-button";
import { OrdersRecentActivity } from "@/components/orders-recent-activity";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getOrderRecentActivityFeed } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrdersActivityPage() {
  await requireAuth();
  const recentActivity = await getOrderRecentActivityFeed({ limit: 20, invoiceLimit: 20 });

  return (
    <div className="stack orders-activity-page-shell">
      <PageHeader
        title="Cronologia ordini"
        description="Ultimi cambi fatturazione e ultime modifiche operative sugli ordini, con annullamento rapido dove disponibile."
        action={<HistoryBackButton className="button ghost" fallbackHref="/orders" label="Torna agli ordini" />}
      />

      <OrdersRecentActivity
        recentChanges={recentActivity.recentChanges}
        recentInvoiceChanges={recentActivity.recentInvoiceChanges}
        returnTo="/orders/activity#orders-recent-activity"
      />
    </div>
  );
}
