import { DashboardPage } from "@/components/dashboard-page";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    panel?: string;
  };
};

export default async function Page({ searchParams }: Props) {
  await requireAuth();
  return <DashboardPage panel={searchParams?.panel} />;
}
