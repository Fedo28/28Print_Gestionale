import { DashboardPage } from "@/components/dashboard-page";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAuth();
  return <DashboardPage />;
}
