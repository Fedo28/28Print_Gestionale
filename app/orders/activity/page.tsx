import { HistoryBackButton } from "@/components/history-back-button";
import { OrdersRecentActivity } from "@/components/orders-recent-activity";
import { PageHeader } from "@/components/page-header";
import { requireAuth } from "@/lib/auth";
import { getOrderRecentActivityFeed } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrdersActivityPage({
  searchParams
}: {
  searchParams?: {
    type?: string | string[];
  };
}) {
  await requireAuth();
  const recentActivity = await getOrderRecentActivityFeed({ limit: 80, invoiceLimit: 80 });

  return (
    <div className="stack orders-activity-page-shell">
      <PageHeader
        title="Cronologia ordini"
        action={<HistoryBackButton className="button ghost" fallbackHref="/orders" label="Torna agli ordini" />}
      />

      <OrdersRecentActivity
        activeType={searchParams?.type}
        recentChanges={recentActivity.recentChanges}
        recentInvoiceChanges={recentActivity.recentInvoiceChanges}
        returnTo="/orders/activity#orders-recent-activity"
      />
    </div>
  );
}
